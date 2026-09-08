import { Fragment, useMemo, useState } from "react";
import { Card, Input, MultiSelect, Button, IllustrationBadge } from "../components/ui/index.js";
import { usePasswordGate } from "../lib/PasswordGate.jsx";
import { MONTH_NAMES, STATUS_LABEL } from "../lib/text.js";
import InitiativeModal from "./InitiativeModal.jsx";
import "./RoadmapGantt.css";

// Excluded from the Gantt entirely -- ideas haven't been reviewed yet, and
// rejected ideas never became roadmap work (see the Rejected tab for those).
const VISIBLE_STATUSES = new Set(["backlog", "in_development", "completed"]);
const CURRENT_MONTH = new Date().getMonth() + 1;
const BAR_ICON = { completed: "✓", in_development: "●", backlog: "○" };

const MONTH_OPTIONS = MONTH_NAMES.map((m, idx) => ({ value: String(idx + 1), label: m }));
const COLUMN_OPTIONS = [{ value: "backlog", label: "Backlog" }, ...MONTH_OPTIONS];

// Distinct, cycling palette for focus areas -- these are user-editable
// (see ManageTaxonomy), so colors are assigned by taxonomy order rather
// than hardcoded per name.
const FOCUS_COLORS = [
  "#0069ba", // blue
  "#078181", // teal
  "#7c3aed", // violet
  "#c2650a", // amber
  "#b3306b", // magenta
  "#4b5563", // slate
  "#046a41", // deep green
  "#ae2b41", // deep red
];
function focusAreaColor(name, order) {
  if (!name) return "#9ca3af";
  const idx = order.indexOf(name);
  return FOCUS_COLORS[(idx === -1 ? name.length : idx) % FOCUS_COLORS.length];
}

// Which column keys ("1".."12" or "backlog") a scheduled/unscheduled
// initiative occupies, independent of which columns are currently shown.
function occupiedColumns(item) {
  if (item.startMonth == null || item.endMonth == null) return ["backlog"];
  const out = [];
  for (let m = item.startMonth; m <= item.endMonth; m++) out.push(String(m));
  return out;
}

