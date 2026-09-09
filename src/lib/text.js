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

// Fixed picklist for the "Impacted Products" field on an initiative --
// not a taxonomy table like Focus Areas/Teams, just a short closed set.
export const IMPACTED_PRODUCTS = ["All", "Calls", "Clicks", "Leads", "Unknown"];
