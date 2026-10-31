## Was ändert sich und warum?

<!-- kurz, aus Sicht der Benutzer oder des Systems -->

## Constitution-Check

Jede Zeile mit „ja“, „entfällt“ oder einer Begründung beantworten. Maßgeblich: [Constitution](../.specify/memory/constitution.md).

- [ ] **I Fachlogik zuerst:** Regeln liegen in `packages/domain`, nicht in Routen oder Komponenten, und sind getestet.
- [ ] **II Erweiterbar an den Rändern:** Quellen nur als Connector; Connectoren schreiben nicht in die Datenbank.
- [ ] **III Nachvollziehbarkeit:** Neue Änderungen an Rollen, Integrationen, Bewertungsmodell oder Schulden stehen im Protokoll bzw. Verlauf.
- [ ] **IV Geheimnisse:** Keine Zugangsdaten in Antworten, Logs, Audit oder Fehlermeldungen; `secrets.test.ts` ist grün.
- [ ] **V Manuell schlägt automatisch:** Importe überschreiben keine manuell gepflegten Felder (Ausnahme „Quelle getilgt gewinnt“).
- [ ] **VI Einfach vor clever:** Neue Laufzeitkomponenten oder Abweichungen sind im Plan („Complexity Tracking“) begründet.
- [ ] **VII Backend ist der Vertrag:** `pnpm openapi:generate && pnpm api-types:generate` ausgeführt und eingecheckt.

## Qualität

- [ ] Neue Fachlogik und neue Endpunkte haben Tests; `pnpm test`, `pnpm lint`, `pnpm typecheck` sind grün.
- [ ] Bei Änderungen an der Architektur: ADR angelegt oder ersetzt und `docs/architecture/vision.md` angepasst (`pnpm check:docs`).
- [ ] Datenbankänderungen nur als Migration.
