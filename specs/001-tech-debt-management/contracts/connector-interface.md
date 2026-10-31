# Contract: Connector-Schnittstelle

Jede Integrationsquelle implementiert diese Schnittstelle (Paket `packages/connectors`). Der Kern kennt nur das Interface.

```ts
interface Connector {
  readonly type: string;                         // "sonarcloud" | "gitlab" | ...
  configSchema: ZodSchema;                       // Validierung von config
  testConnection(ctx: ConnectorContext): Promise<TestResult>;
  fetchFindings(ctx: ConnectorContext): AsyncIterable<RawFinding[]>; // paginiert, vollständig
  mapToDebt(finding: RawFinding): DebtDraft;     // Titel, Beschreibung, Art, Aufwandsschätzung?
}
```

## Verhalten
- `fetchFindings` liefert stabile `externalId`s und **alle** offenen Befunde. Ein unvollständiges Listing (Limits, Abbruch) führt zu `PartialData`, nie zu einem Teilergebnis, weil fehlende Befunde als behoben gelten.
- Der Kontext enthält `allowedHosts`; Anfragen an andere Hosts als `sonarcloud.io`, `gitlab.com` und die freigegebenen werden mit `InvalidConfig` abgelehnt (SSRF-Schutz).
- Rate-Limits und HTTP-429 werden vom Connector gemeldet (`retryAfter`); der Worker pausiert.
- Fehler sind typisiert: `Unreachable`, `InvalidCredentials`, `InvalidConfig`, `PartialData`, `RateLimited` → verständliche Meldung (FR-013), bestehende Daten bleiben unberührt.
- Connectoren schreiben nie in die Datenbank und sehen Zugangsdaten nur über `ctx`.
- Neue Connectoren: Implementieren, registrieren, Fixture-Tests hinzufügen; keine Änderung am Schuldenmodell (FR-012).

## v1
- **sonarcloud**: Issues (Code Smells, Vulnerabilities), Security Hotspots, Duplikat-Metriken je Projekt.
- **gitlab**: Issues mit konfigurierbarem Label (z. B. `tech-debt`); optional Code-Quality-Berichte.
