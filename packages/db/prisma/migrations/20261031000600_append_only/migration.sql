-- The change log is append-only (constitution III): the database refuses to rewrite or remove entries.
-- TRUNCATE (test resets) is not a row operation and stays possible.
CREATE FUNCTION tessera_refuse_change() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% on % is not allowed: the table is append-only', TG_OP, TG_TABLE_NAME
    USING ERRCODE = 'integrity_constraint_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_entry_append_only
  BEFORE UPDATE OR DELETE ON "audit_entry"
  FOR EACH ROW EXECUTE FUNCTION tessera_refuse_change();

-- Assessments are immutable records (FR-005): a new assessment is a new row.
CREATE TRIGGER assessment_immutable
  BEFORE UPDATE ON "assessment"
  FOR EACH ROW EXECUTE FUNCTION tessera_refuse_change();
