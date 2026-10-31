# Architekturvision: Tessera

**Stand:** 2026-10-31 · **Status:** gültig, wird bei Architekturänderungen im selben Pull Request gepflegt

Diese Seite ist der Einstieg. Wer sie liest, soll Zweck, Bausteine, Integrationsansatz und die
wichtigsten Entscheidungen von Tessera ohne Rückfragen erklären können. Sie dient ebenso als
Kontext für KI-gestützte Weiterarbeit am Projekt.

## Zweck

Tessera erfasst, bewertet und priorisiert **architektonische und technische Schulden**. Schulden
liegen heute verstreut in Köpfen, Tickets und Analysewerkzeugen. Tessera führt sie in einem
zentralen Register zusammen, macht ihre Dringlichkeit nachvollziehbar und liefert eine
priorisierte Tilgungsliste für die Planung.

## Zielbild

- **Ein Register** für alle Schulden eines Produkts: manuell erfasst oder aus Umsystemen importiert.
- **Nachvollziehbare Priorität:** gewichtete Kriterien ergeben einen Wert von 0–100. Die Herleitung
  ist einsehbar, Änderungen sind versioniert, manuelle Überschreibungen brauchen eine Begründung.
- **Lebendiges Bild** durch Import aus SonarCloud und GitLab Cloud (weitere Quellen später ohne
  Umbau des Kerns).
- **Entscheidungsgrundlage** für Teams und Management: Dashboard, Zeitverlauf und Export.

## Zielgruppen

| Gruppe                  | Nutzen                                               |
| ----------------------- | ---------------------------------------------------- |
| Entwicklungsteams       | Schulden erfassen, bearbeiten, Status pflegen        |
| Tech Leads, Architekten | bewerten, priorisieren, Bewertungsmodell pflegen     |
| Engineering Manager     | Überblick, Trends, Berichte für die Planung          |
| Administratoren         | Produkte, Rollen, Integrationen und Modell verwalten |

## Leitprinzipien

Verbindlich sind die sieben Prinzipien der [Constitution](../../.specify/memory/constitution.md):

1. **Fachlogik zuerst:** Regeln in reinen Modulen (`packages/domain`), nicht in Routen oder Komponenten.
2. **Erweiterbar an den Rändern:** neue Quelle = neuer Connector, kein Eingriff in den Kern.
3. **Nachvollziehbarkeit:** jede relevante Änderung hat Urheber, Zeitpunkt, Vorher/Nachher.
4. **Geheimnisse bleiben geheim:** Zugangsdaten verschlüsselt, nie im Klartext in Antworten oder Logs.
5. **Manuell schlägt automatisch:** Importe überschreiben keine manuell gepflegten Felder
   (Ausnahme: „Quelle getilgt gewinnt“).
6. **Einfach vor clever:** PostgreSQL für Daten, Queue und Audit; Abweichungen werden begründet.
7. **Backend ist der Vertrag:** Der Backend-Code erzeugt die OpenAPI-Spezifikation, das Frontend wird daraus generiert.

## Systemgrenzen

**Innerhalb:** Schuldenregister, Bewertung und Priorisierung, Import aus Umsystemen,
Dashboard/Berichte, Rollen und Änderungsprotokoll, diese Dokumentation.

**Außerhalb:** Benutzerverwaltung und Passwörter (liegen bei Keycloak), die Analysewerkzeuge selbst
(SonarCloud, GitLab), Ticket- und Planungswerkzeuge.

Details: [Kontext und Bausteine](context-and-building-blocks.md).

## Abgrenzung Version 1

- Integrationen sind **nur lesend** (Import); kein Rückschreiben in Quellsysteme.
- Kein mandantenfähiger Betrieb für externe Kunden; eine Organisation mit mehreren Produkten.
- Quellen in v1: SonarCloud und GitLab Cloud.
- Benachrichtigungen bei ungültigen Zugangsdaten nur als Hinweis in der Anwendung (keine E-Mail).
- Mobile Optimierung ist nachrangig.

