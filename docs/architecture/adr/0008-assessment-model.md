# ADR 0008: Bewertung mit gewichteten Kriterien und versioniertem Modell

- **Status:** Akzeptiert
- **Datum:** 2026-10-31
- **Umsetzungsstand:** umgesetzt

## Kontext

Die Priorität einer Schuld muss nachvollziehbar, konfigurierbar und überprüfbar sein; manuelle Ausnahmen müssen möglich, aber begründet sein (FR-004, FR-004a, FR-005).

## Entscheidung

Kriterien (Standard: Auswirkung, Risiko, Folgekosten, Aufwand) werden je mit 1–5 bewertet. Der Prioritätswert ist der gewichtete Durchschnitt der normalisierten Werte, skaliert auf 0–100 (eine Nachkommastelle); die Richtung (`up`/`down`) legt fest, ob ein hoher Wert dringender wirkt (Aufwand wirkt umgekehrt). Das Modell ist versioniert, genau eines ist aktiv (Datenbank-Constraint). Eine neue Version berechnet alle Prioritäten neu; fehlt einer Schuld ein Wert für ein neues Kriterium, gilt sie als „nicht bewertet“. Bewertungen sind unveränderlich. Eine manuelle Überschreibung braucht eine Begründung und steht getrennt vom berechneten Wert; gültig ist der überschriebene Wert (`priority_effective`).

## Begründung

Einfach erklärbar, Herleitung je Kriterium einsehbar, Historie vollständig, Änderungen am Modell sind auditiert.

## Betrachtete Alternativen

- **Freie Einstufung hoch/mittel/niedrig:** subjektiv und nicht vergleichbar.
- **Nur berechnet, ohne Überschreiben:** zu starr; abgelehnt in der Klärung.

## Konsequenzen

- Die Berechnung liegt als reine Funktion in `packages/domain/src/scoring.ts`.
- Änderungen am Modell lösen eine Neuberechnung aus und sind Administratoren vorbehalten.

## Referenzen

- [Qualitätsziele](../quality-goals.md)
- `packages/domain/src/scoring.ts`
- `apps/api/src/services/assessment.ts`
