-- ---------------------------------------------------------------------------
-- Focus Area / Team taxonomy.
--
-- Reference data, seeded in every environment so the idea-intake and
-- scheduling pickers always have something to offer. Deliberately NOT a
-- foreign key on initiatives: initiative rows keep their own denormalized
-- focus_area/team text (same pattern as ai-capability-finder's
-- departments/categories vs. capabilities).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS focus_areas (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  sort_order  INT NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS focus_areas_name_ci_idx ON focus_areas (lower(name));

CREATE TABLE IF NOT EXISTS teams (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  pm_name     TEXT NOT NULL DEFAULT '',
  sort_order  INT NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS teams_name_ci_idx ON teams (lower(name));
ALTER TABLE teams ADD COLUMN IF NOT EXISTS pm_name TEXT NOT NULL DEFAULT '';

-- ---------------------------------------------------------------------------
-- Initiatives — one row per idea/roadmap item, moving through:
--   idea -> backlog -> planned -> in_progress -> completed
--                 \-> rejected
--
-- start_year/start_month + end_year/end_month (nullable, month granularity
-- -- no week-level detail) place the item on the Gantt-style roadmap;
-- null means "unscheduled" (shows in the Backlog column). Year is tracked
-- independently on each end since a range can cross a year boundary (e.g.
-- start Dec 2026, end Jan 2027). One range per initiative -- no separate
-- design/build sub-phases in v1.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS initiatives (
  id                 SERIAL PRIMARY KEY,
  focus_area         TEXT NOT NULL DEFAULT '',
  team               TEXT NOT NULL DEFAULT '',
  title              TEXT NOT NULL,
  summary            TEXT NOT NULL DEFAULT '',
  current_state      TEXT NOT NULL DEFAULT '',
  future_state       TEXT NOT NULL DEFAULT '',
  success_metrics    TEXT NOT NULL DEFAULT '',
  impacted_teams     TEXT[] NOT NULL DEFAULT '{}',
  impacted_products   TEXT[] NOT NULL DEFAULT '{}',
  status             TEXT NOT NULL DEFAULT 'idea'
                       CHECK (status IN ('idea', 'backlog', 'in_development', 'completed', 'rejected')),
  completed          BOOLEAN NOT NULL DEFAULT FALSE,
  start_year         INT,
  start_month        INT CHECK (start_month BETWEEN 1 AND 12),
  end_year           INT,
  end_month          INT CHECK (end_month BETWEEN 1 AND 12),
  submitted_by       TEXT NOT NULL DEFAULT '',
  submitted_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_by        TEXT NOT NULL DEFAULT '',
  reviewed_at        TIMESTAMPTZ,
  reviewer_notes     TEXT NOT NULL DEFAULT '',
  sort_order         INT NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS initiatives_status_idx ON initiatives (status);

-- Idempotent upgrades for a database created before pm_name / month-based
-- scheduling / impacted_products existed.
ALTER TABLE initiatives DROP COLUMN IF EXISTS start_date;
ALTER TABLE initiatives DROP COLUMN IF EXISTS end_date;
ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS start_year INT;
ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS start_month INT CHECK (start_month BETWEEN 1 AND 12);
ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS end_year INT;
ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS end_month INT CHECK (end_month BETWEEN 1 AND 12);
ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS impacted_products TEXT[] NOT NULL DEFAULT '{}';
