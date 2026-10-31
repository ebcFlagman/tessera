# Integrationskonzept

Wie Umsysteme angebunden werden und wie importierte Daten mit manuell gepflegten Daten
zusammenspielen. **Stand:** umgesetzt. Geprüft mit aufgezeichneten Antworten und einer lokalen Attrappe der Quelle; ein Test gegen die echten Dienste steht aus.
Entscheidungen: [ADR 0006](adr/0006-connector-plugin-interface.md),
[ADR 0007](adr/0007-import-reconciliation-and-field-origin.md),
[ADR 0009](adr/0009-secrets-handling.md).

## Grundsatz

Tessera holt Daten **aus den APIs der Umsysteme** (Polling). Jede Quelle ist ein Connector hinter
einer gemeinsamen Schnittstelle. Der Kern kennt nur diese Schnittstelle, nie eine konkrete Quelle.

## Connector-Schnittstelle

Verbindliche Beschreibung: [contracts/connector-interface.md](../../specs/001-tech-debt-management/contracts/connector-interface.md).

| Operation        | Zweck                                                                                                                    |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `testConnection` | Zugangsdaten und Erreichbarkeit prüfen (Admin-Aktion „Verbindung testen“)                                                |
| `fetchFindings`  | alle offenen Befunde seitenweise liefern; das Listing muss **vollständig** sein, sonst wirft der Connector (siehe unten) |
| `mapToDebt`      | Rohbefund auf einen Schuldenentwurf abbilden (Titel, Beschreibung, Art, Aufwandsschätzung)                               |

Regeln:

- Befunde haben eine **stabile externe ID** (`externalId`).
- Connectoren **schreiben nie in die Datenbank** und sehen Zugangsdaten nur über ihren Kontext.
- Fehler sind typisiert: `Unreachable`, `InvalidCredentials`, `PartialData`. Rate-Limits (HTTP 429)
  werden mit `retryAfter` gemeldet; der Worker pausiert.
- Pro Quelle gibt es Fixture-Tests mit aufgezeichneten Antworten (Seitenwechsel, 429, ungültige Zugangsdaten).

### Quellen in Version 1

| Quelle       | Schnittstelle | Importiert                                                                             |
| ------------ | ------------- | -------------------------------------------------------------------------------------- |
| SonarCloud   | Web-API       | Issues (Code Smells, Vulnerabilities), Security Hotspots, Duplikat-Metriken je Projekt |
| GitLab Cloud | REST-API      | Issues mit konfigurierbarem Label (z. B. `tech-debt`), optional Code-Quality-Berichte  |

## Vollständige Listings

Ob ein Befund „in der Quelle behoben“ ist, erkennt Tessera daran, dass er im Listing fehlt. Deshalb
holt jeder Lauf **alle** offenen Befunde (kein inkrementeller Abruf), und der Abgleich beginnt erst,
wenn das Listing vollständig vorliegt. Bricht die Quelle mittendrin ab, antwortet sie mit Fehlern oder
nennt sie mehr Befunde, als sie ausliefern kann (SonarCloud: über 10.000), schlägt der Lauf fehl und
ändert **nichts** (`PartialData`).

## Eindeutigkeit und Idempotenz

Ein Befund ist eindeutig über **(Integration, externe Befund-ID)**. Ein Importlauf ist deshalb
wiederholbar: derselbe Lauf zweimal ausgeführt erzeugt keine Duplikate.

## Abgleich pro Lauf

| Situation                                          | Reaktion                                                                                                                  |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Befund neu                                         | Schuld anlegen, Verlaufseintrag „importiert“ (Urheber: System)                                                            |
| Befund vorhanden                                   | nur **quellgeführte** Felder aktualisieren                                                                                |
| Befund in der Quelle nicht mehr vorhanden          | Schuld auf **„getilgt“** setzen, Verlauf vermerkt „in Quelle behoben“ samt vorherigem Status und Importzeitpunkt          |
| Befund taucht später wieder auf                    | Schuld wieder öffnen                                                                                                      |
| Quelle nicht erreichbar oder Zugangsdaten ungültig | Lauf als fehlgeschlagen markieren, **bestehende Daten bleiben unverändert**, Hinweis für Administratoren in der Anwendung |

