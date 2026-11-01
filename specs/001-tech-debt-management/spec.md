# Feature Specification: Tessera – Plattform für Architektur- und Technische Schulden

**Feature Branch**: `claude/architecture-debt-management-app-eb5d14`

**Created**: 2026-10-31

**Status**: Draft

**Input**: User description: "ich möchte eine architekturvision erstellen inkl. entsprechender dokumentation, damit du diese für später nutzen kannst. ich möchte eine applikation bauen um architektonische und technische schulden zu erfassen und zu managen/bewerten. dafür soll auch eine integration von z.B. sonarcloud, gitlab cloud usw. möglich sein. backend in nextjs und frontend in nextjs mit react"

## Clarifications

### Session 2026-10-31

- Q: Wie sollen sich Benutzer bei Tessera anmelden? → A: Single Sign-On über einen Standard-Anbieter (OIDC), betrieben mit Keycloak; Rollen pflegt Tessera.
- Q: Wie soll Tessera mit Befunden umgehen, die in der Quelle erledigt sind, aber in Tessera noch offen geführt werden? → A: Automatisch auf „getilgt“ setzen (mit Vermerk im Verlauf); überschreibt auch einen manuell gesetzten Status.
- Q: Gilt eine Rolle pro Produkt oder für die gesamte Organisation? → A: Lesen organisationsweit für alle angemeldeten Benutzer; Schreiben und Verwalten pro Produkt.
- Q: Wie wird die Priorität berechnet? → A: Aus gewichteten Kriterien berechnet; manuelles Überschreiben mit Begründung durch Bearbeiter des Produkts möglich.
- Q: Wie oft sollen Integrationen automatisch Daten abholen? → A: Mehrmals täglich (Standard stündlich, pro Integration konfigurierbar) plus Import auf Anforderung.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Schulden manuell erfassen und im Register verwalten (Priority: P1)

Ein Mitglied eines Entwicklungsteams erfasst eine architektonische oder technische Schuld (z. B. „Monolith-Modul X ist eng mit Modul Y gekoppelt“ oder „veraltete Bibliothek Z“) mit Titel, Beschreibung, Art (Architektur- vs. technische Schuld), betroffenem Produkt/System und Verantwortlichem. Alle erfassten Schulden stehen in einem zentralen Register, das sich filtern, durchsuchen und sortieren lässt. Der Status einer Schuld (z. B. offen, geplant, in Bearbeitung, getilgt, akzeptiert) wird über ihren Lebenszyklus gepflegt.

**Why this priority**: Das zentrale Schuldenregister ist die Grundlage für alles Weitere (Bewertung, Integrationen, Berichte). Auch allein liefert es Wert: Schulden werden sichtbar statt in Köpfen und Tickets verstreut.

**Independent Test**: Kann vollständig getestet werden, indem eine Person mehrere Schulden anlegt, bearbeitet, filtert und den Status ändert – ohne Bewertung oder Integrationen.

**Acceptance Scenarios**:

1. **Given** ein angemeldeter Benutzer mit Schreibrechten auf ein Produkt, **When** er eine neue Schuld mit Pflichtfeldern speichert, **Then** erscheint sie im Register mit Status „offen“ und ist über Suche und Filter auffindbar.
2. **Given** eine bestehende Schuld, **When** der Verantwortliche den Status auf „getilgt“ setzt, **Then** wird die Änderung samt Zeitpunkt und Urheber im Verlauf der Schuld festgehalten.
3. **Given** ein Register mit vielen Einträgen, **When** der Benutzer nach Art, Status, Produkt oder Verantwortlichem filtert, **Then** zeigt die Liste nur passende Einträge.

---

### User Story 2 - Schulden bewerten und priorisieren (Priority: P1)

Ein Tech Lead oder Architekt bewertet jede Schuld anhand nachvollziehbarer Kriterien (z. B. geschäftliche Auswirkung, Risiko, geschätzter Tilgungsaufwand, laufende „Zinsen“ wie Mehraufwand oder Fehleranfälligkeit). Aus der Bewertung ergibt sich ein Prioritätswert, anhand dessen das Register sortiert und eine priorisierte Tilgungsliste erzeugt wird. Die Bewertungskriterien und ihre Gewichtung sind konfigurierbar.

**Why this priority**: Erfassen allein reicht nicht – der eigentliche Nutzen liegt darin, begründet zu entscheiden, welche Schulden zuerst getilgt werden.

**Independent Test**: Kann getestet werden, indem Schulden mit unterschiedlichen Kriterienwerten bewertet werden und geprüft wird, dass die resultierende Rangfolge den konfigurierten Gewichtungen entspricht.

