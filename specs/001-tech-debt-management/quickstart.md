# Quickstart: Validierung von Tessera

Ziel: Nachweisen, dass die P1/P2-Abläufe Ende-zu-Ende funktionieren. Details zu Daten: [data-model.md](data-model.md); API-Entwurf: [contracts/openapi.yaml](contracts/openapi.yaml) (maßgeblich ist die aus dem Backend-Code erzeugte Spezifikation).

## Voraussetzungen
- Node.js 22, pnpm, Docker (PostgreSQL und Keycloak lokal)
- Beispielkonfiguration `deploy/.env.example` nach `.env` kopieren (Testwerte, keine echten Geheimnisse)
- Für Import-Szenario: SonarCloud-Testprojekt oder die mitgelieferten Fixtures (`FIXTURE_MODE=1`)

## Start
```bash
docker compose -f deploy/docker-compose.dev.yml up -d   # PostgreSQL + Keycloak (Testrealm mit Testbenutzern)
pnpm install
pnpm --filter @tessera/db migrate
pnpm dev                                                  # web, api, worker
```

## Szenarien
1. **Register (US1)**: Mit Testbenutzer „editor“ anmelden, Schuld anlegen, Status ändern, filtern. Erwartet: Eintrag im Verlauf (FR-003).
2. **Bewertung (US2)**: Zwei Schulden bewerten, Gewicht ändern, Rangfolge prüfen; Priorität mit Begründung überschreiben (FR-004a).
3. **Import (US3)**: Als „admin“ Integration anlegen, Verbindung testen, Import starten; zweiter Import erzeugt keine Duplikate; entfernter Fixture-Befund → Schuld „getilgt“ (FR-011a).
4. **Dashboard (US4)**: Kennzahlen mit gefilterter Registerliste vergleichen (SC-006); CSV exportieren.
5. **Rechte (US6)**: Benutzer ohne Rolle darf lesen, aber nicht ändern; Audit-Log enthält Integrationsänderung ohne Zugangsdaten.
6. **Dokumentation (US5)**: `docs/architecture/vision.md` lesen und gegen die Abnahmekriterien in spec.md prüfen.

## Tests
```bash
pnpm test            # Unit + Integration (Testcontainers)
pnpm test:contract   # Backend gegen erzeugte OpenAPI-Spezifikation
pnpm --filter @tessera/web exec playwright install chromium   # einmalig
pnpm test:e2e        # Playwright (Stack und `pnpm dev` inkl. Worker müssen laufen;
                     # der Import-Test braucht SOURCE_ALLOWED_HOSTS=localhost)
```
