import express from "express";
import pool from "./db.mjs";

const router = express.Router();

const STATUSES = ["idea", "backlog", "in_development", "completed", "rejected"];

// Shared RETURNING/SELECT column list -- every initiative-shaped query below
// returns exactly this shape to the client.
const INITIATIVE_COLUMNS = `
  id, focus_area AS "focusArea", team, title, summary,
  current_state AS "currentState", future_state AS "futureState",
  success_metrics AS "successMetrics", impacted_teams AS "impactedTeams",
  impacted_products AS "impactedProducts",
  status, completed,
  start_year AS "startYear", start_month AS "startMonth",
  end_year AS "endYear", end_month AS "endMonth",
  submitted_by AS "submittedBy", submitted_at AS "submittedAt",
  reviewed_by AS "reviewedBy", reviewed_at AS "reviewedAt",
  reviewer_notes AS "reviewerNotes", sort_order AS "sortOrder",
  archived, archived_by AS "archivedBy",
  to_char(archived_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS "archivedAt",
  (
    SELECT COALESCE(json_agg(json_build_object(
      'id', n.id, 'body', n.body, 'author', n.author,
      'createdAt', to_char(n.created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'updatedAt', to_char(n.updated_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
    ) ORDER BY n.created_at), '[]'::json)
    FROM initiative_notes n WHERE n.initiative_id = initiatives.id
  ) AS notes,
  (
    SELECT COALESCE(json_agg(json_build_object(
      'id', c.id, 'body', c.body, 'author', c.author,
      'createdAt', to_char(c.created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
    ) ORDER BY c.created_at), '[]'::json)
    FROM initiative_chat_messages c WHERE c.initiative_id = initiatives.id
  ) AS chat
`;

// Month granularity, no week detail. A year/month pair is either both
// present (scheduled) or both null (unscheduled/backlog) -- never a
// year without a month or vice versa.
function toMonthOrNull(v) {
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 && n <= 12 ? n : null;
}
function toYearOrNull(v) {
  const n = Number(v);
  return Number.isInteger(n) ? n : null;
}

// ---- GET /api/bootstrap ----------------------------------------------------
router.get("/bootstrap", async (req, res) => {
  try {
    const [focusAreasRes, teamsRes, initiativesRes] = await Promise.all([
      pool.query(`SELECT id, name FROM focus_areas ORDER BY sort_order, name`),
      pool.query(`SELECT id, name, pm_name AS "pmName" FROM teams ORDER BY sort_order, name`),
      pool.query(`SELECT ${INITIATIVE_COLUMNS} FROM initiatives ORDER BY sort_order, id`),
    ]);
    res.json({
      ok: true,
      focusAreas: focusAreasRes.rows,
      teams: teamsRes.rows,
      initiatives: initiativesRes.rows,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: "bootstrap query failed" });
  }
});

