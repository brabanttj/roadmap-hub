import { useEffect, useState } from "react";
import { Card } from "../components/ui/index.js";
import RoadmapGantt from "./RoadmapGantt.jsx";
import IdeaForm from "./IdeaForm.jsx";
import ReviewQueue from "./ReviewQueue.jsx";
import ManageTaxonomy from "./ManageTaxonomy.jsx";
import "./RoadmapPlanner.css";

const FRIENDLY_ERROR = "Something went wrong. Please try again.";

export default function RoadmapPlanner() {
  const [focusAreas, setFocusAreas] = useState([]);
  const [teams, setTeams] = useState([]);
  const [initiatives, setInitiatives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [view, setView] = useState("roadmap"); // roadmap | submit | review | taxonomy

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
      <header className="rp-header">
        <span className="lt-eyebrow">Roadmap Hub</span>
        <h1 className="rp-header__title">Ideas in, roadmap out</h1>
        <p className="rp-header__sub">
          Submit ideas, review and approve them, and manage the roadmap they
          become.
        </p>
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
        <IdeaForm
          focusAreas={focusAreas}
          teams={teams}
          onSubmitted={upsertInitiative}
        />
      )}
      {view === "review" && (
        <ReviewQueue
          initiatives={initiatives.filter((i) => i.status === "idea")}
          onUpsert={upsertInitiative}
        />
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
