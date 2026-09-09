import { Fragment, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Card, Input, Select, MultiSelect, Button, IllustrationBadge } from "../components/ui/index.js";
import { usePasswordGate } from "../lib/PasswordGate.jsx";
import { MONTH_NAMES, STATUS_LABEL } from "../lib/text.js";
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

// Explicit (not "auto") header row height: the sidebar panel and the date
// panel are two independent DOM trees sitting side by side, so their row
// tracks must match in pixels exactly or the rows won't line up.
const HEAD_ROW_H = 34;
const BODY_ROW_H = 44;

const monthIndex = (year, month) => year * 12 + (month - 1);

// Every field on an initiative, for the hover card -- so a reviewer never
// has to open the edit modal just to read something.
function initiativeFacts(item) {
  const fmtDate = (v) => (v ? new Date(v).toLocaleDateString() : "—");
  const schedule =
    item.startMonth && item.endMonth
      ? `${MONTH_NAMES[item.startMonth - 1]} ${item.startYear} – ${MONTH_NAMES[item.endMonth - 1]} ${item.endYear}`
      : "Unscheduled (Backlog)";
  // `wide: true` facts always take the full row (long free text); the rest
  // pair up two-per-row so the whole card stays short enough to fit on
  // screen without needing to scroll -- see .rg-tooltip__facts.
  return [
    { label: "Team", value: item.team || "—" },
    { label: "Focus area", value: item.focusArea || "—" },
    { label: "Status", value: STATUS_LABEL[item.status] },
    { label: "Completed", value: item.completed ? "Yes" : "No" },
    { label: "Schedule", value: schedule, wide: true },
    { label: "Summary", value: item.summary || "—", wide: true },
    { label: "Current state", value: item.currentState || "—", wide: true },
    { label: "Future state", value: item.futureState || "—", wide: true },
    { label: "Success metrics", value: item.successMetrics || "—", wide: true },
    { label: "Impacted teams", value: item.impactedTeams?.length ? item.impactedTeams.join(", ") : "—" },
    { label: "Impacted products", value: item.impactedProducts?.length ? item.impactedProducts.join(", ") : "—" },
    { label: "Submitted by", value: item.submittedBy || "—" },
    { label: "Submitted", value: fmtDate(item.submittedAt) },
    { label: "Reviewed by", value: item.reviewedBy || "—" },
    { label: "Reviewed", value: fmtDate(item.reviewedAt) },
    { label: "Reviewer notes", value: item.reviewerNotes || "—", wide: true },
  ];
}

// Counts by status, used for the colored count pills next to "Initiative"
// and next to each team/focus-area group band.
function countByStatus(items) {
  const out = { backlog: 0, in_development: 0, completed: 0 };
  for (const i of items) if (out[i.status] !== undefined) out[i.status]++;
  return out;
}

function StatusCounts({ counts, total }) {
  return (
    <span className="rg-statuscounts">
      {VISIBLE_STATUSES.map((s) => (
        <span key={s} className={`rg-statuscount rg-statuscount--${s}`}>
          {counts[s]}
        </span>
      ))}
      <span className="rg-statuscount rg-statuscount--total">{total}</span>
    </span>
  );
}

// Which columns (by index into `activeColumns`) a scheduled/unscheduled
// initiative occupies, independent of which columns are currently shown.
// A month column is occupied if it falls within the item's
// [startYear/startMonth, endYear/endMonth] range, inclusive on both ends.
function occupiedIndices(item, activeColumns) {
  if (!item.startMonth || !item.endMonth) {
    const idx = activeColumns.findIndex((c) => c.type === "backlog");
    return idx === -1 ? [] : [idx];
  }
  const start = monthIndex(item.startYear, item.startMonth);
  const end = monthIndex(item.endYear, item.endMonth);
  const out = [];
  activeColumns.forEach((c, i) => {
    if (c.type !== "month") return;
    const idx = monthIndex(c.year, c.month);
    if (idx >= start && idx <= end) out.push(i);
  });
  return out;
}

