---

description: "Aufgabenliste für Tessera – Plattform für Architektur- und Technische Schulden"
---

# Tasks: Tessera – Plattform für Architektur- und Technische Schulden

**Input**: `specs/001-tech-debt-management/` (plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md)

**Prerequisites**: plan.md, spec.md; Constitution v1.1.0 (`.specify/memory/constitution.md`)

**Tests**: Enthalten, weil die Constitution (Workflow & Quality Gates) Tests für neue Fachlogik und Endpunkte sowie E2E für P1-Abläufe verlangt.

**Organization**: Nach User Stories gruppiert (US1–US6 laut spec.md). Prinzip VII: Der Backend-Code ist der Vertrag; `contracts/openapi.yaml` ist nur ein Entwurf.

## Format: `[ID] [P?] [Story] Beschreibung mit Dateipfad`

- **[P]**: parallel ausführbar (andere Dateien, keine Abhängigkeit zu offenen Aufgaben)
- **[Story]**: zugehörige User Story (US1–US6)

## Path Conventions

`apps/web`, `apps/api`, `apps/worker`, `packages/{db,domain,connectors,api-types}`, `docs/architecture`, `deploy` (siehe plan.md).

---

## Phase 1: Setup

- [x] T001 pnpm-Monorepo anlegen: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json` (strict), Verzeichnisse `apps/{web,api,worker}` und `packages/{db,domain,connectors,api-types}`
- [x] T002 [P] ESLint und Prettier konfigurieren (Commit-Hooks bewusst nicht eingerichtet; die CI prüft Format und Lint) in `eslint.config.mjs`, `.prettierrc`
- [x] T003 [P] Next.js-App (App Router, React 19) initialisieren in `apps/web/`
- [x] T004 [P] Next.js-App (nur Route Handlers, Basispfad `/api/v1`) initialisieren in `apps/api/`
- [x] T005 [P] Worker-Paket (Node 22, TypeScript) initialisieren in `apps/worker/package.json`
- [x] T006 [P] Vitest-Konfiguration mit eingebetteter PostgreSQL für Integrationstests (Paket `embedded-postgres` statt Testcontainers, kein Docker nötig) in `vitest.config.ts`, `apps/api/tests/helpers/global-setup.ts` und Playwright in `apps/web/playwright.config.ts`
- [x] T007 [P] Entwicklungsumgebung: `deploy/docker-compose.dev.yml` (PostgreSQL 16, Keycloak mit Testrealm und Testbenutzern admin, editor und einen Benutzer ohne Rolle) und `deploy/.env.example`
- [x] T008 [P] CI-Pipeline (Lint, Typecheck, Test, Prüfung auf veraltete OpenAPI-Spezifikation und generierten Client) in `.github/workflows/ci.yml`

---

## Phase 2: Foundational (blockiert alle User Stories)

**⚠️ CRITICAL**: Keine User Story darf vor Abschluss dieser Phase beginnen.

- [x] T009 Prisma-Schema mit Basistabellen `Product`, `User`, `Team`, `Membership` (role ∈ {admin, editor}, eindeutig je (user, product)), `AuditEntry` (nur anfügend) in `packages/db/prisma/schema.prisma`; erste Migration
- [x] T010 Prisma-Client-Paket und Seed (Testprodukte, Testbenutzer) in `packages/db/src/index.ts`, `packages/db/prisma/seed.ts`
- [x] T011 [P] Gemeinsame Fehler- und Ergebnis-Typen sowie Zod-Basisschemas (Fehlerformat `{code, message, details?}`) in `packages/domain/src/errors.ts`
- [x] T012 JWT-Prüfung gegen Keycloak-JWKS (`jose`), Benutzer-Spiegelung aus Token (`subject`, `name`, `email`) in `apps/api/src/auth/verify-token.ts`
- [x] T013 Autorisierung: Lesen für alle angemeldeten Benutzer; Schreiben nur mit Rolle editor/admin des Produkts, Admin-Aktionen nur admin in `apps/api/src/auth/authorize.ts`
- [x] T014 Audit-Service (schreibt `AuditEntry`, Details ohne Geheimnisse, Redaction) in `apps/api/src/services/audit.ts`
- [x] T015 Code-First-API-Grundgerüst: Route-Wrapper, der Zod-Schemas registriert und die OpenAPI-Spezifikation aus dem Backend-Code erzeugt (z. B. zod-to-openapi) in `apps/api/src/openapi/registry.ts`; Skript `pnpm openapi:generate` schreibt die eingecheckte Spezifikation nach `apps/api/openapi.generated.json`
- [x] T016 Client- und Typ-Generierung aus `apps/api/openapi.generated.json` nach `packages/api-types/` (z. B. openapi-typescript) mit Skript `pnpm api-types:generate`; handgeschriebene API-Aufrufe im Frontend per ESLint-Regel verbieten in `eslint.config.mjs`
- [x] T017 Vertragstest-Rahmen: Backend-Antworten gegen die erzeugte Spezifikation prüfen in `apps/api/tests/contract/setup.ts`
- [x] T018 [P] Strukturiertes Logging mit Redaction von Geheimnissen in `apps/api/src/lib/logger.ts`
- [x] T019 [P] Frontend: Auth.js mit Keycloak-Provider (Authorization Code + PKCE), Sitzungsverwaltung und Token-Weitergabe in `apps/web/src/lib/auth.ts`
- [x] T020 [P] Frontend: App-Layout, Navigation, Fehler- und Ladezustände in `apps/web/src/app/layout.tsx`, `apps/web/src/components/shell/`
- [x] T021 [P] Frontend: API-Client-Wrapper, der den generierten Client aus `packages/api-types` mit Token und TanStack Query verbindet in `apps/web/src/lib/api.ts`
- [x] T022 Test: Autorisierungsregeln (Lesen ohne Rolle erlaubt, Schreiben ohne Rolle verweigert) in `apps/api/tests/integration/authorize.test.ts`
- [x] T023 Test: CI-Schritt schlägt fehl bei veralteter Spezifikation bzw. veraltetem generiertem Client (Skript `scripts/check-generated.sh`)

**Checkpoint**: Anmeldung, Autorisierung, Audit, Code-First-OpenAPI und Client-Generierung stehen.

---

## Phase 3: User Story 1 – Schulden erfassen und im Register verwalten (P1) 🎯 MVP

**Goal**: Schulden anlegen, bearbeiten, archivieren, filtern, suchen; Statusverlauf.

**Independent Test**: Schulden anlegen, bearbeiten, filtern und Status ändern; Verlauf zeigt Urheber und Zeitpunkt (quickstart Szenario 1).

### Tests für US1

- [x] T024 [P] [US1] Unit-Tests der Zustandsübergänge (open → planned → in_progress → repaid; open/planned → accepted; repaid → open; `accepted` erfordert `accepted_reason`) in `packages/domain/tests/debt-status.test.ts`
- [x] T025 [P] [US1] Vertragstest `GET/POST /debts`, `GET/PATCH /debts/{id}` in `apps/api/tests/contract/debts.test.ts`
- [x] T026 [P] [US1] Integrationstest Register: Filter (Art, Status, Produkt, Verantwortlicher; die Filter Priorität und Quelle folgen mit US2 bzw. US3), Suche, Sortierung, Cursor-Paginierung in `apps/api/tests/integration/debt-register.test.ts`
- [x] T027 [P] [US1] E2E: Schuld mit Aufwand und Folgekosten anlegen, Verantwortlichen auswählen, filtern, Status ändern, Verlauf prüfen in `apps/web/tests/e2e/register.spec.ts`
- [x] T028 [P] [US1] Vertragstests `GET /users`, `PATCH /products/{id}` (Umbenennen, Archivieren inkl. Folgewirkung auf Schulden) in `apps/api/tests/contract/products-users.test.ts`

### Implementation für US1

- [x] T029 [P] [US1] Prisma-Modelle `DebtItem` (Felder laut data-model.md: `title` 1–200 Zeichen, `kind` ∈ {architectural, technical}, `status` ∈ {open, planned, in_progress, repaid, accepted}, `effort_estimate` und `interest_estimate` ≥ 0, `accepted_reason?`, `review_date?`, `archived_at`, `field_origin` JSON) und `DebtEvent` (`changes` JSON vorher/nachher) in `packages/db/prisma/schema.prisma`; Migration; Indizes (product_id, status), (kind), (owner_id), Volltext auf title/description
- [x] T030 [P] [US1] Zustandsübergangs-Logik und Validierung (reine Funktionen) in `packages/domain/src/debt-status.ts`
- [x] T031 [US1] Debt-Service: anlegen, ändern, archivieren, Ereignis in `DebtEvent` schreiben, Audit-Eintrag in `apps/api/src/services/debts.ts`
- [x] T032 [US1] Register-Abfrage (Suche, Filter, Sortierung, Cursor) in `apps/api/src/services/debt-query.ts`
- [x] T033 [US1] Routen `GET/POST /api/v1/debts`, `GET/PATCH /api/v1/debts/{id}` mit Zod-Schemas (Fehler 403/404/422) in `apps/api/src/app/api/v1/debts/`
- [x] T034 [US1] Routen `GET/POST /api/v1/products` (Anlegen nur admin) in `apps/api/src/app/api/v1/products/route.ts`
- [x] T035 [US1] Product-Service und Route `PATCH /api/v1/products/{id}` (Umbenennen, Archivieren; zugehörige Schulden werden archiviert statt gelöscht; nur admin) in `apps/api/src/services/products.ts`, `apps/api/src/app/api/v1/products/[id]/route.ts`
- [x] T036 [US1] Route `GET /api/v1/users` (Suche, für die Auswahl des Verantwortlichen) in `apps/api/src/app/api/v1/users/route.ts`
- [x] T037 [US1] OpenAPI-Spezifikation und Client neu generieren (`pnpm openapi:generate && pnpm api-types:generate`) und einchecken (`apps/api/openapi.generated.json`, `packages/api-types/`)
- [x] T038 [P] [US1] Frontend: Registerliste mit Filtern, Suche, Sortierung in `apps/web/src/app/register/page.tsx`
- [x] T039 [P] [US1] Frontend: Formular „Schuld erfassen/bearbeiten“ (Validierung, Aufwandsschätzung und Folgekosten ≥ 0, Auswahl des Verantwortlichen, „akzeptiert“ nur mit Begründung) in `apps/web/src/components/debt/DebtForm.tsx`
- [x] T040 [US1] Frontend: Detailseite mit Verlauf in `apps/web/src/app/debt/[id]/page.tsx`

**Checkpoint**: US1 ist eigenständig lauffähig und testbar (MVP).

---

## Phase 4: User Story 2 – Bewerten und priorisieren (P1)

**Goal**: Gewichtete Bewertung, Prioritätswert, Überschreiben mit Begründung, priorisierte Tilgungsliste.

**Independent Test**: Schulden bewerten, Gewicht ändern, Rangfolge prüfen, Priorität überschreiben (quickstart Szenario 2).

### Tests für US2

- [ ] T041 [P] [US2] Unit-Tests der Bewertungsberechnung (Kriterien je 1–5, gewichtete Summe, Normalisierung 0–100, Herleitung) in `packages/domain/tests/scoring.test.ts`
- [ ] T042 [P] [US2] Vertragstests für `/assessment-model`, `/debts/{id}/assessments`, `/debts/{id}/priority-override`, `/priority-list` in `apps/api/tests/contract/assessment.test.ts`
- [ ] T043 [P] [US2] Integrationstest: Modelländerung löst konsistente Neuberechnung aus; Überschreiben ohne Begründung wird abgelehnt; unbewertete Schulden werden in der Priorisierung getrennt von bewerteten geführt in `apps/api/tests/integration/scoring.test.ts`
- [ ] T044 [P] [US2] E2E: bewerten, Rangfolge, Überschreiben in `apps/web/tests/e2e/scoring.spec.ts`

### Implementation für US2

- [ ] T045 [P] [US2] Prisma-Modelle `Assessment` (unveränderlich) und `AssessmentModel` (versioniert, ein aktives Modell, Standardkriterien Auswirkung, Risiko, Aufwand, Folgekosten) sowie Felder `priority_calculated`, `priority_override?`, `priority_override_reason?` an `DebtItem` (Indizes auf `priority_calculated` und `priority_override`) in `packages/db/prisma/schema.prisma`; Migration und Seed des Standardmodells
- [ ] T046 [P] [US2] Bewertungslogik (reine Funktionen) in `packages/domain/src/scoring.ts`
- [ ] T047 [US2] Assessment-Service: bewerten, Historie, Neuberechnung bei neuer Modellversion, Überschreiben mit Begründung inkl. Verlauf und Audit; Änderungen am Bewertungsmodell werden im Audit festgehalten in `apps/api/src/services/assessment.ts`
- [ ] T048 [US2] Routen laut Test T042 mit Zod-Schemas (Modell ändern nur admin) in `apps/api/src/app/api/v1/assessment-model/`, `.../debts/[id]/assessments/`, `.../debts/[id]/priority-override/`, `.../priority-list/`
- [ ] T049 [US2] OpenAPI-Spezifikation und Client neu generieren und einchecken (`apps/api/openapi.generated.json`, `packages/api-types/`)
- [ ] T050 [P] [US2] Frontend: Bewertungsformular mit Herleitung des Werts und Historie in `apps/web/src/components/debt/AssessmentPanel.tsx`
- [ ] T051 [P] [US2] Frontend: Prioritätsüberschreibung (berechneter und überschriebener Wert getrennt) in `apps/web/src/components/debt/PriorityOverride.tsx`
- [ ] T052 [P] [US2] Frontend: priorisierte Tilgungsliste (Filter Produkt/Team; unbewertete Schulden getrennt ausgewiesen) in `apps/web/src/app/priorities/page.tsx`
- [ ] T053 [P] [US2] Frontend: Admin-Seite Bewertungsmodell in `apps/web/src/app/settings/assessment-model/page.tsx`

**Checkpoint**: US1 und US2 funktionieren gemeinsam und einzeln.

---

## Phase 5: User Story 5 – Architekturvision und Dokumentation (P1)

**Goal**: Versionierte Architekturvision und Doku im Repository, nutzbar als Kontext für Menschen und KI.

**Independent Test**: Eine unbeteiligte Person kann nach Lektüre Zweck, Bausteine, Integrationsansatz und die wichtigsten Entscheidungen erklären (SC-008).

- [ ] T054 [US5] Architekturvision (Zielbild, Zielgruppen, Leitprinzipien aus der Constitution, Systemgrenzen, Abgrenzung v1) in `docs/architecture/vision.md`
- [ ] T055 [P] [US5] Qualitätsziele mit Messgrößen aus spec.md (SC-003, SC-005, SC-006, SC-007) in `docs/architecture/quality-goals.md`
- [ ] T056 [P] [US5] Systemkontext und Bausteine als Mermaid-Diagramme (web, api, worker, PostgreSQL, Keycloak, SonarCloud, GitLab) in `docs/architecture/context-and-building-blocks.md`
- [ ] T057 [P] [US5] Integrationskonzept (Connector-Schnittstelle, Abgleichregeln, Feldherkunft, „Quelle getilgt gewinnt“) in `docs/architecture/integration-concept.md`
- [ ] T058 [P] [US5] ADR-Vorlage (MADR) und Index in `docs/architecture/adr/README.md`, `docs/architecture/adr/0000-template.md`
- [ ] T059 [P] [US5] ADRs 0001–0004 aus D1–D4 in `specs/001-tech-debt-management/research.md` (Monorepo/zwei Next.js-Apps, Code-First-API, PostgreSQL/Prisma, pg-boss-Worker) in `docs/architecture/adr/`
- [ ] T060 [P] [US5] ADRs 0005–0008 aus D5–D8 (Keycloak/OIDC, Connector-Plugin-Schnittstelle, Abgleich und Feldherkunft, Bewertungsmodell) in `docs/architecture/adr/`
- [ ] T061 [P] [US5] ADRs 0009–0012 aus D9–D12 (Geheimnisse, Snapshots, Teststrategie, Dokumentationsansatz) in `docs/architecture/adr/`
- [ ] T062 [US5] Vision verlinkt alle ADRs und Qualitätsziele; README verweist auf `docs/architecture/` in `docs/architecture/vision.md`, `README.md`
- [ ] T063 [US5] Dokumentationsprüfung: Link-Check der Markdown-Dateien in CI in `.github/workflows/ci.yml`

**Checkpoint**: Dokumentation vollständig und verlinkt.

---

## Phase 6: User Story 3 – Externe Quellen anbinden und importieren (P2)

**Goal**: SonarCloud und GitLab Cloud über deren APIs anbinden; idempotenter Import; Schutz manueller Felder; automatisches „getilgt“.

**Independent Test**: Verbindung einrichten, Import auslösen, keine Duplikate beim zweiten Lauf, entfernter Befund → „getilgt“ (quickstart Szenario 3).

### Tests für US3

- [ ] T064 [P] [US3] Unit-Tests Abgleich (neu/aktualisiert/fehlend, Feldherkunft schützt manuelle Felder, „getilgt“ überschreibt manuellen Status inkl. „accepted“, Wiedereröffnung bei Wiederauftauchen) in `packages/domain/tests/reconcile.test.ts`
- [ ] T065 [P] [US3] Connector-Tests mit aufgezeichneten Fixtures (Pagination, 429, ungültige Zugangsdaten) in `packages/connectors/tests/sonarcloud.test.ts`, `packages/connectors/tests/gitlab.test.ts`
- [ ] T066 [P] [US3] Integrationstest Importlauf inkl. Idempotenz und Fehlerfall (bestehende Daten bleiben unverändert) in `apps/worker/tests/sync.test.ts`
- [ ] T067 [P] [US3] Vertragstests `/products/{id}/integrations`, `/integrations/{id}`, `/test`, `/sync`, `/sync-runs/{id}` und Test, dass Zugangsdaten nie in Antworten erscheinen, in `apps/api/tests/contract/integrations.test.ts`
- [ ] T068 [P] [US3] Test: Duplikate zusammenführen (Verlauf und Quellenverweise bleiben erhalten, Audit) in `apps/api/tests/integration/merge-debts.test.ts`
- [ ] T069 [P] [US3] E2E: Integration anlegen, testen, Import, Ergebnis im Register in `apps/web/tests/e2e/integration.spec.ts`

### Implementation für US3

- [ ] T070 [P] [US3] Prisma-Modelle `Integration` (`credentials_encrypted`, `key_id`, `schedule` Standard stündlich, `status`), `SyncRun`, `Finding` (eindeutig (integration_id, external_id), `raw` JSONB, `gone_at?`) in `packages/db/prisma/schema.prisma`; Migration
- [ ] T071 [P] [US3] Verschlüsselung der Zugangsdaten (AES-256-GCM, Schlüssel-ID für Rotation) in `packages/domain/src/crypto.ts`
- [ ] T072 [P] [US3] Connector-Schnittstelle und Fehlertypen (`Unreachable`, `InvalidCredentials`, `PartialData`) laut `contracts/connector-interface.md` in `packages/connectors/src/types.ts`
- [ ] T073 [P] [US3] SonarCloud-Connector (Web-API: Issues, Hotspots, Duplikate; Pagination, Rate-Limit) in `packages/connectors/src/sonarcloud/`
- [ ] T074 [P] [US3] GitLab-Cloud-Connector (REST-API: Issues mit konfigurierbarem Label, optional Code-Quality) in `packages/connectors/src/gitlab/`
- [ ] T075 [US3] Abgleichslogik (reine Funktionen) in `packages/domain/src/reconcile.ts`
- [ ] T076 [US3] Import-Job: Connector aufrufen, abgleichen, Zähler und Fortschritt im `SyncRun`, Rate-Limit-Pausen in `apps/worker/src/jobs/sync-integration.ts`
- [ ] T077 [US3] pg-boss-Setup, Zeitplan pro Integration (Standard stündlich), Wiederholung mit Backoff in `apps/worker/src/scheduler.ts`
- [ ] T078 [US3] Integrations-Service (anlegen, ändern, trennen, testen, Import anstoßen (legt den Job über dieselbe pg-boss-Queue an, die der Worker abarbeitet), Zugangsdaten verschlüsseln, Audit) in `apps/api/src/services/integrations.ts`
- [ ] T079 [US3] Routen laut Test T067 (nur admin; `POST /sync` antwortet 202 mit SyncRun-ID) in `apps/api/src/app/api/v1/integrations/`, `.../products/[id]/integrations/`, `.../sync-runs/`
- [ ] T080 [US3] Merge-Service und Route `POST /api/v1/debts/{id}/merge` (Duplikat in Ziel-Schuld zusammenführen) in `apps/api/src/services/merge-debts.ts`, `apps/api/src/app/api/v1/debts/[id]/merge/route.ts`
- [ ] T081 [US3] OpenAPI-Spezifikation und Client neu generieren und einchecken (`apps/api/openapi.generated.json`, `packages/api-types/`)
- [ ] T082 [P] [US3] Frontend: Integrationsverwaltung (anlegen, testen, Zeitplan, Status, letzter Abgleich, verständliche Fehler; bei Status „error“ durch abgelaufene/ungültige Zugangsdaten gut sichtbarer Hinweis für Administratoren in der Anwendung) in `apps/web/src/app/integrations/page.tsx`
- [ ] T083 [P] [US3] Frontend: Importfortschritt und Quellenverweis in Registerliste/Detailseite in `apps/web/src/components/debt/SourceBadge.tsx`
- [ ] T084 [P] [US3] Frontend: Hinweis zu Konflikten bei manuell geänderten Feldern und Duplikat-Zusammenführung in `apps/web/src/components/debt/MergeDuplicates.tsx`

**Checkpoint**: Mindestens eine Quelle lässt sich Ende-zu-Ende importieren.

---

## Phase 7: User Story 4 – Überblick, Trends, Berichte (P2)

**Goal**: Dashboard mit Kennzahlen und Zeitverlauf, Export.

**Independent Test**: Kennzahlen stimmen mit dem Register überein; Export enthält die angezeigten Daten (quickstart Szenario 4).

- [ ] T085 [P] [US4] Integrationstest: Dashboard-Kennzahlen stimmen zu 100 % mit gefiltertem Register überein (SC-006) in `apps/api/tests/integration/dashboard.test.ts`
- [ ] T086 [P] [US4] Vertragstests `/dashboard`, `/exports/debts` in `apps/api/tests/contract/dashboard.test.ts`
- [ ] T087 [P] [US4] Performance-Test: Register/Dashboard bei 10.000 Schulden < 3 s (SC-005) in `apps/api/tests/performance/register-dashboard.test.ts`
- [ ] T088 [P] [US4] Prisma-Modell `MetricSnapshot` (`count_by_status/kind/priority_band` JSON, `total_effort`) in `packages/db/prisma/schema.prisma`; Migration
- [ ] T089 [US4] Täglicher Snapshot-Job in `apps/worker/src/jobs/metric-snapshot.ts`
- [ ] T090 [US4] Dashboard-Service (Live-Kennzahlen aus Register, Verlauf aus Snapshots, Filter Produkt/Team/Zeitraum) in `apps/api/src/services/dashboard.ts`
- [ ] T091 [US4] CSV-Export in `apps/api/src/services/export.ts`
- [ ] T092 [US4] Routen `GET /api/v1/dashboard`, `GET /api/v1/exports/debts` in `apps/api/src/app/api/v1/dashboard/`, `.../exports/debts/`
- [ ] T093 [US4] OpenAPI-Spezifikation und Client neu generieren und einchecken (`apps/api/openapi.generated.json`, `packages/api-types/`)
- [ ] T094 [P] [US4] Frontend: Dashboard mit Kennzahlen und Zeitverlauf (Recharts) in `apps/web/src/app/dashboard/page.tsx`
- [ ] T095 [P] [US4] Frontend: Export-Schaltfläche in Register und Dashboard in `apps/web/src/components/export/ExportButton.tsx`
- [ ] T096 [P] [US4] E2E: Dashboard vs. Register, Export in `apps/web/tests/e2e/dashboard.spec.ts`

**Checkpoint**: Dashboard und Export liefern konsistente Zahlen.

---

## Phase 8: User Story 6 – Rollen und Änderungsprotokoll (P3)

**Goal**: Produktrollen verwalten, Änderungsprotokoll einsehen.

**Independent Test**: Verschiedene Rollen versuchen dieselben Aktionen; Protokoll zeigt Wer/Wann/Was ohne Zugangsdaten (quickstart Szenario 5).

- [ ] T097 [P] [US6] Vertragstests `/products/{id}/members`, `/audit-log` in `apps/api/tests/contract/members-audit.test.ts`
- [ ] T098 [P] [US6] Integrationstest: Audit-Einträge für Rollen-, Integrations- und Modelländerungen; keine Geheimnisse im Protokoll (SC-007) in `apps/api/tests/integration/audit.test.ts`
- [ ] T099 [P] [US6] Vertragstests und Integrationstest für Teams (`/teams`, Mitglieder; Filter nach Team in Prioritätsliste und Dashboard) in `apps/api/tests/contract/teams.test.ts`
- [ ] T100 [US6] Member-Service (Rollen setzen, nur admin) in `apps/api/src/services/members.ts`
- [ ] T101 [US6] Routen `GET/PUT /api/v1/products/{id}/members`, `GET /api/v1/audit-log` (nur admin) in `apps/api/src/app/api/v1/products/[id]/members/route.ts`, `.../audit-log/route.ts`
- [ ] T102 [US6] Team-Service und Routen `GET/POST /api/v1/teams`, `PUT /api/v1/teams/{id}/members` (nur admin) in `apps/api/src/services/teams.ts`, `apps/api/src/app/api/v1/teams/`
- [ ] T103 [US6] OpenAPI-Spezifikation und Client neu generieren und einchecken (`apps/api/openapi.generated.json`, `packages/api-types/`)
- [ ] T104 [P] [US6] Frontend: Rollenverwaltung pro Produkt in `apps/web/src/app/settings/members/page.tsx`
- [ ] T105 [P] [US6] Frontend: Teamverwaltung in `apps/web/src/app/settings/teams/page.tsx`
- [ ] T106 [P] [US6] Frontend: Änderungsprotokoll mit Filtern in `apps/web/src/app/settings/audit/page.tsx`
- [ ] T107 [P] [US6] E2E: Benutzer ohne Rolle darf lesen, aber nicht ändern; verständliche Fehlermeldung in `apps/web/tests/e2e/authorization.spec.ts`

---

## Phase 9: Polish & Cross-Cutting

- [ ] T108 [P] Container-Dateien für web, api, worker in `deploy/Dockerfile.web`, `deploy/Dockerfile.api`, `deploy/Dockerfile.worker`
- [ ] T109 [P] Barrierefreiheit und Fehler-/Leerzustände aller Hauptansichten prüfen und beheben in `apps/web/src/`
- [ ] T110 [P] Import-Lasttest mit 1.000 Befunden < 10 min (SC-003) in `apps/worker/tests/performance/import-load.test.ts`
- [ ] T111 [P] Sicherheitsprüfung: Suche nach Klartext-Zugangsdaten in Logs, Antworten und Audit in `apps/api/tests/security/secrets.test.ts`
- [ ] T112 Quickstart-Szenarien 1–6 vollständig durchlaufen und `specs/001-tech-debt-management/quickstart.md` bei Abweichungen korrigieren
- [ ] T113 Constitution-Check gegen den fertigen Stand durchführen und Ergebnis in `docs/architecture/vision.md` vermerken

---

## Dependencies & Execution Order

- **Phase 1 → Phase 2 → alle User Stories.** Phase 2 blockiert alles.
- **US1** (Phase 3) hat keine Story-Abhängigkeit. **US2** nutzt `DebtItem` aus US1. **US5** ist unabhängig (nur Dokumentation) und kann parallel zu US1/US2 laufen. **US3** nutzt `DebtItem` und `DebtEvent` aus US1. **US4** nutzt Register (US1) und Priorität (US2). **US6** nutzt Auth/Audit aus Phase 2 und ist sonst unabhängig.
- Innerhalb einer Story: Tests → Modelle → Domänenlogik → Services → Routen → Spezifikation/Client regenerieren → Frontend. Frontend-Aufgaben einer Story folgen immer auf die Regenerierung des Clients (T037, T049, T081, T093, T103).

### Parallel-Beispiele

- Phase 1: T002–T008 gleichzeitig.
- US1: T024–T028 (Tests) und T029/T030 gleichzeitig; danach T038/T039.
- US3: T070–T074 gleichzeitig; Connectoren T073 und T074 getrennt entwickelbar.
- US5: T055–T061 gleichzeitig nach T054.

## Implementation Strategy

1. **MVP**: Phase 1, 2 und US1 (Register). Danach validieren.
2. **Inkrementell**: US2 (Priorisierung) und US5 (Vision/ADRs) als zweites und drittes P1-Inkrement; US3 und US4 (P2); US6 (P3); zuletzt Polish.
3. Die Constitution verlangt, dass API-Änderungen im Backend-Code beginnen und der Client danach regeneriert wird; die CI (T008, T023) erzwingt das.
