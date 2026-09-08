import { Fragment, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Card, Input, Select, MultiSelect, Button, IllustrationBadge } from "../components/ui/index.js";
import { usePasswordGate } from "../lib/PasswordGate.jsx";
import { MONTH_NAMES, STATUS_LABEL, mondaysInMonth, formatWeekLabel } from "../lib/text.js";
import InitiativeModal from "./InitiativeModal.jsx";
import "./RoadmapGantt.css";

// Excluded from the Gantt entirely -- ideas haven't been reviewed yet, and
// rejected ideas never became roadmap work (see the Rejected tab for those).
const VISIBLE_STATUSES = ["backlog", "in_development", "completed"];
const STATUS_OPTIONS = VISIBLE_STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] }));
const REFERENCE_YEAR = new Date().getFullYear();
const TODAY = new Date();
TODAY.setHours(0, 0, 0, 0);

// Month + Year combined into one option per (year, month) -- e.g. "Jan
// 2026" -- so a single multi-select can mix and match any months across
// any of these years, instead of one shared Year applying to every pick.
const YEAR_RANGE = [REFERENCE_YEAR - 1, REFERENCE_YEAR, REFERENCE_YEAR + 1];
const MONTH_YEAR_OPTIONS = YEAR_RANGE.flatMap((y) =>
  MONTH_NAMES.map((name, idx) => ({ value: `${y}-${idx + 1}`, label: `${name} ${y}`, year: y, month: idx + 1 }))
);
const COLUMN_OPTIONS = [{ value: "backlog", label: "Backlog" }, ...MONTH_YEAR_OPTIONS];
// Default (nothing explicitly picked) -- the current year's 12 months plus
// Backlog, matching what "All Months" used to mean before Year existed as
// a separate control.
const DEFAULT_COLUMN_VALUES = [
  ...MONTH_NAMES.map((_, idx) => `${REFERENCE_YEAR}-${idx + 1}`),
  "backlog",
];

// Explicit (not "auto") header row heights: the sidebar panel and the date
// panel are two independent DOM trees sitting side by side, so their row
// tracks must match in pixels exactly or the rows won't line up.
const HEAD_ROW_H = 34;
const BODY_ROW_H = 44;

