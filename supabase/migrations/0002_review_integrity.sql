CREATE FUNCTION protect_model_definition() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Model definitions cannot be deleted'; END IF;
 IF (to_jsonb(OLD)-ARRAY['review_due','retention_review_due','updated_at']) IS DISTINCT FROM
    (to_jsonb(NEW)-ARRAY['review_due','retention_review_due','updated_at']) THEN
  RAISE EXCEPTION 'Model definition is immutable; register a new version';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER protect_definition BEFORE UPDATE OR DELETE ON models FOR EACH ROW EXECUTE FUNCTION protect_model_definition();
CREATE OR REPLACE VIEW monitoring_queue AS
 SELECT m.id,m.name,m.version,m.owner,m.review_due,e.created_at AS last_evaluated,
 coalesce(e.result->>'status','not evaluated') AS status,
 (e.result->>'distance')::double precision AS distance,(e.result->>'mae')::double precision AS mae,
 (SELECT count(*)::integer FROM datasets d WHERE d.model_id=m.id AND d.kind='production'
  AND NOT EXISTS(SELECT 1 FROM evaluations x WHERE x.production_id=d.id)) AS unreviewed_windows
 FROM models m LEFT JOIN LATERAL (SELECT * FROM evaluations e WHERE e.model_id=m.id ORDER BY created_at DESC,id DESC LIMIT 1)e ON true;
REVOKE ALL ON monitoring_queue FROM PUBLIC;
