# Feature Specification: Einheitliche Oberfläche mit PrimeReact 11

**Feature Branch**: `claude/speckit-primereact-ui-f3972e`

**Created**: 2026-11-01

**Status**: Draft

**Input**: User description: "das ui möchte ich mit primereact umsetzten. mit der aktuellsten version 11"

## Clarifications

### Session 2026-11-01

- Q: Welche Grundanmutung soll die neue Oberfläche haben? → A: Neutrales, modernes Standardthema der Bibliothek mit Tessera-Akzentfarbe (hell/dunkel); keine eigenen Markenfarben, keine besonders dichte Darstellung.
- Q: Wie soll das Register bei sehr vielen Schulden Filtern, Sortieren und Seitenwechsel handhaben? → A: Der Server liefert jeweils nur die sichtbare Seite; Filtern, Sortieren und Suchen laufen serverseitig (die bestehende API unterstützt das bereits, keine Backend-Änderung nötig).
- Q: Wie soll die Navigation die Bereiche gliedern? → A: Navigation ausschließlich im Hamburger-Menü mit den Gruppen „Arbeit“ (Dashboard, Register, Prioritäten, Integrationen) und „Verwaltung“ (Bewertungsmodell, Produkte, Rollen, Teams, Protokoll); auf allen Bildschirmbreiten über das Hamburger-Menü erreichbar.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Einheitlicher App-Rahmen und Navigation (Priority: P1)

Ein angemeldeter Benutzer sieht beim Öffnen von Tessera einen einheitlich gestalteten Rahmen: Kopfbereich mit Produktname, übersichtliche Hauptnavigation im Hamburger-Menü (auf allen Bildschirmbreiten, keine zweite Navigation daneben), gegliedert in „Arbeit“ (Dashboard, Register, Prioritäten, Integrationen) und „Verwaltung“ (Bewertungsmodell, Produkte, Rollen, Teams, Protokoll), Anzeige des angemeldeten Benutzers mit Abmelden-Funktion sowie die bestehenden Hinweise (z. B. Integrationswarnung, „Erstes Produkt anlegen“). Die Navigation zeigt, in welchem Bereich man sich befindet, und ist über das Hamburger-Menü auf allen Bildschirmbreiten bedienbar.

**Why this priority**: Der Rahmen ist auf jeder Seite sichtbar. Er legt Erscheinungsbild und Bedienmuster fest, auf denen alle weiteren Seiten aufbauen, und macht schon allein den größten sichtbaren Unterschied zur bisherigen schlichten Oberfläche.

**Independent Test**: Anmelden und alle Navigationseinträge nacheinander öffnen; Rahmen, aktiver Eintrag, Benutzeranzeige und Abmelden prüfen – auch bei schmaler Fensterbreite –, ohne dass die Seiteninhalte bereits umgestaltet sein müssen.

**Acceptance Scenarios**:

1. **Given** ein angemeldeter Benutzer, **When** er eine beliebige Seite öffnet, **Then** sieht er denselben Rahmen mit Produktname, Hauptnavigation und seinem Namen, und der aktuelle Bereich ist in der Navigation hervorgehoben.
2. **Given** ein schmales Fenster (Smartphone-Breite), **When** der Benutzer die Navigation öffnet, **Then** erreicht er alle Bereiche, ohne dass Inhalte abgeschnitten werden oder die Seite seitlich scrollt.
3. **Given** ein Benutzer ohne Schreibrechte, **When** er die Navigation betrachtet, **Then** sieht er dieselben Einträge wie bisher (keine neuen oder entfallenen Berechtigungen durch die Umgestaltung).
4. **Given** eine ausgefallene Integration oder ein fehlendes Produkt, **When** der Benutzer eine Seite öffnet, **Then** erscheint der jeweilige Hinweis weiterhin deutlich sichtbar im neuen Gestaltungsstil.

---

### User Story 2 - Register, Detailansicht und Erfassung im neuen Stil (Priority: P1)

