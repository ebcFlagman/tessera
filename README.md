# Tessera

Tessera erfasst, bewertet und priorisiert **architektonische und technische Schulden** und
importiert Befunde aus Umsystemen wie SonarCloud und GitLab Cloud.

**Architektur:** [docs/architecture/vision.md](docs/architecture/vision.md) ist der Einstieg
(Zielbild, Bausteine, Entscheidungen, Umsetzungsstand). Weiter:
[Qualitätsziele](docs/architecture/quality-goals.md),
[Kontext und Bausteine](docs/architecture/context-and-building-blocks.md),
[Integrationskonzept](docs/architecture/integration-concept.md),
[Architekturentscheidungen](docs/architecture/adr/README.md).

**Anforderungen und Plan:** [specs/001-tech-debt-management](specs/001-tech-debt-management/spec.md)
(Spezifikation, Plan, Datenmodell, Aufgabenliste, Quickstart). Verbindliche Regeln:
[Constitution](.specify/memory/constitution.md).

## Aufbau

| Pfad | Inhalt |
|---|---|
| `apps/web` | Frontend (Next.js, React) |
| `apps/api` | Backend (Next.js Route Handlers, REST `/api/v1`), erzeugt die OpenAPI-Spezifikation |
| `apps/worker` | Hintergrundjobs: Importe und Zeitplan |
| `packages/domain` | reine Fachlogik (Statusregeln, Bewertung) |
| `packages/db` | Prisma-Schema, Migrationen, Seed |
| `packages/api-types` | aus der OpenAPI-Spezifikation generierte Typen (nicht von Hand ändern) |
| `packages/connectors` | Anbindung der Umsysteme (SonarCloud, GitLab Cloud) |
| `docs/architecture` | Architekturdokumentation |
| `deploy` | Entwicklungsumgebung (PostgreSQL, Keycloak) und Beispielkonfiguration |

## Entwickeln

Voraussetzungen: Node.js 22, pnpm, Docker.

```bash
docker compose -f deploy/docker-compose.dev.yml up -d   # PostgreSQL + Keycloak
cp deploy/.env.example .env && cp .env apps/api/.env && cp .env apps/web/.env && cp .env apps/worker/.env
pnpm install
pnpm --filter @tessera/db migrate && pnpm --filter @tessera/db seed
pnpm dev   # web, api und worker
```

Quellen (SonarCloud, GitLab) dürfen nur auf `sonarcloud.io` und `gitlab.com` liegen; weitere Hosts
trägt ein Systemadministrator in `SOURCE_ALLOWED_HOSTS` ein. Die Zugangsdaten der Quellen werden mit
`CREDENTIALS_KEY` (32 Byte, Base64) verschlüsselt; für Produktion einen eigenen Schlüssel erzeugen
(`openssl rand -base64 32`).

Testbenutzer im Keycloak-Realm: `admin`, `editor`, `norole` (Passwort = Benutzername, nur für die Entwicklung).

Prüfen:

```bash
pnpm lint && pnpm typecheck && pnpm test   # Unit-, Integrations-, Vertragstests (eingebettete PostgreSQL)
pnpm check:generated                       # OpenAPI-Spezifikation und Client aktuell?
pnpm check:docs                            # Links in der Dokumentation gültig?
pnpm test:e2e                              # Playwright; Stack und `pnpm dev` müssen laufen
```

Nach jeder API-Änderung: `pnpm openapi:generate && pnpm api-types:generate` und beides einchecken.
