import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MONTH_NAMES, STATUS_LABEL } from "../lib/text.js";
import "./InitiativeDetails.css";

// Every field on an initiative, for the hover/click details card -- shared
// by the Gantt, Review queue, Rejected archive, and Archived page, so
// "view details" always shows the same thing no matter where you are.
export function initiativeFacts(item) {
  const fmtDate = (v) => (v ? new Date(v).toLocaleDateString() : "—");
  const schedule =
    item.startMonth && item.endMonth
      ? `${MONTH_NAMES[item.startMonth - 1]} ${item.startYear} – ${MONTH_NAMES[item.endMonth - 1]} ${item.endYear}`
      : "Unscheduled (Backlog)";
  // `wide: true` facts always take the full row (long free text); the rest
  // pair up two-per-row so the whole card stays short enough to fit on
  // screen without needing to scroll -- see .idet-facts.
  return [
    { label: "Team", value: item.team || "—" },
    { label: "Focus area", value: item.focusArea || "—" },
    { label: "Status", value: STATUS_LABEL[item.status] || item.status },
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
    {
      label: "Notes",
      value: item.notes?.length ? item.notes.map((n) => n.body).join(" | ") : "—",
      wide: true,
    },
    ...(item.archived
      ? [
          { label: "Archived by", value: item.archivedBy || "—" },
          { label: "Archived", value: fmtDate(item.archivedAt) },
        ]
      : []),
  ];
}

// Positioned in two passes: first rendered off-screen-safe at its naive
// anchor position so it can be measured, then clamped to stay fully inside
// the viewport (flipping above the anchor, and/or sliding left) instead of
// running off the right/bottom edge, which is unreadable.
export function HoverTooltip({ item, anchorRect }) {
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
    <div ref={ref} className="idet-tooltip" role="tooltip" style={style}>
      <div className="idet-tooltip__title">{item.title}</div>
      <dl className="idet-facts">
        {initiativeFacts(item).map((f) => (
          <div className={`idet-fact${f.wide ? " idet-fact--wide" : ""}`} key={f.label}>
            <dt>{f.label}</dt>
            <dd>{f.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

// Shared hover/click-to-view-details behavior: `show(item)` returns an
// event handler to attach to onMouseEnter/onFocus/onClick, `hide` to
// onMouseLeave/onBlur, and `portal` is what to render (anywhere) to
// actually show the tooltip while it's open.
export function useInitiativeTooltip() {
  const [hover, setHover] = useState(null);
  const show = (item) => (e) => setHover({ item, rect: e.currentTarget.getBoundingClientRect() });
  const hide = () => setHover(null);
  const portal = hover ? createPortal(<HoverTooltip item={hover.item} anchorRect={hover.rect} />, document.body) : null;
  return { hover, show, hide, portal };
}

// A small circled-i button -- the standalone "view details" affordance
// used on card-style rows (Review queue, Rejected, Archived) that don't
// have the Gantt's own .rg-labelcell__info.
export function InfoButton({ item, show, hide }) {
  return (
    <button
      type="button"
      className="idet-infobtn"
      aria-label={`View details: ${item.title}`}
      title="View details"
      onMouseEnter={show(item)}
      onMouseLeave={hide}
      onFocus={show(item)}
      onBlur={hide}
      onClick={show(item)}
    >
      ⓘ
    </button>
  );
}
