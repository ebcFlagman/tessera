# Integrationskonzept

Wie Umsysteme angebunden werden und wie importierte Daten mit manuell gepflegten Daten
zusammenspielen. **Stand:** Konzept steht, Umsetzung folgt mit User Story 3.
Entscheidungen: [ADR 0006](adr/0006-connector-plugin-interface.md),
[ADR 0007](adr/0007-import-reconciliation-and-field-origin.md),
[ADR 0009](adr/0009-secrets-handling.md).

## Grundsatz

Tessera holt Daten **aus den APIs der Umsysteme** (Polling). Jede Quelle ist ein Connector hinter
einer gemeinsamen Schnittstelle. Der Kern kennt nur diese Schnittstelle, nie eine konkrete Quelle.

## Connector-Schnittstelle

Verbindliche Beschreibung: [contracts/connector-interface.md](../../specs/001-tech-debt-management/contracts/connector-interface.md).

| Operation        | Zweck                                                                                      |
| ---------------- | ------------------------------------------------------------------------------------------ |
| `testConnection` | Zugangsdaten und Erreichbarkeit prüfen (Admin-Aktion „Verbindung testen“)                  |
| `fetchFindings`  | Befunde seitenweise liefern, inkrementell (`since`), wo die Quelle es kann                 |
| `mapToDebt`      | Rohbefund auf einen Schuldenentwurf abbilden (Titel, Beschreibung, Art, Aufwandsschätzung) |

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

## Zugangsdaten

Zugangsdaten stehen verschlüsselt in der Datenbank (AES-256-GCM, Schlüssel-ID für Rotation) und
werden nur Administratoren zugänglich gemacht. Sie erscheinen **nie** in API-Antworten, Logs,
Fehlermeldungen oder Audit-Details (siehe [ADR 0009](adr/0009-secrets-handling.md)).

## Rhythmus

Standardmäßig **stündlich** pro Integration (konfigurierbar) plus Import auf Anforderung.
Importe laufen im Worker und blockieren keine Benutzeranfragen.

## Eine neue Quelle hinzufügen

1. Paket `packages/connectors/src/<quelle>/` anlegen und die Schnittstelle implementieren.
2. Konfigurationsschema (Zod) für die quellspezifischen Einstellungen definieren.
3. Fixture-Tests mit aufgezeichneten Antworten ergänzen (Pagination, 429, ungültige Zugangsdaten).
4. Connector registrieren. **Keine Änderung** am Schuldenmodell oder an anderen Connectoren.
5. Quelle in [vision.md](vision.md) und [context-and-building-blocks.md](context-and-building-blocks.md) ergänzen.

## Offene Punkte

- Webhooks zusätzlich zum Polling für schnellere Aktualisierung (eigener ADR, falls gewünscht).
- Rückschreiben in Quellsysteme ist für Version 1 ausgeschlossen.
