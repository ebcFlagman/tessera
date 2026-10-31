# Systemkontext und Bausteine

Diagramme sind in Mermaid geschrieben und werden von GitHub und GitLab direkt dargestellt.

## Systemkontext

```mermaid
flowchart LR
    user["Benutzer<br/>(Team, Tech Lead, Manager, Admin)"]
    tessera["Tessera"]
    kc["Keycloak<br/>(Anmeldung, OIDC)"]
    sonar["SonarCloud<br/>(Code-Qualität)"]
    gitlab["GitLab Cloud<br/>(Issues)"]

    user -->|Browser| tessera
    tessera -->|"OIDC: Login, Token-Prüfung"| kc
    tessera -->|"liest Befunde per API"| sonar
    tessera -->|"liest Issues per API"| gitlab
```

Tessera **liest** aus SonarCloud und GitLab (Version 1: kein Rückschreiben). Benutzer und
Passwörter gehören Keycloak; Produktrollen verwaltet Tessera selbst.

## Bausteine

```mermaid
flowchart TB
    subgraph browser[Browser]
        web["apps/web<br/>Next.js + React"]
    end
    subgraph server[Server]
        api["apps/api<br/>Next.js Route Handlers<br/>REST /api/v1"]
        worker["apps/worker<br/>Import-Jobs, Zeitpläne"]
    end
    db[("PostgreSQL<br/>Daten, Queue, Audit")]
    kc[Keycloak]
    ext["SonarCloud / GitLab"]

    web -->|"generierter Client<br/>Bearer-Token"| api
    web -->|"OIDC Login"| kc
    api -->|"JWT prüfen (JWKS)"| kc
    api --> db
    worker --> db
    worker -->|"Connectoren"| ext
    api -.->|"legt Importjobs an"| db
```

### Pakete und Verantwortung

| Baustein    | Pfad                  | Verantwortung                                                                                                                                       | Stand                                                         |
| ----------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Web         | `apps/web`            | Oberfläche (Dashboard, Register, Detail, Prioritäten, Integrationen, Modellpflege), Login per Auth.js, ruft die API nur über den generierten Client | umgesetzt (Register, Bewertung); Dashboard/Verwaltung geplant |
| API         | `apps/api`            | Routen mit Zod-Schemas, Rechteprüfung, Services; erzeugt die OpenAPI-Spezifikation                                                                  | umgesetzt für Produkte, Benutzer, Schulden, Bewertung         |
| Worker      | `apps/worker`         | Importjobs, Zeitpläne, Tages-Snapshots (pg-boss)                                                                                                    | umgesetzt (Importjobs, Zeitplan, Tages-Snapshots)             |
| Domäne      | `packages/domain`     | reine Fachlogik: Statusregeln, Bewertung, Fehler                                                                                                    | umgesetzt; Abgleich geplant                                   |
| Datenbank   | `packages/db`         | Prisma-Schema, Migrationen, Seed                                                                                                                    | umgesetzt                                                     |
| Connectoren | `packages/connectors` | Schnittstelle und Quellen (SonarCloud, GitLab)                                                                                                      | umgesetzt (SonarCloud, GitLab Cloud)                          |
| API-Typen   | `packages/api-types`  | aus der OpenAPI-Spezifikation generierte Typen                                                                                                      | umgesetzt (generiert)                                         |

### Abhängigkeitsregeln

- `packages/domain` hat **keine** Abhängigkeit auf Datenbank, HTTP oder Frameworks.
- Das Frontend ruft das Backend ausschließlich über den generierten Client (ESLint-Regel erzwingt es).
- Connectoren schreiben nie selbst in die Datenbank; der Worker übernimmt das Ergebnis.
- Der Worker und die API teilen sich Datenbank und Domäne, aber keinen Prozess.

## Ablauf: Anmeldung und API-Aufruf

```mermaid
sequenceDiagram
    actor U as Benutzer
    participant W as web
    participant K as Keycloak
    participant A as api
    participant D as PostgreSQL

    U->>W: „Anmelden“
    W->>K: Authorization Code + PKCE
    K-->>W: Access- und Refresh-Token
    U->>W: Register öffnen
    W->>A: GET /debts (Bearer-Token)
    A->>K: Token prüfen (JWKS)
    A->>D: Benutzer spiegeln, Rechte laden, Daten lesen
    A-->>W: Schulden (Schema aus der OpenAPI-Spezifikation)
```

Abgelaufene Access-Tokens erneuert das Frontend über das Refresh-Token. Schlägt das fehl,
fordert die Startseite zur erneuten Anmeldung auf. „Abmelden“ beendet auch die Keycloak-Sitzung.

## Ablauf: Import

```mermaid
sequenceDiagram
    participant S as Zeitplan / Admin
    participant Q as Queue (pg-boss)
    participant W as worker
    participant C as Connector
    participant E as SonarCloud / GitLab
    participant D as PostgreSQL

    S->>Q: Importjob für Integration
    Q->>W: Job
    W->>C: fetchFindings (paginiert)
    C->>E: API-Aufrufe (Rate-Limits beachten)
    E-->>C: Befunde
    C-->>W: Rohbefunde
    W->>D: abgleichen, Schulden und Verlauf schreiben
    W->>D: SyncRun mit Ergebnis
```

Regeln des Abgleichs: [Integrationskonzept](integration-concept.md).

## Datenhaltung

- Ein PostgreSQL für Fachdaten, Job-Queue und Audit (Prinzip VI).
- Der Verlauf einer Schuld (`debt_event`) und das Änderungsprotokoll (`audit_entry`) sind nur anfügend.
- Bewertungen sind unveränderlich; die Priorität einer Schuld wird daraus abgeleitet
  (`priority_calculated`), die manuelle Überschreibung steht daneben (`priority_override`),
  `priority_effective` ist eine generierte Spalte für Sortierung und Rangliste.
- Datenmodell im Detail: [data-model.md](../../specs/001-tech-debt-management/data-model.md).
