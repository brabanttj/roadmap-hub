import { Fragment, useMemo, useState } from "react";
import { Card, Input, MultiSelect, Button, IllustrationBadge } from "../components/ui/index.js";
import { usePasswordGate } from "../lib/PasswordGate.jsx";
import { MONTH_NAMES, STATUS_LABEL, mondaysInMonth, formatWeekLabel } from "../lib/text.js";
import InitiativeModal from "./InitiativeModal.jsx";
import "./RoadmapGantt.css";

// Excluded from the Gantt entirely -- ideas haven't been reviewed yet, and
// rejected ideas never became roadmap work (see the Rejected tab for those).
const VISIBLE_STATUSES = new Set(["backlog", "in_development", "completed"]);
const REFERENCE_YEAR = new Date().getFullYear();
const TODAY = new Date();
TODAY.setHours(0, 0, 0, 0);

const MONTH_OPTIONS = MONTH_NAMES.map((m, idx) => ({ value: String(idx + 1), label: m }));
const COLUMN_OPTIONS = [{ value: "backlog", label: "Backlog" }, ...MONTH_OPTIONS];

// The two fixed left columns (Initiative, Focus area) before the
// week/backlog columns start. Grid columns are 1-indexed, so a data column
// at array index i sits at grid column i + 3.
const FIXED_COLS = 2;
const gridColOf = (i) => i + FIXED_COLS + 1;

// Which columns (by index into `activeColumns`) a scheduled/unscheduled
// initiative occupies, independent of which columns are currently shown.
// Every field on an initiative, for the hover card -- so a reviewer never
// has to open the edit modal just to read something.
function initiativeFacts(item) {
  const schedule =
    item.startMonth != null && item.endMonth != null
      ? `${MONTH_NAMES[item.startMonth - 1]}–${MONTH_NAMES[item.endMonth - 1]}${item.year ? " " + item.year : ""}`
      : "Unscheduled (Backlog)";
  const fmtDate = (v) => (v ? new Date(v).toLocaleDateString() : "—");
  return [
    { label: "Team", value: item.team || "—" },
    { label: "Focus area", value: item.focusArea || "—" },
    { label: "Status", value: STATUS_LABEL[item.status] },
    { label: "Completed", value: item.completed ? "Yes" : "No" },
    { label: "Schedule", value: schedule },
    { label: "Summary", value: item.summary || "—" },
    { label: "Current state", value: item.currentState || "—" },
    { label: "Future state", value: item.futureState || "—" },
    { label: "Success metrics", value: item.successMetrics || "—" },
    { label: "Impacted teams", value: item.impactedTeams?.length ? item.impactedTeams.join(", ") : "—" },
    { label: "Submitted by", value: item.submittedBy || "—" },
    { label: "Submitted", value: fmtDate(item.submittedAt) },
    { label: "Reviewed by", value: item.reviewedBy || "—" },
    { label: "Reviewed", value: fmtDate(item.reviewedAt) },
    { label: "Reviewer notes", value: item.reviewerNotes || "—" },
  ];
}

function occupiedIndices(item, activeColumns) {
  if (item.startMonth == null || item.endMonth == null) {
    const idx = activeColumns.findIndex((c) => c.type === "backlog");
    return idx === -1 ? [] : [idx];
  }
  const out = [];
  activeColumns.forEach((c, i) => {
    if (c.type === "week" && c.month >= item.startMonth && c.month <= item.endMonth) out.push(i);
  });
  return out;
}