Benutzer arbeiten im Schuldenregister, in der Detailansicht und im Erfassungsformular mit den neuen Oberflächenelementen: Das Register ist eine Tabelle mit sortierbaren Spalten, Filtern, Suche und Seitenwechsel; Status, Art, Priorität und Quelle sind als erkennbare Markierungen dargestellt; Formulare zeigen Eingabefelder, Auswahllisten und Validierungsmeldungen einheitlich; Bestätigungen und Meldungen (z. B. „gespeichert“, Fehler) erscheinen konsistent.

**Why this priority**: Register und Erfassung sind die täglich genutzten Kernabläufe (P1 der Fachfunktion). Die Umgestaltung darf sie nicht verschlechtern, sondern soll sie übersichtlicher machen.

**Independent Test**: Eine Schuld anlegen, im Register filtern/sortieren/suchen, öffnen, bewerten, Priorität überschreiben und Duplikate zusammenführen – alle Abläufe liefern dieselben Ergebnisse wie vor der Umgestaltung.

**Acceptance Scenarios**:

1. **Given** ein Register mit vielen Schulden, **When** der Benutzer nach Spalte sortiert, nach Art/Status/Produkt/Verantwortlichem filtert oder sucht, **Then** zeigt die Tabelle die passenden Einträge unverändert korrekt und teilt lange Listen in Seiten auf.
2. **Given** das Erfassungsformular, **When** der Benutzer Pflichtfelder leer lässt oder ungültige Werte eingibt, **Then** erscheint die Fehlermeldung direkt am betroffenen Feld, und die Eingabe geht nicht verloren.
3. **Given** eine erfolgreiche oder fehlgeschlagene Aktion (speichern, Status ändern, zusammenführen), **When** sie abgeschlossen ist, **Then** erhält der Benutzer eine gut sichtbare, sich selbst wieder ausblendende Rückmeldung.
4. **Given** eine endgültige oder folgenreiche Aktion (z. B. Zusammenführen von Duplikaten), **When** der Benutzer sie auslöst, **Then** wird sie über einen einheitlichen Bestätigungsdialog abgesichert.
5. **Given** eine leere Liste, ein Ladevorgang oder ein Fehler beim Laden, **When** die Seite angezeigt wird, **Then** erscheinen verständliche Leer-, Lade- und Fehlerzustände.

---

### User Story 3 - Dashboard, Prioritäten und Auswertungen im neuen Stil (Priority: P2)

Das Dashboard zeigt Kennzahlen, Verteilungen und Verläufe in einheitlich gestalteten Kacheln und Diagrammen; die Prioritätenliste und der Export folgen demselben Stil. Diagrammfarben passen zum gewählten Erscheinungsbild (hell/dunkel) und bleiben auch ohne Farbwahrnehmung unterscheidbar.

**Why this priority**: Das Dashboard ist wichtig für Leitung und Tech Leads, aber nicht Voraussetzung für die tägliche Erfassung; es kann nach Rahmen und Register umgestaltet werden.

**Independent Test**: Dashboard und Prioritätenliste öffnen und Kennzahlen, Verläufe und Exportfunktion mit den Werten vor der Umgestaltung vergleichen.

**Acceptance Scenarios**:

1. **Given** vorhandene Schulden und Verlaufsdaten, **When** der Benutzer das Dashboard öffnet, **Then** erscheinen dieselben Zahlen und Verläufe wie zuvor in der neuen Darstellung.
2. **Given** ein dunkles Erscheinungsbild, **When** das Dashboard angezeigt wird, **Then** sind Beschriftungen, Kacheln und Diagramme gut lesbar.
3. **Given** die Prioritätenliste, **When** der Benutzer exportiert, **Then** funktioniert der Export unverändert.

---

### User Story 4 - Verwaltungsbereiche im neuen Stil (Priority: P2)

Integrationen, Bewertungsmodell, Produkte, Rollen, Teams und Änderungsprotokoll nutzen dieselben Tabellen-, Formular-, Dialog- und Meldungsmuster wie das Register, sodass Administratoren und Bearbeiter überall dieselbe Bedienlogik vorfinden.

**Why this priority**: Verwaltungsseiten werden seltener genutzt, müssen aber zum Gesamtbild passen, damit die Umstellung vollständig ist und kein Stilbruch verbleibt.

