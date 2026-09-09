import { Card, Badge, Button, IllustrationBadge } from "../components/ui/index.js";
import { usePasswordGate } from "../lib/PasswordGate.jsx";
import "./ReviewQueue.css"; // reuses .rq-card__* (title/badges/desc/meta) and .rq-list
import "./RejectedArchive.css";

export default function RejectedArchive({ initiatives, onArchive }) {
  const guard = usePasswordGate();
  return (
    <>
      <p className="rb-intro">
        Ideas that were rejected, with the reviewer's reason. Nothing here
        can be edited — resubmit as a new idea if it should be reconsidered.
      </p>

      {initiatives.length === 0 ? (
        <Card className="cf-empty-results">
          <IllustrationBadge icon="binocular" tone="blue" size={72} />
          <p className="cf-empty__title">Nothing rejected</p>
          <p className="cf-empty__sub">Rejected ideas will show up here.</p>
        </Card>
      ) : (
        <div className="rq-list">
          {initiatives.map((i) => (
            <Card key={i.id} className="ra-card">
              <div className="rq-card__head">
                <h3 className="rq-card__title">{i.title}</h3>
                <div className="rq-card__badges">
                  {i.focusArea && <Badge tone="brand">{i.focusArea}</Badge>}
                  {i.team && <Badge tone="neutral">{i.team}</Badge>}
                </div>
              </div>
              {i.summary && <p className="rq-card__desc">{i.summary}</p>}
              <div className="rq-card__meta">
                {i.submittedBy && <span>Submitted by {i.submittedBy}</span>}
                {i.submittedAt && <span>{new Date(i.submittedAt).toLocaleDateString()}</span>}
              </div>
              <div className="ra-reason">
                <span className="ra-reason__label">Rejection reason</span>
                <p className="ra-reason__text">{i.reviewerNotes}</p>
                {i.reviewedBy && (
                  <span className="ra-reason__by">
                    — {i.reviewedBy}
                    {i.reviewedAt && `, ${new Date(i.reviewedAt).toLocaleDateString()}`}
                  </span>
                )}
              </div>
              <div className="rq-card__actions">
                <Button variant="ghost" size="sm" onClick={guard(() => onArchive(i.id))}>
                  Archive
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
