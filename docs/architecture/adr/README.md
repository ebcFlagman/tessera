# Architekturentscheidungen (ADRs)

Jede wesentliche Architekturentscheidung hat einen eigenen Eintrag im Stil von
[MADR](https://adr.github.io/madr/): Kontext, Entscheidung, Begründung, Alternativen, Konsequenzen.
Neue ADRs entstehen aus der [Vorlage](0000-template.md) und werden fortlaufend nummeriert.
Eine abgelöste Entscheidung bleibt bestehen und verweist auf ihre Nachfolgerin.

| Nr. | Entscheidung | Status | Umsetzung |
|---|---|---|---|
| 0001 | [Monorepo mit zwei Next.js-Apps und einem Worker](0001-monorepo-with-two-nextjs-apps.md) | Akzeptiert | teilweise (web, api umgesetzt; Worker als Gerüst) |
| 0002 | [Backend-Code ist der API-Vertrag (Code-first)](0002-code-first-api-contract.md) | Akzeptiert | umgesetzt |
| 0003 | [PostgreSQL 16 mit Prisma](0003-postgresql-and-prisma.md) | Akzeptiert | umgesetzt |
| 0004 | [Hintergrundjobs mit pg-boss in eigenem Worker](0004-background-jobs-with-pg-boss.md) | Akzeptiert | geplant (Worker-Gerüst vorhanden) |
| 0005 | [Anmeldung per OIDC mit Keycloak, Rollen in Tessera](0005-authentication-with-keycloak-oidc.md) | Akzeptiert | umgesetzt |
| 0006 | [Connector-Schnittstelle für Umsysteme](0006-connector-plugin-interface.md) | Akzeptiert | geplant |
| 0007 | [Idempotenter Abgleich mit Feldherkunft](0007-import-reconciliation-and-field-origin.md) | Akzeptiert | geplant |
| 0008 | [Bewertung mit gewichteten Kriterien und versioniertem Modell](0008-assessment-model.md) | Akzeptiert | umgesetzt |
| 0009 | [Umgang mit Zugangsdaten](0009-secrets-handling.md) | Akzeptiert | teilweise (Redaction umgesetzt; Verschlüsselung folgt mit US3) |
| 0010 | [Tägliche Kennzahlen-Snapshots für den Zeitverlauf](0010-daily-metric-snapshots.md) | Akzeptiert | geplant (US4) |
| 0011 | [Teststrategie: echte Datenbank, Vertragstests, E2E](0011-test-strategy.md) | Akzeptiert | umgesetzt |
| 0012 | [Architekturdokumentation im Repository](0012-architecture-documentation-in-repo.md) | Akzeptiert | umgesetzt |

## Offene Themen (noch keine Entscheidung)

- Zusammenlegung von `apps/web` und `apps/api` zu einer Next.js-App (Vereinfachung, siehe [ADR 0001](0001-monorepo-with-two-nextjs-apps.md)).
- Externer Secret-Store statt Verschlüsselung in der Datenbank (siehe [ADR 0009](0009-secrets-handling.md)).
- Webhooks zusätzlich zum Polling (siehe [ADR 0006](0006-connector-plugin-interface.md)).

## Wann ein ADR nötig ist

Wenn eine Änderung die Struktur (Bausteine, Abhängigkeitsregeln), Schnittstellen, eingesetzte
Technologien, Qualitätsziele oder eine Constitution-Regel berührt. Im Zweifel: schreiben.
Der ADR gehört in denselben Pull Request wie die Änderung.