// Every field on an initiative, for the hover card -- so a reviewer never
// has to open the edit modal just to read something.
function initiativeFacts(item) {
  const fmtDate = (v) => (v ? new Date(v).toLocaleDateString() : "—");
  const schedule =
    item.startDate && item.endDate
      ? `Week of ${fmtDate(item.startDate)} – week of ${fmtDate(item.endDate)}`
      : "Unscheduled (Backlog)";
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

// Which columns (by index into `activeColumns`) a scheduled/unscheduled
// initiative occupies, independent of which columns are currently shown.
// A "week" column is occupied if the initiative's [startDate, endDate]
// range (both Mondays) overlaps that week's Monday-to-Sunday span.
function occupiedIndices(item, activeColumns) {
  if (!item.startDate || !item.endDate) {
    const idx = activeColumns.findIndex((c) => c.type === "backlog");
    return idx === -1 ? [] : [idx];
  }
  const start = new Date(item.startDate);
  const end = new Date(item.endDate);
  const out = [];
  activeColumns.forEach((c, i) => {
    if (c.type !== "week") return;
    const monday = new Date(c.value);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    if (start <= sunday && end >= monday) out.push(i);
  });
  return out;
}

export default function RoadmapGantt({ initiatives, focusAreas, teams, onUpsert, onRemove }) {
  const guard = usePasswordGate();
  const [search, setSearch] = useState("");
  const [focusAreaFilter, setFocusAreaFilter] = useState([]); // [] = all
  const [teamFilter, setTeamFilter] = useState([]); // [] = all
  const [statusFilter, setStatusFilter] = useState([]); // [] = all
  const [columnFilter, setColumnFilter] = useState([]); // [] = current year's months + backlog
  const [groupBy, setGroupBy] = useState("team"); // "team" | "focusArea"
  const [editing, setEditing] = useState(null); // { initiative } | { isNew: true } | null
  const [hover, setHover] = useState(null); // { item, rect } | null -- drives the portal tooltip

  const sidebarRef = useRef(null);
  const hscrollRef = useRef(null);
  const syncingRef = useRef(false);
  const onHscrollScroll = (e) => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    if (sidebarRef.current) sidebarRef.current.scrollTop = e.currentTarget.scrollTop;
    syncingRef.current = false;
    setHover(null);
  };
  const onSidebarScroll = (e) => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    if (hscrollRef.current) hscrollRef.current.scrollTop = e.currentTarget.scrollTop;
    syncingRef.current = false;
    setHover(null);
  };

  const teamOrder = teams.map((t) => t.name);
  const focusAreaOrder = focusAreas.map((f) => f.name);
  const rank = (list, value) => {
    const idx = list.indexOf(value);
    return idx === -1 ? Infinity : idx;
  };

  // Which field drives the row grouping vs. which shows as the secondary
  // (non-grouped) column -- flipped by the Group By control.
  const primaryField = groupBy === "team" ? "team" : "focusArea";
  const secondaryField = groupBy === "team" ? "focusArea" : "team";
  const primaryOrder = groupBy === "team" ? teamOrder : focusAreaOrder;
  const primaryFallback = groupBy === "team" ? "(No team)" : "(No focus area)";
  const secondaryLabel = groupBy === "team" ? "Focus Area" : "Team";

  // Columns actually rendered: each selected (year, month) broken down into
  // its Mondays, in chronological order; Backlog forced last whenever it's
  // part of the selection (or the default/unfiltered view) -- never
  // wherever the user happened to click it.
  const activeColumns = useMemo(() => {
    const chosen = columnFilter.length === 0 ? DEFAULT_COLUMN_VALUES : columnFilter;
    const monthYears = chosen
      .filter((v) => v !== "backlog")
      .map((v) => {
        const [y, m] = v.split("-").map(Number);
        return { year: y, month: m };
      })
      .sort((a, b) => a.year - b.year || a.month - b.month);
    const cols = [];
    for (const { year, month } of monthYears) {
      for (const monday of mondaysInMonth(year, month)) {
        cols.push({
          type: "week",
          year,
          month,
          value: monday.toISOString().slice(0, 10),
          label: formatWeekLabel(monday),
        });
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
      while (
        j + 1 < activeColumns.length &&
        activeColumns[j + 1].month === col.month &&
        activeColumns[j + 1].year === col.year
      )
        j++;
      bands.push({ label: `${MONTH_NAMES[col.month - 1]} ${col.year}`, startIdx: i, endIdx: j });
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
      if (!VISIBLE_STATUSES.includes(i.status)) return false;
      if (statusFilter.length && !statusFilter.includes(i.status)) return false;
      if (focusAreaFilter.length && !focusAreaFilter.includes(i.focusArea)) return false;
      if (teamFilter.length && !teamFilter.includes(i.team)) return false;
      if (q && !i.title.toLowerCase().includes(q)) return false;
      if (occupiedIndices(i, activeColumns).length === 0) return false;
      return true;
    });
  }, [initiatives, search, statusFilter, focusAreaFilter, teamFilter, activeColumns]);

  // Grouped by the chosen primary field only -- the secondary field is
  // shown as its own column per row instead of a second grouping level,
  // since e.g. a team's initiatives can span several focus areas (nesting
  // would duplicate the same group under each).
  const rows = useMemo(() => {
    const byGroup = new Map();
    for (const i of visible) {
      const key = i[primaryField] || primaryFallback;
      if (!byGroup.has(key)) byGroup.set(key, []);
      byGroup.get(key).push(i);
    }
    const entries = [...byGroup.entries()].sort(
      (a, b) => rank(primaryOrder, a[0]) - rank(primaryOrder, b[0]) || a[0].localeCompare(b[0])
    );
    const out = [];
    for (const [label, items] of entries) {
      out.push({ type: "group", key: `group-${label}`, label, count: items.length });
      for (const item of items) out.push({ type: "item", key: `item-${item.id}`, item });
    }
    return out;
  }, [visible, primaryField, primaryOrder, primaryFallback]);

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
  const rowsTemplate = `${HEAD_ROW_H}px ${HEAD_ROW_H}px repeat(${bodyRowCount}, ${BODY_ROW_H}px)`;
  const lastRowLine = bodyRowCount + 3;

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
            label="Statuses"
            options={STATUS_OPTIONS}
            selected={statusFilter}
            onChange={setStatusFilter}
          />
          <MultiSelect
            label="Months"
            options={COLUMN_OPTIONS}
            selected={columnFilter}
            onChange={setColumnFilter}
          />
          <Select value={groupBy} onChange={(e) => setGroupBy(e.target.value)} aria-label="Group by">
            <option value="team">Group by Team</option>
            <option value="focusArea">Group by Focus Area</option>
          </Select>
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
        <div className="rg-tablewrap">
          {/* Sidebar: Initiative + secondary-field columns. A completely
              separate, non-horizontally-scrolling panel -- not a "sticky"
              column of the date grid. CSS position:sticky on a grid item
              stops tracking correctly once scrolled roughly past its own
              track's width in a very wide implicit grid (confirmed via
              direct measurement while debugging this exact table), so the
              only fully reliable fix is to not rely on it at all: this
              panel simply never scrolls horizontally, and its vertical
              scroll is kept in sync with the date panel via JS below. */}
          <div className="rg-sidebar" ref={sidebarRef} onScroll={onSidebarScroll}>
            <div className="rg-sidebargrid" style={{ gridTemplateRows: rowsTemplate }}>
              <div className="rg-headcell rg-headcell--label" style={{ gridRow: "1 / 3", gridColumn: 1 }}>
                Initiative
              </div>
              <div className="rg-headcell rg-headcell--focus" style={{ gridRow: "1 / 3", gridColumn: 2 }}>
                {secondaryLabel}
              </div>
              {rows.map((r, idx) => (
                <SidebarRow key={r.key} row={r} gridRow={idx + 3} secondaryField={secondaryField} guard={guard} setEditing={setEditing} onHover={setHover} />
              ))}
            </div>
          </div>

          <div className="rg-hscroll lt-scroll" ref={hscrollRef} onScroll={onHscrollScroll}>
            <div
              className="rg-grid"
              style={{
                gridTemplateColumns: `repeat(${activeColumns.length}, minmax(76px, 1fr))`,
                gridTemplateRows: rowsTemplate,
              }}
            >
              {activeColumns.map((col, i) => (
                <div
                  key={`colbg-${col.value}`}
                  className={`rg-colbg${i % 2 === 1 ? " rg-colbg--alt" : ""}${i === todayColIndex ? " rg-colbg--today" : ""}`}
                  style={{ gridColumn: i + 1, gridRow: `1 / ${lastRowLine}` }}
                />
              ))}

              {monthBands.map((band) => (
                <div
                  key={`band-${band.startIdx}`}
                  className="rg-headcell rg-headcell--month"
                  style={{ gridRow: 1, gridColumn: `${band.startIdx + 1} / ${band.endIdx + 2}` }}
                >
                  {band.label}
                </div>
              ))}
              {activeColumns.map((col, i) => (
                <div
                  key={col.value}
                  className={`rg-headcell${i === todayColIndex ? " rg-headcell--now" : ""}`}
                  style={{ gridRow: 2, gridColumn: i + 1 }}
                >
                  {col.label}
                </div>
              ))}

              {rows.map((r, idx) => (
                <DateRow key={r.key} row={r} gridRow={idx + 3} activeColumns={activeColumns} guard={guard} setEditing={setEditing} />
              ))}
            </div>
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

      {hover &&
        createPortal(
          <div
            className="rg-tooltip rg-tooltip--portal"
            role="tooltip"
            style={{ top: hover.rect.bottom + 6, left: hover.rect.left }}
          >
            <div className="rg-tooltip__title">{hover.item.title}</div>
            <dl className="rg-tooltip__facts">
              {initiativeFacts(hover.item).map((f) => (
                <div className="rg-tooltip__fact" key={f.label}>
                  <dt>{f.label}</dt>
                  <dd>{f.value}</dd>
                </div>
              ))}
            </dl>
          </div>,
          document.body
        )}
    </>
  );
}