**Acceptance Scenarios**:

1. **Given** zwei Schulden mit unterschiedlichen Bewertungen, **When** der Benutzer das Register nach Priorität sortiert, **Then** steht die Schuld mit dem höheren Prioritätswert oben, und die Herleitung des Werts ist einsehbar.
2. **Given** ein Administrator ändert die Gewichtung eines Kriteriums, **When** die Bewertungen neu berechnet werden, **Then** aktualisieren sich die Prioritätswerte aller betroffenen Schulden konsistent.
3. **Given** eine Schuld wurde mehrfach neu bewertet, **When** der Benutzer ihren Verlauf öffnet, **Then** sieht er frühere Bewertungen mit Datum und Urheber.

---

### User Story 3 - Externe Quellen anbinden und Schulden automatisch importieren (Priority: P2)

Ein Administrator verbindet eine externe Quelle (z. B. SonarCloud oder GitLab Cloud) mit einem Produkt. Tessera importiert regelmäßig oder auf Anforderung Befunde (z. B. Code-Smells, Sicherheitslücken, Duplikate, Issues/Tickets) und legt daraus neue Schulden an bzw. aktualisiert bestehende. Importierte Schulden behalten einen Verweis auf ihre Quelle, werden nicht doppelt angelegt und können manuell ergänzt und bewertet werden. Das Integrationsmodell ist erweiterbar, sodass weitere Quellen später ohne Umbau des Kerns hinzukommen können.

**Why this priority**: Die Anbindung macht aus einer manuellen Liste ein lebendiges, aktuelles Bild der Schuldenlage und spart Erfassungsaufwand. Sie baut auf Register und Bewertung auf.

**Independent Test**: Kann mit einer einzelnen Quelle (z. B. SonarCloud-Testprojekt) getestet werden: Verbindung einrichten, Import auslösen, importierte Schulden im Register prüfen, erneuten Import ohne Duplikate bestätigen.

**Acceptance Scenarios**:

1. **Given** eine gültig konfigurierte Verbindung zu einer Quelle, **When** ein Import ausgelöst wird, **Then** erscheinen die Befunde als Schulden mit Quellenverweis und Importzeitpunkt im Register.
2. **Given** bereits importierte Schulden, **When** derselbe Import erneut läuft, **Then** werden bestehende Einträge aktualisiert statt dupliziert.
3. **Given** ein Befund ist in der Quelle nicht mehr vorhanden, **When** der nächste Import läuft, **Then** wird die zugehörige Schuld automatisch auf „getilgt“ gesetzt (auch wenn der Status zuvor manuell gesetzt war, z. B. „akzeptiert“), und der Verlauf vermerkt „in Quelle behoben“ mit Importzeitpunkt.
4. **Given** die Quelle ist nicht erreichbar oder die Zugangsdaten sind ungültig, **When** ein Import läuft, **Then** erhält der Administrator eine verständliche Fehlermeldung, und vorhandene Daten bleiben unverändert.

---

### User Story 4 - Überblick, Trends und Berichte für Entscheider (Priority: P2)

Ein Engineering Manager oder Architekt sieht auf einem Dashboard die Schuldenlage pro Produkt, Team und Art: Anzahl, Gesamtaufwand zur Tilgung, Verteilung nach Priorität sowie Entwicklung über die Zeit. Daraus lassen sich Berichte für Planung und Stakeholder-Gespräche ableiten und exportieren.

**Why this priority**: Macht den Nutzen für Management und Planung sichtbar und unterstützt datenbasierte Entscheidungen, setzt aber vorhandene Daten voraus.

**Independent Test**: Kann mit vorbereiteten Beispieldaten getestet werden: Dashboard-Kennzahlen müssen mit dem Registerinhalt übereinstimmen, Export muss die angezeigten Daten enthalten.

**Acceptance Scenarios**:

1. **Given** ein Register mit Schulden mehrerer Produkte, **When** der Benutzer das Dashboard öffnet, **Then** stimmen Kennzahlen mit den im Register gefilterten Daten überein.
2. **Given** historische Stände, **When** der Benutzer den Zeitverlauf betrachtet, **Then** sieht er die Entwicklung von Anzahl und Gesamtaufwand pro Zeitraum.
3. **Given** ein gewählter Bericht, **When** der Benutzer exportiert, **Then** erhält er eine Datei mit den angezeigten Daten.

---

### User Story 5 - Architekturvision und Dokumentation pflegen (Priority: P1)

