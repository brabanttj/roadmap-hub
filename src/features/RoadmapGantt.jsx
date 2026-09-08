import { Fragment, useMemo, useState } from "react";
import { Card, Input, Select, Button, IllustrationBadge } from "../components/ui/index.js";
import { usePasswordGate } from "../lib/PasswordGate.jsx";
import { MONTH_NAMES, STATUS_LABEL } from "../lib/text.js";
import InitiativeModal from "./InitiativeModal.jsx";
import "./RoadmapGantt.css";

const ALL = "All";
// Excluded from the Gantt entirely -- ideas haven't been reviewed yet, and
// rejected ideas never became roadmap work (see the Rejected tab for those).
const VISIBLE_STATUSES = new Set(["backlog", "in_development", "completed"]);
const CURRENT_MONTH = new Date().getMonth() + 1;
// Grid columns: 1 = label, 2 = Backlog, 3..14 = Jan..Dec.
const DATE_COLUMNS = [2, ...MONTH_NAMES.map((_, idx) => 3 + idx)];
const BAR_ICON = { completed: "✓", in_development: "●", backlog: "○" };

export default function RoadmapGantt({ initiatives, focusAreas, teams, onUpsert, onRemove }) {
  const guard = usePasswordGate();
  const [search, setSearch] = useState("");
  const [focusAreaFilter, setFocusAreaFilter] = useState(ALL);
  const [teamFilter, setTeamFilter] = useState(ALL);
  const [monthFilter, setMonthFilter] = useState(ALL);
  const [editing, setEditing] = useState(null); // { initiative } | { isNew: true } | null

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const month = monthFilter === ALL ? null : Number(monthFilter);
    return initiatives.filter((i) => {
      if (!VISIBLE_STATUSES.has(i.status)) return false;
      if (focusAreaFilter !== ALL && i.focusArea !== focusAreaFilter) return false;
      if (teamFilter !== ALL && i.team !== teamFilter) return false;
      if (month && !(i.startMonth != null && i.endMonth != null && month >= i.startMonth && month <= i.endMonth)) {
        return false;
      }
      if (q && !i.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [initiatives, search, focusAreaFilter, teamFilter, monthFilter]);

  // Group by focus area, then team, ordered by the taxonomy's sort order --
  // falling back to alphabetical for any free-text value not in the taxonomy.
  const focusAreaOrder = focusAreas.map((f) => f.name);
  const teamOrder = teams.map((t) => t.name);
  const rank = (list, value) => {
    const idx = list.indexOf(value);
    return idx === -1 ? Infinity : idx;
  };

  const groups = useMemo(() => {
    const byFocusArea = new Map();
    for (const i of visible) {
      const fa = i.focusArea || "(No focus area)";
      if (!byFocusArea.has(fa)) byFocusArea.set(fa, new Map());
      const byTeam = byFocusArea.get(fa);
      const team = i.team || "(No team)";
      if (!byTeam.has(team)) byTeam.set(team, []);
      byTeam.get(team).push(i);
    }
    const focusAreaEntries = [...byFocusArea.entries()].sort(
      (a, b) => rank(focusAreaOrder, a[0]) - rank(focusAreaOrder, b[0]) || a[0].localeCompare(b[0])
    );
    return focusAreaEntries.map(([focusArea, byTeam]) => ({
      focusArea,
      teams: [...byTeam.entries()]
        .sort((a, b) => rank(teamOrder, a[0]) - rank(teamOrder, b[0]) || a[0].localeCompare(b[0]))
        .map(([team, items]) => ({ team, items })),
    }));
  }, [visible, focusAreaOrder, teamOrder]);

  // Flatten into explicit grid rows up front (row 1 is the header) so every
  // piece of a row -- label, bar -- can share one explicit `gridRow`,
  // instead of relying on CSS Grid's auto-placement to keep separately
  // emitted elements in lockstep.
  const rows = useMemo(() => {
    const out = [];
    for (const g of groups) {
      out.push({ type: "focusArea", key: `fa-${g.focusArea}`, label: g.focusArea });
      for (const t of g.teams) {
        out.push({ type: "team", key: `team-${g.focusArea}-${t.team}`, label: t.team, count: t.items.length });
        for (const item of t.items) {
          out.push({ type: "item", key: `item-${item.id}`, item });
        }
      }
    }
    return out;
  }, [groups]);

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
          <Select
            value={focusAreaFilter}
            onChange={(e) => setFocusAreaFilter(e.target.value)}
            aria-label="Filter by focus area"
          >
            <option value={ALL}>All Focus Areas</option>
            {focusAreas.map((f) => (
              <option key={f.id} value={f.name}>
                {f.name}
              </option>
            ))}
          </Select>
          <Select value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)} aria-label="Filter by team">
            <option value={ALL}>All Teams</option>
            {teams.map((t) => (
              <option key={t.id} value={t.name}>
                {t.name}
              </option>
            ))}
          </Select>
          <Select value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)} aria-label="Filter by month">
            <option value={ALL}>All Months</option>
            {MONTH_NAMES.map((m, idx) => (
              <option key={m} value={idx + 1}>
                {m}
              </option>
            ))}
          </Select>
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
      </div>

      {rows.length === 0 ? (
        <Card className="cf-empty-results">
          <IllustrationBadge icon="target" tone="blue" size={72} />
          <p className="cf-empty__title">No initiatives match</p>
          <p className="cf-empty__sub">
            Try a different filter, approve an idea from the review queue, or add one directly.
          </p>
        </Card>
      ) : (
        <div className="rg-scroll lt-scroll">
          <div className="rg-grid" style={{ gridTemplateRows: `auto repeat(${bodyRowCount}, 44px)` }}>
            {/* Column tints painted first so every later element (header,
                labels, bars) naturally stacks on top in DOM order -- no
                z-index bookkeeping needed. */}
            {DATE_COLUMNS.map((col, i) => (
              <div
                key={`colbg-${col}`}
                className={`rg-colbg${i % 2 === 1 ? " rg-colbg--alt" : ""}${
                  col === 2 + CURRENT_MONTH ? " rg-colbg--today" : ""
                }`}
                style={{ gridColumn: col, gridRow: `1 / ${bodyRowCount + 2}` }}
              />
            ))}

            <div className="rg-headcell rg-headcell--label" style={{ gridRow: 1, gridColumn: 1 }}>
              Initiative
            </div>
            <div className="rg-headcell" style={{ gridRow: 1, gridColumn: 2 }}>
              Backlog
            </div>
            {MONTH_NAMES.map((m, idx) => (
              <div
                key={m}
                className={`rg-headcell${idx + 1 === CURRENT_MONTH ? " rg-headcell--now" : ""}`}
                style={{ gridRow: 1, gridColumn: 3 + idx }}
              >
                {m}
                {idx + 1 === CURRENT_MONTH && <span className="rg-headcell__today">Today</span>}
              </div>
            ))}

            {rows.map((r, idx) => (
              <GridRow key={r.key} row={r} gridRow={idx + 2} guard={guard} setEditing={setEditing} />
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

function GridRow({ row, gridRow, guard, setEditing }) {
  if (row.type === "focusArea") {
    return (
      <div className="rg-groupband" style={{ gridRow, gridColumn: "1 / -1" }}>
        <span className="rg-groupband__pin">{row.label}</span>
      </div>
    );
  }
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
  const inBacklog = item.startMonth == null || item.endMonth == null;
  const startCol = inBacklog ? 2 : 2 + item.startMonth;
  const endCol = inBacklog ? 3 : 2 + item.endMonth + 1;
  const onEdit = () => guard(() => setEditing({ initiative: item }))();

  return (
    <Fragment>
      <button
        type="button"
        className="rg-labelcell"
        style={{ gridRow, gridColumn: 1 }}
        onClick={onEdit}
      >
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