export default function RoadmapGantt({ initiatives, focusAreas, teams, onUpsert, onRemove, onReorder }) {
  const guard = usePasswordGate();
  const [search, setSearch] = useState("");
  const [focusAreaFilter, setFocusAreaFilter] = useState([]); // [] = all
  const [teamFilter, setTeamFilter] = useState([]); // [] = all
  const [statusFilter, setStatusFilter] = useState([]); // [] = all
  const [columnFilter, setColumnFilter] = useState([]); // [] = current year's months + backlog
  const [groupBy, setGroupBy] = useState("team"); // "team" | "focusArea"
  const [sortMode, setSortMode] = useState("priority"); // "priority" | "startDate" -- see `rows` below
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [editing, setEditing] = useState(null); // { initiative } | { isNew: true } | null
  const [hover, setHover] = useState(null); // { item, rect } | null -- drives the portal tooltip
  const [scrollTop, setScrollTop] = useState(0); // drives which group's sticky band is shown
  const [dragOverId, setDragOverId] = useState(null); // item id currently being dragged over -- drop-target highlight

  const sidebarRef = useRef(null);
  const hscrollRef = useRef(null);
  const syncingRef = useRef(false);
  const dragIdRef = useRef(null); // id of the item currently being dragged, if any
  const onHscrollScroll = (e) => {
    setScrollTop(e.currentTarget.scrollTop);
    if (syncingRef.current) return;
    syncingRef.current = true;
    if (sidebarRef.current) sidebarRef.current.scrollTop = e.currentTarget.scrollTop;
    syncingRef.current = false;
    setHover(null);
  };
  const onSidebarScroll = (e) => {
    setScrollTop(e.currentTarget.scrollTop);
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

  // Priority is a per-team drag order -- it doesn't mean anything once
  // grouped by Focus Area (a focus area isn't a single owner who could
  // prioritize across teams), so that grouping always sorts by start date
  // instead, and the control locks to reflect it rather than silently
  // ignoring whatever the user has it set to.
  const sortModeEffective = groupBy === "focusArea" ? "startDate" : sortMode;

  // Columns actually rendered: one per selected (year, month), in
  // chronological order; Backlog forced last whenever it's part of the
  // selection (or the default/unfiltered view) -- never wherever the user
  // happened to click it.
  const activeColumns = useMemo(() => {
    const chosen = columnFilter.length === 0 ? DEFAULT_COLUMN_VALUES : columnFilter;
    const monthYears = chosen
      .filter((v) => v !== "backlog")
      .map((v) => {
        const [y, m] = v.split("-").map(Number);
        return { year: y, month: m };
      })
      .sort((a, b) => a.year - b.year || a.month - b.month);
    const cols = monthYears.map(({ year, month }) => ({
      type: "month",
      year,
      month,
      value: `${year}-${month}`,
      label: `${MONTH_NAMES[month - 1]} ${year}`,
    }));
    if (chosen.includes("backlog")) cols.push({ type: "backlog", value: "backlog", label: "Backlog" });
    return cols;
  }, [columnFilter]);

  const todayColIndex = activeColumns.findIndex(
    (c) => c.type === "month" && c.year === TODAY.getFullYear() && c.month === TODAY.getMonth() + 1
  );

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return initiatives.filter((i) => {
      if (i.archived) return false;
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
  //
  // Within a group: Completed initiatives are never manually prioritized --
  // they always sort first, earliest completion month first (then title).
  // Backlog/In Development initiatives follow, ordered either by their
  // manual drag priority (`sortMode === "priority"`, the array's natural
  // order -- see `dropReorder` below) or by scheduled start date.
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
      const completed = items
        .filter((i) => i.status === "completed")
        .sort((a, b) => {
          const ae = a.endMonth ? monthIndex(a.endYear, a.endMonth) : Infinity;
          const be = b.endMonth ? monthIndex(b.endYear, b.endMonth) : Infinity;
          return ae - be || a.title.localeCompare(b.title);
        });
      let active = items.filter((i) => i.status !== "completed");
      if (sortModeEffective === "startDate") {
        active = [...active].sort((a, b) => {
          const as = a.startMonth ? monthIndex(a.startYear, a.startMonth) : Infinity;
          const bs = b.startMonth ? monthIndex(b.startYear, b.startMonth) : Infinity;
          return as - bs || a.title.localeCompare(b.title);
        });
      }
      const ordered = [...completed, ...active];
      out.push({ type: "group", key: `group-${label}`, label, count: ordered.length, counts: countByStatus(ordered) });
      for (const item of ordered) out.push({ type: "item", key: `item-${item.id}`, item });
    }
    return out;
  }, [visible, primaryField, primaryOrder, primaryFallback, sortModeEffective]);

  const totalCounts = useMemo(() => countByStatus(visible), [visible]);

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

  const archive = async (id) => {
    const res = await fetch(`/api/initiatives/${id}/archive`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: true }),
    });
    const j = await res.json();
    if (!res.ok || !j.ok) throw new Error(j.error || "Something went wrong. Please try again.");
    onUpsert(j.initiative);
  };

  // Only reorderable when grouped by Team, sorting by priority (dragging
  // wouldn't mean anything under a derived sort like start date), and only
  // for Backlog/In Development items -- Completed initiatives are never
  // manually prioritized, they're always ordered by completion date (see
  // `rows` above).
  const reorderable = groupBy === "team" && sortModeEffective === "priority";

  // Drop = insert the dragged item just before the drop target, within
  // whichever team they both belong to. Reordered against the team's FULL
  // active (non-completed) roster (`initiatives`, not the filtered
  // `visible`/`rows`) -- otherwise a teammate hidden by the active filters
  // (a different status, a month outside the current range, ...) would
  // keep its old sort_order while the visible items around it get
  // renumbered, so it could land in a completely different spot the next
  // time a filter change brings it back into view. Using the full roster
  // means only the dragged item actually moves; every hidden sibling keeps
  // its exact relative position.
  const dropReorder = (draggedId, targetId) => {
    if (draggedId === targetId) return;
    const draggedItem = visible.find((i) => i.id === draggedId);
    const targetItem = visible.find((i) => i.id === targetId);
    if (!draggedItem || !targetItem) return;
    if (draggedItem.status === "completed" || targetItem.status === "completed") return;
    const groupKey = draggedItem.team || "(No team)";
    if ((targetItem.team || "(No team)") !== groupKey) return; // dropped outside its own team -- ignore

    const fullTeamIds = initiatives
      .filter((i) => (i.team || "(No team)") === groupKey && i.status !== "completed")
      .map((i) => i.id);
    const without = fullTeamIds.filter((id) => id !== draggedId);
    const targetIdx = without.indexOf(targetId);
    const nextIds = [...without.slice(0, targetIdx), draggedId, ...without.slice(targetIdx)];
    guard(async () => {
      const byId = new Map(initiatives.map((i) => [i.id, i]));
      try {
        const res = await fetch("/api/initiatives/reorder", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: nextIds }),
        });
        const j = await res.json();
        if (!res.ok || !j.ok) throw new Error(j.error || "Something went wrong. Please try again.");
        onReorder(nextIds.map((id) => j.initiatives.find((i) => i.id === id) || byId.get(id)));
      } catch {
        // Reorder is low-stakes and self-evident when it fails to stick --
        // no banner, the row will simply stay put.
      }
    })();
  };

  const bodyRowCount = rows.length;
  const rowsTemplate = `${HEAD_ROW_H}px repeat(${bodyRowCount}, ${BODY_ROW_H}px)`;
  const lastRowLine = bodyRowCount + 2;

  // Which group band should be floating, pinned just under the column
  // headers -- the last group whose own row has scrolled up underneath
  // that pin point. It stays put until the next group's row reaches the
  // same point and takes over, the same way section headers work in a
  // grouped list.
  const groupAnchors = useMemo(() => rows.filter((r) => r.type === "group").map((r) => ({ row: r, idx: rows.indexOf(r) })), [rows]);
  const activeGroup = useMemo(() => {
    let current = null;
    for (const a of groupAnchors) {
      if (a.idx * BODY_ROW_H <= scrollTop) current = a;
      else break;
    }
    return current;
  }, [groupAnchors, scrollTop]);

  return (
    <>
      <Card className="cf-toolbar">
        <div className="rg-toolbar__head">
          <button
            type="button"
            className="rg-toolbar__toggle"
            onClick={() => setFiltersOpen((v) => !v)}
            aria-expanded={filtersOpen}
          >
            <span aria-hidden="true">{filtersOpen ? "▾" : "▸"}</span>
            Filters
          </button>
        </div>
        {filtersOpen && (
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
          <Select
            value={sortModeEffective}
            onChange={(e) => setSortMode(e.target.value)}
            disabled={groupBy === "focusArea"}
            aria-label="Sort by"
          >
            <option value="priority" disabled={groupBy === "focusArea"}>
              Sort by Priority
            </option>
            <option value="startDate">Sort by Start Date</option>
          </Select>
          <Button variant="accent" onClick={guard(() => setEditing({ isNew: true }))}>
            + Add initiative
          </Button>
        </div>
        )}
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
              scroll is kept in sync with the date panel via JS below.
              (A single shared scrolling ancestor for both panels was
              tried instead, but giving the date panel `overflow-x`
              -- needed for its own horizontal scrollbar -- makes it
              register as ITS OWN sticky scroll container per the CSS
              Overflow spec's visible/non-visible axis-pairing rule, which
              breaks its header's vertical stickiness. Two independently
              vertically-scrolling panels, kept in sync, avoids that.) */}
          <div className="rg-sidebar" ref={sidebarRef} onScroll={onSidebarScroll}>
            <div className="rg-sidebargrid" style={{ gridTemplateRows: rowsTemplate }}>
              <div className="rg-headcell rg-headcell--label" style={{ gridRow: 1, gridColumn: 1 }}>
                <span>Initiative</span>
                <StatusCounts counts={totalCounts} total={visible.length} />
              </div>
              <div className="rg-headcell rg-headcell--focus" style={{ gridRow: 1, gridColumn: 2 }}>
                {secondaryLabel}
              </div>
              {rows.map((r, idx) => (
                <SidebarRow
                  key={r.key}
                  row={r}
                  gridRow={idx + 2}
                  secondaryField={secondaryField}
                  guard={guard}
                  setEditing={setEditing}
                  onHover={setHover}
                  reorderable={reorderable}
                  dragIdRef={dragIdRef}
                  dragOverId={dragOverId}
                  setDragOverId={setDragOverId}
                  onDropReorder={dropReorder}
                />
              ))}
              {activeGroup && (
                <div
                  className="rg-teamband rg-teamband--sticky"
                  style={{ gridRow: `2 / ${lastRowLine}`, gridColumn: "1 / -1", alignSelf: "start", top: HEAD_ROW_H }}
                >
                  <span className="rg-teamband__name">{activeGroup.row.label}</span>
                  <StatusCounts counts={activeGroup.row.counts} total={activeGroup.row.count} />
                </div>
              )}
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

              {activeColumns.map((col, i) => (
                <div
                  key={col.value}
                  className={`rg-headcell${i === todayColIndex ? " rg-headcell--now" : ""}`}
                  style={{ gridRow: 1, gridColumn: i + 1 }}
                >
                  {col.label}
                </div>
              ))}

              {rows.map((r, idx) => (
                <DateRow key={r.key} row={r} gridRow={idx + 2} activeColumns={activeColumns} guard={guard} setEditing={setEditing} />
              ))}
              {activeGroup && (
                <div
                  className="rg-teamband rg-teamband--filler rg-teamband--sticky"
                  style={{ gridRow: `2 / ${lastRowLine}`, gridColumn: "1 / -1", alignSelf: "start", top: HEAD_ROW_H }}
                />
              )}
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
          onArchive={archive}
        />
      )}

      {hover && createPortal(<HoverTooltip item={hover.item} anchorRect={hover.rect} />, document.body)}
    </>
  );
}

