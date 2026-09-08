import { useState } from "react";
import { Modal, Input, Select, Button } from "../components/ui/index.js";
import { MONTH_NAMES, STATUS_LABEL, mondaysInMonth, formatWeekLabel } from "../lib/text.js";
import "./InitiativeModal.css";

const FRIENDLY_ERROR = "Something went wrong. Please try again.";
const STATUS_OPTIONS = ["backlog", "in_development", "completed"];
const REFERENCE_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = [REFERENCE_YEAR - 1, REFERENCE_YEAR, REFERENCE_YEAR + 1];

// Every Monday of the given year, grouped by month -- the same week list
// the Gantt view itself renders, so scheduling here always lines up with a
// real column on the roadmap.
function weeksByMonth(year) {
  return MONTH_NAMES.map((name, idx) => ({
    name,
    weeks: mondaysInMonth(year, idx + 1).map((d) => ({
      value: d.toISOString().slice(0, 10),
      label: formatWeekLabel(d),
    })),
  }));
}

function toFormState(initiative, focusAreas, teams) {
  return {
    title: initiative?.title || "",
    focusArea: initiative?.focusArea || focusAreas[0]?.name || "",
    team: initiative?.team || teams[0]?.name || "",
    summary: initiative?.summary || "",
    currentState: initiative?.currentState || "",
    futureState: initiative?.futureState || "",
    successMetrics: initiative?.successMetrics || "",
    impactedTeams: (initiative?.impactedTeams || []).join(", "),
    status: initiative?.status && initiative.status !== "idea" && initiative.status !== "rejected"
      ? initiative.status
      : "backlog",
    startYear: initiative?.startDate ? Number(initiative.startDate.slice(0, 4)) : REFERENCE_YEAR,
    endYear: initiative?.endDate ? Number(initiative.endDate.slice(0, 4)) : REFERENCE_YEAR,
    // Backlog means "not yet scheduled" -- unscheduled (blank) is only
    // valid while status stays Backlog; anything else needs a real range.
    startDate: initiative?.startDate || "",
    endDate: initiative?.endDate || "",
  };
}

