# Implementation Plan: Einheitliche Oberfläche mit PrimeReact 11

**Branch**: `002-primereact-ui` | **Date**: 2026-11-01 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/002-primereact-ui/spec.md`

## Summary

Die bestehende, schlicht gestaltete Web-Oberfläche (`apps/web`) wird vollständig auf PrimeReact 11 umgestellt: App-Rahmen mit seitlicher Navigation, Register als serverseitig paginierte Tabelle, Formulare, Dialoge, Rückmeldungen, Dashboard und Verwaltungsseiten, dazu Hell/Dunkel-Wahl und deutsche Beschriftungen. Fachverhalten, API und Backend bleiben unverändert.

Technischer Ansatz (Details in [research.md](research.md)): Das Paket `@primereact/ui` (gestylte Schicht über den ungestylten Primitiven `primereact` 11.2.2) mit einem Preset aus `@primeuix/themes`, angepasst an eine Tessera-Akzentfarbe und eingebunden über einen einzigen `PrimeReactProvider` in `Providers.tsx`. Wichtig: Version 11 ist eine Neuentwicklung mit anderer, zusammensetzbarer Komponenten-API (`Select.Root`, `Select.Trigger` …); Wissen und Beispiele aus PrimeReact 10 sind nicht übertragbar.

## Technical Context

**Language/Version**: TypeScript 5.9 (strict), Node.js 22 LTS (unverändert)

**Primary Dependencies**: Next.js 15.5 (App Router) und React 19 (unverändert); neu: `@primereact/ui` 11.2.2 (bringt `primereact` und `@primereact/styles` mit), `@primeuix/themes` 3.1.0 (Presets), `@primeicons/react` (Symbole); bleibt: TanStack Query, `openapi-fetch`, Recharts

**Storage**: keine Änderung; Erscheinungsbild-Wahl nur im Browser des Benutzers

**Testing**: Playwright (E2E, bestehende Tests angepasst an neue Bedienelemente), `@axe-core/playwright` (hell und dunkel), Vitest für reine Hilfsfunktionen (z. B. Mapping Status → Markierung)

**Target Platform**: Linux-Container (OCI), `output: 'standalone'` bleibt; aktuelle Desktop- und Mobilbrowser

**Project Type**: Web-Anwendung; Änderung nur in `apps/web`

**Performance Goals**: Register/Dashboard < 3 s bei 10.000 Schulden (SC-004); Theme-Wechsel < 1 s (SC-006)

**Constraints**: Keine handgeschriebenen API-Aufrufe (Prinzip VII); keine Geheimnisse im Klartext; Lizenzschlüssel gehört nicht ins Repository; kein Aufblitzen beim Erscheinungsbild-Wechsel; Standalone-Image muss die Pakete enthalten

**Scale/Scope**: 11 Seiten, ca. 20 Komponenten, ca. 2.000 Zeilen Oberflächencode

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Prüfung gegen Constitution v1.1.0:

| Prinzip | Ergebnis | Anmerkung |
|---------|----------|-----------|
| I. Fachlogik zuerst | Erfüllt | Reine Darstellungsänderung; Zuordnungen wie Status → Markierung leben in `labels.ts`, Fachregeln bleiben in `packages/domain` |
| II. Erweiterbar an den Rändern | Nicht berührt | Connectoren unverändert |
| III. Nachvollziehbarkeit | Nicht berührt | Keine Änderung an Audit; Aktionen rufen dieselben Endpunkte |
| IV. Geheimnisse bleiben geheim | Erfüllt, mit Auflage | Integrationsformulare zeigen Geheimnisse weiterhin nie; PrimeUI-Lizenzschlüssel kommt aus Umgebungskonfiguration, nicht aus dem Repository |
| V. Manuell schlägt automatisch | Nicht berührt | Begründungspflichten bleiben in den Formularen erhalten |
| VI. Einfach vor clever | Erfüllt | Eine Bibliothek, ein Provider, ein Thema; keine neue Laufzeitkomponente |
| VII. Backend ist der Vertrag | Erfüllt | Weiterhin ausschließlich der generierte Client; ESLint-Regel gilt weiter |
| Technologievorgaben | Erfüllt | TypeScript strict, Next.js, React; Technologie-Vorgabe des Auftraggebers |
| Workflow/Quality Gates | Offen → Aufgabe | ADR 0014 „PrimeReact 11“ und Verlinkung in der Vision (FR-016); E2E der P1-Abläufe bleiben grün |

**Ergebnis nach Phase 1**: keine Verstöße; keine Einträge unter Complexity Tracking.

**Entschieden**: Die kostenlose PrimeUI Community License gilt (siehe [research.md](research.md), R-1); der Lizenzschlüssel und die jährliche Bestätigung sind Betriebsaufgaben.

## Project Structure

### Documentation (this feature)

```text
specs/002-primereact-ui/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── ui-contract.md
├── checklists/requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
apps/web/
├── next.config.mjs          # ggf. transpilePackages für PrimeReact
├── src/
│   ├── app/
│   │   ├── layout.tsx       # Erscheinungsbild vor dem ersten Rendern setzen (kein Aufblitzen)
│   │   └── (app)/…          # alle 11 Seiten umgestellt
│   ├── theme/               # NEU: Preset, Akzentfarbe, deutsche Texte (Locale), Provider-Optionen
│   ├── components/
│   │   ├── shell/           # Shell (Navigation im Hamburger-Menü), Providers (PrimeReactProvider, Toaster), ThemeToggle
│   │   ├── ui/              # NEU: dünne Bausteine (DataTable-Grundmuster, FormField, StatusTag, ConfirmDialog, States)
│   │   ├── debt/ dashboard/ export/
│   └── lib/                 # API-Client unverändert
└── tests/e2e/               # bestehende Tests angepasst, accessibility.spec.ts um dunkles Thema erweitert
docs/architecture/adr/0014-primereact-11-ui.md   # NEU
```

**Structure Decision**: Nur `apps/web` ändert sich. Wiederverwendbare Bausteine liegen in `components/ui/`, das zentrale Thema in `src/theme/`; Seiten enthalten keine Stilwerte (FR-013).

## Complexity Tracking

Keine Verstöße – keine Einträge.
