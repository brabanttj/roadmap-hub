import { useEffect, useState } from "react";
import { Card, Icon, Select, MultiSelect } from "../components/ui/index.js";
import RoadmapGantt, { EXTRA_COLUMN_OPTIONS } from "./RoadmapGantt.jsx";
import IdeaForm from "./IdeaForm.jsx";
import ReviewQueue from "./ReviewQueue.jsx";
import RejectedArchive from "./RejectedArchive.jsx";
import ArchivedArchive from "./ArchivedArchive.jsx";
import ManageTaxonomy from "./ManageTaxonomy.jsx";
import ExportModal from "./ExportModal.jsx";
import "./RoadmapPlanner.css";

const FRIENDLY_ERROR = "Something went wrong. Please try again.";

// Cycled in the header subtext, purely for morale. Rotates on a timer --
// see the effect below.
const ROADMAP_QUOTES = [
  "A roadmap is just a list of future arguments, sorted by quarter.",
  "Roadmaps are promises written in pencil—until someone screenshots the slide.",
  "A roadmap is just a list of future disappointments, organized by quarter.",
  "Our roadmap is customer-driven—by whichever customer emailed most recently.",
  "Roadmaps are promises written in pencil, presented in PowerPoint, and remembered as contracts.",
  "The roadmap is strategic until Sales shares it with a prospect.",
  "Every roadmap has three horizons: now, next, and ‘why is this still on here?’",
  "A roadmap is how product says ‘maybe’ in a font executives can understand.",
  "We don’t miss roadmap dates; we discover new definitions of ‘Q3.’",
  "The roadmap is a living document. Mostly because it keeps getting resurrected.",
  "Nothing is more permanent than a temporary roadmap commitment.",
  "Product roadmaps: where confidence is high, estimates are low, and dependencies are invisible.",
];