function SidebarRow({ row, gridRow, secondaryField, guard, setEditing, onHover }) {
  if (row.type === "group") {
    return (
      <div className="rg-teamband" style={{ gridRow, gridColumn: "1 / -1" }}>
        <span className="rg-teamband__name">{row.label}</span>
        <span className="rg-teamband__count">{row.count}</span>
      </div>
    );
  }

  const item = row.item;
  const onEdit = () => guard(() => setEditing({ initiative: item }))();
  const showTooltip = (e) => onHover({ item, rect: e.currentTarget.getBoundingClientRect() });
  const hideTooltip = () => onHover(null);

  return (
    <Fragment>
      <button
        type="button"
        className="rg-labelcell"
        style={{ gridRow, gridColumn: 1 }}
        onClick={onEdit}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onFocus={showTooltip}
        onBlur={hideTooltip}
      >
        <span className="rg-labelcell__text">{item.title}</span>
      </button>
      <div className="rg-focuscell" style={{ gridRow, gridColumn: 2 }}>
        {item[secondaryField] || "—"}
      </div>
    </Fragment>
  );
}

function DateRow({ row, gridRow, activeColumns, guard, setEditing }) {
  if (row.type === "group") {
    return <div className="rg-teamband rg-teamband--filler" style={{ gridRow, gridColumn: "1 / -1" }} />;
  }

  const item = row.item;
  const idxs = occupiedIndices(item, activeColumns);
  const startCol = Math.min(...idxs) + 1;
  const endCol = Math.max(...idxs) + 2;
  const onEdit = () => guard(() => setEditing({ initiative: item }))();

  return (
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
  );
}