**Independent Test**: Jede Verwaltungsseite öffnen und ihre bisherigen Aktionen (Integration verbinden, Gewichtung ändern, Produkt anlegen, Rolle zuweisen, Team pflegen, Protokoll filtern) durchführen; alle Ergebnisse stimmen mit dem bisherigen Verhalten überein.

**Acceptance Scenarios**:

1. **Given** ein Administrator, **When** er eine Verwaltungsseite öffnet, **Then** sieht er dieselben Daten und Aktionen wie zuvor in der neuen Darstellung.
2. **Given** ein Benutzer ohne Verwaltungsrecht, **When** er eine Verwaltungsseite aufruft, **Then** bleibt der Zugriff wie bisher beschränkt.
3. **Given** das Eingeben eines Geheimnisses (z. B. Zugangsdaten einer Integration), **When** die Seite es anzeigt, **Then** erscheint es weiterhin nie im Klartext.

---

### User Story 5 - Erscheinungsbild wählen und barrierefrei bedienen (Priority: P3)

Ein Benutzer kann zwischen hellem und dunklem Erscheinungsbild wählen (Standard: Einstellung des Systems); die Wahl bleibt beim nächsten Besuch erhalten. Alle Seiten sind per Tastatur vollständig bedienbar, haben sichtbare Fokusmarkierung und ausreichende Kontraste.

**Why this priority**: Wertvoller Komfort und Qualitätsmerkmal, aber nicht Voraussetzung für die Nutzbarkeit der umgestalteten Seiten.

**Independent Test**: Erscheinungsbild umschalten, Seite neu laden und prüfen, dass die Wahl bleibt; alle Hauptabläufe nur mit Tastatur durchführen; automatisierte Barrierefreiheitsprüfung durchlaufen lassen.

**Acceptance Scenarios**:

1. **Given** ein Benutzer wählt das dunkle Erscheinungsbild, **When** er die Seite neu lädt oder später wiederkommt, **Then** bleibt das dunkle Erscheinungsbild aktiv, ohne dass beim Laden kurz das helle aufblitzt.
2. **Given** keine gespeicherte Wahl, **When** der Benutzer Tessera erstmals öffnet, **Then** richtet sich das Erscheinungsbild nach der Systemeinstellung.
3. **Given** ein Benutzer, der nur die Tastatur nutzt, **When** er Register, Formular, Dialoge und Navigation bedient, **Then** erreicht er alle Elemente in sinnvoller Reihenfolge, und der Fokus ist stets sichtbar.

---

### Edge Cases

