# Phase 0 – Research: PrimeReact 11

Stand 2026-11-01, geprüft gegen die npm-Pakete (nicht gegen Dokumentationsseiten, die teilweise noch „alpha“ ausweisen).

## R-1 Version, Verfügbarkeit, Lizenz

- **Decision**: `@primereact/ui` und `primereact` in Version **11.2.2** (npm `latest`); Peer-Abhängigkeit `react >= 19` passt zu React 19 im Projekt.
- **Befund**: Die Hauptversion 11 ist stabil verfügbar. Die Lizenz ist die **PrimeUI License** (nicht MIT): kostenlos als Community License (u. a. unter 1 Mio. USD Jahresumsatz, weniger als 5 Entwickler, weniger als 10 Mitarbeiter, weniger als 3 Mio. USD Fremdkapital; Privatpersonen, Studierende, Non-Profits, nicht-kommerzielle Open-Source-Projekte), sonst kostenpflichtig pro Entwickler. **Ein Lizenzschlüssel ist erforderlich** (Prüfung offline, ohne Telemetrie); fehlt er, kann die Bibliothek einen Lizenzhinweis anzeigen. Weitergabe als Entwicklungswerkzeug erfordert eine OEM-Lizenz.
- **Entscheidung des Auftraggebers (2026-11-01)**: Tessera fällt unter die kostenlose **Community License**. Die Community License verlangt eine jährliche Bestätigung der Berechtigung; der Termin wird in der Betriebsdoku vermerkt.
- **Rationale/Folge**: Der Auftraggeber stellt den Community-Schlüssel bereit. Der Schlüssel wird über Umgebungskonfiguration eingespielt (nicht im Repository, Prinzip IV) und in `deploy/` sowie der Betriebsdoku ergänzt. Der Schlüssel muss vor dem produktiven Betrieb vorliegen.
- **Alternatives**: PrimeReact 10 (MIT, andere API) – widerspricht der Vorgabe „Version 11“; bei fehlender Lizenzberechtigung die Rückfalloption.

## R-2 Gestylt vs. ungestylt

- **Decision**: Gestylte Schicht über `@primereact/ui` mit einem Preset aus `@primeuix/themes`; Akzentfarbe über Design-Tokens des Presets.
- **Rationale**: Das Paket `primereact` selbst liefert nur ungestylte Primitive; die gestylte Variante ist `@primereact/ui` (nutzt `@primereact/styles`). Das erfüllt „neutrales Standardthema mit Tessera-Akzentfarbe“ (Klärung) mit dem geringsten Aufwand und ermöglicht Hell/Dunkel sowie die zentrale Anpassung (FR-013).
- **Alternatives**: Ungestylt + Tailwind v4 (maximale Freiheit, aber deutlich mehr Eigenbau und Pflege, widerspricht Einfachheit); `@primereact/styles` je Komponente einbinden (nur sinnvoll für Sonderfälle).

## R-3 Kompatibilität mit Next.js 15 App Router

- **Decision**: Provider und alle interaktiven Bausteine als Client Components (`'use client'`); Seiten bleiben, wie heute, überwiegend Client Components mit TanStack Query. `Shell` bleibt serverseitig (Auth), bindet aber Client-Bausteine (Navigation, ThemeToggle) ein.
- **Offen/zu prüfen in der ersten Aufgabe (Spike)**: Stile werden zur Laufzeit durch `@primeuix/styled` erzeugt – wir prüfen, ob beim Server-Rendern ein ungestalteter Zwischenzustand (FOUC) entsteht, wie Stile in den Server-Render einfließen, und ob `transpilePackages` nötig ist. Ergebnis wird im ADR festgehalten.
- **Spike-Ergebnis (2026-11-01)**: Mit `PrimeReactStyleSheet` und `useServerInsertedHTML` (siehe `apps/web/src/components/shell/PrimeProvider.tsx`) stehen die Stile bereits im ausgelieferten HTML (kein ungestalteter Zwischenzustand). `transpilePackages` ist nicht nötig. Der Dunkel-Selektor `:root[data-theme='dark']` wirkt. Ohne Lizenzschlüssel erscheint unten rechts das Banner „Invalid PrimeUI License“; der Schlüssel wird als `NEXT_PUBLIC_PRIMEUI_LICENSE` zur Build-Zeit gesetzt (die Prüfung läuft im Browser, der Wert ist ein Lizenz-Token, kein Zugangsgeheimnis). Eine offizielle Next.js-Anleitung existiert; sie war beim Recherchieren nicht abrufbar.
- **Alternatives**: Auf Client-seitiges Rendern der Rahmen-Teile beschränken, falls SSR-Stile nicht zuverlässig sind.

