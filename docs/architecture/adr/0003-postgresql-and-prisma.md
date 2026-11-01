# ADR 0003: PostgreSQL 16 mit Prisma

- **Status:** Akzeptiert
- **Datum:** 2026-10-31
- **Umsetzungsstand:** umgesetzt

## Kontext

Tessera braucht ein relationales Modell mit Verlauf und Audit, gute Filter- und Aggregationsfähigkeit für Register und Dashboard sowie JSON für Rohbefunde.

## Entscheidung

PostgreSQL 16 als einziger Datenspeicher; Prisma für Schema, Migrationen und Zugriff. Migrationen sind versionierte SQL-Dateien unter `packages/db/prisma/migrations`. Wo Prisma etwas nicht ausdrückt, steht handgeschriebenes SQL in der Migration (zum Beispiel die generierte Spalte `priority_effective`, ein partieller Unique-Index für das aktive Bewertungsmodell und Check-Constraints).

## Begründung

Bewährt, Transaktionen und Constraints schützen die Konsistenz, JSONB deckt Rohbefunde und Feldherkunft ab. Ein Speicher hält den Betrieb einfach (Prinzip VI).

## Betrachtete Alternativen

- **Drizzle:** näher an SQL, aber kleineres Ökosystem für Migrationen.
- **MongoDB:** Beziehungen und Aggregation sind schwächer.

## Konsequenzen

- Datenbankänderungen laufen ausschließlich über Migrationen.
- Suche nutzt vorerst einfache Teilstring-Suche; ein Volltextindex ist bei Bedarf nachrüstbar.
- Eine in SQL generierte Spalte ist für Prisma eine normale Spalte und darf nie geschrieben werden.
- Das Änderungsprotokoll (`audit_entry`) ist per Trigger nur anfügend, Bewertungen (`assessment`) sind per Trigger unveränderlich: Auch Code mit Datenbankzugriff kann sie nicht umschreiben.

## Referenzen

- [data-model.md](../../../specs/001-tech-debt-management/data-model.md)
- `packages/db/prisma/schema.prisma`
