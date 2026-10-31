# ADR 0002: Backend-Code ist der API-Vertrag (Code-first)

- **Status:** Akzeptiert
- **Datum:** 2026-10-31
- **Umsetzungsstand:** umgesetzt

## Kontext

Frontend und Backend dürfen nicht auseinanderlaufen. Eine von Hand gepflegte Spezifikation wäre eine zweite Wahrheit neben dem Code.

## Entscheidung

Routen werden im Backend mit Zod-Schemas definiert (`defineRoute` in `apps/api/src/openapi/route.ts`). Daraus erzeugt `pnpm openapi:generate` die OpenAPI-Spezifikation (`apps/api/openapi.generated.json`), die eingecheckt wird. Typen und Client des Frontends werden daraus generiert (`packages/api-types`, openapi-typescript, openapi-fetch). Die CI bricht ab, wenn Spezifikation oder generierter Code veraltet sind (`pnpm check:generated`).

## Begründung

Eine einzige Wahrheit im Code, Typsicherheit bis in die Oberfläche, Fehler zeigen sich beim Build statt zur Laufzeit. Vertragstests prüfen echte Antworten gegen die erzeugte Spezifikation.

## Betrachtete Alternativen

- **Spezifikation zuerst (OpenAPI von Hand):** zusätzliche Pflegestelle, Abweichungen wahrscheinlich; ausdrücklich abgelehnt.
- **GraphQL:** Mehraufwand ohne klaren Bedarf.
- **tRPC:** koppelt das Frontend eng an Backend-Typen und ist für externe Nutzer ungeeignet.

## Konsequenzen

- Jede API-Änderung erfordert das Neugenerieren und Einchecken von Spezifikation und Client.
- Handgeschriebene API-Aufrufe im Frontend sind per ESLint-Regel verboten.
- Die Datei `specs/.../contracts/openapi.yaml` ist nur ein Entwurf und nicht maßgeblich.

## Referenzen

- Constitution Prinzip VII
- `scripts/check-generated.sh`
- [Qualitätsziel QZ-7](../quality-goals.md)
