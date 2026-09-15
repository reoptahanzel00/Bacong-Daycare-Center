-- ==========================================================================
-- 20260915_01 — ECCD Child's Record 2 is now the official Word template
--
-- The checklist in src/data/eccdChecklist.ts is generated from the template
-- (src/templates/eccd-child-record-2.docx) and now carries all 109 official
-- items, numbered as on the form. Two things follow for stored data:
--
--   1. Social-Emotional ratings move to the official item numbers. The old
--      list had 20 items in a different order; the form has 24. Each stored
--      SE code is remapped to the number of the same skill on the form, so no
--      rating changes meaning.
--   2. Cognitive items 5 and 6 were "Looks at picture book one page at a time"
--      and "Imitates drawing a line", which are not on the form. The form's
--      items 5 and 6 are different skills, so those ratings cannot be carried
--      over: they are removed and the Cognitive raw scores recomputed.
--
-- Also adds the per-round record (date tested, examiner, standard score) and
-- the per-item Comments column that the form prints.
--
-- Apply BEFORE deploying the app version that ships the 109-item checklist:
-- ratings saved by the new app are already in official numbering and must not
-- be remapped, and the new API writes to the two tables created here.
--
-- Safe to re-run: the remap only runs while eccd_evaluations does not yet
-- exist, so a second run cannot map SE-05 -> SE-08 -> SE-11.
-- ==========================================================================

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.eccd_evaluations') IS NULL THEN
    UPDATE progress_observations o
    SET milestone_code = m.new_code,
        title = CASE WHEN o.title = o.milestone_code THEN m.new_code ELSE o.title END
    FROM (VALUES
      ('SE-05', 'SE-08'), ('SE-06', 'SE-09'), ('SE-07', 'SE-10'), ('SE-08', 'SE-11'),
      ('SE-09', 'SE-12'), ('SE-10', 'SE-13'), ('SE-11', 'SE-15'), ('SE-12', 'SE-17'),
      ('SE-13', 'SE-18'), ('SE-14', 'SE-20'), ('SE-15', 'SE-21'), ('SE-16', 'SE-24'),
      ('SE-17', 'SE-16'), ('SE-18', 'SE-19'), ('SE-19', 'SE-22'), ('SE-20', 'SE-23')
    ) AS m(old_code, new_code)
    WHERE o.milestone_code = m.old_code;

    DELETE FROM progress_observations WHERE milestone_code IN ('COG-05', 'COG-06');

    UPDATE eccd_scores s
    SET raw_score = (
          SELECT count(*) FROM progress_observations o
          WHERE o.pupil_id = s.pupil_id
            AND o.domain_id = s.domain_id
            AND o.evaluation_round = s.evaluation_round
            AND o.milestone_code IS NOT NULL
            AND o.status_rating = 'Present'
        ),
        updated_at = now()
    WHERE s.domain_id = 'cognitive';
  END IF;
END $$;

-- One row per graded round: fills the form's Date Tested / Examiner's Name
-- rows, the Standard Score row and, from it, the Interpretation row.
CREATE TABLE IF NOT EXISTS eccd_evaluations (
  pupil_id TEXT NOT NULL REFERENCES pupils(id) ON DELETE CASCADE,
  evaluation_round SMALLINT NOT NULL CHECK (evaluation_round BETWEEN 1 AND 3),
  evaluated_on DATE NOT NULL DEFAULT CURRENT_DATE,
  examiner_id UUID REFERENCES users(id) ON DELETE SET NULL,
  standard_score INT CHECK (standard_score BETWEEN 0 AND 200),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (pupil_id, evaluation_round)
);

-- The form's Comments column: why a child could not show a skill.
CREATE TABLE IF NOT EXISTS eccd_item_comments (
  pupil_id TEXT NOT NULL REFERENCES pupils(id) ON DELETE CASCADE,
  evaluation_round SMALLINT NOT NULL CHECK (evaluation_round BETWEEN 1 AND 3),
  milestone_code TEXT NOT NULL,
  comment TEXT NOT NULL CHECK (char_length(comment) BETWEEN 1 AND 300),
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (pupil_id, evaluation_round, milestone_code)
);

-- Rounds graded before this migration: date them from their last score save
-- (centre-local) and credit whoever recorded the round's latest rating.
INSERT INTO eccd_evaluations (pupil_id, evaluation_round, evaluated_on, examiner_id)
SELECT s.pupil_id,
       s.evaluation_round,
       (max(s.updated_at) AT TIME ZONE 'Asia/Manila')::date,
       (SELECT o.recorded_by FROM progress_observations o
        WHERE o.pupil_id = s.pupil_id
          AND o.evaluation_round = s.evaluation_round
          AND o.milestone_code IS NOT NULL
        ORDER BY o.created_at DESC
        LIMIT 1)
FROM eccd_scores s
GROUP BY s.pupil_id, s.evaluation_round
ON CONFLICT (pupil_id, evaluation_round) DO NOTHING;

-- Same access shape as eccd_scores: parents read linked children, staff read
-- all, writes only through the server API (service role).
ALTER TABLE eccd_evaluations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ECCD Evaluations SELECT Own" ON eccd_evaluations;
CREATE POLICY "ECCD Evaluations SELECT Own" ON eccd_evaluations
  FOR SELECT TO authenticated
  USING (pupil_id IN (SELECT pupil_id FROM guardians WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "ECCD Evaluations SELECT Staff" ON eccd_evaluations;
CREATE POLICY "ECCD Evaluations SELECT Staff" ON eccd_evaluations
  FOR SELECT TO authenticated
  USING (public.current_user_role() IN ('worker', 'official', 'barangay_admin'));

ALTER TABLE eccd_item_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ECCD Item Comments SELECT Own" ON eccd_item_comments;
CREATE POLICY "ECCD Item Comments SELECT Own" ON eccd_item_comments
  FOR SELECT TO authenticated
  USING (pupil_id IN (SELECT pupil_id FROM guardians WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "ECCD Item Comments SELECT Staff" ON eccd_item_comments;
CREATE POLICY "ECCD Item Comments SELECT Staff" ON eccd_item_comments
  FOR SELECT TO authenticated
  USING (public.current_user_role() IN ('worker', 'official', 'barangay_admin'));

COMMIT;

-- ==========================================================================
-- Verify (run separately, after COMMIT):
--
--   -- immediately after applying (before anyone grades on the new checklist):
--   -- no rating points at a retired item or past SE-24; expect 0
--   SELECT count(*) FROM progress_observations
--   WHERE milestone_code IN ('COG-05', 'COG-06')
--      OR (milestone_code LIKE 'SE-%' AND substring(milestone_code, 4)::int > 24);
--
--   -- every graded round has its record; expect zero rows
--   SELECT DISTINCT s.pupil_id, s.evaluation_round FROM eccd_scores s
--   LEFT JOIN eccd_evaluations e USING (pupil_id, evaluation_round)
--   WHERE e.pupil_id IS NULL;
-- ==========================================================================
