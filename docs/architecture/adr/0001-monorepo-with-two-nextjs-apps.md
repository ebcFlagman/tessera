# ADR 0001: Monorepo mit zwei Next.js-Apps und einem Worker

- **Status:** Akzeptiert
- **Datum:** 2026-10-31
- **Umsetzungsstand:** teilweise (web, api umgesetzt; Worker als Gerüst)

## Kontext

Der Auftraggeber verlangt Backend und Frontend je in Next.js, das Frontend mit React. Fachlogik und Typen sollen zwischen Backend, Frontend und Hintergrundjobs geteilt werden.

## Entscheidung

Ein pnpm-Monorepo mit `apps/web` (Next.js, React), `apps/api` (Next.js Route Handlers), `apps/worker` (Node-Prozess) und geteilten Paketen unter `packages/*` (`domain`, `db`, `connectors`, `api-types`).

## Begründung

Erfüllt die Vorgabe, trennt Oberfläche und API sauber und erlaubt unabhängiges Deployment. Geteilte Pakete vermeiden doppelte Typen und Regeln (Prinzip I).

## Betrachtete Alternativen

- **Eine einzige Next.js-Vollstack-App:** einfacher im Betrieb, widerspricht aber der Vorgabe. Bleibt als mögliche spätere Vereinfachung offen.
- **Getrennte Repositories:** Typen und Fachlogik ließen sich nur aufwendig teilen.

## Konsequenzen

- Zwei Next.js-Prozesse, die getrennt gestartet, konfiguriert (CORS, Ports) und deployt werden.
- Ein dritter Prozess (Worker) ist nötig, siehe [ADR 0004](0004-background-jobs-with-pg-boss.md).
- Abweichung vom einfachsten Aufbau ist im Plan unter „Complexity Tracking“ begründet.

## Referenzen

- [plan.md](../../../specs/001-tech-debt-management/plan.md)
- Constitution Prinzipien I und VI
