import { useState } from "react";
import { Modal, Input, Select, MultiSelect, Button } from "../components/ui/index.js";
import { MONTH_NAMES, STATUS_LABEL, IMPACTED_PRODUCTS } from "../lib/text.js";
import "./InitiativeModal.css";

const FRIENDLY_ERROR = "Something went wrong. Please try again.";
const STATUS_OPTIONS = ["backlog", "in_development", "completed"];
const REFERENCE_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = [REFERENCE_YEAR - 1, REFERENCE_YEAR, REFERENCE_YEAR + 1];
const MONTH_OPTIONS = MONTH_NAMES.map((name, idx) => ({ value: idx + 1, label: name }));

function toFormState(initiative, focusAreas, teams) {
  return {
    title: initiative?.title || "",
    focusArea: initiative?.focusArea || focusAreas[0]?.name || "",
    team: initiative?.team || teams[0]?.name || "",
    summary: initiative?.summary || "",
    currentState: initiative?.currentState || "",
    futureState: initiative?.futureState || "",
    successMetrics: initiative?.successMetrics || "",
    impactedTeams: initiative?.impactedTeams || [],
    impactedProducts: initiative?.impactedProducts || [],
    status: initiative?.status && initiative.status !== "idea" && initiative.status !== "rejected"
      ? initiative.status
      : "backlog",
    // Backlog means "not yet scheduled" -- unscheduled (blank) is only
    // valid while status stays Backlog; anything else needs a real month.
    startYear: initiative?.startYear || REFERENCE_YEAR,
    startMonth: initiative?.startMonth || "",
    endYear: initiative?.endYear || REFERENCE_YEAR,
    endMonth: initiative?.endMonth || "",
  };
}