Das Projektteam (und künftige KI-Assistenz) hat eine verbindliche, versionierte Architekturvision für Tessera: Zielbild, Leitprinzipien, Qualitätsziele, Systemkontext, Bausteine, Integrationskonzept und zentrale Architekturentscheidungen mit Begründung. Die Dokumentation liegt im Repository, ist in verständlicher Sprache verfasst und wird bei Änderungen an Architekturentscheidungen aktualisiert, damit sie später als verlässliche Referenz für Planung und Umsetzung dient.

**Why this priority**: Ausdrücklicher Wunsch des Auftraggebers – die Vision ist Grundlage für alle späteren Entscheidungen und für die Zusammenarbeit mit KI-Assistenz, die diese Dokumente als Kontext nutzt.

**Independent Test**: Kann getestet werden, indem eine Person, die das Projekt nicht kennt, anhand der Dokumentation Zielbild, Bausteine, Integrationsansatz und die wichtigsten Entscheidungen korrekt wiedergeben kann.

**Acceptance Scenarios**:

1. **Given** die Dokumentation im Repository, **When** eine neue Person sie liest, **Then** kann sie Zweck, Zielgruppen, Leitprinzipien und Systemgrenzen von Tessera ohne Rückfragen erklären.
2. **Given** eine neue Architekturentscheidung, **When** sie getroffen wird, **Then** wird sie mit Kontext, Alternativen, Begründung und Datum dokumentiert und ist von der Vision aus auffindbar.
3. **Given** die Vision verweist auf Qualitätsziele, **When** ein Ziel geändert wird, **Then** ist ersichtlich, welche Dokumente davon betroffen sind.

---

### User Story 6 - Zugriff, Rollen und Nachvollziehbarkeit (Priority: P3)

Benutzer melden sich an, dürfen organisationsweit lesen und erhalten für Schreiben und Verwalten Rollen (Administrator, Bearbeiter) pro Produkt. Sensible Konfigurationen wie Integrationszugangsdaten sind nur Administratoren zugänglich. Änderungen an Schulden, Bewertungen und Integrationen werden nachvollziehbar protokolliert.

**Why this priority**: Notwendig für den produktiven Mehrbenutzerbetrieb, aber für den ersten Nutzwert nachrangig gegenüber Register, Bewertung und Vision.

**Independent Test**: Kann getestet werden, indem Benutzer mit verschiedenen Rollen dieselben Aktionen versuchen und das Änderungsprotokoll geprüft wird.

**Acceptance Scenarios**:

1. **Given** ein Benutzer ohne Bearbeiterrolle für das Produkt, **When** er eine Schuld ändern will, **Then** wird die Aktion verweigert und verständlich erklärt.
2. **Given** ein Administrator ändert eine Integrationskonfiguration, **When** ein Auditor das Protokoll öffnet, **Then** sind Wer, Wann und Was ersichtlich, ohne dass Zugangsdaten im Klartext erscheinen.

---

### Edge Cases

