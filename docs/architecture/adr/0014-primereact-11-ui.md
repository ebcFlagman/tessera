# ADR 0014: Oberfläche mit PrimeReact 11

- **Status:** Akzeptiert
- **Datum:** 2026-11-01
- **Umsetzungsstand:** umgesetzt (Spezifikation `specs/002-primereact-ui`; Container-Build steht aus, siehe ADR 0013)

## Kontext

Die Web-Oberfläche war bewusst schlicht (Inline-Stile, native Elemente). Der Auftraggeber möchte sie
einheitlich mit PrimeReact in der aktuellen Hauptversion 11 gestalten. Version 11 ist eine Neuentwicklung:
`primereact` liefert ungestylte, zusammensetzbare Bausteine (`Select.Root`, `Select.Trigger` …), die gestylte
Schicht ist `@primereact/ui` (nutzt `@primereact/styles`) mit Presets aus `@primeuix/themes`. Die Lizenz ist
die PrimeUI License, nicht MIT.

## Entscheidung

- `@primereact/ui` 11.2.2 (fest), `@primeuix/themes` und `@primeicons/react` in `apps/web`.
- Ein einziger `PrimeReactProvider` ([PrimeProvider.tsx](../../../apps/web/src/components/shell/PrimeProvider.tsx))
  mit Aura-Preset und Tessera-Akzentfarbe, definiert an einer Stelle ([preset.ts](../../../apps/web/src/theme/preset.ts)).
- Server-Rendering: `PrimeReactStyleSheet` plus `useServerInsertedHTML`, damit die Stile schon im ausgelieferten HTML
  stehen (im Spike geprüft, kein ungestalteter Zwischenzustand, kein `transpilePackages` nötig).
- Hell/Dunkel: Selektor `:root[data-theme='dark']`; die Wahl (`light|dark|system`) liegt in `localStorage`
  (`tessera-theme`), ein Inline-Skript im `<head>` setzt das Attribut vor dem ersten Rendern.
- Kontrast: Die Bibliothek legt ihre Dunkel-Regeln verschachtelt unter `:root` ab; das funktioniert mit einem
  `data-theme`-Selektor am `<html>`-Element nicht für scheme-spezifische Preset-Überschreibungen. Kontrastkorrekturen
  (Primärfarbe, Meldungsfarben) stehen deshalb als `light-dark()`-Paare in `globals.css` (`:root:root`).
  Die automatische Prüfung (axe, hell und dunkel) sichert sie ab.
- Deutsche Texte zentral in [locale-de.ts](../../../apps/web/src/theme/locale-de.ts).
- Wiederverwendbare Bausteine in `apps/web/src/components/ui/` (Tabelle, Formularfeld, Statusmarkierung,
  Bestätigungsdialog, Rückmeldungen, Zustände). Seiten enthalten keine Stilwerte.
- Recharts bleibt für Diagramme; die Farben kommen aus den Design-Tokens des Presets.
- Lizenz: kostenlose **Community License**; der Schlüssel wird als Build-Argument `NEXT_PUBLIC_PRIMEUI_LICENSE`
  gesetzt (nicht im Repository). Die Berechtigung muss jährlich bestätigt werden.

## Begründung

Vorgabe des Auftraggebers; ein gestyltes Paket mit einem Preset ist der kürzeste Weg zu einem einheitlichen,
umfärbbaren Erscheinungsbild mit Hell/Dunkel. Backend, API und Fachlogik bleiben unberührt (Prinzipien I, VII).

## Betrachtete Alternativen

- **PrimeReact 10 (MIT):** andere, eingeführte API; widerspricht der Vorgabe Version 11. Rückfall, falls die Lizenz nicht passt.
- **Ungestylte Primitive mit Tailwind:** maximale Freiheit, aber deutlich mehr Eigenbau und Pflege (Prinzip VI).

## Konsequenzen

- Die API von Version 11 unterscheidet sich von Version 10; Beispiele aus älteren Versionen sind nicht übertragbar.
- Der Lizenz-Token steckt im Browser-Bündel (die Prüfung läuft offline im Browser); er ist kein Zugangsgeheimnis,
  gehört aber nicht ins Repository. Fehlt er, zeigt die Bibliothek ein Lizenzhinweis-Banner.
- Die Barrierefreiheitsprüfung läuft in hellem und dunklem Erscheinungsbild.
