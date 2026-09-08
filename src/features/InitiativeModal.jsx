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

function toFormState(initiative) {
  return {
    title: initiative?.title || "",
    focusArea: initiative?.focusArea || "",
    team: initiative?.team || "",
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
    startDate: initiative?.startDate || "",
    endDate: initiative?.endDate || "",
  };
}

export default function InitiativeModal({ initiative, focusAreas, teams, onClose, onSave, onDelete }) {
  const [form, setForm] = useState(() => toFormState(initiative));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");

  const upd = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const valid = form.title.trim();
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
            <Select label="Focus area" value={form.focusArea} onChange={upd("focusArea")}>
              <option value="">—</option>
              {focusAreas.map((f) => (
                <option key={f.id} value={f.name}>
                  {f.name}
                </option>
              ))}
            </Select>
            <Select label="Team" value={form.team} onChange={upd("team")}>
              <option value="">—</option>
              {teams.map((t) => (
                <option key={t.id} value={t.name}>
                  {t.name}
                </option>
              ))}
            </Select>
          </div>

          <label className="lt-field">
            <span className="lt-field__label">Summary</span>
            <textarea className="lt-input" rows={2} value={form.summary} onChange={upd("summary")} />
          </label>
          <label className="lt-field">
            <span className="lt-field__label">Current state</span>
            <textarea className="lt-input" rows={2} value={form.currentState} onChange={upd("currentState")} />
          </label>
          <label className="lt-field">
            <span className="lt-field__label">Future state</span>
            <textarea className="lt-input" rows={2} value={form.futureState} onChange={upd("futureState")} />
          </label>
          <label className="lt-field">
            <span className="lt-field__label">Success metrics</span>
            <textarea className="lt-input" rows={2} value={form.successMetrics} onChange={upd("successMetrics")} />
          </label>
          <Input
            label="Impacted teams (comma-separated)"
            value={form.impactedTeams}
            onChange={upd("impactedTeams")}
            placeholder="e.g. Sales, Support"
          />

          <Select label="Status" value={form.status} onChange={upd("status")}>
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
            <Select label="Start week" value={form.startDate} onChange={upd("startDate")}>
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
            <Select label="End week" value={form.endDate} onChange={upd("endDate")}>
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