export default function RoadmapGantt({ initiatives, focusAreas, teams, onUpsert, onRemove }) {
  const guard = usePasswordGate();
  const [search, setSearch] = useState("");
  const [focusAreaFilter, setFocusAreaFilter] = useState([]); // [] = all
  const [teamFilter, setTeamFilter] = useState([]); // [] = all
  const [columnFilter, setColumnFilter] = useState([]); // [] = all columns shown
  const [editing, setEditing] = useState(null); // { initiative } | { isNew: true } | null

  const focusAreaOrder = focusAreas.map((f) => f.name);
  const teamOrder = teams.map((t) => t.name);
  const rank = (list, value) => {
    const idx = list.indexOf(value);
    return idx === -1 ? Infinity : idx;
  };

  // Columns actually rendered: months in calendar order, Backlog forced
  // last whenever it's part of the selection (or the default/unfiltered
  // "everything" view) -- never wherever the user happened to click it.
  const activeColumns = useMemo(() => {
    const chosen = columnFilter.length === 0 ? COLUMN_OPTIONS.map((o) => o.value) : columnFilter;
    const months = chosen
      .filter((v) => v !== "backlog")
      .map(Number)
      .sort((a, b) => a - b);
    const cols = months.map((m) => ({ type: "month", value: String(m), label: MONTH_NAMES[m - 1] }));
    if (chosen.includes("backlog")) cols.push({ type: "backlog", value: "backlog", label: "Backlog" });
    return cols;
  }, [columnFilter]);

  const activeColumnValues = useMemo(() => new Set(activeColumns.map((c) => c.value)), [activeColumns]);
  const colIndex = (value) => activeColumns.findIndex((c) => c.value === value);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return initiatives.filter((i) => {
      if (!VISIBLE_STATUSES.has(i.status)) return false;
      if (focusAreaFilter.length && !focusAreaFilter.includes(i.focusArea)) return false;
      if (teamFilter.length && !teamFilter.includes(i.team)) return false;
      if (q && !i.title.toLowerCase().includes(q)) return false;
      if (!occupiedColumns(i).some((c) => activeColumnValues.has(c))) return false;
      return true;
    });
  }, [initiatives, search, focusAreaFilter, teamFilter, activeColumnValues]);

  // Grouped by TEAM only -- focus area is color-coded per row instead of a
  // second grouping level, since a team's initiatives can span several
  // focus areas (nesting would duplicate the same team under each one).
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
  const todayColIndex = colIndex(String(CURRENT_MONTH));

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

      <div className="rg-legend">
        {Object.entries(STATUS_LABEL)
          .filter(([k]) => VISIBLE_STATUSES.has(k))
          .map(([k, label]) => (
            <span key={k} className="rg-legend__item">
              <span className={`rg-swatch rg-swatch--${k}`} aria-hidden="true" />
              {label}
            </span>
          ))}
        <span className="rg-legend__sep" aria-hidden="true" />
        {focusAreas.map((f) => (
          <span key={f.id} className="rg-legend__item">
            <span
              className="rg-swatch"
              style={{ background: focusAreaColor(f.name, focusAreaOrder) }}
              aria-hidden="true"
            />
            {f.name}
          </span>
        ))}
      </div>

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
              gridTemplateColumns: `230px repeat(${activeColumns.length}, minmax(64px, 1fr))`,
              gridTemplateRows: `auto repeat(${bodyRowCount}, 44px)`,
            }}
          >
            {activeColumns.map((col, i) => (
              <div
                key={`colbg-${col.value}`}
                className={`rg-colbg${i % 2 === 1 ? " rg-colbg--alt" : ""}${i === todayColIndex ? " rg-colbg--today" : ""}`}
                style={{ gridColumn: i + 2, gridRow: `1 / ${bodyRowCount + 2}` }}
              />
            ))}

            <div className="rg-headcell rg-headcell--label" style={{ gridRow: 1, gridColumn: 1 }}>
              Initiative
            </div>
            {activeColumns.map((col, i) => (
              <div
                key={col.value}
                className={`rg-headcell${i === todayColIndex ? " rg-headcell--now" : ""}`}
                style={{ gridRow: 1, gridColumn: i + 2 }}
              >
                {col.label}
                {i === todayColIndex && <span className="rg-headcell__today">Today</span>}
              </div>
            ))}

            {rows.map((r, idx) => (
              <GridRow
                key={r.key}
                row={r}
                gridRow={idx + 2}
                colIndex={colIndex}
                focusAreaOrder={focusAreaOrder}
                guard={guard}
                setEditing={setEditing}
              />
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

function GridRow({ row, gridRow, colIndex, focusAreaOrder, guard, setEditing }) {
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
  const cols = occupiedColumns(item)
    .map((v) => colIndex(v))
    .filter((i) => i !== -1)
    .sort((a, b) => a - b);
  const startCol = cols[0] + 2;
  const endCol = cols[cols.length - 1] + 3;
  const onEdit = () => guard(() => setEditing({ initiative: item }))();
  const dotColor = focusAreaColor(item.focusArea, focusAreaOrder);

  return (
    <Fragment>
      <button
        type="button"
        className="rg-labelcell"
        style={{ gridRow, gridColumn: 1 }}
        onClick={onEdit}
      >
        <span
          className="rg-labelcell__dot"
          style={{ background: dotColor }}
          title={item.focusArea || "No focus area"}
        />
        <span className="rg-labelcell__text">{item.title}</span>
        <div className="rg-tooltip" role="tooltip">
          <div className="rg-tooltip__title">{item.title}</div>
          <dl className="rg-tooltip__facts">
            <div className="rg-tooltip__fact">
              <dt>Focus area</dt>
              <dd>{item.focusArea || "—"}</dd>
            </div>
            <div className="rg-tooltip__fact">
              <dt>Summary</dt>
              <dd>{item.summary || "—"}</dd>
            </div>
            <div className="rg-tooltip__fact">
              <dt>Current state</dt>
              <dd>{item.currentState || "—"}</dd>
            </div>
            <div className="rg-tooltip__fact">
              <dt>Future state</dt>
              <dd>{item.futureState || "—"}</dd>
            </div>
          </dl>
        </div>
      </button>
      <div
        className={`rg-bar rg-bar--${item.status}`}
        style={{ gridRow, gridColumn: `${startCol} / ${endCol}` }}
        onClick={onEdit}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onEdit()}
        title={`${item.title} — ${STATUS_LABEL[item.status]}`}
      >
        <span className="rg-bar__icon" aria-hidden="true">{BAR_ICON[item.status]}</span>
        <span className="rg-bar__label">{item.title}</span>
      </div>
    </Fragment>
  );
}
