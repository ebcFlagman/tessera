# ADR 0010: Tägliche Kennzahlen-Snapshots für den Zeitverlauf

- **Status:** Akzeptiert
- **Datum:** 2026-10-31
- **Umsetzungsstand:** geplant (US4)

## Kontext

Das Dashboard zeigt Kennzahlen live aus dem Register und zusätzlich einen Verlauf über die Zeit (FR-014).

## Entscheidung

Ein täglicher Job im Worker schreibt Kennzahlen je Produkt (Anzahl nach Status, Art und Prioritätsband sowie Gesamtaufwand) in `metric_snapshot`. Live-Zahlen kommen aus dem Register, der Verlauf aus den Snapshots.

## Begründung

Live-Zahlen stimmen mit dem Register überein (QZ-3), Verlaufsabfragen bleiben schnell.

## Betrachtete Alternativen

- **Verlauf aus Ereignissen rekonstruieren:** aufwendig und langsam bei vielen Daten.

## Konsequenzen

- Der Verlauf beginnt erst mit dem ersten Snapshot; es gibt keine rückwirkenden Werte.
- Der Snapshot-Job muss zuverlässig laufen ([ADR 0004](0004-background-jobs-with-pg-boss.md)).

## Referenzen

- [Qualitätsziele](../quality-goals.md)
