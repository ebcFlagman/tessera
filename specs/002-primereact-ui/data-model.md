# Data Model: Einheitliche Oberfläche

Keine Änderung am Datenmodell, an der Datenbank oder an der API. Es entstehen nur Browser-seitige Zustände.

## Erscheinungsbild-Auswahl

| Feld | Typ | Regel |
|------|-----|-------|
| `mode` | `'light' \| 'dark' \| 'system'` | Standard `'system'`; Speicherort `localStorage` unter dem Schlüssel `tessera-theme`; ungültige oder fehlende Werte gelten als `'system'` |

Der aufgelöste Wert (`light`/`dark`) wird vor dem ersten Rendern am `<html>`-Element gesetzt. Zugriffe auf den Speicher sind abgesichert (Speicher kann blockiert sein).

## Gestaltungsthema (Konfiguration im Code)

| Teil | Inhalt |
|------|--------|
| Preset | Basis-Preset aus `@primeuix/themes` |
| Akzentfarbe | Primärpalette (Tessera-Akzent) als Token |
| Dunkel-Selektor | Bedingung am `<html>`-Element |
| Locale | Deutsche Texte für Bibliothekskomponenten |

## Zuordnungen für Markierungen (rein, testbar)

Status, Art, Priorität und Quelle → (Beschriftung, Schweregrad, Symbol). Bestehende Beschriftungen aus `components/debt/labels.ts`; Ergänzung um Symbol, damit die Bedeutung nicht nur über Farbe erkennbar ist (FR-005).