## Feldherkunft: manuell schlägt automatisch

Jede Schuld führt je Feld, ob der Wert aus der Quelle oder von Hand stammt (`field_origin`).
Sobald jemand ein Feld ändert, gilt es als **manuell** und wird von Importen nicht mehr überschrieben.
Das gilt für Titel, Beschreibung, Verantwortlichen, Schätzungen, Bewertung und Priorität.

**Einzige Ausnahme „Quelle getilgt gewinnt“:** Ist ein Befund in der Quelle erledigt, setzt der
Import die Schuld auf „getilgt“, **auch wenn der Status manuell gesetzt war** (zum Beispiel
„akzeptiert“). Der Verlauf hält den vorherigen Status fest, damit nichts verloren geht.

Konflikte (manuell geändert und in der Quelle ebenfalls verändert) werden in der Oberfläche
kenntlich gemacht. Doppelte Schulden aus mehreren Quellen lassen sich zusammenführen.

## Erlaubte Hosts (SSRF-Schutz)

Eine frei wählbare Basis-URL würde den Worker beliebige Adressen im internen Netz abrufen lassen.
Deshalb sind nur `sonarcloud.io` und `gitlab.com` erlaubt. Weitere Hosts (selbst gehostete
Installationen) gibt ein Systemadministrator über `SOURCE_ALLOWED_HOSTS` frei. Die Prüfung gilt beim
Anlegen und bei jedem Abruf.

## Zugangsdaten

Zugangsdaten stehen verschlüsselt in der Datenbank (AES-256-GCM, Schlüssel-ID für Rotation) und
werden nur Administratoren zugänglich gemacht. Sie erscheinen **nie** in API-Antworten, Logs,
Fehlermeldungen oder Audit-Details (siehe [ADR 0009](adr/0009-secrets-handling.md)).

## Rhythmus

Standardmäßig **stündlich** pro Integration (5 Minuten bis 7 Tage, konfigurierbar) plus Import auf
Anforderung. Importe laufen im Worker und blockieren keine Benutzeranfragen.

- Ein minütlicher Takt prüft, welche Integrationen fällig sind. Maßgeblich ist der **letzte Versuch**,
  nicht der letzte Erfolg: Eine fehlerhafte Integration wird nicht jede Minute neu versucht.
- Pro Integration gibt es höchstens einen wartenden oder laufenden Lauf (Datenbank-Constraint);
  eine zweite Anforderung liefert den bestehenden Lauf zurück.
- Rate-Limits (HTTP 429) verschieben den Lauf um `Retry-After`, höchstens fünfmal; danach schlägt er fehl.
- Verlorene Läufe (Worker abgestürzt, Auftrag verloren) werden nach 30 Minuten (laufend) bzw. 2 Stunden
  (wartend) als fehlgeschlagen beendet, damit der Zeitplan weiterläuft.
- Ein fehlgeschlagener Lauf setzt die Integration auf „Fehler“; Administratoren sehen einen Hinweis in der Anwendung.

## Eine neue Quelle hinzufügen

1. Paket `packages/connectors/src/<quelle>/` anlegen und die Schnittstelle implementieren.
2. Konfigurationsschema (Zod) für die quellspezifischen Einstellungen definieren.
3. Fixture-Tests mit aufgezeichneten Antworten ergänzen (Pagination, 429, ungültige Zugangsdaten).
4. Connector registrieren. **Keine Änderung** am Schuldenmodell oder an anderen Connectoren.
5. Quelle in [vision.md](vision.md) und [context-and-building-blocks.md](context-and-building-blocks.md) ergänzen.

## Offene Punkte

- Webhooks zusätzlich zum Polling für schnellere Aktualisierung (eigener ADR, falls gewünscht).
- Rückschreiben in Quellsysteme ist für Version 1 ausgeschlossen.
