import { useState } from "react";
import { Card, Input, Button, Icon } from "../components/ui/index.js";
import { capitalizeFirst } from "../lib/text.js";
import { usePasswordGate } from "../lib/PasswordGate.jsx";
import "./ManageTaxonomy.css";

const FRIENDLY_ERROR = "Something went wrong. Please try again.";

export default function ManageTaxonomy({ focusAreas, teams, setFocusAreas, setTeams }) {
  return (
    <>
      <p className="rb-intro">
        The Focus Area and Team pickers used when submitting or scheduling
        initiatives. Existing initiatives keep their own text either way —
        removing an entry only removes it as a picker option.
      </p>
      <div className="tx-columns">
        <TaxonomyList
          title="Focus Areas"
          endpoint="focus-areas"
          items={focusAreas}
          setItems={setFocusAreas}
        />
        <TaxonomyList title="Teams" endpoint="teams" items={teams} setItems={setTeams} />
      </div>
    </>
  );
}

function TaxonomyList({ title, endpoint, items, setItems }) {
  const guard = usePasswordGate();
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [error, setError] = useState("");

  const handleAdd = async (e) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const j = await res.json();
      if (!res.ok || !j.ok) throw new Error(j.error || FRIENDLY_ERROR);
      setItems((prev) => [...prev, j.item]);
      setNewName("");
      setAdding(false);
    } catch (err) {
      setError(err.message || FRIENDLY_ERROR);
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (item) => {
    setError("");
    setEditingId(item.id);
    setEditName(item.name);
  };

  const saveEdit = async (e) => {
    e.preventDefault();
    const name = editName.trim();
    if (!name || busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/${endpoint}/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const j = await res.json();
      if (!res.ok || !j.ok) throw new Error(j.error || FRIENDLY_ERROR);
      setItems((prev) => prev.map((i) => (i.id === editingId ? j.item : i)));
      setEditingId(null);
    } catch (err) {
      setError(err.message || FRIENDLY_ERROR);
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmRemove = async () => {
    if (!confirmTarget || busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/${endpoint}/${confirmTarget.id}`, { method: "DELETE" });
      const j = await res.json();
      if (!res.ok || !j.ok) throw new Error(j.error || FRIENDLY_ERROR);
      setItems((prev) => prev.filter((i) => i.id !== confirmTarget.id));
      setConfirmTarget(null);
    } catch (err) {
      setError(err.message || FRIENDLY_ERROR);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="tx-list">
      <div className="tx-list__head">
        <h3 className="tx-list__title">{title}</h3>
        <Button size="sm" variant="accent" onClick={guard(() => setAdding(true))}>
          <Icon name="add" size={11} /> Add
        </Button>
      </div>

      {error && (
        <div className="mt-banner" role="alert">
          <span className="mt-banner__icon" aria-hidden="true">⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {adding && (
        <form className="tx-addrow" onSubmit={handleAdd}>
          <input
            className="lt-input"
            placeholder={`New ${title.toLowerCase().replace(/s$/, "")}`}
            value={newName}
            onChange={(e) => setNewName(capitalizeFirst(e.target.value))}
            autoFocus
            required
          />
          <Button type="submit" size="sm" variant="accent" disabled={!newName.trim() || submitting}>
            Save
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={() => setAdding(false)}>
            Cancel
          </Button>
        </form>
      )}

      <ul className="tx-items">
        {items.map((item) =>
          editingId === item.id ? (
            <li key={item.id} className="tx-item tx-item--editing">
              <form className="tx-editrow" onSubmit={saveEdit}>
                <input
                  className="lt-input"
                  value={editName}
                  onChange={(e) => setEditName(capitalizeFirst(e.target.value))}
                  autoFocus
                  required
                />
                <button type="submit" className="lt-icon-btn" aria-label="Save" disabled={busy}>
                  <Icon name="checkmark" size={14} />
                </button>
                <button
                  type="button"
                  className="lt-icon-btn"
                  aria-label="Cancel"
                  onClick={() => setEditingId(null)}
                >
                  <Icon name="close" size={14} />
                </button>
              </form>
            </li>
          ) : (
            <li key={item.id} className="tx-item">
              <span className="tx-item__name">{item.name}</span>
              <button
                type="button"
                className="lt-icon-btn"
                aria-label={`Rename ${item.name}`}
                onClick={guard(() => startEdit(item))}
              >
                <Icon name="edit" size={14} />
              </button>
              <button
                type="button"
                className="lt-icon-btn lt-icon-btn--danger"
                aria-label={`Remove ${item.name}`}
                onClick={guard(() => setConfirmTarget(item))}
              >
                <Icon name="trash" size={14} />
              </button>
            </li>
          )
        )}
        {items.length === 0 && <li className="tx-empty">None yet — add the first one above.</li>}
      </ul>

      {confirmTarget && (
        <div className="tx-confirm-overlay" role="alertdialog">
          <div className="tx-confirm">
            <p className="mt-confirm__body">
              Remove <strong>{confirmTarget.name}</strong>? This can't be undone.
            </p>
            <div className="mt-confirm__actions">
              <Button variant="secondary" size="sm" onClick={() => setConfirmTarget(null)}>
                Cancel
              </Button>
              <Button variant="danger" size="sm" onClick={handleConfirmRemove} disabled={busy}>
                {busy ? "Removing…" : "Remove"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