## R-4 Hell/Dunkel ohne Aufblitzen (FR-010)

- **Decision**: Wahl (hell/dunkel/System) in `localStorage`; ein kleines Inline-Skript im `<head>` setzt vor dem ersten Rendern ein Attribut/eine Klasse am `<html>`-Element, auf das der Dunkel-Selektor des Presets reagiert. Standard: `prefers-color-scheme`.
- **Rationale**: Der Wert liegt nur im Browser (keine Serverdaten, Spezifikation „Erscheinungsbild-Auswahl“); ein Cookie wäre nur nötig, wenn der Server das Thema mitrendern müsste.
- **Alternatives**: Cookie + serverseitiges Rendern (mehr Aufwand ohne klaren Gewinn).

## R-5 Register: serverseitige Tabelle mit „Mehr laden“

- **Decision**: DataTable-Bausteine aus `primereact/datatable` mit manuellem (servergesteuertem) Sortieren/Filtern; Daten weiter über den vorhandenen `useInfiniteQuery` mit Cursor (`sort`, Filter, `cursor`), Auslösung über „Mehr laden“. Keine Änderung an API oder generiertem Client.
- **Rationale**: Die API blättert per Cursor und unterstützt Filter/Sortierung bereits (Klärung 2); feste Seitenzahlen wären ohne Backend-Änderung nicht möglich.
- **Alternatives**: Offset-Paginierung (erfordert Backend-Änderung, ausgeschlossen).

## R-6 Deutsche Texte (FR-011)

- **Decision**: Das Paket `@primeuix/locale` ist Abhängigkeit des Core; eine deutsche Locale-Konfiguration (Pagination, Filter, Datum, Leerzustände, ARIA-Texte) wird zentral im Provider hinterlegt, fehlende Schlüssel selbst ergänzt. Test: Stichprobe auf englische Standardtexte (SC-008).

## R-7 Diagramme

- **Decision**: Recharts bleibt; `dashboard/theme.tsx` liest Farben aus den Design-Tokens des Presets (CSS-Variablen), damit Hell/Dunkel stimmt. Werte bleiben unverändert (FR-009).
- **Alternatives**: PrimeReact-Diagramme gibt es in v11 nicht als Komponente (kein `chart`-Paket in `primereact` 11.2.2); Wechsel wäre ohne Nutzen.

## R-8 Mapping bestehender Elemente auf Bausteine

Details in [contracts/ui-contract.md](contracts/ui-contract.md). Verfügbare Pakete in 11.2.2 u. a.: `datatable`, `select`, `inputtext`, `textarea`, `inputnumber`, `datepicker`, `dialog`, `toast`/`toaster`, `message`, `tag`/`badge`, `button`, `navigationmenu`, `drawer`/`sidebar`, `tabs`, `skeleton`, `progressspinner`, `paginator`, `tooltip`. Ein fertiger Bestätigungsdialog (`ConfirmDialog`) ist nicht dabei – er wird aus `dialog` gebaut (siehe `components/ui/`).

## R-9 Tests

- Bestehende E2E-Tests nutzen teils native Elemente (`select`, `button`). Selektoren werden auf Rollen und Beschriftungen umgestellt; das fachliche Erwartungsverhalten bleibt (FR-015). `accessibility.spec.ts` prüft zusätzlich das dunkle Thema (SC-003).

## R-10 Container und Betrieb

- Die Pakete müssen im `standalone`-Output enthalten sein (Dateiverfolgung ab Monorepo-Wurzel ist bereits gesetzt). Der Lizenzschlüssel wird als Laufzeit- bzw. Build-Variable über `deploy/` zugeführt; Doku in `docs/architecture/` ergänzen.