export default function RoadmapPlanner() {
  const [focusAreas, setFocusAreas] = useState([]);
  const [teams, setTeams] = useState([]);
  const [initiatives, setInitiatives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [section, setSection] = useState("initiatives"); // initiatives | settings
  const [view, setView] = useState("roadmap"); // roadmap | submit | review | rejected | archived
  const [exporting, setExporting] = useState(false);
  const [quoteIndex, setQuoteIndex] = useState(0);

  // Roadmap display settings -- how the Gantt groups/sorts/columns itself.
  // Owned here (not inside RoadmapGantt) since they now live under the
  // Settings section rather than the Roadmap view itself.
  const [groupBy, setGroupBy] = useState("team"); // "team" | "focusArea"
  const [sortMode, setSortMode] = useState("priority"); // "priority" | "startDate"
  const [extraColumns, setExtraColumns] = useState([]); // [] = none of the optional columns
  const [showCounts, setShowCounts] = useState(true);
  // Priority is a per-team drag order -- meaningless once grouped by Focus
  // Area, so that grouping always sorts by start date instead.
  const sortModeEffective = groupBy === "focusArea" ? "startDate" : sortMode;

  useEffect(() => {
    const id = setInterval(() => {
      setQuoteIndex((i) => (i + 1) % ROADMAP_QUOTES.length);
    }, 5000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    fetch("/api/bootstrap")
      .then((res) => res.json())
      .then((j) => {
        if (!j.ok) throw new Error(j.error || FRIENDLY_ERROR);
        setFocusAreas(j.focusAreas);
        setTeams(j.teams);
        setInitiatives(j.initiatives);
      })
      .catch((err) => setError(err.message || FRIENDLY_ERROR))
      .finally(() => setLoading(false));
  }, []);

  const upsertInitiative = (initiative) =>
    setInitiatives((prev) => {
      const idx = prev.findIndex((i) => i.id === initiative.id);
      if (idx === -1) return [...prev, initiative];
      const next = [...prev];
      next[idx] = initiative;
      return next;
    });

  const removeInitiative = (id) =>
    setInitiatives((prev) => prev.filter((i) => i.id !== id));

  // Drag-to-reorder within a team group: `orderedInitiatives` is that one
  // group's items in their new order. Every other item keeps its current
  // slot in the array -- only the positions belonging to this group's ids
  // get filled in with the new order.
  const reorderInitiatives = (orderedInitiatives) => {
    const byId = new Map(orderedInitiatives.map((i) => [i.id, i]));
    setInitiatives((prev) => {
      let next = 0;
      return prev.map((item) => (byId.has(item.id) ? orderedInitiatives[next++] : item));
    });
  };

  const archiveInitiative = async (id, archived = true) => {
    const res = await fetch(`/api/initiatives/${id}/archive`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived }),
    });
    const j = await res.json();
    if (!res.ok || !j.ok) throw new Error(j.error || FRIENDLY_ERROR);
    upsertInitiative(j.initiative);
  };

  const ideaCount = initiatives.filter((i) => i.status === "idea" && !i.archived).length;
  const rejectedCount = initiatives.filter((i) => i.status === "rejected" && !i.archived).length;
  const archivedCount = initiatives.filter((i) => i.archived).length;

  if (loading) {
    return (
      <div className="rp-shell">
        <Card className="cf-empty-results">
          <p className="cf-empty__title">Loading…</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="rp-shell">
      <div className="rp-leafmark" aria-hidden="true">
        <Icon name="brandLeaf" preserveAspectRatio="xMidYMid meet" />
      </div>
      <header className="rp-header" title={ROADMAP_QUOTES[quoteIndex]}>
        <span className="rp-header__crumb">LendingTree Insurance Division</span>
        <span className="rp-header__sep" aria-hidden="true">/</span>
        <span className="rp-header__crumb">Product Management</span>
        <span className="rp-header__sep" aria-hidden="true">/</span>
        <span className="rp-header__title">Roadmap</span>
      </header>

      {error && (
        <div className="mt-banner" role="alert">
          <span className="mt-banner__icon" aria-hidden="true">⚠️</span>
          <span>{error}</span>
        </div>
      )}

      <div className="rp-sections" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={section === "initiatives"}
          className={`rp-section${section === "initiatives" ? " rp-section--on" : ""}`}
          onClick={() => setSection("initiatives")}
        >
          Initiatives
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={section === "settings"}
          className={`rp-section${section === "settings" ? " rp-section--on" : ""}`}
          onClick={() => setSection("settings")}
        >
          Settings
        </button>
      </div>

      {section === "initiatives" && (
        <div className="cf-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={view === "roadmap"}
            className={`cf-tab${view === "roadmap" ? " cf-tab--on" : ""}`}
            onClick={() => setView("roadmap")}
          >
            Roadmap
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === "submit"}
            className={`cf-tab${view === "submit" ? " cf-tab--on" : ""}`}
            onClick={() => setView("submit")}
          >
            Submit an idea
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === "review"}
            className={`cf-tab${view === "review" ? " cf-tab--on" : ""}`}
            onClick={() => setView("review")}
          >
            Review queue <span className="cf-tab__n">{ideaCount}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === "rejected"}
            className={`cf-tab${view === "rejected" ? " cf-tab--on" : ""}`}
            onClick={() => setView("rejected")}
          >
            Rejected <span className="cf-tab__n">{rejectedCount}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === "archived"}
            className={`cf-tab${view === "archived" ? " cf-tab--on" : ""}`}
            onClick={() => setView("archived")}
          >
            Archived <span className="cf-tab__n">{archivedCount}</span>
          </button>
          <button type="button" className="cf-tab" onClick={() => setExporting(true)}>
            Export to Excel
          </button>
        </div>
      )}

      {section === "initiatives" && view === "roadmap" && (
        <RoadmapGantt
          initiatives={initiatives}
          focusAreas={focusAreas}
          teams={teams}
          onUpsert={upsertInitiative}
          onRemove={removeInitiative}
          onReorder={reorderInitiatives}
          groupBy={groupBy}
          sortMode={sortMode}
          extraColumns={extraColumns}
          showCounts={showCounts}
        />
      )}
      {section === "initiatives" && view === "submit" && (
        <IdeaForm focusAreas={focusAreas} onSubmitted={upsertInitiative} />
      )}
      {section === "initiatives" && view === "review" && (
        <ReviewQueue
          initiatives={initiatives.filter((i) => i.status === "idea" && !i.archived)}
          teams={teams}
          onUpsert={upsertInitiative}
          onArchive={archiveInitiative}
        />
      )}
      {section === "initiatives" && view === "rejected" && (
        <RejectedArchive
          initiatives={initiatives.filter((i) => i.status === "rejected" && !i.archived)}
          onArchive={archiveInitiative}
        />
      )}
      {section === "initiatives" && view === "archived" && (
        <ArchivedArchive
          initiatives={initiatives.filter((i) => i.archived)}
          onUnarchive={(id) => archiveInitiative(id, false)}
        />
      )}

      {section === "settings" && (
        <>
          <Card className="cf-toolbar rp-settings">
            <h3 className="rp-settings__title">Roadmap display</h3>
            <div className="rg-toolbar__grid">
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
              <MultiSelect
                label="Columns"
                options={EXTRA_COLUMN_OPTIONS}
                selected={extraColumns}
                onChange={setExtraColumns}
              />
              <label className="rg-settings__checkbox">
                <input type="checkbox" checked={showCounts} onChange={(e) => setShowCounts(e.target.checked)} />
                Show initiative counts
              </label>
            </div>
          </Card>
          <ManageTaxonomy
            focusAreas={focusAreas}
            teams={teams}
            setFocusAreas={setFocusAreas}
            setTeams={setTeams}
          />
        </>
      )}

      {exporting && <ExportModal initiatives={initiatives} onClose={() => setExporting(false)} />}
    </div>
  );
}
