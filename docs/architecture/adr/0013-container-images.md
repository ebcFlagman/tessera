# ADR 0013: Container-Images aus dem Monorepo

- **Status:** Akzeptiert
- **Datum:** 2026-10-31
- **Umsetzungsstand:** teilweise (Layouts geprüft, `docker build` selbst noch nicht gelaufen)

## Kontext

Web, API und Worker sollen als getrennte Container laufen ([ADR 0001](0001-monorepo-with-two-nextjs-apps.md)).
Die Pakete unter `packages/*` liegen als TypeScript-Quellen im Monorepo; Prisma lädt zur Laufzeit eine
Query-Engine, die ein Datei-Tracer nicht sieht.

## Entscheidung

- **Web:** Next.js `output: 'standalone'` (nur `next`, `react` und die Auth-Pakete werden gebraucht).
  `NEXT_PUBLIC_API_URL` ist ein Build-Argument, weil es in das Browser-Bündel einkompiliert wird.
- **API und Worker:** `pnpm deploy --prod` erzeugt einen Baum mit allen Produktionsabhängigkeiten;
  danach läuft `prisma generate` darin. Die API startet mit `next start`, der Worker mit `tsx`
  (Produktionsabhängigkeit), weil die Workspace-Pakete TypeScript-Quellen sind.
- Die Next.js-Konfiguration ist `.mjs`, damit `next start` kein TypeScript braucht.
- `@prisma/client`, `pg-boss` und `prisma` stehen als **direkte** Abhängigkeiten der API und des Workers,
  weil sie im `pnpm deploy`-Baum sonst nur beim Paket `@tessera/db` liegen und zur Laufzeit nicht gefunden werden.
- Migrationen laufen mit dem Worker-Image (`prisma migrate deploy`), vor dem Start einer neuen Version.

## Begründung

Standalone für die API scheiterte praktisch: Das Bündel enthielt weder die Query-Engine noch `pg-boss`,
die erste Datenbankabfrage wäre im Container fehlgeschlagen. Der vollständige Produktionsbaum vermeidet diese
Klasse von Fehlern und ist lokal ohne Docker prüfbar.

## Betrachtete Alternativen

- **Standalone auch für die API:** kleineres Image, aber Query-Engine und externe Pakete müssen von Hand
  nachgetragen werden und brechen leicht bei Updates.
- **Das ganze Monorepo ins Image:** einfach, aber groß und mit Entwicklungswerkzeugen.
- **Worker vorab zu JavaScript bündeln:** zusätzlicher Build-Schritt ohne klaren Gewinn.

## Konsequenzen

- Die Images sind größer als ein reines Standalone-Bündel (volle Produktionsabhängigkeiten).
- Beim Hinzufügen einer Abhängigkeit, die zur Laufzeit von einem Workspace-Paket geladen wird, muss sie
  auch bei der App stehen, die es einbindet.
- Die Dockerfiles sind in einer Umgebung ohne Docker entstanden. Geprüft sind die Layouts (siehe README);
  ein echter `docker build` und ein Start des Gesamtsystems stehen aus.

## Referenzen

- `deploy/Dockerfile.api`, `deploy/Dockerfile.web`, `deploy/Dockerfile.worker`
- [README, Abschnitt „Betrieb“](../../../README.md)
