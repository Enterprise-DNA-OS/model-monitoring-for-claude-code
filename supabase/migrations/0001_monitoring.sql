CREATE FUNCTION touch_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at=now(); RETURN NEW; END $$;
CREATE FUNCTION immutable_record() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Evidence is append-only; load a corrected snapshot with a new external ID'; END $$;
CREATE TABLE models (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), source text NOT NULL CHECK(length(trim(source))>0), external_id text NOT NULL,
 name text NOT NULL CHECK(length(trim(name))>0), version text NOT NULL, owner text NOT NULL, purpose text NOT NULL,
 feature_name text NOT NULL, unit text NOT NULL, cuts jsonb NOT NULL CHECK(jsonb_typeof(cuts)='array'),
 drift_limit double precision NOT NULL CHECK(drift_limit BETWEEN 0 AND 1), mae_limit double precision NOT NULL CHECK(mae_limit BETWEEN 0 AND 1e12),
 min_samples integer NOT NULL CHECK(min_samples>=2), review_due date NOT NULL, retention_review_due date NOT NULL,
 source_ref text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(source,external_id)
);
CREATE TABLE datasets (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), model_id uuid NOT NULL REFERENCES models(id), external_id text NOT NULL,
 kind text NOT NULL CHECK(kind IN ('baseline','production')), window_start timestamptz NOT NULL, window_end timestamptz NOT NULL,
 expected_count integer NOT NULL CHECK(expected_count>0), source_ref text NOT NULL, digest text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(window_end>window_start), UNIQUE(model_id,external_id)
);
CREATE TABLE observations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), dataset_id uuid NOT NULL REFERENCES datasets(id), event_id text NOT NULL,
 occurred_at timestamptz NOT NULL, feature double precision CHECK(feature BETWEEN -1e12 AND 1e12),
 prediction double precision NOT NULL CHECK(prediction BETWEEN -1e12 AND 1e12), actual double precision CHECK(actual BETWEEN -1e12 AND 1e12),
 segment text NOT NULL CHECK(length(trim(segment))>0),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(dataset_id,event_id)
);
CREATE TABLE evaluations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), model_id uuid NOT NULL REFERENCES models(id),
 baseline_id uuid NOT NULL REFERENCES datasets(id), production_id uuid NOT NULL REFERENCES datasets(id),
 result jsonb NOT NULL, actor text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE actions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), model_id uuid NOT NULL REFERENCES models(id), title text NOT NULL,
 owner text NOT NULL, due date NOT NULL, status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','closed')),
 resolution text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(status<>'closed' OR length(trim(resolution))>0)
);
CREATE TABLE notes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), model_id uuid NOT NULL REFERENCES models(id), body text NOT NULL, actor text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE activity (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), model_id uuid REFERENCES models(id), actor text NOT NULL, operation text NOT NULL,
 detail jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE imports (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), model_id uuid NOT NULL REFERENCES models(id), digest text NOT NULL,
 source_ref text NOT NULL, datasets integer NOT NULL, rows integer NOT NULL, actor text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(model_id,digest)
);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['models','datasets','observations','evaluations','actions','notes','activity','imports'] LOOP
  EXECUTE format('CREATE TRIGGER touch BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION touch_updated_at()',t);
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON %I FROM PUBLIC',t);
 END LOOP;
 FOREACH t IN ARRAY ARRAY['datasets','observations','evaluations','notes','activity','imports'] LOOP
  EXECUTE format('CREATE TRIGGER immutable BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION immutable_record()',t);
 END LOOP;
END $$;
CREATE INDEX observations_dataset ON observations(dataset_id);
CREATE INDEX evaluations_model ON evaluations(model_id,created_at DESC);
CREATE VIEW dataset_quality AS
 SELECT d.id,d.model_id,m.name AS model,d.external_id,d.kind,d.window_start,d.window_end,d.expected_count,
 count(o.id)::integer AS loaded_count,count(o.actual)::integer AS outcome_count,
 count(o.id) FILTER(WHERE o.feature IS NULL)::integer AS missing_features,
 count(o.id) FILTER(WHERE o.occurred_at<d.window_start OR o.occurred_at>=d.window_end)::integer AS outside_window
 FROM datasets d JOIN models m ON m.id=d.model_id LEFT JOIN observations o ON o.dataset_id=d.id GROUP BY d.id,m.name;
CREATE VIEW monitoring_queue AS
 SELECT m.id,m.name,m.version,m.owner,m.review_due,e.created_at AS last_evaluated,
 coalesce(e.result->>'status','not evaluated') AS status,
 (e.result->>'distance')::double precision AS distance,(e.result->>'mae')::double precision AS mae
 FROM models m LEFT JOIN LATERAL (SELECT * FROM evaluations e WHERE e.model_id=m.id ORDER BY created_at DESC,id DESC LIMIT 1)e ON true;
CREATE VIEW overdue_actions AS SELECT a.id,m.name AS model,a.title,a.owner,a.due FROM actions a JOIN models m ON m.id=a.model_id WHERE a.status='open' AND a.due<current_date;
CREATE VIEW compliance_findings AS
 SELECT id AS model_id,name AS model,'review-overdue' AS rule,review_due AS due,'NIST-MEASURE-2.4' AS source_rule FROM models WHERE review_due<current_date
 UNION ALL SELECT id,name,'retention-review-overdue',retention_review_due,'NZ-IPP9' FROM models WHERE retention_review_due<current_date
 UNION ALL SELECT m.id,m.name,'no-monitoring-evidence',NULL::date,'NIST-MEASURE-2.4' FROM models m WHERE NOT EXISTS(SELECT 1 FROM evaluations e WHERE e.model_id=m.id)
 UNION ALL SELECT model_id,model,'incomplete-or-outside-window',NULL::date,'NZ-IPP8' FROM dataset_quality WHERE loaded_count<>expected_count OR outside_window>0;
REVOKE ALL ON dataset_quality,monitoring_queue,overdue_actions,compliance_findings FROM PUBLIC;
