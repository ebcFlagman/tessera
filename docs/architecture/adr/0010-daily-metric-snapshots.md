# ADR 0010: Tägliche Kennzahlen-Snapshots für den Zeitverlauf

- **Status:** Akzeptiert
- **Datum:** 2026-10-31
- **Umsetzungsstand:** umgesetzt

## Kontext

Das Dashboard zeigt Kennzahlen live aus dem Register und zusätzlich einen Verlauf über die Zeit (FR-014).

## Entscheidung

Ein täglicher Job im Worker (02:15 UTC, zusätzlich einmal beim Start, falls für heute noch nichts
existiert) schreibt Kennzahlen **je Produkt und Team** (Teamlose Schulden bilden eine eigene Partition)
in `metric_snapshot`: Anzahl nach Status, Art und Prioritätsband, offene Anzahl, offener Aufwand,
offene Folgekosten. Das Dashboard summiert die Partitionen für seinen Filter (Produkt, Team, Zeitraum).
Die Live-Zahlen und die Snapshots entstehen aus **derselben Abfrage** (`loadCube`), sodass sie nicht
auseinanderlaufen können. Prioritätsbänder: hoch ab 70, mittel ab 40, niedrig darunter, plus „nicht bewertet“.

## Begründung

Live-Zahlen stimmen mit dem Register überein (QZ-3), Verlaufsabfragen bleiben schnell.

## Betrachtete Alternativen

- **Verlauf aus Ereignissen rekonstruieren:** aufwendig und langsam bei vielen Daten.

## Konsequenzen

- Der Verlauf beginnt erst mit dem ersten Snapshot; es gibt keine rückwirkenden Werte.
- Pro Tag und Partition gibt es genau einen Stand (Unique-Index); ein erneuter Lauf am selben Tag ersetzt ihn.
- Teamzuordnungen werden historisch so festgehalten, wie sie am Stichtag galten.
- Der Snapshot-Job muss zuverlässig laufen ([ADR 0004](0004-background-jobs-with-pg-boss.md)).

## Referenzen

- [Qualitätsziele](../quality-goals.md)
