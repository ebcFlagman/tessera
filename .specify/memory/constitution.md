# Tessera Constitution

## Core Principles

### I. Fachlogik zuerst (Domain Logic First)
Bewertung, Zustandsübergänge und Deduplizierung MUST in reinen Modulen ohne I/O
(`packages/domain`) liegen und per Unit-Tests abgedeckt sein. Route Handlers und
React-Komponenten MUST keine Fachregeln enthalten, sondern nur delegieren.
Rationale: Fachregeln sind der Kern des Produkts und müssen ohne Framework testbar bleiben.

### II. Erweiterbar an den Rändern (Extensible Integrations)
Jede externe Quelle MUST als Connector hinter der gemeinsamen Schnittstelle implementiert
werden und DARF NICHT das Schuldenmodell oder andere Connectoren ändern. Connectoren
schreiben nie selbst in die Datenbank. Neue Quellen MUST Fixture-basierte Tests mitbringen.
Rationale: Weitere Umsysteme sollen ohne Umbau des Kerns hinzukommen (FR-012).

### III. Nachvollziehbarkeit (Auditability)
Jede relevante Änderung an Schulden, Bewertungen, Rollen, Integrationen und dem
Bewertungsmodell MUST Urheber, Zeitpunkt und Vorher/Nachher festhalten. Das Änderungsprotokoll
ist nur anfügend. Rationale: Entscheidungen über Schulden müssen später erklärbar sein.

### IV. Geheimnisse bleiben geheim (Secrets Stay Secret)
Zugangsdaten externer Quellen MUST verschlüsselt gespeichert werden und DÜRFEN NIE in
API-Antworten, Logs, Fehlermeldungen oder Auditdetails im Klartext erscheinen. Tessera
MUST keine eigenen Passwörter speichern; Anmeldung erfolgt per OIDC (Keycloak).

### V. Manuell schlägt automatisch (Manual Over Automatic)
Importe MÜSSEN manuell gepflegte Felder schützen (Feldherkunft wird geführt). Einzige Ausnahme:
Ist ein Befund in der Quelle erledigt, MUST die Schuld auf „getilgt“ gesetzt werden, auch wenn
der Status manuell gesetzt war (z. B. „akzeptiert“). Automatische Statusänderungen durch
Importe MÜSSEN im Verlauf als solche erkennbar sein. Manuelle Prioritätsüberschreibungen und
„akzeptiert“ MUST eine Begründung haben.

### VI. Einfach vor clever (Simplicity)
Es gilt YAGNI: PostgreSQL ist Speicher für Daten, Job-Queue und Audit, solange kein
messbarer Bedarf etwas anderes begründet. Jede zusätzliche Laufzeitkomponente oder
Abweichung vom einfachsten Aufbau MUST im Plan unter „Complexity Tracking“ begründet werden.

### VII. Backend ist der Vertrag (Code-First API)
Der Backend-Code ist die einzige Quelle für die API: Routen samt Ein- und Ausgabeschemas werden
im Backend-Code definiert, und daraus wird die OpenAPI-Spezifikation automatisch erzeugt. Diese
erzeugte Spezifikation ist der Vertrag, den das Frontend einhält. API-Client und API-Typen des
Frontends MUST aus ihr generiert werden; handgeschriebene API-Aufrufe oder -Typen im Frontend
sind verboten. Die erzeugte Spezifikation MUST eingecheckt sein, und die CI MUST fehlschlagen,
wenn sie nicht zum Backend-Code oder der generierte Frontend-Code nicht zur Spezifikation passt.
Rationale: Es gibt eine einzige Wahrheit (den Code); Frontend und Backend laufen nicht auseinander.

## Technology & Security Constraints

- Sprache/Laufzeit: TypeScript (strict), Node.js LTS. Backend und Frontend je Next.js; Frontend mit React.
- Die REST-API wird durch die OpenAPI-Spezifikation (Ausgangspunkt `contracts/openapi.yaml`) aus dem Backend-Code erzeugt (siehe Prinzip VII).
- Autorisierung: Lesen für alle angemeldeten Benutzer; Schreiben/Verwalten per Produktrolle (admin, editor).
- Importe MUST Rate-Limits der Quellen einhalten und DÜRFEN Benutzeranfragen nicht blockieren.
- Leistungsziele: Register/Dashboard < 3 s bei 10.000 Schulden; Erstimport 1.000 Befunde < 10 min.

## Development Workflow & Quality Gates

- Architekturentscheidungen MUST als ADR in `docs/architecture/adr/` festgehalten und aus der
  Architekturvision verlinkt werden; die Vision wird bei Änderungen im selben Pull Request aktualisiert.
- Pull Requests MUST bestehende Tests grün halten; neue Fachlogik und neue Endpunkte MUST Tests
  (Unit bzw. Vertragstest) enthalten. P1-Abläufe MUST durch E2E-Tests abgedeckt sein.
- Datenbankänderungen erfolgen ausschließlich über versionierte Migrationen.
- Reviews MUST die Einhaltung dieser Constitution prüfen.

## Governance

Diese Constitution hat Vorrang vor anderen Praktiken. Änderungen erfordern einen
Pull Request mit Begründung, Zustimmung der Projektverantwortlichen und – bei Prinzipien­änderungen –
einen Migrationshinweis für bestehenden Code. Versionierung nach SemVer: MAJOR bei
inkompatiblen Prinzipienänderungen oder -entfernungen, MINOR bei neuen Prinzipien/Abschnitten oder
wesentlich erweiterter Vorgabe, PATCH bei Klarstellungen. Einhaltung wird in jedem Review und bei
jedem Plan („Constitution Check“) geprüft. Laufende Hinweise zur Umsetzung stehen in `docs/architecture/`.

**Version**: 1.1.0 | **Ratified**: 2026-10-31 | **Last Amended**: 2026-10-31