export default function InitiativeModal({
  initiative,
  focusAreas,
  teams,
  onClose,
  onSave,
  onDelete,
  onArchive,
  onNotesUpdated,
}) {
  const [form, setForm] = useState(() => toFormState(initiative, focusAreas, teams));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");

  // Notes are their own sub-resource (add/edit/delete independently,
  // persisted immediately -- not part of the Save button below) so they
  // only apply to an initiative that already exists.
  const [notes, setNotes] = useState(initiative?.notes || []);
  const [noteDraft, setNoteDraft] = useState("");
  const [noteAuthor, setNoteAuthor] = useState("");
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [editingNoteBody, setEditingNoteBody] = useState("");
  const [noteBusy, setNoteBusy] = useState(false);
  const [noteError, setNoteError] = useState("");

  const addNote = async () => {
    const body = noteDraft.trim();
    if (!body || noteBusy) return;
    setNoteBusy(true);
    setNoteError("");
    try {
      const res = await fetch(`/api/initiatives/${initiative.id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, author: noteAuthor.trim() }),
      });
      const j = await res.json();
      if (!res.ok || !j.ok) throw new Error(j.error || FRIENDLY_ERROR);
      setNotes(j.initiative.notes);
      onNotesUpdated?.(j.initiative);
      setNoteDraft("");
    } catch (err) {
      setNoteError(err.message || FRIENDLY_ERROR);
    } finally {
      setNoteBusy(false);
    }
  };

  const saveNoteEdit = async (noteId) => {
    const body = editingNoteBody.trim();
    if (!body || noteBusy) return;
    setNoteBusy(true);
    setNoteError("");
    try {
      const res = await fetch(`/api/initiatives/${initiative.id}/notes/${noteId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const j = await res.json();
      if (!res.ok || !j.ok) throw new Error(j.error || FRIENDLY_ERROR);
      setNotes(j.initiative.notes);
      onNotesUpdated?.(j.initiative);
      setEditingNoteId(null);
    } catch (err) {
      setNoteError(err.message || FRIENDLY_ERROR);
    } finally {
      setNoteBusy(false);
    }
  };

  const deleteNote = async (noteId) => {
    if (noteBusy) return;
    setNoteBusy(true);
    setNoteError("");
    try {
      const res = await fetch(`/api/initiatives/${initiative.id}/notes/${noteId}`, { method: "DELETE" });
      const j = await res.json();
      if (!res.ok || !j.ok) throw new Error(j.error || FRIENDLY_ERROR);
      setNotes(j.initiative.notes);
      onNotesUpdated?.(j.initiative);
    } catch (err) {
      setNoteError(err.message || FRIENDLY_ERROR);
    } finally {
      setNoteBusy(false);
    }
  };

  const upd = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  // Backlog is explicitly "not yet scheduled" -- everything else needs a
  // real start/end month.
  const scheduleRequired = form.status !== "backlog";
  const valid =
    form.title.trim() &&
    form.focusArea &&
    form.team &&
    form.summary.trim() &&
    form.currentState.trim() &&
    form.futureState.trim() &&
    form.successMetrics.trim() &&
    form.impactedTeams.length > 0 &&
    form.impactedProducts.length > 0 &&
    (!scheduleRequired || (form.startMonth && form.endMonth));

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
          impactedTeams: form.impactedTeams,
          impactedProducts: form.impactedProducts,
          status: form.status,
          completed: form.status === "completed",
          startYear: form.startMonth ? Number(form.startYear) : null,
          startMonth: form.startMonth ? Number(form.startMonth) : null,
          endYear: form.endMonth ? Number(form.endYear) : null,
          endMonth: form.endMonth ? Number(form.endMonth) : null,
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

  const handleArchive = async () => {
    setArchiving(true);
    setError("");
    try {
      await onArchive(initiative.id);
      onClose();
    } catch (err) {
      setError(err.message || FRIENDLY_ERROR);
    } finally {
      setArchiving(false);
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
          <label className="lt-field">
            <span className="lt-field__label">Impacted teams *</span>
            <MultiSelect
              label="Teams"
              options={teams.map((t) => ({ value: t.name, label: t.name }))}
              selected={form.impactedTeams}
              onChange={(next) => setForm((f) => ({ ...f, impactedTeams: next }))}
            />
          </label>
          <label className="lt-field">
            <span className="lt-field__label">Impacted products *</span>
            <MultiSelect
              label="Products"
              options={IMPACTED_PRODUCTS.map((p) => ({ value: p, label: p }))}
              selected={form.impactedProducts}
              onChange={(next) => setForm((f) => ({ ...f, impactedProducts: next }))}
            />
          </label>

          <Select label="Status *" value={form.status} onChange={upd("status")}>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </Select>

          <div className="im-form__row">
            <Select label="Start year" value={form.startYear} onChange={upd("startYear")}>
              {YEAR_OPTIONS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
            <Select
              label={`Start month${scheduleRequired ? " *" : ""}`}
              value={form.startMonth}
              onChange={upd("startMonth")}
              required={scheduleRequired}
            >
              <option value="">Unscheduled</option>
              {MONTH_OPTIONS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="im-form__row">
            <Select label="End year" value={form.endYear} onChange={upd("endYear")}>
              {YEAR_OPTIONS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
            <Select
              label={`End month${scheduleRequired ? " *" : ""}`}
              value={form.endMonth}
              onChange={upd("endMonth")}
              required={scheduleRequired}
            >
              <option value="">Unscheduled</option>
              {MONTH_OPTIONS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </Select>
          </div>

          {initiative && (
            <div className="im-notes">
              <span className="lt-field__label">Notes</span>
              {noteError && (
                <div className="mt-banner" role="alert">
                  <span className="mt-banner__icon" aria-hidden="true">⚠️</span>
                  <span>{noteError}</span>
                </div>
              )}
              <ul className="im-notes__list">
                {notes.map((n) => (
                  <li key={n.id} className="im-notes__item">
                    {editingNoteId === n.id ? (
                      <>
                        <textarea
                          className="lt-input"
                          rows={2}
                          value={editingNoteBody}
                          onChange={(e) => setEditingNoteBody(e.target.value)}
                          autoFocus
                        />
                        <div className="im-notes__actions">
                          <Button
                            type="button"
                            size="sm"
                            variant="accent"
                            onClick={() => saveNoteEdit(n.id)}
                            disabled={noteBusy || !editingNoteBody.trim()}
                          >
                            Save
                          </Button>
                          <Button type="button" size="sm" variant="secondary" onClick={() => setEditingNoteId(null)}>
                            Cancel
                          </Button>
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="im-notes__body">{n.body}</p>
                        <div className="im-notes__meta">
                          {n.author && <span>{n.author}</span>}
                          <span>{new Date(n.createdAt).toLocaleDateString()}</span>
                        </div>
                        <div className="im-notes__actions">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={noteBusy}
                            onClick={() => {
                              setEditingNoteId(n.id);
                              setEditingNoteBody(n.body);
                            }}
                          >
                            Edit
                          </Button>
                          <Button type="button" size="sm" variant="ghost" disabled={noteBusy} onClick={() => deleteNote(n.id)}>
                            Delete
                          </Button>
                        </div>
                      </>
                    )}
                  </li>
                ))}
                {notes.length === 0 && <li className="im-notes__empty">No notes yet.</li>}
              </ul>
              <div className="im-notes__add">
                <textarea
                  className="lt-input"
                  rows={2}
                  placeholder="Add a note…"
                  value={noteDraft}
                  onChange={(e) => setNoteDraft(e.target.value)}
                />
                <Input
                  placeholder="Your name (optional)"
                  value={noteAuthor}
                  onChange={(e) => setNoteAuthor(e.target.value)}
                />
                <Button type="button" size="sm" variant="accent" onClick={addNote} disabled={noteBusy || !noteDraft.trim()}>
                  Add note
                </Button>
              </div>
            </div>
          )}

          <div className="im-form__actions">
            {initiative && (
              <div className="im-form__actions-left">
                <Button type="button" variant="danger" onClick={() => setConfirmDelete(true)} disabled={saving}>
                  Remove
                </Button>
                <Button type="button" variant="secondary" onClick={handleArchive} disabled={saving || archiving}>
                  {archiving ? "Archiving…" : "Archive"}
                </Button>
              </div>
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
