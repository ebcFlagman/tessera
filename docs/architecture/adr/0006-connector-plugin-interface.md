# ADR 0006: Connector-Schnittstelle für Umsysteme

- **Status:** Akzeptiert
- **Datum:** 2026-10-31
- **Umsetzungsstand:** umgesetzt

## Kontext

Mehrere Umsysteme (SonarCloud, GitLab, später weitere) sollen anbindbar sein, ohne den Kern zu verändern (FR-012).

## Entscheidung

Jede Quelle ist ein Connector im Paket `packages/connectors` hinter der Schnittstelle `testConnection`, `fetchFindings`, `mapToDebt`. Connectoren schreiben nie in die Datenbank und erhalten Zugangsdaten nur über ihren Kontext. Fehler und Rate-Limits sind typisiert.

## Begründung

Der Kern bleibt unabhängig von Quellen; jede Quelle ist einzeln mit aufgezeichneten Antworten testbar.

## Betrachtete Alternativen

- **Webhooks als Hauptweg:** Zustellung unsicher; kann später zusätzlich kommen.

## Konsequenzen

- Neue Quellen brauchen Fixture-Tests, aber keine Kernänderung.
- Polling statt Push, daher Aktualität im Stundenbereich.
- Das Listing muss vollständig sein; ein Abruf ist immer ein voller Lauf (siehe [Integrationskonzept](../integration-concept.md)).
- Quellen dürfen nur auf freigegebenen Hosts liegen (`SOURCE_ALLOWED_HOSTS`), um Abrufe interner Adressen zu verhindern.

## Referenzen

- [connector-interface.md](../../../specs/001-tech-debt-management/contracts/connector-interface.md)
- [Integrationskonzept](../integration-concept.md)
