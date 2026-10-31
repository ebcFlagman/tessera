# ADR 0004: Hintergrundjobs mit pg-boss in eigenem Worker

- **Status:** Akzeptiert
- **Datum:** 2026-10-31
- **Umsetzungsstand:** geplant (Worker-Gerüst vorhanden)

## Kontext

Importe sind langlaufend und zeitgesteuert (standardmäßig stündlich, FR-009). Next.js eignet sich nicht für solche Jobs, und sie dürfen Benutzeranfragen nicht blockieren.

## Entscheidung

Eine Job-Queue auf PostgreSQL (pg-boss) und ein eigener Worker-Prozess (`apps/worker`). Die API legt Importjobs über dieselbe Queue an. Zeitpläne gelten pro Integration; Fehlversuche werden mit Wartezeit wiederholt, Rate-Limits der Quellen werden beachtet.

## Begründung

Keine zusätzliche Infrastruktur, Jobs überleben Neustarts, Fortschritt ist abfragbar (`SyncRun`). Der Worker teilt Domäne und Datenbank mit der API.

## Betrachtete Alternativen

- **BullMQ mit Redis:** zusätzlicher Dienst ohne Bedarf.
- **Cron mit Route Handler:** nicht robust bei Neustarts und lang laufenden Aufgaben.

## Konsequenzen

- Ein dritter Laufzeit-Prozess muss betrieben und überwacht werden.
- Der tägliche Snapshot-Job für das Dashboard läuft ebenfalls hier ([ADR 0010](0010-daily-metric-snapshots.md)).

## Referenzen

- Complexity Tracking in [plan.md](../../../specs/001-tech-debt-management/plan.md)
- [Integrationskonzept](../integration-concept.md)
