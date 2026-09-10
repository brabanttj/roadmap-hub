import { MONTH_NAMES, STATUS_LABEL } from "./text.js";

const monthIndex = (year, month) => year * 12 + (month - 1);

// Only actual roadmap work -- never ideas awaiting review, rejected ideas,
// or archived initiatives, regardless of the date range chosen below.
const EXPORTABLE_STATUSES = ["backlog", "in_development", "completed"];

// Both Team and Focus Area are always included as their own columns (not
// just whichever the on-screen view happens to be grouped by), so a pivot
// table built from this file can slice by either dimension.
const COLUMNS = [
  { key: "team", header: "Team" },
  { key: "focusArea", header: "Focus Area" },
  { key: "title", header: "Initiative" },
  { key: "status", header: "Status" },
  { key: "completed", header: "Completed" },
  { key: "startMonth", header: "Start Month" },
  { key: "startYear", header: "Start Year" },
  { key: "endMonth", header: "End Month" },
  { key: "endYear", header: "End Year" },
  { key: "summary", header: "Summary" },
  { key: "currentState", header: "Current State" },
  { key: "futureState", header: "Future State" },
  { key: "successMetrics", header: "Success Metrics" },
  { key: "impactedTeams", header: "Impacted Teams" },
  { key: "impactedProducts", header: "Impacted Products" },
  { key: "submittedBy", header: "Submitted By" },
  { key: "submittedAt", header: "Submitted" },
  { key: "reviewedBy", header: "Reviewed By" },
  { key: "reviewedAt", header: "Reviewed" },
  { key: "reviewerNotes", header: "Reviewer Notes" },
];

function fmtDate(v) {
  return v ? new Date(v).toLocaleDateString() : "";
}

function toRow(item) {
  return {
    team: item.team || "",
    focusArea: item.focusArea || "",
    title: item.title,
    status: STATUS_LABEL[item.status] || item.status,
    completed: item.completed ? "Yes" : "No",
    startMonth: item.startMonth ? MONTH_NAMES[item.startMonth - 1] : "",
    startYear: item.startYear || "",
    endMonth: item.endMonth ? MONTH_NAMES[item.endMonth - 1] : "",
    endYear: item.endYear || "",
    summary: item.summary || "",
    currentState: item.currentState || "",
    futureState: item.futureState || "",
    successMetrics: item.successMetrics || "",
    impactedTeams: (item.impactedTeams || []).join(", "),
    impactedProducts: (item.impactedProducts || []).join(", "),
    submittedBy: item.submittedBy || "",
    submittedAt: fmtDate(item.submittedAt),
    reviewedBy: item.reviewedBy || "",
    reviewedAt: fmtDate(item.reviewedAt),
    reviewerNotes: item.reviewerNotes || "",
  };
}

// `range` is { startYear, startMonth, endYear, endMonth } -- any of the
// four may be omitted, meaning "no lower/upper bound" on that end.
// Unscheduled (Backlog) initiatives have no date to filter on, so they're
// always included regardless of the chosen range -- consistent with how
// the Gantt's own Months filter always shows Backlog no matter which
// months are picked.
// `xlsx` is a ~300KB dependency used nowhere else in the app -- loaded on
// demand here instead of bundled into the initial page weight every visitor
// pays for whether or not they ever click Export.
export async function exportRoadmapToExcel(initiatives, range = {}) {
  const XLSX = await import("xlsx");
  const { startYear, startMonth, endYear, endMonth } = range;
  const lower = startYear && startMonth ? monthIndex(startYear, startMonth) : -Infinity;
  const upper = endYear && endMonth ? monthIndex(endYear, endMonth) : Infinity;

  const rows = initiatives
    .filter((i) => EXPORTABLE_STATUSES.includes(i.status) && !i.archived)
    .filter((i) => {
      if (!i.startMonth || !i.endMonth) return true; // unscheduled -- always included
      const itemStart = monthIndex(i.startYear, i.startMonth);
      const itemEnd = monthIndex(i.endYear, i.endMonth);
      return itemStart <= upper && itemEnd >= lower;
    })
    .map(toRow);

  const sheet = XLSX.utils.json_to_sheet(rows, { header: COLUMNS.map((c) => c.key) });
  XLSX.utils.sheet_add_aoa(sheet, [COLUMNS.map((c) => c.header)], { origin: "A1" });
  sheet["!cols"] = COLUMNS.map((c) =>
    ["summary", "currentState", "futureState", "successMetrics", "reviewerNotes"].includes(c.key)
      ? { wch: 40 }
      : { wch: 16 }
  );

  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Roadmap");

  const stamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(book, `roadmap-export-${stamp}.xlsx`);

  return rows.length;
}
