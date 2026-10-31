# ADR 0009: Umgang mit Zugangsdaten

- **Status:** Akzeptiert
- **Datum:** 2026-10-31
- **Umsetzungsstand:** teilweise (Redaction umgesetzt; Verschlüsselung folgt mit US3)

## Kontext

Für Importe speichert Tessera Zugangsdaten externer Systeme. Sie dürfen nie offengelegt werden (FR-017, Prinzip IV).

## Entscheidung

Zugangsdaten werden mit AES-256-GCM verschlüsselt in der Datenbank gespeichert; der Schlüssel kommt aus der Umgebung beziehungsweise einem Secret-Store, eine Schlüssel-ID erlaubt Rotation. Die API gibt Zugangsdaten nie zurück. Logging und Audit entfernen sensible Felder (`redact`), sodass sie nicht im Klartext erscheinen können.

## Begründung

Schutz auch bei Datenbank-Zugriff und Logs, ohne zusätzliche Infrastruktur.

## Betrachtete Alternativen

- **Externer Vault:** sinnvolle spätere Option, für Version 1 zu aufwendig; eigener ADR bei Bedarf.

## Konsequenzen

- Der Schlüssel muss sicher bereitgestellt und gesichert werden; Verlust macht gespeicherte Zugangsdaten unbrauchbar.
- Ein Test sucht in Antworten, Logs und Audit nach Klartext.

## Referenzen

- Constitution Prinzip IV
- `apps/api/src/lib/logger.ts` (`redact`)
- [Qualitätsziel QZ-4](../quality-goals.md)