// ---- POST /api/ideas --------------------------------------------------------
// Public idea submission — no password gate. Takes the same fields as a full
// initiative (minus status/schedule, which review/scheduling set later).
// Lands as status='idea', pending review. submitted_at defaults to now() --
// that's the recorded submission date.
router.post("/ideas", async (req, res) => {
  const b = req.body || {};
  const title = String(b.title || "").trim();
  if (!title) return res.status(400).json({ ok: false, error: "Title is required" });
  if (!String(b.submittedBy || "").trim()) {
    return res.status(400).json({ ok: false, error: "Your name is required" });
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO initiatives (
         focus_area, team, title, summary, current_state, future_state, success_metrics,
         impacted_teams, impacted_products, status, submitted_by, sort_order
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'idea',$10,
         (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM initiatives))
       RETURNING ${INITIATIVE_COLUMNS}`,
      [
        String(b.focusArea || "").trim(),
        String(b.team || "").trim(),
        title,
        String(b.summary || "").trim(),
        String(b.currentState || "").trim(),
        String(b.futureState || "").trim(),
        String(b.successMetrics || "").trim(),
        Array.isArray(b.impactedTeams) ? b.impactedTeams.map((t) => String(t).trim()).filter(Boolean) : [],
        Array.isArray(b.impactedProducts) ? b.impactedProducts.map((t) => String(t).trim()).filter(Boolean) : [],
        String(b.submittedBy).trim(),
      ]
    );
    res.json({ ok: true, initiative: rows[0] });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

// ---- POST /api/initiatives/:id/review ---------------------------------------
// Approve moves idea -> backlog (everything starts in the backlog); reject
// moves idea -> rejected and requires a reason, shown in the Rejected archive.
router.post("/initiatives/:id/review", async (req, res) => {
  const id = Number(req.params.id);
  const decision = String(req.body?.decision || "");
  const notes = String(req.body?.notes || "").trim();
  const reviewedBy = String(req.body?.reviewedBy || "").trim();
  if (!Number.isInteger(id)) return res.status(400).json({ ok: false, error: "Invalid id" });
  if (!["approve", "reject"].includes(decision)) {
    return res.status(400).json({ ok: false, error: "decision must be 'approve' or 'reject'" });
  }
  if (decision === "reject" && !notes) {
    return res.status(400).json({ ok: false, error: "A rejection reason is required" });
  }
  const nextStatus = decision === "approve" ? "backlog" : "rejected";
  try {
    const { rows } = await pool.query(
      `UPDATE initiatives
       SET status = $1, reviewed_by = $2, reviewed_at = now(), reviewer_notes = $3
       WHERE id = $4 AND status = 'idea'
       RETURNING ${INITIATIVE_COLUMNS}`,
      [nextStatus, reviewedBy, notes, id]
    );
    if (!rows.length) {
      return res.status(404).json({ ok: false, error: "Idea not found or already reviewed" });
    }
    res.json({ ok: true, initiative: rows[0] });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

// ---- POST /api/initiatives ---------------------------------------------------
// Direct creation for reviewers/planners (client-side password-gated, same
// as every other mutation here -- no server-side auth yet, matching
// ai-capability-finder's admin routes). Bypasses idea review entirely.
router.post("/initiatives", async (req, res) => {
  const b = req.body || {};
  const title = String(b.title || "").trim();
  if (!title) return res.status(400).json({ ok: false, error: "Title is required" });
  const status = String(b.status || "backlog");
  if (!STATUSES.includes(status)) {
    return res.status(400).json({ ok: false, error: `status must be one of: ${STATUSES.join(", ")}` });
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO initiatives (
         focus_area, team, title, summary, current_state, future_state, success_metrics,
         impacted_teams, impacted_products, status, completed,
         start_year, start_month, end_year, end_month, submitted_by, sort_order
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,
         (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM initiatives))
       RETURNING ${INITIATIVE_COLUMNS}`,
      [
        String(b.focusArea || "").trim(),
        String(b.team || "").trim(),
        title,
        String(b.summary || "").trim(),
        String(b.currentState || "").trim(),
        String(b.futureState || "").trim(),
        String(b.successMetrics || "").trim(),
        Array.isArray(b.impactedTeams) ? b.impactedTeams.map((t) => String(t).trim()).filter(Boolean) : [],
        Array.isArray(b.impactedProducts) ? b.impactedProducts.map((t) => String(t).trim()).filter(Boolean) : [],
        status,
        status === "completed",
        toYearOrNull(b.startYear),
        toMonthOrNull(b.startMonth),
        toYearOrNull(b.endYear),
        toMonthOrNull(b.endMonth),
        String(b.submittedBy || "").trim() || "reviewer",
      ]
    );
    res.json({ ok: true, initiative: rows[0] });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

// ---- PUT /api/initiatives/reorder --------------------------------------------
// Drag-to-reorder within a team group on the Gantt. Takes the full list of
// ids for just that one group, in their new order, and reassigns sort_order
// starting from the lowest sort_order already held by any of them -- so the
// group's position relative to every OTHER group is untouched, only the
// order within it changes. Declared before the `/:id` route below since
// Express would otherwise try to parse "reorder" as that route's numeric id.
router.put("/initiatives/reorder", async (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number) : [];
  if (!ids.length || ids.some((n) => !Number.isInteger(n))) {
    return res.status(400).json({ ok: false, error: "ids must be a non-empty array of integers" });
  }
  try {
    const { rows: existing } = await pool.query(
      `SELECT id, sort_order FROM initiatives WHERE id = ANY($1::int[])`,
      [ids]
    );
    if (existing.length !== ids.length) {
      return res.status(404).json({ ok: false, error: "Some initiatives not found" });
    }
    const base = Math.min(...existing.map((r) => r.sort_order));
    await Promise.all(
      ids.map((id, i) => pool.query(`UPDATE initiatives SET sort_order = $1 WHERE id = $2`, [base + i, id]))
    );
    const { rows } = await pool.query(
      `SELECT ${INITIATIVE_COLUMNS} FROM initiatives WHERE id = ANY($1::int[]) ORDER BY sort_order`,
      [ids]
    );
    res.json({ ok: true, initiatives: rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

// ---- PUT /api/initiatives/:id ------------------------------------------------
// Full edit — used both for scheduling (setting months moves the item onto
// the Gantt) and general field edits.
router.put("/initiatives/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ ok: false, error: "Invalid id" });

  const b = req.body || {};
  const status = String(b.status || "");
  if (status && !STATUSES.includes(status)) {
    return res.status(400).json({ ok: false, error: `status must be one of: ${STATUSES.join(", ")}` });
  }

  try {
    const { rows } = await pool.query(
      `UPDATE initiatives SET
         focus_area        = $1,
         team              = $2,
         title             = $3,
         summary           = $4,
         current_state     = $5,
         future_state      = $6,
         success_metrics   = $7,
         impacted_teams    = $8,
         impacted_products = $9,
         status            = $10,
         completed         = $11,
         start_year        = $12,
         start_month       = $13,
         end_year          = $14,
         end_month         = $15
       WHERE id = $16
       RETURNING ${INITIATIVE_COLUMNS}`,
      [
        String(b.focusArea || "").trim(),
        String(b.team || "").trim(),
        String(b.title || "").trim(),
        String(b.summary || "").trim(),
        String(b.currentState || "").trim(),
        String(b.futureState || "").trim(),
        String(b.successMetrics || "").trim(),
        Array.isArray(b.impactedTeams) ? b.impactedTeams.map((t) => String(t).trim()).filter(Boolean) : [],
        Array.isArray(b.impactedProducts) ? b.impactedProducts.map((t) => String(t).trim()).filter(Boolean) : [],
        status || "idea",
        status === "completed" || Boolean(b.completed),
        toYearOrNull(b.startYear),
        toMonthOrNull(b.startMonth),
        toYearOrNull(b.endYear),
        toMonthOrNull(b.endMonth),
        id,
      ]
    );
    if (!rows.length) return res.status(404).json({ ok: false, error: "Initiative not found" });
    res.json({ ok: true, initiative: rows[0] });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

// ---- POST /api/initiatives/:id/archive ---------------------------------------
// Archiving is independent of status -- any initiative, in any state, can
// be archived/unarchived without touching its status. Client-side
// password-gated the same as every other mutation here.
router.post("/initiatives/:id/archive", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ ok: false, error: "Invalid id" });
  const archived = Boolean(req.body?.archived);
  const archivedBy = String(req.body?.archivedBy || "").trim();
  try {
    const { rows } = await pool.query(
      `UPDATE initiatives
       SET archived = $1, archived_by = $2, archived_at = ${archived ? "now()" : "NULL"}
       WHERE id = $3
       RETURNING ${INITIATIVE_COLUMNS}`,
      [archived, archived ? archivedBy : "", id]
    );
    if (!rows.length) return res.status(404).json({ ok: false, error: "Initiative not found" });
    res.json({ ok: true, initiative: rows[0] });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

// ---- Notes: add/edit/delete free-form notes on an initiative ---------------
// Separate from reviewer_notes (a single rejection reason). Each returns the
// whole initiative (with its updated `notes` array) so the client can just
// onUpsert it, same as every other mutation here.
router.post("/initiatives/:id/notes", async (req, res) => {
  const id = Number(req.params.id);
  const body = String(req.body?.body || "").trim();
  const author = String(req.body?.author || "").trim();
  if (!Number.isInteger(id)) return res.status(400).json({ ok: false, error: "Invalid id" });
  if (!body) return res.status(400).json({ ok: false, error: "Note text is required" });
  try {
    await pool.query(`INSERT INTO initiative_notes (initiative_id, body, author) VALUES ($1, $2, $3)`, [
      id,
      body,
      author,
    ]);
    const { rows } = await pool.query(`SELECT ${INITIATIVE_COLUMNS} FROM initiatives WHERE id = $1`, [id]);
    if (!rows.length) return res.status(404).json({ ok: false, error: "Initiative not found" });
    res.json({ ok: true, initiative: rows[0] });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

router.put("/initiatives/:id/notes/:noteId", async (req, res) => {
  const id = Number(req.params.id);
  const noteId = Number(req.params.noteId);
  const body = String(req.body?.body || "").trim();
  if (!Number.isInteger(id) || !Number.isInteger(noteId)) {
    return res.status(400).json({ ok: false, error: "Invalid id" });
  }
  if (!body) return res.status(400).json({ ok: false, error: "Note text is required" });
  try {
    const { rowCount } = await pool.query(
      `UPDATE initiative_notes SET body = $1, updated_at = now() WHERE id = $2 AND initiative_id = $3`,
      [body, noteId, id]
    );
    if (!rowCount) return res.status(404).json({ ok: false, error: "Note not found" });
    const { rows } = await pool.query(`SELECT ${INITIATIVE_COLUMNS} FROM initiatives WHERE id = $1`, [id]);
    res.json({ ok: true, initiative: rows[0] });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

router.delete("/initiatives/:id/notes/:noteId", async (req, res) => {
  const id = Number(req.params.id);
  const noteId = Number(req.params.noteId);
  if (!Number.isInteger(id) || !Number.isInteger(noteId)) {
    return res.status(400).json({ ok: false, error: "Invalid id" });
  }
  try {
    const { rowCount } = await pool.query(`DELETE FROM initiative_notes WHERE id = $1 AND initiative_id = $2`, [
      noteId,
      id,
    ]);
    if (!rowCount) return res.status(404).json({ ok: false, error: "Note not found" });
    const { rows } = await pool.query(`SELECT ${INITIATIVE_COLUMNS} FROM initiatives WHERE id = $1`, [id]);
    res.json({ ok: true, initiative: rows[0] });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

// ---- Chat: append-only Q&A / discussion thread on an initiative ------------
// Post-only, no edit -- delete is only for outright mistakes/spam. Each
// returns the whole initiative (with its updated `chat` array), same as Notes.
router.post("/initiatives/:id/chat", async (req, res) => {
  const id = Number(req.params.id);
  const body = String(req.body?.body || "").trim();
  const author = String(req.body?.author || "").trim();
  if (!Number.isInteger(id)) return res.status(400).json({ ok: false, error: "Invalid id" });
  if (!body) return res.status(400).json({ ok: false, error: "Message text is required" });
  try {
    await pool.query(`INSERT INTO initiative_chat_messages (initiative_id, body, author) VALUES ($1, $2, $3)`, [
      id,
      body,
      author,
    ]);
    const { rows } = await pool.query(`SELECT ${INITIATIVE_COLUMNS} FROM initiatives WHERE id = $1`, [id]);
    if (!rows.length) return res.status(404).json({ ok: false, error: "Initiative not found" });
    res.json({ ok: true, initiative: rows[0] });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

router.delete("/initiatives/:id/chat/:messageId", async (req, res) => {
  const id = Number(req.params.id);
  const messageId = Number(req.params.messageId);
  if (!Number.isInteger(id) || !Number.isInteger(messageId)) {
    return res.status(400).json({ ok: false, error: "Invalid id" });
  }
  try {
    const { rowCount } = await pool.query(
      `DELETE FROM initiative_chat_messages WHERE id = $1 AND initiative_id = $2`,
      [messageId, id]
    );
    if (!rowCount) return res.status(404).json({ ok: false, error: "Message not found" });
    const { rows } = await pool.query(`SELECT ${INITIATIVE_COLUMNS} FROM initiatives WHERE id = $1`, [id]);
    res.json({ ok: true, initiative: rows[0] });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

// ---- DELETE /api/initiatives/:id ---------------------------------------------
router.delete("/initiatives/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ ok: false, error: "Invalid id" });
  try {
    const { rowCount } = await pool.query(`DELETE FROM initiatives WHERE id = $1`, [id]);
    if (!rowCount) return res.status(404).json({ ok: false, error: "Initiative not found" });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

// ---- Focus areas + Teams: flat CRUD taxonomy, mirrored ----------------------
// Teams additionally carry a required pm_name (the Product Manager for that
// team) -- focus areas don't have an equivalent, hence the `withPm` flag.
function taxonomyRoutes(table, { withPm = false } = {}) {
  const t = express.Router();
  const cols = withPm ? `id, name, pm_name AS "pmName"` : `id, name`;

  t.post("/", async (req, res) => {
    const name = String(req.body?.name || "").trim();
    if (!name) return res.status(400).json({ ok: false, error: "Name is required" });
    const pmName = withPm ? String(req.body?.pmName || "").trim() : null;
    if (withPm && !pmName) {
      return res.status(400).json({ ok: false, error: "Product Manager is required" });
    }
    try {
      const { rows } = withPm
        ? await pool.query(
            `INSERT INTO ${table} (name, pm_name, sort_order)
             VALUES ($1, $2, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM ${table}))
             RETURNING ${cols}`,
            [name, pmName]
          )
        : await pool.query(
            `INSERT INTO ${table} (name, sort_order)
             VALUES ($1, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM ${table}))
             RETURNING ${cols}`,
            [name]
          );
      res.json({ ok: true, item: rows[0] });
    } catch (e) {
      if (e.code === "23505") {
        return res.status(409).json({ ok: false, error: `"${name}" already exists` });
      }
      console.error(e);
      res.status(500).json({ ok: false, error: String(e.message || e) });
    }
  });

  t.put("/:id", async (req, res) => {
    const id = Number(req.params.id);
    const name = String(req.body?.name || "").trim();
    if (!Number.isInteger(id)) return res.status(400).json({ ok: false, error: "Invalid id" });
    if (!name) return res.status(400).json({ ok: false, error: "Name is required" });
    const pmName = withPm ? String(req.body?.pmName || "").trim() : null;
    if (withPm && !pmName) {
      return res.status(400).json({ ok: false, error: "Product Manager is required" });
    }
    try {
      const { rows } = withPm
        ? await pool.query(
            `UPDATE ${table} SET name = $1, pm_name = $2 WHERE id = $3 RETURNING ${cols}`,
            [name, pmName, id]
          )
        : await pool.query(`UPDATE ${table} SET name = $1 WHERE id = $2 RETURNING ${cols}`, [name, id]);
      if (!rows.length) return res.status(404).json({ ok: false, error: "Not found" });
      res.json({ ok: true, item: rows[0] });
    } catch (e) {
      if (e.code === "23505") {
        return res.status(409).json({ ok: false, error: `"${name}" already exists` });
      }
      console.error(e);
      res.status(500).json({ ok: false, error: String(e.message || e) });
    }
  });

  t.delete("/:id", async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ ok: false, error: "Invalid id" });
    try {
      const { rowCount } = await pool.query(`DELETE FROM ${table} WHERE id = $1`, [id]);
      if (!rowCount) return res.status(404).json({ ok: false, error: "Not found" });
      res.json({ ok: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ ok: false, error: String(e.message || e) });
    }
  });

  return t;
}

router.use("/focus-areas", taxonomyRoutes("focus_areas"));
router.use("/teams", taxonomyRoutes("teams", { withPm: true }));

export default router;
