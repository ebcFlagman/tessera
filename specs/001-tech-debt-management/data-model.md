# Data Model: Tessera

Konzeptionelles Modell (Prisma-Schema entsteht in der Umsetzung). Alle Tabellen haben `id`, `created_at`, `updated_at`.

## Entitäten

### Product (Produkt/System)
`name` (eindeutig), `description`, `archived_at`.

### Membership
`user_id` (OIDC-Subject), `product_id`, `role` ∈ {admin, editor}. Eindeutig je (user, product). Lesen: jeder angemeldete Benutzer organisationsweit. Zusätzlich `User` (`subject`, `name`, `email`) als Spiegel aus dem OIDC-Token und `Team` (`name`) mit `team_member`.

### DebtItem (Schuld)
`product_id`, `title`, `description`, `kind` ∈ {architectural, technical}, `status` ∈ {open, planned, in_progress, repaid, accepted}, `owner_id`, `team_id?`, `effort_estimate` (Personentage), `interest_estimate` (Personentage/Monat), `priority_calculated` (0–100), `priority_override?` (0–100), `priority_override_reason?`, `accepted_reason?`, `review_date?`, `archived_at`, `field_origin` (JSON: Feld → source|manual).
- **Validierung**: Titel 1–200 Zeichen; `accepted` erfordert `accepted_reason` (FR-019); Override erfordert Begründung (FR-004a).
- **Zustandsübergänge**: open → planned → in_progress → repaid; open/planned → accepted; repaid → open (Wiedereröffnung, auch automatisch bei Wiederauftauchen des Befunds); jede Änderung erzeugt `DebtEvent`.

### DebtEvent (Verlauf)
`debt_id`, `actor_id?` (null bei Import), `type`, `changes` (JSON vorher/nachher), `at`.

### Assessment (Bewertung)
`debt_id`, `model_id`, `scores` (JSON Kriterium → 1–5), `priority_calculated`, `assessed_by`, `assessed_at`. Unveränderlich (Historie, FR-005).

### AssessmentModel (Bewertungsmodell)
`version`, `criteria` (JSON: Schlüssel, Name, Gewicht), `active`. Nur ein aktives Modell; Änderung erzeugt neue Version und löst Neuberechnung aus.

### Integration (Quelle)
`product_id`, `type` ∈ {sonarcloud, gitlab}, `name`, `config` (JSON ohne Geheimnisse, z. B. Projektschlüssel, `baseUrl`), `credentials_encrypted` (AES-256-GCM, Format `v1.<keyId>.<iv>.<tag>.<ciphertext>`; die Schlüssel-ID steckt im Wert), `schedule_minutes` (5–10080, Standard 60), `status` ∈ {ok, error, disabled}, `last_attempt_at` (Takt des Zeitplans), `last_sync_at` (letzter Erfolg), `last_error?`.

### SyncRun
`integration_id`, `state` ∈ {queued, running, succeeded, failed}, `trigger` ∈ {manual, schedule}, `requested_by?`, `started_at?`, `finished_at?`, `counts` (created, updated, repaid, reopened, unchanged, total), `error?` (nie Zugangsdaten). Höchstens ein Lauf je Integration ist `queued` oder `running` (partieller Unique-Index).

### Finding (Importierter Befund)
`integration_id`, `external_id`, `debt_id`, `fingerprint`, `url?`, `raw` (JSONB), `conflicts` (manuell gepflegte Felder, deren Quellwert abweicht), `first_seen_at`, `last_seen_at`, `gone_at?`. Eindeutig (integration_id, external_id). Mehrere Befunde können dieselbe Schuld speisen; der älteste liefert deren Quellfelder, und die Schuld gilt erst als behoben, wenn alle ihre Befunde verschwunden sind.

### MetricSnapshot
`product_id`, `date`, `count_by_status/kind/priority_band` (JSON), `total_effort`.

### AuditEntry
`actor_id`, `action`, `target_type`, `target_id`, `details` (JSON ohne Geheimnisse), `at`. Nur anfügen.

### DecisionRecord (ADR)
Liegt als Markdown in `docs/architecture/adr/`, nicht in der Datenbank.

## Beziehungen
Product 1–n DebtItem, Integration; DebtItem 1–n DebtEvent, Assessment; Integration 1–n Finding, SyncRun; Finding n–1 DebtItem über `Finding.debt_id` (Duplikate können mehrere Befunde zu einer Schuld bündeln); Product n–m User über Membership.

## Indizes (Performance, SC-005)
DebtItem: (product_id, status), (kind), (owner_id), (priority_calculated), (priority_override); Volltext auf title/description; Finding: unique (integration_id, external_id).
