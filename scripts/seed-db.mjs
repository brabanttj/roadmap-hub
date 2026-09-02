/**
 * Loads the v1 seed data into Postgres.
 *
 *   npm run db:seed
 *
 * Destructive: truncates and re-inserts every table. Never point this at an
 * environment holding real submissions.
 *
 * Requires DB_HOST/PORT/NAME/USER/PASSWORD (or the docker-compose defaults).
 */
import { FOCUS_AREAS, TEAMS, INITIATIVES } from "./seed-data.mjs";
import pool from "../server/db.mjs";

const client = await pool.connect();
try {
  await client.query("BEGIN");
  await client.query("TRUNCATE initiatives, focus_areas, teams RESTART IDENTITY CASCADE");

  for (let i = 0; i < FOCUS_AREAS.length; i++) {
    await client.query(`INSERT INTO focus_areas (name, sort_order) VALUES ($1, $2)`, [FOCUS_AREAS[i], i]);
  }
  for (let i = 0; i < TEAMS.length; i++) {
    await client.query(`INSERT INTO teams (name, sort_order) VALUES ($1, $2)`, [TEAMS[i], i]);
  }

  for (let i = 0; i < INITIATIVES.length; i++) {
    const n = INITIATIVES[i];
    await client.query(
      `INSERT INTO initiatives (
         focus_area, team, title, summary, current_state, future_state, success_metrics,
         impacted_teams, status, completed, year, start_month, end_month, submitted_by, sort_order
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [
        n.focusArea,
        n.team,
        n.title,
        n.summary,
        n.currentState,
        n.futureState,
        n.successMetrics,
        n.impactedTeams,
        n.status,
        n.status === "completed",
        n.year,
        n.startMonth,
        n.endMonth,
        "seed",
        i,
      ]
    );
  }

  await client.query("COMMIT");
  console.log(
    `Seeded ${FOCUS_AREAS.length} focus areas, ${TEAMS.length} teams, ${INITIATIVES.length} initiatives.`
  );
} catch (e) {
  await client.query("ROLLBACK");
  throw e;
} finally {
  client.release();
  await pool.end();
}
