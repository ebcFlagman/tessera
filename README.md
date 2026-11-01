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
cp deploy/.env.example .env
for d in apps/api apps/web apps/worker packages/db; do cp .env $d/.env; done
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
pnpm test:e2e                              # Playwright; Stack und `pnpm dev` (inkl. Worker) müssen laufen
```

Nach jeder API-Änderung: `pnpm openapi:generate && pnpm api-types:generate` und beides einchecken.

## Erste Schritte auf einer leeren Instanz

Tessera verwaltet keine Konten: Benutzer und Passwörter liegen in Keycloak, „Administrator“ ist eine Rolle
pro Produkt in Tessera.

1. Konto in Keycloak anlegen (lokal: http://localhost:8080, Realm `tessera`, *Users → Add user*, dann ein Passwort setzen).
2. In Tessera anmelden und unter **Produkte** (`/settings/products`) das **erste Produkt anlegen**. Wer das
   erste Produkt anlegt, wird dessen Administrator. Solange kein Produkt existiert, weisen Register und
   Schuldenformular mit einem Hinweis darauf hin.
3. Weitere Personen berechtigt ein Administrator unter **Rollen** (`/settings/members`); weitere Produkte legen
   ebenfalls nur Administratoren an.

Hinweis: Auf einer leeren Instanz kann **jede angemeldete Person** das erste Produkt anlegen und so die erste
Administratorin werden. Die Anmeldung ist dafür die Schranke: Registrierung und Zugang regelt Keycloak.

## Betrieb (Container)

Drei Images, gebaut aus dem Repository-Wurzelverzeichnis (die Konfiguration steht in
[deploy/.env.example](deploy/.env.example) und kommt zur Laufzeit aus der Umgebung):

```bash
docker build -f deploy/Dockerfile.api -t tessera-api .
docker build -f deploy/Dockerfile.worker -t tessera-worker .
docker build -f deploy/Dockerfile.web -t tessera-web --build-arg NEXT_PUBLIC_API_URL=https://tessera.example.org/api/v1 .
```

`NEXT_PUBLIC_API_URL` wird in das Browser-Bündel einkompiliert und ist deshalb ein Build-Argument.
Datenbank-Migrationen laufen mit dem Worker-Image, vor dem Start einer neuen Version:

```bash
docker run --rm --env-file .env tessera-worker \
  node_modules/.bin/prisma migrate deploy --schema node_modules/@tessera/db/prisma/schema.prisma
```

Hinter einem Reverse Proxy müssen Web (3000) und API (3001) unter den Adressen erreichbar sein, die in
`AUTH_URL`, `NEXT_PUBLIC_API_URL` und `WEB_ORIGIN` stehen. **Stand der Prüfung:** Die Dockerfiles wurden
in einer Umgebung ohne Docker geschrieben. Geprüft ist, was sie ausführen: `pnpm deploy`-Baum für API und
Worker (Server startet, Datenbankabfrage über den generierten Client, `prisma migrate deploy`, Worker
meldet „ready“) und das Standalone-Bündel des Webs. Der eigentliche `docker build` ist noch nicht gelaufen.
