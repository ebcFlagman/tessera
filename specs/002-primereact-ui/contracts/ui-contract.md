# UI Contract: Bausteine und Seitenzuordnung

Kein externer Vertrag (API unverändert). Dieses Dokument legt fest, welche Bausteine Seiten verwenden dürfen.

## Wiederverwendbare Bausteine (`apps/web/src/components/ui/`)

| Baustein | Aufgabe | Quelle |
|----------|---------|--------|
| `AppShell` / `SideNav` | Rahmen, Gruppen „Arbeit“ und „Verwaltung“, einklappbar auf kleinen Bildschirmen | `navigationmenu`, `drawer` |
| `ThemeToggle` | hell / dunkel / System | `togglebuttongroup` oder `select` |
| `DataGrid` | Tabelle mit Spaltenkopf-Sortierung, Filterleiste, „Mehr laden“, Leer-/Lade-/Fehlerzustand | `datatable`, `skeleton` |
| `FormField` | Beschriftung, Pflichtmarkierung, Hilfetext, Fehlermeldung am Feld | `label`, `inputtext`, `textarea`, `select`, `inputnumber`, `datepicker` |
| `StatusTag` | Status/Art/Priorität/Quelle mit Symbol und Text | `tag` |
| `ConfirmDialog` | einheitliche Bestätigung folgenreicher Aktionen | `dialog` |
| `Notifier` | Rückmeldungen (Erfolg, Warnung, Fehler), blenden sich aus | `toast`, `toaster` |
| `PageStates` | Laden, leer, Fehler (löst `shell/states.tsx` ab) | `skeleton`, `message` |

## Regeln

1. Seiten importieren aus `components/ui/` bzw. direkt aus `@primereact/ui`; keine eigenen Stilwerte (Farben, Abstände) in Seiten.
2. API-Aufrufe bleiben ausschließlich über den generierten Client (ESLint-Regel).
3. Jedes Feld mit Validierungsfehler verknüpft die Meldung per `aria-describedby`.
4. Statusanzeigen enthalten stets Text, nicht nur Farbe.
5. Alle sichtbaren Texte deutsch.

## Seitenzuordnung

| Seite | Kern-Bausteine |
|-------|----------------|
| `register` | `DataGrid`, Filter, `StatusTag`, Export |
| `debt/new`, `debt/[id]` | `FormField`, `AssessmentPanel`, `PriorityOverride`, `MergeDuplicates` (`ConfirmDialog`) |
| `priorities` | `DataGrid`, `ExportButton` |
| `dashboard` | `StatTile` (Karte), `BarList`, `HistoryChart` (Recharts mit Token-Farben) |
| `integrations` | `DataGrid`, `FormField`, `ConfirmDialog`, `Notifier` |
| `settings/*` | `DataGrid`, `FormField`, `ConfirmDialog` |
