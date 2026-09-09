import { useEffect, useState } from "react";
import { Card, Icon } from "../components/ui/index.js";
import RoadmapGantt from "./RoadmapGantt.jsx";
import IdeaForm from "./IdeaForm.jsx";
import ReviewQueue from "./ReviewQueue.jsx";
import RejectedArchive from "./RejectedArchive.jsx";
import ManageTaxonomy from "./ManageTaxonomy.jsx";
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
  const [view, setView] = useState("roadmap"); // roadmap | submit | review | taxonomy
  const [quoteIndex, setQuoteIndex] = useState(0);

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

  const ideaCount = initiatives.filter((i) => i.status === "idea").length;
  const rejectedCount = initiatives.filter((i) => i.status === "rejected").length;

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
          aria-selected={view === "taxonomy"}
          className={`cf-tab${view === "taxonomy" ? " cf-tab--on" : ""}`}
          onClick={() => setView("taxonomy")}
        >
          Focus Areas &amp; Teams
        </button>
      </div>

      {view === "roadmap" && (
        <RoadmapGantt
          initiatives={initiatives}
          focusAreas={focusAreas}
          teams={teams}
          onUpsert={upsertInitiative}
          onRemove={removeInitiative}
        />
      )}
      {view === "submit" && (
        <IdeaForm focusAreas={focusAreas} onSubmitted={upsertInitiative} />
      )}
      {view === "review" && (
        <ReviewQueue
          initiatives={initiatives.filter((i) => i.status === "idea")}
          teams={teams}
          onUpsert={upsertInitiative}
        />
      )}
      {view === "rejected" && (
        <RejectedArchive initiatives={initiatives.filter((i) => i.status === "rejected")} />
      )}
      {view === "taxonomy" && (
        <ManageTaxonomy
          focusAreas={focusAreas}
          teams={teams}
          setFocusAreas={setFocusAreas}
          setTeams={setTeams}
        />
      )}
    </div>
  );
}
