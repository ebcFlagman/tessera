# Contract: Connector-Schnittstelle

Jede Integrationsquelle implementiert diese Schnittstelle (Paket `packages/connectors`). Der Kern kennt nur das Interface.

```ts
interface Connector {
  readonly type: string;                         // "sonarcloud" | "gitlab" | ...
  configSchema: ZodSchema;                       // Validierung von config
  testConnection(ctx: ConnectorContext): Promise<TestResult>;
  fetchFindings(ctx: ConnectorContext, since?: Date): AsyncIterable<RawFinding[]>; // paginiert
  mapToDebt(finding: RawFinding): DebtDraft;     // Titel, Beschreibung, Art, Aufwandsschätzung?
}
```

## Verhalten
- `fetchFindings` liefert stabile `externalId`s; inkrementell mit `since`, falls die Quelle es kann, sonst vollständig.
- Rate-Limits und HTTP-429 werden vom Connector gemeldet (`retryAfter`); der Worker pausiert.
- Fehler sind typisiert: `Unreachable`, `InvalidCredentials`, `PartialData` → verständliche Meldung (FR-013), bestehende Daten bleiben unberührt.
- Connectoren schreiben nie in die Datenbank und sehen Zugangsdaten nur über `ctx`.
- Neue Connectoren: Implementieren, registrieren, Fixture-Tests hinzufügen; keine Änderung am Schuldenmodell (FR-012).

## v1
- **sonarcloud**: Issues (Code Smells, Vulnerabilities), Security Hotspots, Duplikat-Metriken je Projekt.
- **gitlab**: Issues mit konfigurierbarem Label (z. B. `tech-debt`); optional Code-Quality-Berichte.
