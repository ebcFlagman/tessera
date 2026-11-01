---

description: "Aufgabenliste: Einheitliche Oberfläche mit PrimeReact 11"
---

# Tasks: Einheitliche Oberfläche mit PrimeReact 11

**Input**: Design-Dokumente aus `/specs/002-primereact-ui/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/ui-contract.md](contracts/ui-contract.md)

**Tests**: Keine neuen Testsuiten gefordert. Die bestehenden E2E-Tests (FR-015) und die Barrierefreiheitsprüfung (SC-003) werden je Story angepasst bzw. erweitert; ein kleiner Unit-Test deckt die reine Zuordnung für Markierungen ab.

**Organization**: Nach Nutzergeschichten gruppiert. Alle Pfade relativ zum Repository-Wurzelverzeichnis; geändert wird nur `apps/web` (plus Doku und Deploy).

## Format: `[ID] [P?] [Story] Beschreibung`

- **[P]**: parallel ausführbar (andere Dateien, keine offenen Abhängigkeiten)
- **[Story]**: US1–US5 gemäß spec.md

---

## Phase 1: Setup

- [X] T001 Pakete `@primereact/ui@11.2.2`, `@primeuix/themes@3.1.0` und `@primeicons/react` zu `apps/web/package.json` hinzufügen und `pnpm install` ausführen (Lockfile `pnpm-lock.yaml` einchecken; Version 11.2.2 fest, nicht per Bereich)
- [X] T002 Spike: In `apps/web` eine Wegwerf-Seite mit `PrimeReactProvider` (`@primereact/core`), Preset und einem `Button` rendern; mit `pnpm --filter @tessera/web build` und `start` prüfen, (a) ob Stile beim Server-Rendern ohne ungestalteten Zwischenzustand ankommen, (b) ob `transpilePackages` in `apps/web/next.config.mjs` nötig ist, (c) ob der Lizenzschlüssel per Umgebungsvariable gesetzt wird und ohne ihn nur ein Lizenzhinweis erscheint; Ergebnis in `specs/002-primereact-ui/research.md` unter R-3 und R-1 nachtragen, Wegwerf-Seite wieder löschen
- [X] T003 [P] ADR `docs/architecture/adr/0014-primereact-11-ui.md` nach Vorlage `0000-template.md` anlegen (Entscheidung, gestylte Schicht, Community-Lizenz, Ergebnis des Spikes T002, Alternativen PrimeReact 10 / ungestylt + Tailwind) und in `docs/architecture/adr/README.md` sowie `docs/architecture/vision.md` verlinken (FR-016)
- [X] T004 [P] Lizenzschlüssel-Konfiguration dokumentieren: Variable in `deploy/Dockerfile.web` (Build-/Laufzeit gemäß Spike-Ergebnis) und `docs/architecture/context-and-building-blocks.md` ergänzen, inkl. Hinweis auf die jährliche Bestätigung der Community-Lizenz; Schlüssel nie einchecken; `.env.example` (falls vorhanden) um Platzhalter erweitern

---

## Phase 2: Foundational (blockiert alle Nutzergeschichten)

**⚠️ Erst nach Abschluss dieser Phase mit den Nutzergeschichten beginnen**

- [X] T005 Zentrales Thema anlegen in `apps/web/src/theme/preset.ts` (neutrales Basis-Preset aus `@primeuix/themes` mit Tessera-Akzentfarbe als Primärpalette; Dunkel-Selektor `:root[data-theme='dark']`, passend zum bestehenden Selektor in `apps/web/src/components/dashboard/theme.tsx`) und `apps/web/src/theme/index.ts` (Provider-Optionen, einzige Stelle für Farben/Abstände/Ecken, FR-013)
- [X] T006 [P] Deutsche Locale in `apps/web/src/theme/locale-de.ts` anlegen (Paginierung/„Mehr laden“, Filter, leere Tabelle, Datumsauswahl, ARIA-Texte, Dialog-Schaltflächen); fehlende Schlüssel aus `@primeuix/locale` selbst ergänzen (FR-011)
- [X] T007 `apps/web/src/components/shell/Providers.tsx` um `PrimeReactProvider` (Preset aus T005, Locale aus T006) und `Toaster` erweitern; bestehende `SessionProvider`/`QueryClientProvider` unverändert lassen
- [X] T008 Kein-Aufblitzen-Skript in `apps/web/src/app/layout.tsx` ergänzen: Inline-Skript im `<head>` liest `localStorage['tessera-theme']` (`light|dark|system`, ungültig/fehlend/blockiert → `system`, in try/catch) und setzt `data-theme` am `<html>`-Element vor dem ersten Rendern; `<body style={{ margin: 0 }}>` durch Theme-Hintergrund ersetzen; `suppressHydrationWarning` am `<html>` setzen (R-4, data-model.md)
- [X] T009 [P] Reine Zuordnung `apps/web/src/components/debt/labels.ts` erweitern: für Status, Art, Priorität und Quelle zusätzlich Schweregrad und Symbol liefern (Text bleibt Pflicht, nie nur Farbe, FR-005); Unit-Test `apps/web/src/components/debt/labels.test.ts` (Vitest) prüft, dass jeder Wert Beschriftung, Schweregrad und Symbol hat
- [X] T010 [P] Baustein `StatusTag` in `apps/web/src/components/ui/StatusTag.tsx` (nutzt T009, `tag` aus `@primereact/ui`) und `apps/web/src/components/debt/SourceBadge.tsx` darauf umstellen
- [X] T011 [P] Baustein `PageStates` in `apps/web/src/components/ui/PageStates.tsx` (Laden mit `skeleton`/`progressspinner`, leer, Fehler mit `message`; `role="status"`/`role="alert"` erhalten) und `apps/web/src/components/shell/states.tsx` als dünne Weiterleitung darauf umbauen, damit bestehende Importe `Loading`, `ErrorState`, `Empty` weiter funktionieren
- [X] T012 [P] Baustein `FormField` in `apps/web/src/components/ui/FormField.tsx` (Beschriftung, Pflichtmarkierung, Hilfetext, Fehlermeldung am Feld, `aria-describedby`/`aria-invalid`, Werte bleiben bei Fehlern erhalten, FR-006)
- [X] T013 [P] Baustein `ConfirmDialog` in `apps/web/src/components/ui/ConfirmDialog.tsx` aus `dialog` (Titel, Text, Bestätigen/Abbrechen, Fokusfalle, Escape schließt, Schaltflächen deutsch; Bibliothek bringt keinen fertigen Bestätigungsdialog mit, R-8)
- [X] T014 [P] Baustein `Notifier` in `apps/web/src/components/ui/Notifier.tsx` (Hook `useNotify()` mit `success|warn|error`, blendet sich aus, `role` für Hilfstechnologien; FR-007)
- [X] T015 Baustein `DataGrid` in `apps/web/src/components/ui/DataGrid.tsx` aus `datatable`: Spaltenkopf-Sortierung und Filter als gesteuerte Eigenschaften (Zustand liegt bei der Seite, kein Eigen-Sortieren), „Mehr laden“-Schaltfläche, Lade-/Leer-/Fehlerzustand über T011, `scrollable`, Zeilenklick per Link/Tastatur (R-5)

**Checkpoint**: Thema, Provider, Locale und Bausteine stehen; Seiten können umgestellt werden.

---

## Phase 3: User Story 1 – Einheitlicher App-Rahmen und Navigation (Priorität: P1) 🎯 MVP

**Ziel**: Navigation im Hamburger-Menü mit Gruppen „Arbeit“ und „Verwaltung“, Benutzeranzeige, Abmelden, Hinweise im neuen Stil; auf schmalen Bildschirmen einklappbar.

**Unabhängiger Test**: Anmelden, alle neun Einträge öffnen (aktueller Eintrag hervorgehoben), Fenster auf Smartphone-Breite ziehen, Navigation ein-/ausklappen, abmelden.

- [X] T016 [US1] Client-Baustein `SideNav` in `apps/web/src/components/ui/SideNav.tsx`: Gruppen „Arbeit“ (Dashboard `/dashboard`, Register `/register`, Prioritäten `/priorities`, Integrationen `/integrations`) und „Verwaltung“ (Bewertungsmodell `/settings/assessment-model`, Produkte `/settings/products`, Rollen `/settings/members`, Teams `/settings/teams`, Protokoll `/settings/audit`), aktueller Eintrag per `usePathname()` hervorgehoben und mit `aria-current="page"`, `aria-label="Hauptnavigation"`; Next-`Link` für Navigation
- [X] T017 [US1] `apps/web/src/components/shell/Shell.tsx` umbauen: Kopfleiste (Produktname, Menüknopf für schmale Bildschirme, Benutzername, Abmelden als Server-Action-Formular unverändert), `SideNav` fest ab Tablet-Breite, darunter als `drawer` einklappbar; `IntegrationAlert` und Inhalt rechts; keine seitliche Scrollleiste bei 375 px Breite; Inline-Stile entfernen
- [X] T018 [P] [US1] `apps/web/src/components/shell/IntegrationAlert.tsx` und `apps/web/src/components/shell/NoProductNotice.tsx` auf `message` (Warnung bzw. Info) umstellen, Text und Link-Ziele unverändert
- [X] T019 [P] [US1] Anmeldeseite/Startseite `apps/web/src/app/page.tsx` im neuen Stil (Karte mit Anmelden-Schaltfläche); Anmeldeablauf unverändert
- [X] T020 [US1] E2E-Selektoren in `apps/web/tests/e2e/helpers.ts` und `apps/web/tests/e2e/authorization.spec.ts` auf Rollen/Beschriftungen der neuen Navigation anpassen; Erwartungen (welche Einträge pro Rolle sichtbar sind) unverändert; zusätzlichen Fall „Smartphone-Breite: Navigation öffnen und Bereich erreichen“ ergänzen

**Checkpoint**: Rahmen auf allen Seiten sichtbar und bedienbar; MVP demonstrierbar.

---

## Phase 4: User Story 2 – Register, Detailansicht und Erfassung (Priorität: P1)

**Ziel**: Register als servergesteuerte Tabelle mit „Mehr laden“; Formulare, Dialoge und Rückmeldungen im neuen Stil.

**Unabhängiger Test**: Schuld anlegen (Pflichtfeld leer → Fehler am Feld), im Register filtern/sortieren/suchen/nachladen, öffnen, bewerten, Priorität überschreiben, Duplikate zusammenführen – gleiche Ergebnisse wie vorher.

- [X] T021 [US2] `apps/web/src/app/(app)/register/page.tsx` auf `DataGrid` umstellen: Suchfeld, Filter (Art, Status, Produkt, Team, Quelle) und Sortierauswahl (`-createdAt`, `createdAt`, `title`, `status`, `-priority`) als `inputtext`/`select`; bestehende `useInfiniteQuery`-Abfrage mit Cursor, Filtern und Sortierung unverändert (kein neuer API-Aufruf); Spalten Titel (Link auf `/debt/[id]`), Art, Status, Priorität, Quelle über `StatusTag`; „Mehr laden“ löst `fetchNextPage` aus; Lade-/Leer-/Fehlerzustand über `PageStates`
- [X] T022 [P] [US2] `apps/web/src/components/debt/DebtForm.tsx` auf `FormField`-Bausteine umstellen (Titel, Beschreibung, Art, Produkt, Verantwortlicher, weitere vorhandene Felder); Validierungsregeln und Pflichtfelder unverändert, Fehler am Feld, Eingaben bleiben erhalten; Erfolg/Fehler über `useNotify()`
- [X] T023 [P] [US2] `apps/web/src/components/debt/AssessmentPanel.tsx` im neuen Stil (Kriterien als `inputnumber`/`select`, Herleitung des Prioritätswerts als Tabelle, Bewertungsverlauf mit Datum und Urheber)
- [X] T024 [P] [US2] `apps/web/src/components/debt/PriorityOverride.tsx` im neuen Stil; Begründung bleibt Pflicht (Constitution V); Bestätigung über `ConfirmDialog`
- [X] T025 [P] [US2] `apps/web/src/components/debt/MergeDuplicates.tsx` im neuen Stil mit `ConfirmDialog` vor dem Zusammenführen und Rückmeldung über `useNotify()`
- [X] T026 [US2] Seiten `apps/web/src/app/(app)/debt/new/page.tsx` und `apps/web/src/app/(app)/debt/[id]/page.tsx` auf die umgestellten Komponenten setzen (Statuswechsel als `select` mit Rückmeldung, Verlauf der Schuld als `timeline` oder Tabelle, Quelle über `SourceBadge`)
- [X] T027 [US2] E2E-Tests `apps/web/tests/e2e/register.spec.ts`, `apps/web/tests/e2e/scoring.spec.ts` und `apps/web/tests/e2e/merge.spec.ts` auf neue Bedienelemente anpassen (Rollen/Beschriftungen statt nativer `select`); fachliche Erwartungen unverändert (FR-015); Fall „Pflichtfeld leer → Fehlermeldung am Feld“ ergänzen
- [ ] T028 [US2] Leistungsprüfung: Register mit 10.000 Schulden (vorhandenes Seed-/Lastskript unter `scripts/` bzw. `tests/` verwenden) laden, Erstanzeige und „Mehr laden“ messen (< 3 s, SC-004); Ergebnis kurz in `specs/002-primereact-ui/quickstart.md` notieren

**Checkpoint**: Kernabläufe (P1) vollständig im neuen Stil; Story 1 und 2 unabhängig lauffähig.

---

## Phase 5: User Story 3 – Dashboard, Prioritäten und Auswertungen (Priorität: P2)

**Ziel**: Dashboard und Prioritätenliste im neuen Stil; Diagramme folgen Hell/Dunkel.

**Unabhängiger Test**: Dashboard und Prioritäten öffnen, Zahlen/Verläufe mit dem Stand vorher vergleichen, Export ausführen, im dunklen Thema prüfen.

- [X] T029 [US3] `apps/web/src/components/dashboard/theme.tsx` auf Design-Tokens des Presets umstellen (Farben aus CSS-Variablen von T005 lesen statt fester Werte; Dunkel-Selektor verwenden; Reihen-/Bandfarben für Hell und Dunkel erhalten, in beiden unterscheidbar auch ohne Farbwahrnehmung)
- [X] T030 [P] [US3] `apps/web/src/components/dashboard/StatTile.tsx` auf `card` umstellen (Wert, Beschriftung, Hinweis)
- [X] T031 [P] [US3] `apps/web/src/components/dashboard/BarList.tsx` im neuen Stil (Balken über Token-Farben, Datentabelle als Alternative bleibt erhalten)
- [X] T032 [P] [US3] `apps/web/src/components/dashboard/HistoryChart.tsx`: Recharts bleibt, Achsen-/Gitter-/Serienfarben aus Tokens (T029), Tooltip und Legende im neuen Stil
- [X] T033 [US3] `apps/web/src/app/(app)/dashboard/page.tsx` auf umgestellte Bausteine setzen (Raster aus Karten, `PageStates`); angezeigte Werte und API-Aufrufe unverändert
- [X] T034 [P] [US3] `apps/web/src/app/(app)/priorities/page.tsx` auf `DataGrid` umstellen und `apps/web/src/components/export/ExportButton.tsx` auf `button` mit Lade-/Fehlerrückmeldung über `useNotify()`; Exportinhalt unverändert
- [X] T035 [US3] E2E-Test `apps/web/tests/e2e/dashboard.spec.ts` an neue Bedienelemente anpassen; Erwartungen (Zahlen, Export) unverändert

**Checkpoint**: Story 3 unabhängig prüfbar.

---

## Phase 6: User Story 4 – Verwaltungsbereiche (Priorität: P2)

**Ziel**: Alle Verwaltungsseiten mit denselben Tabellen-, Formular-, Dialog- und Meldungsmustern.

**Unabhängiger Test**: Jede Verwaltungsseite öffnen, bisherige Aktionen ausführen, Zugriff ohne Recht prüfen, Geheimnisse bleiben verborgen.

- [X] T036 [P] [US4] `apps/web/src/app/(app)/integrations/page.tsx` umstellen: Integrationen als `DataGrid`, Anlegen/Bearbeiten über `dialog` mit `FormField`, Zugangsdaten-Feld als `inputpassword` ohne Anzeige gespeicherter Werte (Constitution IV), Import auf Anforderung und Löschen über `ConfirmDialog`, Rückmeldungen über `useNotify()`
- [X] T037 [P] [US4] `apps/web/src/app/(app)/settings/assessment-model/page.tsx` umstellen: Kriterien und Gewichtungen als Formular mit `inputnumber`, Speichern mit Rückmeldung
- [X] T038 [P] [US4] `apps/web/src/app/(app)/settings/products/page.tsx` umstellen: Produktliste `DataGrid`, Anlegen/Bearbeiten über `dialog`; „Erstes Produkt anlegen“-Hinweis (`NoProductNotice`) bleibt erreichbar
- [X] T039 [P] [US4] `apps/web/src/app/(app)/settings/members/page.tsx` umstellen: Rollenzuweisung je Produkt als `DataGrid` mit `select`, Änderung über `ConfirmDialog` bei Entzug von Rechten
- [X] T040 [P] [US4] `apps/web/src/app/(app)/settings/teams/page.tsx` umstellen: Teams und Mitglieder als `DataGrid`/`dialog`
- [X] T041 [P] [US4] `apps/web/src/app/(app)/settings/audit/page.tsx` umstellen: Änderungsprotokoll als `DataGrid` mit Filter und „Mehr laden“; nur lesend, keine Bearbeitung
- [X] T042 [US4] E2E-Tests `apps/web/tests/e2e/integration.spec.ts`, `apps/web/tests/e2e/assessment-model.spec.ts` und `apps/web/tests/e2e/products.spec.ts` an neue Bedienelemente anpassen; Erwartungen unverändert; in `integration.spec.ts` prüfen, dass kein Geheimnis im Seitentext erscheint

**Checkpoint**: Keine Seite im alten Stil (SC-001, per T046 geprüft).

---

## Phase 7: User Story 5 – Erscheinungsbild wählen und barrierefrei bedienen (Priorität: P3)

**Ziel**: Hell/Dunkel/System wählbar und dauerhaft; Tastaturbedienung und Kontraste geprüft.

**Unabhängiger Test**: Dunkel wählen, neu laden (kein Aufblitzen), Systemeinstellung wechseln, Hauptabläufe nur per Tastatur, automatisierte Prüfung in hell und dunkel.

- [X] T043 [US5] `ThemeToggle` in `apps/web/src/components/ui/ThemeToggle.tsx` (hell/dunkel/System als `togglebuttongroup`; schreibt `tessera-theme` in `localStorage` in try/catch und setzt `data-theme`; bei `system` auf `prefers-color-scheme` und dessen Änderungen reagieren) und in die Kopfleiste von `apps/web/src/components/shell/Shell.tsx` einbauen
- [X] T044 [US5] `apps/web/tests/e2e/accessibility.spec.ts` erweitern: alle Seiten in hellem **und** dunklem Thema mit `@axe-core/playwright` prüfen (null schwerwiegende/kritische Verstöße, SC-003); Fälle „Wahl bleibt nach Neuladen“, „Systemeinstellung als Standard“ und „Tastatur: Navigation, Register-Filter, Dialog öffnen/schließen mit Fokusrückgabe“ ergänzen
- [X] T045 [US5] Bei Befunden aus T044 beheben: Kontraste und Fokusmarkierung im Preset (`apps/web/src/theme/preset.ts`), fehlende Beschriftungen/`aria`-Attribute in den Bausteinen unter `apps/web/src/components/ui/`; `prefers-reduced-motion` respektieren (Animationen reduzieren)

**Checkpoint**: Alle Stories unabhängig funktionsfähig.

---

## Phase 8: Polish & übergreifendes

- [X] T046 Restprüfung: `grep -rn "style={{" apps/web/src` und Suche nach nativen `<table`, `<select`, `<button`, `<input` in `apps/web/src`; verbleibende Stellen umstellen oder begründen (SC-001, FR-001, FR-013); Stichprobe aller Seiten auf englische Standardtexte der Bibliothek (SC-008)
- [X] T047 [P] Farbtest für SC-007: Akzentfarbe in `apps/web/src/theme/preset.ts` testweise ändern und prüfen, dass alle Seiten ohne weitere Änderung folgen; Änderung zurücknehmen
- [X] T048 [P] Docker-Image prüfen: `docker build -f deploy/Dockerfile.web` (bzw. `pnpm --filter @tessera/web build`) und Start des Standalone-Servers; Pakete von PrimeReact sind enthalten, Seiten laden ohne Lizenzhinweis mit gesetztem Schlüssel (R-10)
- [X] T049 [P] Architekturdoku aktualisieren: `docs/architecture/context-and-building-blocks.md` (Web-Baustein: PrimeReact 11, `theme/`, `components/ui/`), `docs/architecture/quality-goals.md` (Barrierefreiheit hell/dunkel) und Abschnitt Constitution-Check in `docs/architecture/vision.md`; `pnpm check:docs` ausführen
- [X] T050 Gesamtlauf aus [quickstart.md](quickstart.md): `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`, `pnpm check:generated`, `pnpm build`, `pnpm format:check`; manuelle Szenarien 1–7 durchgehen und Abweichungen beheben

---

## Dependencies & Execution Order

### Phasen

- **Setup (Phase 1)**: T001 zuerst; T002 (Spike) danach – sein Ergebnis kann T005–T008 verändern; T003/T004 parallel dazu, T003 endgültig nach T002
- **Foundational (Phase 2)**: nach Phase 1; blockiert alle Stories
- **US1 (P1)**: nach Phase 2 – MVP
- **US2 (P1)**: nach Phase 2; unabhängig von US1 testbar (im Rahmen des alten oder neuen Shell), sinnvoll nach US1
- **US3 (P2)**, **US4 (P2)**: nach Phase 2; voneinander unabhängig
- **US5 (P3)**: nach Phase 2; T044/T045 am besten nach US1–US4, da sie alle Seiten prüfen
- **Polish (Phase 8)**: nach den gewünschten Stories

### Abhängigkeiten innerhalb der Phasen

- T005 → T006 (Locale nutzt Provider-Optionen) → T007 → T008
- T009 → T010; T011, T012, T013, T014 unabhängig; T015 nach T011
- T016 → T017; T021 nach T015, T010, T011; T026 nach T022–T025
- T029 → T030–T033; T043 nach T017 (Kopfleiste)

### Parallele Möglichkeiten

- Phase 2: T009–T014 gleichzeitig (verschiedene Dateien), danach T015
- US2: T022–T025 gleichzeitig, danach T026
- US3: T030–T032 gleichzeitig
- US4: T036–T041 gleichzeitig (je eine Seite)
- Mit mehreren Personen: nach Phase 2 US1/US2 (P1) gemeinsam, US3 und US4 parallel dazu

---

## Implementation Strategy

### MVP zuerst (US1)

1. Phase 1 und 2 abschließen (Spike T002 entscheidet über SSR-Eignung)
2. Phase 3 (US1) – Rahmen und Navigation → prüfen und vorzeigen
3. Phase 4 (US2) – Kernabläufe im neuen Stil → P1 vollständig

### Schrittweise Auslieferung

Die Anwendung bleibt nach jeder Story lauffähig, denn nicht umgestellte Seiten funktionieren im neuen Rahmen weiter (alte Inline-Stile stören nicht). Reihenfolge: US1 → US2 → US3 → US4 → US5 → Polish.

### Hinweise

- PrimeReact 11 hat eine **andere API als Version 10** (zusammengesetzte Teile wie `Select.Root`/`Select.Trigger`); keine Beispiele aus Version 10 übernehmen, stattdessen Typdefinitionen unter `node_modules/primereact/<komponente>/` lesen
- Kein `fetch` und keine handgeschriebenen API-Aufrufe in `apps/web/src` (ESLint-Regel, Constitution VII)
- Nach jeder Aufgabe oder logischen Gruppe committen