## Technische Grundentscheidungen (Kurzfassung)

| Thema           | Entscheidung                                                 | ADR                                                        |
| --------------- | ------------------------------------------------------------ | ---------------------------------------------------------- |
| Aufbau          | pnpm-Monorepo, zwei Next.js-Apps (web, api) plus Worker      | [0001](adr/0001-monorepo-with-two-nextjs-apps.md)          |
| API             | Code-first, OpenAPI aus dem Backend-Code, Frontend generiert | [0002](adr/0002-code-first-api-contract.md)                |
| Daten           | PostgreSQL 16 mit Prisma                                     | [0003](adr/0003-postgresql-and-prisma.md)                  |
| Hintergrundjobs | pg-boss in eigenem Worker                                    | [0004](adr/0004-background-jobs-with-pg-boss.md)           |
| Anmeldung       | OIDC mit Keycloak, Rollen in Tessera                         | [0005](adr/0005-authentication-with-keycloak-oidc.md)      |
| Integrationen   | Connector-Schnittstelle                                      | [0006](adr/0006-connector-plugin-interface.md)             |
| Import-Abgleich | idempotent, Feldherkunft, „Quelle getilgt gewinnt“           | [0007](adr/0007-import-reconciliation-and-field-origin.md) |
| Bewertung       | gewichtete Kriterien, versioniertes Modell                   | [0008](adr/0008-assessment-model.md)                       |
| Geheimnisse     | AES-256-GCM, Redaction                                       | [0009](adr/0009-secrets-handling.md)                       |
| Zeitverlauf     | tägliche Snapshots                                           | [0010](adr/0010-daily-metric-snapshots.md)                 |
| Tests           | Vitest, eingebettete PostgreSQL, Playwright                  | [0011](adr/0011-test-strategy.md)                          |
| Dokumentation   | im Repository, ADRs im MADR-Stil                             | [0012](adr/0012-architecture-documentation-in-repo.md)     |

Alle Entscheidungen: [ADR-Index](adr/README.md). Qualitätsziele: [quality-goals.md](quality-goals.md).

## Umsetzungsstand

| Bereich                                                                           | Stand                                                                                                       |
| --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Schuldenregister, Verlauf, Rechte, Audit                                          | umgesetzt                                                                                                   |
| Bewertung, Priorisierung, Überschreiben, Modellversionen                          | umgesetzt                                                                                                   |
| Anmeldung (Keycloak), generierter API-Client, CI-Prüfung                          | umgesetzt                                                                                                   |
| Import aus SonarCloud/GitLab, Worker, Zugangsdaten, Zusammenführen von Duplikaten | umgesetzt (geprüft mit Fixtures und einer lokalen Attrappe der Quelle, noch nicht gegen die echten Dienste) |
| Dashboard, Zeitverlauf, CSV-Export                                                | umgesetzt                                                                                                   |
| Teamverwaltung, Rollenverwaltung, Änderungsprotokoll                              | umgesetzt                                                                                                   |

Die Aufgabenliste mit dem genauen Fortschritt steht in
[tasks.md](../../specs/001-tech-debt-management/tasks.md).

## Weiterführende Dokumente

- Anforderungen: [spec.md](../../specs/001-tech-debt-management/spec.md)
- Plan und Recherche: [plan.md](../../specs/001-tech-debt-management/plan.md),
  [research.md](../../specs/001-tech-debt-management/research.md)
- Datenmodell: [data-model.md](../../specs/001-tech-debt-management/data-model.md)
- Integrationskonzept: [integration-concept.md](integration-concept.md)

## Pflege

Wer eine Architekturentscheidung trifft oder ändert, legt im selben Pull Request einen ADR an
(oder ersetzt einen bestehenden) und passt diese Seite an, falls Tabellen oben betroffen sind.
Die Link-Prüfung der CI stellt sicher, dass Verweise gültig bleiben.
