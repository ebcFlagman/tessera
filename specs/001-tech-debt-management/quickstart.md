# Quickstart: Validierung von Tessera

Ziel: Nachweisen, dass die Abläufe Ende-zu-Ende funktionieren. Jeder Schritt unten wurde so ausgeführt;
Abweichungen früherer Fassungen sind korrigiert. Details zu Daten: [data-model.md](data-model.md);
die maßgebliche API-Beschreibung wird aus dem Backend-Code erzeugt (`apps/api/openapi.generated.json`),
[contracts/openapi.yaml](contracts/openapi.yaml) ist nur ein Entwurf.

## Voraussetzungen

- Node.js 22, pnpm, Docker (PostgreSQL und Keycloak lokal)
- Für den Import gegen eine **echte** Quelle: ein SonarCloud-Projekt oder ein GitLab-Projekt samt
  Zugriffstoken. Ohne echten Zugang deckt `pnpm test:e2e` den Import mit einer lokalen Attrappe der
  Quelle ab (Szenario 3).

## Start

```bash
docker compose -f deploy/docker-compose.dev.yml up -d   # PostgreSQL + Keycloak (Testrealm mit Testbenutzern)
cp deploy/.env.example .env
for d in apps/api apps/web apps/worker packages/db; do cp .env $d/.env; done
pnpm install
pnpm --filter @tessera/db migrate && pnpm --filter @tessera/db seed
pnpm dev                                                 # web (3000), api (3001), worker
```

Keycloak braucht nach dem ersten Start etwa eine Minute. Die Testbenutzer `admin`, `editor` und `norole`
haben ihren Namen als Passwort. Für den Import-E2E-Test muss in der `.env` `SOURCE_ALLOWED_HOSTS=localhost`
stehen (dann die Dev-Server neu starten).

## Szenarien

Die Spalte „Automatisiert“ nennt den Test, der das Szenario bei jedem Lauf prüft.

| # | Szenario | Erwartet | Automatisiert |
|---|---|---|---|
| 1 | **Register (US1):** als `editor` anmelden, Schuld anlegen, Status ändern, filtern | Eintrag im Verlauf (FR-003), Suche und Filter finden die Schuld | `register.spec.ts` |
| 2 | **Bewertung (US2):** zwei Schulden bewerten, Rangfolge prüfen, Priorität mit Begründung überschreiben; als `admin` das Modell ändern | Herleitung sichtbar, ohne Begründung kein Überschreiben (FR-004a), Editor darf das Modell nicht ändern | `scoring.spec.ts`, `assessment-model.spec.ts` |
| 3 | **Import (US3):** als `admin` Integration anlegen, testen, Import starten; zweiter Import; Befund in der Quelle entfällt; falsches Token | keine Duplikate, entfallener Befund → Schuld „getilgt“ (FR-011a), falsches Token → lesbarer Fehler und Hinweis | `integration.spec.ts`, `merge.spec.ts` |
| 4 | **Dashboard (US4):** Kennzahlen mit dem gefilterten Register vergleichen, CSV exportieren | Zahlen stimmen überein (SC-006), Export enthält die angezeigten Daten | `dashboard.spec.ts`, `dashboard.test.ts` |
| 5 | **Rechte (US6):** als `norole` lesen, nicht ändern; als `admin` die Rolle vergeben; Protokoll öffnen | Verweigerung mit Erklärung, Rolle wirkt, Protokoll zeigt Wer/Wann/Was ohne Zugangsdaten | `authorization.spec.ts`, `audit.test.ts` |
| 6 | **Dokumentation (US5):** [vision.md](../../docs/architecture/vision.md) lesen und gegen die Abnahmekriterien in [spec.md](spec.md) prüfen | Zweck, Bausteine, Integrationsansatz und die zwölf Entscheidungen sind erklärt und verlinkt | `architecture.test.ts` (Struktur), `pnpm check:docs` (Links); der Lesetest SC-008 braucht einen Menschen |

Zusätzlich beweisen die Tests auf Datenbankebene: Zugangsdaten tauchen nirgends im Klartext auf
(`secrets.test.ts`), das Protokoll ist nur anfügend (`append-only.test.ts`), und 10.000 Schulden
erscheinen in unter 3 Sekunden (`register-dashboard.test.ts`).

## Tests

```bash
pnpm test             # alle Unit-, Integrations-, Vertrags-, Architektur- und Leistungstests;
                      # sie starten selbst eine eingebettete PostgreSQL, Docker wird nicht gebraucht
pnpm test:contract    # nur die Vertragstests der API gegen die erzeugte OpenAPI-Spezifikation
pnpm check:generated  # OpenAPI-Spezifikation und generierter Client aktuell?
pnpm check:docs       # Links in der Dokumentation gültig?
pnpm --filter @tessera/web exec playwright install chromium   # einmalig
pnpm test:e2e         # Playwright; Stack und `pnpm dev` (inkl. Worker) müssen laufen
```