export default function RoadmapGantt({ initiatives, focusAreas, teams, onUpsert, onRemove }) {
  const guard = usePasswordGate();
  const [search, setSearch] = useState("");
  const [focusAreaFilter, setFocusAreaFilter] = useState([]); // [] = all
  const [teamFilter, setTeamFilter] = useState([]); // [] = all
  const [columnFilter, setColumnFilter] = useState([]); // [] = all months + backlog
  const [editing, setEditing] = useState(null); // { initiative } | { isNew: true } | null

  const teamOrder = teams.map((t) => t.name);
  const rank = (list, value) => {
    const idx = list.indexOf(value);
    return idx === -1 ? Infinity : idx;
  };

  // Columns actually rendered: each selected month broken down into its
  // Mondays, in calendar order; Backlog forced last whenever it's part of
  // the selection (or the default/unfiltered "everything" view) -- never
  // wherever the user happened to click it.
  const activeColumns = useMemo(() => {
    const chosen = columnFilter.length === 0 ? COLUMN_OPTIONS.map((o) => o.value) : columnFilter;
    const months = chosen
      .filter((v) => v !== "backlog")
      .map(Number)
      .sort((a, b) => a - b);
    const cols = [];
    for (const m of months) {
      for (const monday of mondaysInMonth(REFERENCE_YEAR, m)) {
        cols.push({ type: "week", month: m, value: monday.toISOString().slice(0, 10), label: formatWeekLabel(monday) });
      }
    }
    if (chosen.includes("backlog")) cols.push({ type: "backlog", value: "backlog", label: "Backlog" });
    return cols;
  }, [columnFilter]);

  // Groups adjacent week columns under one month super-header cell.
  const monthBands = useMemo(() => {
    const bands = [];
    let i = 0;
    while (i < activeColumns.length) {
      const col = activeColumns[i];
      if (col.type === "backlog") {
        bands.push({ label: "", startIdx: i, endIdx: i });
        i++;
        continue;
      }
      let j = i;
      while (j + 1 < activeColumns.length && activeColumns[j + 1].month === col.month) j++;
      bands.push({ label: MONTH_NAMES[col.month - 1], startIdx: i, endIdx: j });
      i = j + 1;
    }
    return bands;
  }, [activeColumns]);

  const todayColIndex = activeColumns.findIndex((c) => {
    if (c.type !== "week") return false;
    const monday = new Date(c.value);
    const nextMonday = new Date(monday);
    nextMonday.setDate(monday.getDate() + 7);
    return TODAY >= monday && TODAY < nextMonday;
  });

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return initiatives.filter((i) => {
      if (!VISIBLE_STATUSES.has(i.status)) return false;
      if (focusAreaFilter.length && !focusAreaFilter.includes(i.focusArea)) return false;
      if (teamFilter.length && !teamFilter.includes(i.team)) return false;
      if (q && !i.title.toLowerCase().includes(q)) return false;
      if (occupiedIndices(i, activeColumns).length === 0) return false;
      return true;
    });
  }, [initiatives, search, focusAreaFilter, teamFilter, activeColumns]);

  // Grouped by TEAM only -- focus area is shown as its own column per row
  // instead of a second grouping level, since a team's initiatives can span
  // several focus areas (nesting would duplicate the same team under each).
  const rows = useMemo(() => {
    const byTeam = new Map();
    for (const i of visible) {
      const team = i.team || "(No team)";
      if (!byTeam.has(team)) byTeam.set(team, []);
      byTeam.get(team).push(i);
    }
    const teamEntries = [...byTeam.entries()].sort(
      (a, b) => rank(teamOrder, a[0]) - rank(teamOrder, b[0]) || a[0].localeCompare(b[0])
    );
    const out = [];
    for (const [team, items] of teamEntries) {
      out.push({ type: "team", key: `team-${team}`, label: team, count: items.length });
      for (const item of items) out.push({ type: "item", key: `item-${item.id}`, item });
    }
    return out;
  }, [visible, teamOrder]);

  const save = async (payload, id) => {
    const isNew = !id;
    const res = await fetch(isNew ? "/api/initiatives" : `/api/initiatives/${id}`, {
      method: isNew ? "POST" : "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const j = await res.json();
    if (!res.ok || !j.ok) throw new Error(j.error || "Something went wrong. Please try again.");
    onUpsert(j.initiative);
    return j.initiative;
  };

  const remove = async (id) => {
    const res = await fetch(`/api/initiatives/${id}`, { method: "DELETE" });
    const j = await res.json();
    if (!res.ok || !j.ok) throw new Error(j.error || "Something went wrong. Please try again.");
    onRemove(id);
  };

  const bodyRowCount = rows.length;
  const lastRowLine = bodyRowCount + 3; // 2 header rows + N body rows -> N+2 tracks -> line N+3

  return (
    <>
      <Card className="cf-toolbar">
        <div className="rg-toolbar__grid">
          <Input
            search
            placeholder="Search initiatives…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search initiatives"
          />
          <MultiSelect
            label="Focus Areas"
            options={focusAreas.map((f) => ({ value: f.name, label: f.name }))}
            selected={focusAreaFilter}
            onChange={setFocusAreaFilter}
          />
          <MultiSelect
            label="Teams"
            options={teams.map((t) => ({ value: t.name, label: t.name }))}
            selected={teamFilter}
            onChange={setTeamFilter}
          />
          <MultiSelect
            label="Months"
            options={COLUMN_OPTIONS}
            selected={columnFilter}
            onChange={setColumnFilter}
          />
          <Button variant="accent" onClick={guard(() => setEditing({ isNew: true }))}>
            + Add initiative
          </Button>
        </div>
      </Card>

      {rows.length === 0 || activeColumns.length === 0 ? (
        <Card className="cf-empty-results">
          <IllustrationBadge icon="target" tone="blue" size={72} />
          <p className="cf-empty__title">No initiatives match</p>
          <p className="cf-empty__sub">
            Try a different filter, approve an idea from the review queue, or add one directly.
          </p>
        </Card>
      ) : (
        <div className="rg-scroll lt-scroll">
          <div
            className="rg-grid"
            style={{
              gridTemplateColumns: `220px 150px repeat(${activeColumns.length}, minmax(56px, 1fr))`,
              gridTemplateRows: `auto auto repeat(${bodyRowCount}, 44px)`,
            }}
          >
            {activeColumns.map((col, i) => (
              <div
                key={`colbg-${col.value}`}
                className={`rg-colbg${i % 2 === 1 ? " rg-colbg--alt" : ""}${i === todayColIndex ? " rg-colbg--today" : ""}`}
                style={{ gridColumn: gridColOf(i), gridRow: `1 / ${lastRowLine}` }}
              />
            ))}

            <div className="rg-headcell rg-headcell--label" style={{ gridRow: "1 / 3", gridColumn: 1 }}>
              Initiative
            </div>
            <div className="rg-headcell rg-headcell--focus" style={{ gridRow: "1 / 3", gridColumn: 2 }}>
              Focus Area
            </div>
            {monthBands.map((band) => (
              <div
                key={`band-${band.startIdx}`}
                className="rg-headcell rg-headcell--month"
                style={{ gridRow: 1, gridColumn: `${gridColOf(band.startIdx)} / ${gridColOf(band.endIdx) + 1}` }}
              >
                {band.label}
              </div>
            ))}
            {activeColumns.map((col, i) => (
              <div
                key={col.value}
                className={`rg-headcell${i === todayColIndex ? " rg-headcell--now" : ""}`}
                style={{ gridRow: 2, gridColumn: gridColOf(i) }}
              >
                {col.label}
                {i === todayColIndex && <span className="rg-headcell__today">Today</span>}
              </div>
            ))}

            {rows.map((r, idx) => (
              <GridRow key={r.key} row={r} gridRow={idx + 3} activeColumns={activeColumns} guard={guard} setEditing={setEditing} />
            ))}
          </div>
        </div>
      )}

      {editing && (
        <InitiativeModal
          initiative={editing.initiative}
          focusAreas={focusAreas}
          teams={teams}
          onClose={() => setEditing(null)}
          onSave={save}
          onDelete={remove}
        />
      )}
    </>
  );
}

function GridRow({ row, gridRow, activeColumns, guard, setEditing }) {
  if (row.type === "team") {
    return (
      <div className="rg-teamband" style={{ gridRow, gridColumn: "1 / -1" }}>
        <span className="rg-teamband__pin">
          <span className="rg-teamband__name">{row.label}</span>
          <span className="rg-teamband__count">{row.count}</span>
        </span>
      </div>
    );
  }

  const item = row.item;
  const idxs = occupiedIndices(item, activeColumns);
  const startCol = gridColOf(Math.min(...idxs));
  const endCol = gridColOf(Math.max(...idxs)) + 1;
  const onEdit = () => guard(() => setEditing({ initiative: item }))();

  return (
    <Fragment>
      <button type="button" className="rg-labelcell" style={{ gridRow, gridColumn: 1 }} onClick={onEdit}>
        <span className="rg-labelcell__text">{item.title}</span>
        <div className="rg-tooltip" role="tooltip">
          <div className="rg-tooltip__title">{item.title}</div>
          <dl className="rg-tooltip__facts">
            {initiativeFacts(item).map((f) => (
              <div className="rg-tooltip__fact" key={f.label}>
                <dt>{f.label}</dt>
                <dd>{f.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </button>
      <div className="rg-focuscell" style={{ gridRow, gridColumn: 2 }}>
        {item.focusArea || "—"}
      </div>
      <div
        className={`rg-bar rg-bar--${item.status}`}
        style={{ gridRow, gridColumn: `${startCol} / ${endCol}` }}
        onClick={onEdit}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onEdit()}
        title={item.title}
      >
        <span className="rg-bar__status">{STATUS_LABEL[item.status]}</span>
      </div>
    </Fragment>
  );
}