- Ein Dialog oder eine Auswahlliste wird geöffnet, während die Sitzung abläuft: Der Benutzer wird wie bisher zur Anmeldung geführt, ohne dass eingegebene Daten stillschweigend verloren gehen.
- Sehr lange Titel, Beschreibungen oder Namen: Tabellen und Kacheln brechen sauber um oder kürzen mit Hinweis auf den vollständigen Text, ohne das Layout zu sprengen.
- 10.000 Schulden im Register: Die Tabelle bleibt bedienbar (serverseitiges Filtern, Sortieren und seitenweises Laden), die Leistungsziele bleiben eingehalten.
- Ohne aktiviertes JavaScript oder bei langsamer Verbindung: Seiten zeigen zuerst Struktur und Ladezustand, kein „Springen“ des Layouts und keine ungestalteten Zwischenzustände.
- Benutzer mit eingeschränkter Sehfähigkeit, Browser-Zoom auf 200 % oder reduzierter Bewegung (Systemeinstellung): Die Oberfläche bleibt nutzbar, Animationen werden entsprechend reduziert.
- Deutsche Beschriftungen aller Oberflächenelemente (Seitenwechsel, Filter, Datumsauswahl, leere Tabellen) müssen vollständig sein; es dürfen keine englischen Standardtexte durchscheinen.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Die gesamte Benutzeroberfläche von Tessera MUST mit der Komponentenbibliothek PrimeReact in der aktuellsten Hauptversion 11 umgesetzt werden; eigenhändig gebaute Gegenstücke zu vorhandenen Bibliothekskomponenten (Tabellen, Schaltflächen, Dialoge, Eingabefelder, Meldungen) MUST entfallen.
- **FR-002**: Alle bisherigen Seiten (Dashboard, Register, Detailansicht, Neue Schuld, Prioritäten, Integrationen, Bewertungsmodell, Produkte, Rollen, Teams, Protokoll) MUST im neuen Stil verfügbar sein; nach Abschluss darf keine Seite im alten, schlichten Stil verbleiben.
- **FR-003**: Die Umgestaltung MUST das fachliche Verhalten unverändert lassen: dieselben Daten, Aktionen, Berechtigungen, Validierungen und Ergebnisse wie vor der Umstellung.
- **FR-004**: Die Oberfläche MUST einen einheitlichen Rahmen mit Kopfbereich, Hauptnavigation im Hamburger-Menü mit den Gruppen „Arbeit“ und „Verwaltung“ (mit Kennzeichnung des aktuellen Bereichs), Benutzeranzeige, Abmelden und den bestehenden Hinweisen bieten und auf kleinen Bildschirmen bedienbar bleiben.
- **FR-005**: Das Schuldenregister MUST Daten tabellarisch mit Sortieren, Filtern, Suchen und Seitenaufteilung darstellen, wobei Filtern, Sortieren und Suchen serverseitig erfolgen und jeweils nur die sichtbare Seite geladen wird (weiteres Nachladen statt fester Seitenzahlen, da die bestehende Schnittstelle fortlaufend blättert); Status, Art, Priorität und Quelle MUST als unterscheidbare Markierungen erscheinen, die nicht allein durch Farbe erkennbar sind.
- **FR-006**: Formulare MUST Pflichtangaben kennzeichnen und Validierungsfehler am betroffenen Feld in deutscher Sprache anzeigen, ohne bereits eingegebene Werte zu verwerfen.
- **FR-007**: Rückmeldungen zu Aktionen (Erfolg, Warnung, Fehler) MUST einheitlich und gut sichtbar erscheinen; folgenreiche Aktionen MUST über einen einheitlichen Bestätigungsdialog abgesichert sein.
- **FR-008**: Jede Seite MUST definierte Lade-, Leer- und Fehlerzustände im neuen Stil anzeigen.
- **FR-009**: Dashboard-Kacheln und -Diagramme MUST im neuen Stil dargestellt werden, dieselben Werte wie bisher zeigen und in hellem wie dunklem Erscheinungsbild lesbar sein.
- **FR-010**: Benutzer MUST zwischen hellem und dunklem Erscheinungsbild wählen können; Standard ist die Systemeinstellung, die Wahl MUST dauerhaft pro Benutzer im Browser erhalten bleiben, und beim Laden DARF KEIN kurzes Aufblitzen des falschen Erscheinungsbilds auftreten.
- **FR-011**: Alle Beschriftungen und Standardtexte der Oberflächenelemente (z. B. Seitenwechsel, Filter, Datumsauswahl, leere Tabellen) MUST auf Deutsch erscheinen.
- **FR-012**: Die Oberfläche MUST barrierefrei bleiben: vollständige Tastaturbedienung, sichtbarer Fokus, ausreichende Kontraste, sinnvolle Beschriftungen für Hilfstechnologien; die bestehende automatisierte Barrierefreiheitsprüfung MUST weiterhin ohne Verstöße bestehen.
- **FR-013**: Farben, Abstände, Schriften und Ecken MUST aus einem zentralen, anpassbaren Gestaltungsthema stammen, sodass das Erscheinungsbild an einer Stelle angepasst werden kann; es DÜRFEN keine verstreuten Einzelwerte in einzelnen Seiten stehen.
- **FR-014**: Die Umstellung DARF die Leistungsziele (Register und Dashboard unter 3 Sekunden bei 10.000 Schulden) nicht verletzen und MUST große Listen ohne spürbares Ruckeln bedienbar halten.
- **FR-015**: Bestehende Ende-zu-Ende-Tests der P1-Abläufe MUST nach der Umstellung weiterhin bestehen (angepasst höchstens an geänderte Bedienelemente, nicht an geändertes Verhalten).
- **FR-016**: Die Entscheidung für PrimeReact 11 samt Begründung und Auswirkungen MUST als Architekturentscheidung (ADR) dokumentiert und in der Architekturvision verlinkt werden.