// Positioned in two passes: first rendered off-screen-safe at its naive
// anchor position so it can be measured, then clamped to stay fully inside
// the viewport (flipping above the anchor, and/or sliding left) instead of
// running off the right/bottom edge, which is unreadable.
function HoverTooltip({ item, anchorRect }) {
  const ref = useRef(null);
  const [style, setStyle] = useState({ top: anchorRect.bottom + 6, left: anchorRect.left, visibility: "hidden" });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const margin = 12;
    const rect = el.getBoundingClientRect();
    let left = anchorRect.left;
    if (left + rect.width > window.innerWidth - margin) {
      left = window.innerWidth - margin - rect.width;
    }
    if (left < margin) left = margin;

    let top = anchorRect.bottom + 6;
    if (top + rect.height > window.innerHeight - margin) {
      const above = anchorRect.top - 6 - rect.height;
      top = above >= margin ? above : Math.max(margin, window.innerHeight - margin - rect.height);
    }
    setStyle({ top, left, visibility: "visible" });
  }, [item, anchorRect]);

  return (
    <div ref={ref} className="rg-tooltip rg-tooltip--portal" role="tooltip" style={style}>
      <div className="rg-tooltip__title">{item.title}</div>
      <dl className="rg-tooltip__facts">
        {initiativeFacts(item).map((f) => (
          <div className={`rg-tooltip__fact${f.wide ? " rg-tooltip__fact--wide" : ""}`} key={f.label}>
            <dt>{f.label}</dt>
            <dd>{f.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function SidebarRow({
  row,
  gridRow,
  secondaryField,
  guard,
  setEditing,
  onHover,
  reorderable,
  dragIdRef,
  dragOverId,
  setDragOverId,
  onDropReorder,
}) {
  if (row.type === "group") {
    return (
      <div className="rg-teamband" style={{ gridRow, gridColumn: "1 / -1" }}>
        <span className="rg-teamband__name">{row.label}</span>
        <StatusCounts counts={row.counts} total={row.count} />
      </div>
    );
  }

  const item = row.item;
  const onEdit = () => guard(() => setEditing({ initiative: item }))();
  const showTooltip = (e) => onHover({ item, rect: e.currentTarget.getBoundingClientRect() });
  const hideTooltip = () => onHover(null);
  // Completed initiatives are never manually prioritized (see `rows` in
  // RoadmapGantt) -- only Backlog/In Development rows can be dragged.
  const canDrag = reorderable && item.status !== "completed";

  // Native HTML5 drag-and-drop -- reordering initiatives within a team
  // group, only available when grouped by Team (see `reorderable` in
  // RoadmapGantt). The dragged id lives in a ref, not state, so dragging
  // itself doesn't trigger re-renders; only the drop-target highlight does.
  const onDragStart = (e) => {
    dragIdRef.current = item.id;
    e.dataTransfer.effectAllowed = "move";
  };
  const onDragOver = (e) => {
    e.preventDefault();
    if (dragOverId !== item.id) setDragOverId(item.id);
  };
  const onDragLeave = () => {
    if (dragOverId === item.id) setDragOverId(null);
  };
  const onDrop = (e) => {
    e.preventDefault();
    setDragOverId(null);
    const draggedId = dragIdRef.current;
    dragIdRef.current = null;
    if (draggedId != null) onDropReorder(draggedId, item.id);
  };
  const onDragEnd = () => {
    dragIdRef.current = null;
    setDragOverId(null);
  };

  // Three separate, clearly distinct controls instead of one row that was
  // simultaneously the drag source, the hover-for-details trigger, and the
  // click-to-edit target -- which made it hard to tell which action you
  // were about to take. Drop handling stays on the row itself so the whole
  // row's width is a valid drop target, not just the handle.
  return (
    <Fragment>
      <div
        className={`rg-labelcell rg-labelcell--${item.status}${dragOverId === item.id ? " rg-labelcell--dragover" : ""}`}
        style={{ gridRow, gridColumn: 1 }}
        onDragOver={canDrag ? onDragOver : undefined}
        onDragLeave={canDrag ? onDragLeave : undefined}
        onDrop={canDrag ? onDrop : undefined}
      >
        {canDrag && (
          <span
            className="rg-labelcell__handle"
            aria-hidden="true"
            title="Drag to reprioritize"
            draggable
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
          >
            ⠿
          </span>
        )}
        <button
          type="button"
          className="rg-labelcell__info"
          aria-label={`View details: ${item.title}`}
          title="View details"
          onMouseEnter={showTooltip}
          onMouseLeave={hideTooltip}
          onFocus={showTooltip}
          onBlur={hideTooltip}
          onClick={showTooltip}
        >
          ⓘ
        </button>
        <button type="button" className="rg-labelcell__titlebtn" onClick={onEdit} title="Click to edit">
          <span className="rg-labelcell__text">{item.title}</span>
        </button>
      </div>
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
