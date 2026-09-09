import { Card, Badge, Button, IllustrationBadge } from "../components/ui/index.js";
import { usePasswordGate } from "../lib/PasswordGate.jsx";
import { STATUS_LABEL } from "../lib/text.js";
import { InfoButton, useInitiativeTooltip } from "./InitiativeDetails.jsx";
import "./ReviewQueue.css"; // reuses .rq-card__* (title/badges/desc/meta) and .rq-list
import "./ArchivedArchive.css";

export default function ArchivedArchive({ initiatives, onUnarchive }) {
  const guard = usePasswordGate();
  const { show: showTooltip, hide: hideTooltip, portal: tooltipPortal } = useInitiativeTooltip();

  return (
    <>
      <p className="rb-intro">
        Initiatives archived out of every other view -- ideas, backlog, in
        development, completed, even rejected can end up here. Unarchiving
        puts one back exactly where its status says it belongs.
      </p>

      {initiatives.length === 0 ? (
        <Card className="cf-empty-results">
          <IllustrationBadge icon="binocular" tone="blue" size={72} />
          <p className="cf-empty__title">Nothing archived</p>
          <p className="cf-empty__sub">Archived initiatives will show up here.</p>
        </Card>
      ) : (
        <div className="rq-list">
          {initiatives.map((i) => (
            <Card key={i.id} className="aa-card">
              <div className="rq-card__head">
                <div className="rq-card__titlewrap">
                  <h3 className="rq-card__title">{i.title}</h3>
                  <InfoButton item={i} show={showTooltip} hide={hideTooltip} />
                </div>
                <div className="rq-card__badges">
                  <Badge tone="neutral">{STATUS_LABEL[i.status] || i.status}</Badge>
                  {i.team && <Badge tone="neutral">{i.team}</Badge>}
                </div>
              </div>
              {i.summary && <p className="rq-card__desc">{i.summary}</p>}
              <div className="rq-card__meta">
                <span>
                  Archived
                  {i.archivedBy && ` by ${i.archivedBy}`}
                  {i.archivedAt && ` — ${new Date(i.archivedAt).toLocaleDateString()}`}
                </span>
              </div>
              <div className="rq-card__actions">
                <Button variant="secondary" size="sm" onClick={guard(() => onUnarchive(i.id))}>
                  Unarchive
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {tooltipPortal}
    </>
  );
}