### Key Entities *(include if feature involves data)*

- **Gestaltungsthema**: Zentrale Festlegung von Farben, Schriften, Abständen und Formen für helles und dunkles Erscheinungsbild; Grundlage aller Seiten.
- **Erscheinungsbild-Auswahl**: Persönliche Wahl des Benutzers (hell, dunkel, System), im Browser des Benutzers gespeichert; keine Serverdaten.
- **Oberflächenbausteine**: Wiederverwendbare Muster für Tabelle mit Filtern, Formularfeld mit Fehlermeldung, Statusmarkierung, Bestätigungsdialog, Rückmeldung, Leer-/Lade-/Fehlerzustand.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100 % der bisherigen Seiten und Dialoge nutzen die neuen Oberflächenbausteine; bei einer Durchsicht aller Seiten findet sich keine Stelle im alten Stil.
- **SC-002**: Alle bestehenden Ende-zu-Ende-Tests der P1-Abläufe bestehen nach der Umstellung ohne fachliche Änderungen an den Erwartungen.
- **SC-003**: Die automatisierte Barrierefreiheitsprüfung meldet auf allen Seiten, in hellem und dunklem Erscheinungsbild, null Verstöße der Stufe „schwerwiegend“ oder „kritisch“.
- **SC-004**: Register und Dashboard laden bei 10.000 Schulden weiterhin in unter 3 Sekunden.
- **SC-005**: Ein Benutzer findet und öffnet einen beliebigen Bereich über die Navigation in höchstens 2 Interaktionen, auch bei Smartphone-Breite.
- **SC-006**: Die Umschaltung zwischen hellem und dunklem Erscheinungsbild wirkt auf allen Seiten sofort (unter 1 Sekunde) und bleibt nach Neuladen erhalten.
- **SC-007**: Eine Änderung der Hauptfarbe an der zentralen Stelle wirkt sich auf 100 % der Seiten aus, ohne dass einzelne Seiten angepasst werden müssen.
- **SC-008**: In einer Stichprobe aller Seiten erscheinen null englische Standardtexte der Oberflächenelemente.

## Assumptions

- Technologievorgabe des Auftraggebers: Die Oberfläche wird mit PrimeReact umgesetzt, und zwar in der zum Zeitpunkt der Planung aktuellsten Hauptversion 11. Die Vereinbarkeit mit dem eingesetzten React und Next.js (App Router, serverseitiges Rendern) sowie die konkrete Unterstützung von Stilen und Erscheinungsbildern wird im Plan geprüft; weicht die tatsächlich verfügbare Version ab, entscheidet der Auftraggeber.
- Umfang: reine Umgestaltung der Darstellung und Bedienelemente der bestehenden Web-Anwendung. Neue Fachfunktionen, Änderungen an Backend, API, Datenmodell, Berechtigungen und Anmeldung sind ausdrücklich nicht Teil dieses Vorhabens.
- Der generierte API-Client und die API-Typen (Prinzip VII der Constitution) bleiben unverändert maßgeblich; die Umstellung führt keine handgeschriebenen API-Aufrufe ein.
- Das visuelle Erscheinungsbild folgt einem von der Bibliothek mitgelieferten, neutralen und modernen Standardthema (hell und dunkel) mit Tessera-spezifischer Akzentfarbe; ein eigenes Corporate Design liegt nicht vor, und eine besonders dichte Darstellung ist nicht gefordert.
- Die Oberflächensprache bleibt Deutsch; weitere Sprachen sind nicht Teil dieses Vorhabens.
- Unterstützt werden aktuelle Versionen gängiger Desktop- und Mobilbrowser; Internet Explorer und sehr alte Browser sind ausgenommen.
- Die Umstellung erfolgt seitenweise in der Reihenfolge der Prioritäten; während der Umstellung bleibt die Anwendung jederzeit lauffähig.
- Die Diagrammdarstellung (Verläufe, Balken) darf bei Bedarf bei der bisherigen Diagrammbibliothek bleiben, sofern sie zum neuen Gestaltungsthema passt.
