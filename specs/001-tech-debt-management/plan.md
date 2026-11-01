# Implementation Plan: Tessera – Plattform für Architektur- und Technische Schulden

**Branch**: `001-tech-debt-management` | **Date**: 2026-10-31 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-tech-debt-management/spec.md`

## Summary

Tessera erfasst, bewertet und priorisiert architektonische und technische Schulden, importiert Befunde aus SonarCloud und GitLab Cloud und liefert Dashboards/Berichte. Zusätzlich entsteht eine versionierte Architekturvision im Repository (`docs/architecture/`).

Technischer Ansatz (Details in [research.md](research.md)): pnpm-Monorepo mit zwei Next.js-Anwendungen (Frontend mit React, Backend als REST-API über Route Handlers), einem Hintergrund-Worker für Importe, PostgreSQL als Speicher, Anmeldung per OIDC gegen Keycloak und einem Connector-Paket mit einheitlicher Schnittstelle für Integrationsquellen.

## Technical Context

**Language/Version**: TypeScript 5.x (strict), Node.js 22 LTS

**Primary Dependencies**: Next.js (App Router) und React 19 für `apps/web` und `apps/api`; Prisma (ORM); pg-boss (Jobs auf PostgreSQL); Auth.js (Keycloak-Provider) im Frontend; `jose` (JWT-Prüfung) im Backend; Zod (Validierung); TanStack Query und Recharts im Frontend

**Storage**: PostgreSQL 16 (Daten, Job-Queue, Auditlog); Zugangsdaten externer Quellen verschlüsselt (AES-256-GCM) in der Datenbank, Schlüssel aus Secret-Konfiguration

**Testing**: Vitest (Unit/Integration, Testcontainers für PostgreSQL), Playwright (E2E), Vertragstests gegen die OpenAPI-Spezifikation, aufgezeichnete Fixtures für SonarCloud/GitLab

**Target Platform**: Linux-Container (OCI), betrieben hinter Reverse Proxy; vorhandene Keycloak-Instanz

**Project Type**: Web-Anwendung (Frontend + Backend) mit Worker

**Performance Goals**: Register/Filter/Dashboard < 3 s bei 10.000 Schulden (SC-005); Erstimport von 1.000 Befunden < 10 min (SC-003)

**Constraints**: Keine eigenen Passwörter; Zugangsdaten nie im Klartext in Antworten/Logs; Importe respektieren Rate-Limits; Importe blockieren keine Benutzeranfragen

**Scale/Scope**: ~100 Benutzer, ~50 Produkte, bis ~10.000 Schulden je Instanz, 2 Connectoren in v1, ca. 8 Hauptansichten

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Prüfung gegen Constitution v1.1.0 (2026-10-31); das Ergebnis für den fertigen Stand mit Belegen steht in [docs/architecture/vision.md](../../docs/architecture/vision.md#constitution-check-stand-2026-10-31-version-110):

| Prinzip | Ergebnis | Anmerkung |
|---------|----------|-----------|
| I. Fachlogik zuerst | Erfüllt | `packages/domain` ohne I/O; Route Handlers delegieren |
| II. Erweiterbar an den Rändern | Erfüllt | Connector-Interface, Connectoren schreiben nicht in die DB, Fixture-Tests |
| III. Nachvollziehbarkeit | Erfüllt | `DebtEvent`, `Assessment`, `AuditEntry` (nur anfügend) |
| IV. Geheimnisse bleiben geheim | Erfüllt | AES-256-GCM, keine Rückgabe in API, Redaction im Logging, OIDC |
| V. Manuell schlägt automatisch | Erfüllt | Ausnahme „Quelle getilgt gewinnt“ ist in Constitution v1.1.0 und FR-011a verankert; Vorheriger Status im Verlauf |
| VII. Backend ist der Vertrag | Erfüllt (Umsetzung offen) | Backend-Code (Zod-Schemas, Routen) erzeugt die OpenAPI-Spezifikation; Frontend-Client/Typen werden daraus generiert (`packages/api-types`); CI-Prüfung auf Aktualität in den Tasks |
| VI. Einfach vor clever | Erfüllt | Abweichungen unter „Complexity Tracking“ begründet |
| Technologie-/Sicherheitsvorgaben | **Teilweise** | `contracts/openapi.yaml` ist nur ein Entwurf zur Orientierung und keine Quelle; maßgeblich ist die aus dem Backend-Code erzeugte Spezifikation (Prinzip VII) |
| Workflow/Quality Gates | **Teilweise** | Die Entscheidungen D1–D12 sind noch keine ADRs; Tasks müssen sie in `docs/architecture/adr/` anlegen |

**Offene Punkte für `/speckit-tasks`**: (1) Erzeugung der OpenAPI-Spezifikation aus dem Backend-Code sowie Client-/Typ-Generierung und CI-Prüfung früh einrichten, bevor Frontend-Ansichten entstehen. (2) ADR-Aufgaben für D1–D12 einplanen.

## Project Structure

### Documentation (this feature)

```text
specs/001-tech-debt-management/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── openapi.yaml        # Entwurf/Orientierung, nicht maßgeblich
│   └── connector-interface.md
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
apps/
├── web/                    # Next.js + React Frontend
│   ├── src/app/            # Routen: register, debt/[id], dashboard, integrations, settings
│   ├── src/components/
│   ├── src/lib/            # API-Client (aus OpenAPI), Auth
│   └── tests/
├── api/                    # Next.js Backend (Route Handlers, REST /api/v1)
│   ├── src/app/api/v1/     # Routen + Zod-Schemas; erzeugen die OpenAPI-Spezifikation
│   ├── src/services/       # Schulden, Bewertung, Integrationen, Berichte, Audit
│   ├── src/auth/           # JWT-Prüfung, Rollen
│   └── tests/
└── worker/                 # Node-Prozess: Import-Jobs, Zeitplan (pg-boss); apps/api legt Importjobs über dieselbe Queue an
    └── src/
packages/
├── db/                     # Prisma-Schema, Migrationen, Client
├── domain/                 # Typen, Bewertungslogik, Zustandsübergänge (rein, ohne I/O)
├── connectors/             # Connector-Schnittstelle + sonarcloud/, gitlab/
└── api-types/              # aus der erzeugten OpenAPI-Spezifikation generierte Typen und Client (nicht von Hand ändern)
docs/
└── architecture/           # Vision, Qualitätsziele, Kontext, Bausteine, ADRs
    ├── vision.md
    ├── quality-goals.md
    ├── context-and-building-blocks.md
    ├── integration-concept.md
    └── adr/
deploy/                     # Container-Dateien, Beispielkonfiguration
```

**Structure Decision**: Monorepo mit zwei Next.js-Apps (wie vom Auftraggeber vorgegeben), einem Worker und gemeinsamen Paketen. Fachlogik liegt in `packages/domain` und `apps/api/src/services`, nicht in Route Handlers oder React-Komponenten.

## Complexity Tracking

| Abweichung | Warum nötig | Einfachere Alternative abgelehnt, weil |
|------------|-------------|----------------------------------------|
| Zwei getrennte Next.js-Apps (web + api) | Ausdrückliche Vorgabe: Backend und Frontend je in Next.js; klare Trennung von UI und API, unabhängig deploybar | Eine einzige Next.js-App wäre einfacher, widerspricht aber der Vorgabe; Option bleibt als ADR-Thema offen |
| Eigener Worker-Prozess | Next.js eignet sich nicht für langlaufende, zeitgesteuerte Importe (FR-009, SC-003, stündlicher Lauf) | Jobs in Route Handlers würden Anfragen blockieren und bei Neustarts verloren gehen |
