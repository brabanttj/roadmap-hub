/* Forces only the first character to uppercase, leaving the rest of the
   string untouched -- so intentional internal casing survives, but
   "customer experience" still reads as a proper name. */
export function capitalizeFirst(value) {
  return value.length ? value[0].toUpperCase() + value.slice(1) : value;
}

export const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export const STATUS_LABEL = {
  idea: "Idea",
  backlog: "Backlog",
  in_development: "In Development",
  completed: "Completed",
  rejected: "Rejected",
};

/* Every Monday that falls within the given calendar month (1-12), so the
   Gantt can break each month down into week columns. Every month has at
   least one -- a month is always >= 28 days, and a Monday always falls
   within the first 7. */
export function mondaysInMonth(year, month) {
  const first = new Date(year, month - 1, 1);
  const last = new Date(year, month, 0);
  const offset = (8 - first.getDay()) % 7;
  const d = new Date(year, month - 1, 1 + offset);
  const mondays = [];
  while (d <= last) {
    mondays.push(new Date(d));
    d.setDate(d.getDate() + 7);
  }
  return mondays;
}

export function formatWeekLabel(date) {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
