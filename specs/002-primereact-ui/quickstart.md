# Quickstart: Validierung der PrimeReact-11-Oberfläche

## Voraussetzungen

- Abhängigkeiten installiert (`pnpm install`), lokale Dienste wie in der Betriebsdoku (`deploy/`).
- PrimeUI-Lizenzschlüssel in der Umgebungskonfiguration gesetzt (siehe [research.md](research.md), R-1); nie im Repository.

## Prüfen

```bash
pnpm --filter @tessera/web typecheck
pnpm lint
pnpm test
pnpm test:e2e
pnpm check:generated
pnpm build
```

## Manuelle Szenarien

1. **Rahmen (Story 1)**: Anmelden, alle Einträge beider Navigationsgruppen öffnen; Fenster auf Smartphone-Breite ziehen und die Navigation einklappen/öffnen; Abmelden.
2. **Register (Story 2)**: Schuld anlegen (Pflichtfeld leer lassen → Fehler am Feld), filtern, sortieren, „Mehr laden“, Priorität überschreiben, Duplikate zusammenführen (Bestätigungsdialog, Rückmeldung).
3. **Dashboard (Story 3)**: Zahlen mit dem Stand vor der Umstellung vergleichen; Export der Prioritätenliste.
4. **Verwaltung (Story 4)**: Jede Seite öffnen und ihre bisherigen Aktionen ausführen; Zugriff als Nutzer ohne Recht prüfen.
5. **Erscheinungsbild (Story 5)**: Auf dunkel umschalten, neu laden (kein Aufblitzen), Systemeinstellung ändern, Tastaturbedienung prüfen.
6. **Texte**: Stichprobe aller Seiten auf englische Standardtexte der Bibliothek.
7. **Leistung**: Mit 10.000 Schulden Register und Dashboard öffnen (< 3 s).

## Erwartete Ergebnisse

Entsprechen den Erfolgskriterien SC-001 bis SC-008 in [spec.md](spec.md); Barrierefreiheitsprüfung in hell und dunkel ohne schwerwiegende Verstöße.

## Messungen und Grenzen (Stand der Umsetzung)

- **Register-Leistung (SC-004):** Die Tabelle lädt nur die sichtbare Seite (Cursor, „Mehr laden“); die Antwortzeit des Servers bei 10.000 Schulden liegt laut `QZ-2` bei rund 10 ms. Eine Messung der Oberfläche selbst mit 10.000 Schulden steht noch aus.
- **Akzentfarbe (SC-007):** Geprüft, indem die Palette in `apps/web/src/theme/preset.ts` testweise von Indigo auf Teal gestellt wurde; alle Seiten folgten ohne weitere Änderung.
- **Dashboard-Tabellen:** Die Datentabellen unter den Diagrammen („Als Tabelle anzeigen“) sind bewusst einfache Tabellen als barrierefreie Alternative.
