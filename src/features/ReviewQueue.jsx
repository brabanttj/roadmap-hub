import { useMemo, useState } from "react";
import { Card, Badge, Button, Modal, Input, IllustrationBadge } from "../components/ui/index.js";
import { usePasswordGate } from "../lib/PasswordGate.jsx";
import "./ReviewQueue.css";

const FRIENDLY_ERROR = "Something went wrong. Please try again.";

export default function ReviewQueue({ initiatives, teams, onUpsert, onArchive }) {
  const guard = usePasswordGate();
  const [rejecting, setRejecting] = useState(null); // initiative pending rejection notes
  const [notes, setNotes] = useState("");
  const [reviewedBy, setReviewedBy] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");

  const teamOrder = teams.map((t) => t.name);
  const rank = (value) => {
    const idx = teamOrder.indexOf(value);
    return idx === -1 ? Infinity : idx;
  };

  const groups = useMemo(() => {
    const byTeam = new Map();
    for (const i of initiatives) {
      const team = i.team || "(No team)";
      if (!byTeam.has(team)) byTeam.set(team, []);
      byTeam.get(team).push(i);
    }
    return [...byTeam.entries()].sort(
      (a, b) => rank(a[0]) - rank(b[0]) || a[0].localeCompare(b[0])
    );
  }, [initiatives, teamOrder]);

  const review = async (id, decision, extraNotes = "") => {
    setBusyId(id);
    setError("");
    try {
      const res = await fetch(`/api/initiatives/${id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, notes: extraNotes, reviewedBy }),
      });
      const j = await res.json();
      if (!res.ok || !j.ok) throw new Error(j.error || FRIENDLY_ERROR);
      onUpsert(j.initiative);
      setRejecting(null);
      setNotes("");
    } catch (err) {
      setError(err.message || FRIENDLY_ERROR);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <p className="rb-intro">
        Ideas waiting for review, grouped by team. Approve moves an idea to
        the Backlog; reject requires a reason, and moves it to the Rejected
        archive.
      </p>

      {error && (
        <div className="mt-banner" role="alert">
          <span className="mt-banner__icon" aria-hidden="true">⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {initiatives.length === 0 ? (
        <Card className="cf-empty-results">
          <IllustrationBadge icon="lightBulb" tone="blue" size={72} />
          <p className="cf-empty__title">Nothing to review</p>
          <p className="cf-empty__sub">New ideas will show up here.</p>
        </Card>
      ) : (
        groups.map(([team, items]) => (
          <section key={team} className="rq-teamsection">
            <h3 className="rq-teamsection__title">
              {team} <span className="cf-tab__n">{items.length}</span>
            </h3>
            <div className="rq-list">
              {items.map((i) => (
                <Card key={i.id} className="rq-card">
                  <div className="rq-card__head">
                    <h3 className="rq-card__title">{i.title}</h3>
                    <div className="rq-card__badges">
                      {i.focusArea && <Badge tone="brand">{i.focusArea}</Badge>}
                    </div>
                  </div>
                  {i.summary && <p className="rq-card__desc">{i.summary}</p>}
                  <div className="rq-card__meta">
                    {i.submittedBy && <span>Submitted by {i.submittedBy}</span>}
                    {i.submittedAt && (
                      <span>{new Date(i.submittedAt).toLocaleDateString()}</span>
                    )}
                  </div>
                  <div className="rq-card__actions">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busyId === i.id}
                      onClick={guard(() => onArchive(i.id))}
                    >
                      Archive
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={busyId === i.id}
                      onClick={guard(() => setRejecting(i))}
                    >
                      Reject
                    </Button>
                    <Button
                      variant="accent"
                      size="sm"
                      disabled={busyId === i.id}
                      onClick={guard(() => review(i.id, "approve"))}
                    >
                      {busyId === i.id ? "Approving…" : "Approve to Backlog"}
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </section>
        ))
      )}

      {rejecting && (
        <Modal title={`Reject "${rejecting.title}"?`} onClose={() => setRejecting(null)}>
          <p className="mt-confirm__body">
            A rejection reason is required — it's shown next to this idea in
            the Rejected archive.
          </p>
          <Input
            label="Reviewer"
            placeholder="Your name"
            value={reviewedBy}
            onChange={(e) => setReviewedBy(e.target.value)}
          />
          <label className="lt-field" style={{ marginTop: "var(--lt-space-3)" }}>
            <span className="lt-field__label">Rejection reason *</span>
            <textarea
              className="lt-input"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              required
              autoFocus
            />
          </label>
          <div className="mt-confirm__actions">
            <Button variant="secondary" onClick={() => setRejecting(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={!notes.trim() || busyId === rejecting.id}
              onClick={() => review(rejecting.id, "reject", notes.trim())}
            >
              {busyId === rejecting.id ? "Rejecting…" : "Reject idea"}
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