export default function InitiativeModal({ initiative, focusAreas, teams, onClose, onSave, onDelete }) {
  const [form, setForm] = useState(() => toFormState(initiative, focusAreas, teams));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");

  const upd = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  // Backlog is explicitly "not yet scheduled" -- everything else needs a
  // real start/end week.
  const scheduleRequired = form.status !== "backlog";
  const valid =
    form.title.trim() &&
    form.focusArea &&
    form.team &&
    form.summary.trim() &&
    form.currentState.trim() &&
    form.futureState.trim() &&
    form.successMetrics.trim() &&
    form.impactedTeams.trim() &&
    (!scheduleRequired || (form.startDate && form.endDate));
  const startWeeks = weeksByMonth(form.startYear);
  const endWeeks = weeksByMonth(form.endYear);
  const yearOptionsFor = (year) => (YEAR_OPTIONS.includes(year) ? YEAR_OPTIONS : [...YEAR_OPTIONS, year].sort());

  // Changing a year swaps that side's week options out from under the
  // current selection -- clear it rather than leave a stale date from the
  // old year silently mismatched with what the dropdown displays. Start
  // and end are independent, so an initiative can span two years (e.g.
  // start Dec 2026, end Jan 2027).
  const onStartYearChange = (e) => setForm((f) => ({ ...f, startYear: Number(e.target.value), startDate: "" }));
  const onEndYearChange = (e) => setForm((f) => ({ ...f, endYear: Number(e.target.value), endDate: "" }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!valid || saving) return;
    setSaving(true);
    setError("");
    try {
      await onSave(
        {
          title: form.title.trim(),
          focusArea: form.focusArea,
          team: form.team,
          summary: form.summary,
          currentState: form.currentState,
          futureState: form.futureState,
          successMetrics: form.successMetrics,
          impactedTeams: form.impactedTeams
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
          status: form.status,
          completed: form.status === "completed",
          startDate: form.startDate || null,
          endDate: form.endDate || null,
        },
        initiative?.id
      );
      onClose();
    } catch (err) {
      setError(err.message || FRIENDLY_ERROR);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    setError("");
    try {
      await onDelete(initiative.id);
      onClose();
    } catch (err) {
      setError(err.message || FRIENDLY_ERROR);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Modal title={initiative ? "Edit initiative" : "Add initiative"} onClose={onClose}>
      {error && (
        <div className="mt-banner" role="alert">
          <span className="mt-banner__icon" aria-hidden="true">⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {confirmDelete ? (
        <div className="im-confirm">
          <p className="mt-confirm__body">
            Remove <strong>{initiative.title}</strong> from the roadmap? This can't be undone.
          </p>
          <div className="mt-confirm__actions">
            <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Removing…" : "Remove initiative"}
            </Button>
          </div>
        </div>
      ) : (
        <form className="im-form" onSubmit={handleSubmit}>
          <Input label="Title *" value={form.title} onChange={upd("title")} required autoFocus />

          <div className="im-form__row">
            <Select label="Focus area *" value={form.focusArea} onChange={upd("focusArea")} required>
              {focusAreas.map((f) => (
                <option key={f.id} value={f.name}>
                  {f.name}
                </option>
              ))}
            </Select>
            <Select label="Team *" value={form.team} onChange={upd("team")} required>
              {teams.map((t) => (
                <option key={t.id} value={t.name}>
                  {t.name}
                </option>
              ))}
            </Select>
          </div>

          <label className="lt-field">
            <span className="lt-field__label">Summary *</span>
            <textarea className="lt-input" rows={2} value={form.summary} onChange={upd("summary")} required />
          </label>
          <label className="lt-field">
            <span className="lt-field__label">Current state *</span>
            <textarea className="lt-input" rows={2} value={form.currentState} onChange={upd("currentState")} required />
          </label>
          <label className="lt-field">
            <span className="lt-field__label">Future state *</span>
            <textarea className="lt-input" rows={2} value={form.futureState} onChange={upd("futureState")} required />
          </label>
          <label className="lt-field">
            <span className="lt-field__label">Success metrics *</span>
            <textarea className="lt-input" rows={2} value={form.successMetrics} onChange={upd("successMetrics")} required />
          </label>
          <Input
            label="Impacted teams (comma-separated) *"
            value={form.impactedTeams}
            onChange={upd("impactedTeams")}
            placeholder="e.g. Sales, Support"
            required
          />

          <Select label="Status *" value={form.status} onChange={upd("status")}>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </Select>

          <div className="im-form__row">
            <Select label="Start year" value={form.startYear} onChange={onStartYearChange}>
              {yearOptionsFor(form.startYear).map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
            <Select
              label={`Start week${scheduleRequired ? " *" : ""}`}
              value={form.startDate}
              onChange={upd("startDate")}
              required={scheduleRequired}
            >
              <option value="">Unscheduled</option>
              {startWeeks.map((m) => (
                <optgroup key={m.name} label={m.name}>
                  {m.weeks.map((w) => (
                    <option key={w.value} value={w.value}>
                      {w.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </Select>
          </div>
          <div className="im-form__row">
            <Select label="End year" value={form.endYear} onChange={onEndYearChange}>
              {yearOptionsFor(form.endYear).map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
            <Select
              label={`End week${scheduleRequired ? " *" : ""}`}
              value={form.endDate}
              onChange={upd("endDate")}
              required={scheduleRequired}
            >
              <option value="">Unscheduled</option>
              {endWeeks.map((m) => (
                <optgroup key={m.name} label={m.name}>
                  {m.weeks.map((w) => (
                    <option key={w.value} value={w.value}>
                      {w.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </Select>
          </div>

          <div className="im-form__actions">
            {initiative && (
              <Button type="button" variant="danger" onClick={() => setConfirmDelete(true)} disabled={saving}>
                Remove
              </Button>
            )}
            <div className="im-form__actions-right">
              <Button type="button" variant="secondary" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" variant="accent" disabled={!valid || saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        </form>
      )}
    </Modal>
  );
}
