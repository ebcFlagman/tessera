# ADR 0011: Teststrategie: echte Datenbank, Vertragstests, E2E

- **Status:** Akzeptiert
- **Datum:** 2026-10-31
- **Umsetzungsstand:** umgesetzt

## Kontext

Fachregeln, Berechtigungen und Datenbank-Constraints sind der Kern des Produkts. Mocks verdecken Fehler in Migrationen und SQL.

## Entscheidung

Vitest für Unit-, Integrations- und Vertragstests. Integrationstests laufen gegen eine echte, eingebettete PostgreSQL (Paket `embedded-postgres`, kein Docker nötig) mit den echten Migrationen. Vertragstests prüfen Antworten gegen die aus dem Code erzeugte OpenAPI-Spezifikation. Playwright deckt die P1-Abläufe gegen den echten Stack mit Keycloak ab. Connectoren werden mit aufgezeichneten Fixtures getestet.

## Begründung

Schnelle, reproduzierbare Tests ohne Containerzwang; Migrationen, Constraints und generierte Spalten werden wirklich ausgeführt.

## Betrachtete Alternativen

- **Testcontainers:** benötigt Docker; bleibt eine Option für die CI.
- **Datenbank mocken:** verdeckt SQL- und Migrationsfehler.

## Konsequenzen

- Integrationstests laufen seriell gegen eine gemeinsame Datenbank.
- Die E2E-Tests benötigen den laufenden Stack (`docker compose`, `pnpm dev`) und einmalig `playwright install chromium`.

## Referenzen

- Constitution, Abschnitt „Development Workflow & Quality Gates“
- [Qualitätsziel QZ-8](../quality-goals.md)
