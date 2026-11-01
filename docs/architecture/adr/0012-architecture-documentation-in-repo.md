# ADR 0012: Architekturdokumentation im Repository

- **Status:** Akzeptiert
- **Datum:** 2026-10-31
- **Umsetzungsstand:** umgesetzt

## Kontext

Die Architektur muss für Menschen und KI-Assistenz jederzeit als verlässliche Referenz verfügbar sein (FR-020, FR-021).

## Entscheidung

Die Dokumentation liegt versioniert unter `docs/architecture/`: Vision, Qualitätsziele, Kontext und Bausteine (Mermaid), Integrationskonzept und ADRs im MADR-Stil. Die Vision verlinkt alle ADRs. Architekturänderungen aktualisieren die Doku im selben Pull Request; eine Link-Prüfung in der CI hält Verweise gültig.

## Begründung

Nähe zum Code, Review zusammen mit der Änderung, Verlauf in Git, maschinenlesbar für KI-Kontext.

## Betrachtete Alternativen

- **Wiki oder externes Dokument:** driftet vom Code weg und ist nicht versioniert.

## Konsequenzen

- Disziplin: Änderungen an Architektur ohne ADR gelten als unvollständig.
- Der Umsetzungsstand in der Vision muss gepflegt werden.

## Referenzen

- [Vision](../vision.md)
- [ADR-Index](README.md)
