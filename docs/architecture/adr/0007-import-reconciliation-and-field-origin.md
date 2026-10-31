# ADR 0007: Idempotenter Abgleich mit Feldherkunft

- **Status:** Akzeptiert
- **Datum:** 2026-10-31
- **Umsetzungsstand:** umgesetzt

## Kontext

Importierte Schulden werden zusätzlich von Menschen bearbeitet. Wiederholte Importe dürfen weder Duplikate erzeugen noch Handarbeit überschreiben (FR-009, FR-011).

## Entscheidung

Befunde sind eindeutig über (Integration, externe Befund-ID). Je Schuld wird pro Feld geführt, ob es aus der Quelle oder von Hand stammt (`field_origin`); manuelle Felder bleiben unangetastet. Einzige Ausnahme: Ist der Befund in der Quelle erledigt, wird die Schuld auf „getilgt“ gesetzt, auch bei manuell gesetztem Status; taucht er wieder auf, wird sie wieder geöffnet. Der Verlauf hält den vorherigen Status fest.

## Begründung

Wiederholbare Importe und Vertrauen in manuelle Pflege; die Ausnahme entspricht der Klärung „Quelle getilgt gewinnt“.

## Betrachtete Alternativen

- **Importe überschreiben alles:** zerstört Handarbeit.
- **Erledigte Befunde nur vorschlagen:** bewusst abgelehnt: die Quelle gilt als Wahrheit für „getilgt“.

## Konsequenzen

- Der Abgleich ist als reine Funktion in `packages/domain` zu schreiben und separat zu testen.
- Konflikte müssen in der Oberfläche sichtbar sein.

## Referenzen

- Constitution Prinzip V
- [Integrationskonzept](../integration-concept.md)
