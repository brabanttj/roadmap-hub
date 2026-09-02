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
  planned: "Planned",
  in_progress: "In Progress",
  completed: "Completed",
  rejected: "Rejected",
};
