# Research: Tessera

Alle technischen Unbekannten sind aufgelöst; es verbleibt kein `NEEDS CLARIFICATION`.

## Leitprinzipien (Entwurf für Architekturvision und Constitution)

1. **Fachlogik zuerst**: Bewertung, Zustandsübergänge und Deduplizierung liegen in reinen, getesteten Modulen.
2. **Erweiterbar an den Rändern**: Neue Quellen = neuer Connector, kein Eingriff in den Kern (FR-012).
3. **Nachvollziehbarkeit**: Jede relevante Änderung hat Urheber, Zeitpunkt, Vorher/Nachher (FR-003, FR-018).
4. **Geheimnisse bleiben geheim**: Zugangsdaten verschlüsselt, nie in Antworten oder Logs (FR-017).
5. **Manuell schlägt automatisch**: Importe überschreiben keine manuell gepflegten Felder (FR-011).
6. **Einfach vor clever**: Eine Datenbank (PostgreSQL) für Daten, Queue und Audit.

## Entscheidungen

### D1 – Aufbau: pnpm-Monorepo mit zwei Next.js-Apps + Worker
- **Decision**: `apps/web`, `apps/api`, `apps/worker`, geteilte `packages/*`.
- **Rationale**: Erfüllt die Vorgabe (Backend und Frontend in Next.js), erlaubt geteilte Typen und Domänenlogik.
- **Alternatives**: Einzelne Next.js-Vollstack-App (einfacher, aber gegen Vorgabe); separate Repos (Typen-Sharing aufwändig).

### D2 – Backend-API: Code-First, erzeugte OpenAPI-Spezifikation
- **Decision**: Route Handlers unter `/api/v1` mit Zod-Schemas für Ein-/Ausgabe; daraus wird die OpenAPI-Spezifikation automatisch erzeugt (z. B. mit zod-to-openapi) und eingecheckt. Der Backend-Code ist der Vertrag (Constitution VII). API-Client und Typen des Frontends werden aus der erzeugten Spezifikation generiert (z. B. openapi-typescript), nichts davon wird von Hand geschrieben. CI bricht ab, wenn die Spezifikation oder der generierte Code veraltet ist. `contracts/openapi.yaml` ist nur ein Entwurf zur Orientierung.
- **Rationale**: Eine einzige Wahrheit im Code; kein Auseinanderlaufen von Spezifikation und Implementierung; Frontend bekommt Typsicherheit.
- **Alternatives**: Spezifikation zuerst (zusätzliche Pflegestelle, abgelehnt); GraphQL (Mehraufwand ohne Bedarf); tRPC (koppelt Frontend eng an Backend-Typen, schlechter für externe Nutzer).

### D3 – Datenbank: PostgreSQL + Prisma
- **Decision**: PostgreSQL 16, Prisma für Schema/Migrationen/Zugriff.
- **Rationale**: Relationales Modell mit Verlauf/Audit, gute Filter-/Aggregationsfähigkeit für Register und Dashboard, JSONB für Rohbefunde.
- **Alternatives**: Drizzle (näher an SQL, kleineres Ökosystem für Migrationen); MongoDB (Aggregation/Beziehungen schwächer).

### D4 – Hintergrundjobs: pg-boss in eigenem Worker
- **Decision**: Job-Queue auf PostgreSQL, Zeitpläne pro Integration (Standard stündlich), Wiederholung mit Backoff, Rate-Limit-Beachtung.
- **Rationale**: Keine zusätzliche Infrastruktur; überlebt Neustarts; Fortschritt abfragbar.
- **Alternatives**: BullMQ/Redis (zusätzlicher Dienst); Cron + Route Handler (nicht robust).

### D5 – Authentifizierung: OIDC mit Keycloak
- **Decision**: Frontend meldet per Auth.js (Keycloak-Provider, Authorization Code + PKCE) an; Backend prüft Access-Tokens via JWKS (`jose`). Produktrollen liegen in Tessera (Tabelle `membership`), nicht in Keycloak.
- **Rationale**: Entspricht Klärung (SSO über Keycloak, Rollen in Tessera); keine Passwörter gespeichert.
- **Alternatives**: Keycloak-Rollen/Gruppen als Quelle (abgelehnt, da Klärung: Rollen pflegt Tessera); eigene Passwortverwaltung (ausgeschlossen).

### D6 – Connectoren: Plugin-Schnittstelle
- **Decision**: Paket `packages/connectors` mit Schnittstelle `Connector` (testConnection, fetchFindings (paginiert, inkrementell), mapToDebt). Beschreibung in [contracts/connector-interface.md](contracts/connector-interface.md). SonarCloud: Web-API (Issues, Hotspots, Duplikate); GitLab Cloud: REST-API (Issues, optional Code-Quality-Berichte).
- **Rationale**: FR-012; Connectoren einzeln testbar mit Fixtures.
- **Alternatives**: Webhooks als Primärweg (Zustellung unsicher; kann später ergänzt werden).

### D7 – Deduplizierung und Abgleich
- **Decision**: Eindeutigkeit über (Integration, externe Befund-ID). Abgleich pro Lauf: neu → anlegen; vorhanden → nur quellgeführte Felder aktualisieren; fehlend → Schuld auf „getilgt“ setzen (Klärung), bei Wiederauftauchen wieder öffnen (FR-011a). Feldherkunft (`quelle` vs. `manuell`) wird je Feld geführt.
- **Rationale**: Idempotente Importe (SC-003), Schutz manueller Felder (FR-011).

### D8 – Bewertung
- **Decision**: Kriterien (Auswirkung, Risiko, Aufwand, Folgekosten) je 1–5, Gewichte pro Bewertungsmodell; Prioritätswert = gewichtete Summe, normalisiert 0–100; manuelles Überschreiben nur mit Begründung, beide Werte werden gespeichert (FR-004a). Modelle sind versioniert.
- **Rationale**: Einfach erklärbar, Herleitung einsehbar (US2).

### D9 – Geheimnisse
- **Decision**: AES-256-GCM mit Schlüssel aus Umgebung/Secret-Store, Schlüssel-ID für Rotation; API gibt Zugangsdaten nie zurück; Logging mit Redaction.
- **Alternatives**: Externer Vault (spätere Option, ADR).

### D10 – Dashboard/Zeitverlauf
- **Decision**: Täglicher Snapshot-Job schreibt Kennzahlen je Produkt in `metric_snapshot`; Live-Kennzahlen aus dem Register, Verlauf aus Snapshots.
- **Rationale**: Stimmigkeit mit Register (SC-006) und schnelle Verlaufsabfragen.

### D11 – Tests
- **Decision**: Vitest + eingebettete PostgreSQL (Paket `embedded-postgres`, echte Migrationen, kein Docker nötig; Testcontainers bleibt eine Option für die CI), Vertragstests aus OpenAPI, Playwright-E2E für P1-Flows, Connector-Fixtures aus aufgezeichneten Antworten.

### D12 – Architekturdokumentation
- **Decision**: `docs/architecture/` mit Vision, Qualitätszielen, Kontext/Bausteinen (Diagramme als Mermaid), Integrationskonzept und ADRs (Format MADR) im Repo; Verweis aus README. Siehe FR-020/021.

## Offene Punkte für spätere ADRs
- Mögliche Zusammenlegung `web`+`api` zu einer App.
- Externer Secret-Store statt DB-Verschlüsselung.
- Webhooks zusätzlich zu Polling.
