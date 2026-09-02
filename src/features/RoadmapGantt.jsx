import { useMemo, useState } from "react";
import { Card, Input, Select, Button, IllustrationBadge } from "../components/ui/index.js";
import { usePasswordGate } from "../lib/PasswordGate.jsx";
import { MONTH_NAMES, STATUS_LABEL } from "../lib/text.js";
import InitiativeModal from "./InitiativeModal.jsx";
import "./RoadmapGantt.css";

const ALL = "All";
// Excluded from the Gantt entirely -- ideas haven't been reviewed yet, and
// rejected ideas never became roadmap work.
const VISIBLE_STATUSES = new Set(["backlog", "planned", "in_progress", "completed"]);

export default function RoadmapGantt({ initiatives, focusAreas, teams, onUpsert, onRemove }) {
  const guard = usePasswordGate();
  const [search, setSearch] = useState("");
  const [focusAreaFilter, setFocusAreaFilter] = useState(ALL);
  const [editing, setEditing] = useState(null); // { initiative } | { isNew: true } | null

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return initiatives.filter((i) => {
      if (!VISIBLE_STATUSES.has(i.status)) return false;
      if (focusAreaFilter !== ALL && i.focusArea !== focusAreaFilter) return false;
      if (q && !i.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [initiatives, search, focusAreaFilter]);

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

      {groups.length === 0 ? (
        <Card className="cf-empty-results">
          <IllustrationBadge icon="target" tone="blue" size={72} />
          <p className="cf-empty__title">No initiatives on the roadmap yet</p>
          <p className="cf-empty__sub">
            Approve an idea from the review queue, or add one directly.
          </p>
        </Card>
      ) : (
        <div className="rg-scroll lt-scroll">
          <div className="rg-grid">
            <div className="rg-headcell rg-headcell--label">Initiative</div>
            <div className="rg-headcell">Backlog</div>
            {MONTH_NAMES.map((m) => (
              <div key={m} className="rg-headcell">
                {m}
              </div>
            ))}

            {groups.map((g) => (
              // Fragments, not divs: CSS Grid only treats *direct element
              // children* of .rg-grid as grid items, so any real wrapper div
              // here would break every descendant's column alignment.
              <FocusAreaGroup key={g.focusArea} group={g} guard={guard} setEditing={setEditing} />
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

function FocusAreaGroup({ group, guard, setEditing }) {
  return (
    <>
      <div className="rg-groupband" style={{ gridColumn: "1 / -1" }}>
        {group.focusArea}
      </div>
      {group.teams.map((t) => (
        <TeamGroup key={t.team} team={t.team} items={t.items} guard={guard} setEditing={setEditing} />
      ))}
    </>
  );
}

function TeamGroup({ team, items, guard, setEditing }) {
  return (
    <>
      <div className="rg-teamband" style={{ gridColumn: "1 / -1" }}>
        {team}
      </div>
      {items.map((item) => (
        <GanttRow
          key={item.id}
          item={item}
          onEdit={() => guard(() => setEditing({ initiative: item }))()}
        />
      ))}
    </>
  );
}

function GanttRow({ item, onEdit }) {
  const inBacklog = item.startMonth == null || item.endMonth == null;
  const startCol = inBacklog ? 2 : 2 + item.startMonth;
  const endCol = inBacklog ? 3 : 2 + item.endMonth + 1;

  return (
    <>
      <button type="button" className="rg-labelcell" onClick={onEdit} title={item.title}>
        {item.title}
        {item.completed && <span className="rg-labelcell__done" aria-label="Completed">✓</span>}
      </button>
      <div
        className={`rg-bar rg-bar--${item.status}`}
        style={{ gridColumn: `${startCol} / ${endCol}` }}
        onClick={onEdit}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onEdit()}
        title={`${item.title} — ${item.status}`}
      >
        <span className="rg-bar__label">{item.title}</span>
      </div>
    </>
  );
}