- Eine importierte Schuld wird manuell bearbeitet und beim nächsten Import in der Quelle verändert: Manuelle Felder (z. B. Bewertung, Verantwortlicher) dürfen nicht überschrieben werden; Konflikte werden kenntlich gemacht.
- Dieselbe Schuld wird von mehreren Quellen oder zusätzlich manuell gemeldet: Das System bietet das Zusammenführen als Duplikat an.
- Eine Quelle liefert sehr viele Befunde (tausende) auf einmal: Der Import bleibt bedienbar, zeigt Fortschritt und beeinträchtigt andere Nutzer nicht.
- Zugangsdaten einer Integration laufen ab oder werden widerrufen: Die Integration zeigt den Fehlerstatus, und Administratoren erhalten in der Anwendung einen gut sichtbaren Hinweis; bestehende Daten bleiben erhalten.
- Eine Schuld ist ohne vollständige Bewertung: Sie wird als „unbewertet“ geführt und in der Priorisierung klar von bewerteten getrennt.
- Ein Produkt oder eine Integration wird gelöscht: Zugehörige Schulden werden archiviert statt stillschweigend entfernt, sofern nicht ausdrücklich anders gewählt.
- Eine Schuld wird als „akzeptiert“ markiert: Sie erfordert eine Begründung und optional ein Wiedervorlagedatum.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Das System MUSS das Anlegen, Bearbeiten, Archivieren und Anzeigen von Schulden mit mindestens Titel, Beschreibung, Art (architektonisch/technisch), Produkt/System, Verantwortlichem und Status ermöglichen.
- **FR-002**: Das System MUSS ein zentrales Register bereitstellen, das Suche, Filter (Art, Status, Produkt, Verantwortlicher, Priorität, Quelle) und Sortierung unterstützt.
- **FR-003**: Das System MUSS Statusänderungen und Feldänderungen einer Schuld mit Zeitpunkt und Urheber im Verlauf festhalten.
- **FR-004**: Das System MUSS Schulden anhand konfigurierbarer Kriterien und Gewichtungen bewerten und daraus einen nachvollziehbaren Prioritätswert ableiten.
- **FR-004a**: Das System MUSS das manuelle Überschreiben des berechneten Prioritätswerts nur mit Begründung erlauben, den berechneten und den überschriebenen Wert getrennt ausweisen und das Überschreiben im Verlauf festhalten.
- **FR-005**: Das System MUSS frühere Bewertungen einer Schuld aufbewahren und einsehbar machen.
- **FR-006**: Das System MUSS eine priorisierte Liste der zu tilgenden Schulden bereitstellen, filterbar nach Produkt und Team.
- **FR-007**: Das System MUSS Schulden mit geschätztem Tilgungsaufwand und laufenden Folgekosten („Zinsen“) erfassen können.
- **FR-008**: Administratoren MÜSSEN externe Quellen (zunächst SonarCloud und GitLab Cloud) mit einem Produkt verbinden, testen und wieder trennen können.
- **FR-009**: Das System MUSS Befunde aus verbundenen Quellen als Schulden importieren (auf Anforderung sowie automatisch standardmäßig stündlich, pro Integration konfigurierbar; Rate-Limits der Quelle werden eingehalten) und dabei Duplikate vermeiden sowie bestehende Einträge aktualisieren.
- **FR-010**: Importierte Schulden MÜSSEN einen Verweis auf Quelle und Originalbefund sowie den Zeitpunkt des letzten Abgleichs tragen.
- **FR-011**: Das System MUSS manuell gepflegte Felder bei Folgeimporten vor Überschreiben schützen.
- **FR-011a**: Das System MUSS Schulden, deren Befund in der Quelle nicht mehr vorhanden ist, automatisch auf „getilgt“ setzen, auch wenn der Status zuvor manuell gesetzt war (z. B. „akzeptiert“), und dies samt vorherigem Status im Verlauf festhalten; taucht der Befund später wieder auf, MUSS die Schuld wieder geöffnet werden.
- **FR-012**: Das System MUSS das Hinzufügen weiterer Integrationsquellen ermöglichen, ohne das Schuldenmodell oder bestehende Integrationen ändern zu müssen.
- **FR-013**: Das System MUSS Importfehler (Erreichbarkeit, ungültige Zugangsdaten, unvollständige Daten) verständlich melden und darf dabei bestehende Daten nicht beschädigen.
- **FR-014**: Das System MUSS ein Dashboard mit Kennzahlen (Anzahl, Gesamtaufwand, Verteilung nach Priorität/Art/Status) und Zeitverlauf je Produkt und Team bieten.
- **FR-015**: Benutzer MÜSSEN Berichte und Registerdaten exportieren können.
- **FR-016**: Das System MUSS Benutzer ausschließlich per Single Sign-On über einen externen Identitätsanbieter (Keycloak, Standard OIDC) authentifizieren, keine eigenen Passwörter speichern und Rechte rollenbasiert durchsetzen: Alle angemeldeten Benutzer dürfen organisationsweit lesen; die Rollen Administrator und Bearbeiter für Schreiben und Verwalten werden pro Produkt vergeben.
- **FR-017**: Das System MUSS Zugangsdaten externer Quellen geschützt speichern, nur Administratoren zugänglich machen und niemals im Klartext anzeigen oder protokollieren.
- **FR-018**: Das System MUSS sicherheits- und datenrelevante Änderungen (Rollen, Integrationen, Bewertungsmodell) in einem Änderungsprotokoll nachvollziehbar festhalten.
- **FR-019**: Das System MUSS das Markieren einer Schuld als „akzeptiert“ nur mit Begründung erlauben.
- **FR-020**: Das Projekt MUSS eine versionierte Architekturvision samt Dokumentation im Repository bereitstellen, die Zielbild, Leitprinzipien, Qualitätsziele, Systemkontext, Bausteine, Integrationskonzept und Architekturentscheidungen (mit Begründung) enthält.
- **FR-021**: Die Dokumentation MUSS so strukturiert sein, dass sie als Referenz für spätere Planungs- und Umsetzungsschritte (auch durch KI-Assistenz) ohne weiteres Vorwissen nutzbar ist.

### Key Entities

