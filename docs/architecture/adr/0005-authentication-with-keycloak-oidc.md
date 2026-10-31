# ADR 0005: Anmeldung per OIDC mit Keycloak, Rollen in Tessera

- **Status:** Akzeptiert
- **Datum:** 2026-10-31
- **Umsetzungsstand:** umgesetzt

## Kontext

Tessera soll keine eigenen Passwörter verwalten. Die Organisation betreibt Keycloak. Berechtigungen sind produktbezogen.

## Entscheidung

Das Frontend meldet per Auth.js (Keycloak-Provider, Authorization Code mit PKCE) an. Das Backend prüft Access-Tokens gegen das JWKS des Realms (`jose`), spiegelt den Benutzer (`sub`, Name, E-Mail) in die Datenbank und lädt die Rechte aus der Tabelle `membership`. Lesen darf jeder angemeldete Benutzer; Schreiben und Verwalten richten sich nach der Rolle (`admin`, `editor`) pro Produkt. Abmelden beendet auch die Keycloak-Sitzung.

## Begründung

Keine Passwörter in Tessera, Standardprotokoll, Rollen bleiben in der Hand der Anwendung (Klärung der Spezifikation).

## Betrachtete Alternativen

- **Rollen aus Keycloak-Gruppen:** widerspricht der Klärung, dass Tessera die Rollen verwaltet.
- **Eigene Passwortverwaltung:** ausgeschlossen.

## Konsequenzen

- Testrealm mit festen Benutzer-IDs unter `deploy/keycloak`, damit Seed und Realm zusammenpassen.
- Das Frontend erneuert Access-Tokens über das Refresh-Token; bei Fehler ist eine erneute Anmeldung nötig.
- Das Backend braucht CORS für den Web-Ursprung (`WEB_ORIGIN`).

## Referenzen

- Constitution Prinzip IV
- [spec.md](../../../specs/001-tech-debt-management/spec.md) Klärungen