- **Schuld (Debt Item)**: Einzelne architektonische oder technische Schuld; Attribute u. a. Titel, Beschreibung, Art, Status, Verantwortlicher, Aufwandsschätzung, Folgekosten, Prioritätswert, Quellenverweis. Gehört zu einem Produkt; hat Verlauf und Bewertungen.
- **Produkt/System**: Betrachtungsobjekt (Anwendung, Service, Repository-Gruppe), dem Schulden, Integrationen und Teams zugeordnet sind.
- **Bewertung (Assessment)**: Zeitpunktbezogene Einstufung einer Schuld anhand der Kriterien, optional mit begründeter manueller Prioritätsüberschreibung; verweist auf Bewerter und Bewertungsmodell.
- **Bewertungsmodell**: Menge der Kriterien samt Gewichtungen, aus denen der Prioritätswert berechnet wird.
- **Integration/Quelle (Source Connection)**: Verbindung eines Produkts mit einem externen System (z. B. SonarCloud, GitLab Cloud); Status, letzter Abgleich, geschützte Zugangsdaten.
- **Importierter Befund (Finding)**: Rohbefund aus einer Quelle mit Originalkennung; wird einer Schuld zugeordnet.
- **Benutzer, Rolle, Team**: Personen, ihre Berechtigungen pro Produkt/Organisation und ihre Teamzugehörigkeit.
- **Änderungsprotokoll-Eintrag**: Nachweis von Wer/Wann/Was bei relevanten Änderungen.
- **Architekturentscheidung (Decision Record)**: Dokumentierte Entscheidung mit Kontext, Alternativen, Begründung, Datum und Status.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Ein Benutzer kann eine neue Schuld in unter 2 Minuten erfassen und im Register wiederfinden.
- **SC-002**: Für 90 % der Schulden ist innerhalb von 4 Wochen nach Einführung eine Bewertung hinterlegt (Pilotteams).
- **SC-003**: Nach Einrichtung einer Quelle ist der erste Import von bis zu 1.000 Befunden in unter 10 Minuten abgeschlossen, und ein Wiederholungsimport erzeugt 0 Duplikate.
- **SC-004**: Die Einrichtung einer Integration gelingt einem Administrator ohne Hilfe in unter 10 Minuten.
- **SC-005**: Register-, Filter- und Dashboard-Ansichten erscheinen bei bis zu 10.000 Schulden für Benutzer in unter 3 Sekunden.
- **SC-006**: Dashboard-Kennzahlen stimmen zu 100 % mit den zugrunde liegenden Registerdaten überein.
- **SC-007**: 100 % der Änderungen an Rollen, Integrationen und Bewertungsmodell sind im Änderungsprotokoll nachvollziehbar; kein Zugangsdatum erscheint im Klartext.
- **SC-008**: Eine mit dem Projekt nicht vertraute Person kann nach Lektüre der Architekturvision in 30 Minuten Zweck, Bausteine, Integrationsansatz und die fünf wichtigsten Entscheidungen korrekt erklären.
- **SC-009**: Planungsrunden zur Auswahl von Tilgungsmaßnahmen benötigen mit der priorisierten Liste spürbar weniger Zeit (Ziel: 30 % weniger als zuvor, gemessen im Pilot).

## Assumptions

- Zielgruppe sind Entwicklungsteams, Tech Leads, Architekten und Engineering Manager in einer Organisation mit mehreren Produkten; ein mandantenfähiger Betrieb für externe Kunden ist für v1 nicht vorgesehen.
- Als erste Integrationen gelten SonarCloud und GitLab Cloud; weitere Quellen (z. B. GitHub, Jira) sind spätere Erweiterungen, für die das Integrationskonzept offen sein muss.
- Integrationen sind in v1 lesend (Import); Rückschreiben in Quellsysteme (z. B. Tickets erzeugen) ist nicht Teil von v1.
- Anmeldung erfolgt per Single Sign-On über eine vorhandene Keycloak-Instanz der Organisation; Produktbezogene Rollen werden in Tessera verwaltet.
- Technische Vorgabe des Auftraggebers (für die Planung, nicht Teil der Anforderungen): Backend und Frontend werden mit Next.js umgesetzt, das Frontend mit React.
- Standardbewertungskriterien (Auswirkung, Risiko, Aufwand, Folgekosten) werden vorgegeben und können vom Administrator angepasst werden.
- Die Benutzeroberfläche ist zunächst auf Deutsch und Englisch ausgerichtet bzw. mindestens auf Deutsch; Mobile-Optimierung ist für v1 nachrangig.
- Die Architekturdokumentation wird im Repository gepflegt und dient zugleich als Kontext für KI-gestützte Weiterarbeit.
- Datenaufbewahrung: Schulden und Protokolle werden unbefristet aufbewahrt, bis sie archiviert bzw. gemäß Organisationsvorgaben gelöscht werden.
