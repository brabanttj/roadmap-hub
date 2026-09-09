import { useState } from "react";
import { Card, Input, Select, MultiSelect, Button, IllustrationBadge } from "../components/ui/index.js";
import { capitalizeFirst, IMPACTED_PRODUCTS } from "../lib/text.js";
import "./IdeaForm.css";

const FRIENDLY_ERROR = "Something went wrong. Please try again.";

const EMPTY_FORM = {
  title: "",
  focusArea: "",
  summary: "",
  currentState: "",
  futureState: "",
  successMetrics: "",
  impactedProducts: [],
  submittedBy: "",
};

export default function IdeaForm({ focusAreas, onSubmitted }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const valid = form.title.trim() && form.submittedBy.trim();
  const upd = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const updText = (k) => (e) => setForm((f) => ({ ...f, [k]: capitalizeFirst(e.target.value) }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!valid || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const j = await res.json();
      if (!res.ok || !j.ok) throw new Error(j.error || FRIENDLY_ERROR);
      onSubmitted(j.initiative);
      setDone(true);
    } catch (err) {
      setError(err.message || FRIENDLY_ERROR);
    } finally {
      setSubmitting(false);
    }
  };

  const submitAnother = () => {
    setForm(EMPTY_FORM);
    setDone(false);
  };

  if (done) {
    return (
      <Card className="cf-empty-results">
        <IllustrationBadge icon="lightBulb" tone="green" size={72} />
        <p className="cf-empty__title">Idea submitted</p>
        <p className="cf-empty__sub">
          It's in the review queue now — a reviewer will approve it to the
          backlog or reject it with a reason.
        </p>
        <div className="if-done__actions">
          <Button variant="accent" onClick={submitAnother}>
            Submit another idea
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="if-card">
      <h2 className="if-card__title">Submit an idea</h2>
      <p className="rb-intro">
        Anyone can submit — a reviewer will approve it onto the backlog or
        reject it with a reason.
      </p>
      {error && (
        <div className="mt-banner" role="alert">
          <span className="mt-banner__icon" aria-hidden="true">⚠️</span>
          <span>{error}</span>
        </div>
      )}
      <form className="if-form" onSubmit={handleSubmit}>
        <Input
          label="Title *"
          placeholder="e.g. Self-Service Billing"
          value={form.title}
          onChange={updText("title")}
          required
          autoFocus
        />
        <Select label="Focus area" value={form.focusArea} onChange={upd("focusArea")}>
          <option value="">Choose a focus area…</option>
          {focusAreas.map((f) => (
            <option key={f.id} value={f.name}>
              {f.name}
            </option>
          ))}
        </Select>
        <label className="lt-field">
          <span className="lt-field__label">Summary</span>
          <textarea
            className="lt-input if-form__textarea"
            placeholder="What is it, and why does it matter?"
            value={form.summary}
            onChange={updText("summary")}
            rows={2}
          />
        </label>
        <label className="lt-field">
          <span className="lt-field__label">Current state</span>
          <textarea
            className="lt-input if-form__textarea"
            placeholder="What's the problem today?"
            value={form.currentState}
            onChange={updText("currentState")}
            rows={2}
          />
        </label>
        <label className="lt-field">
          <span className="lt-field__label">Future state</span>
          <textarea
            className="lt-input if-form__textarea"
            placeholder="What does it look like once this ships?"
            value={form.futureState}
            onChange={updText("futureState")}
            rows={2}
          />
        </label>
        <label className="lt-field">
          <span className="lt-field__label">Success metrics</span>
          <textarea
            className="lt-input if-form__textarea"
            placeholder="How will you know it worked?"
            value={form.successMetrics}
            onChange={updText("successMetrics")}
            rows={2}
          />
        </label>
        <label className="lt-field">
          <span className="lt-field__label">Impacted products</span>
          <MultiSelect
            label="Products"
            options={IMPACTED_PRODUCTS.map((p) => ({ value: p, label: p }))}
            selected={form.impactedProducts}
            onChange={(next) => setForm((f) => ({ ...f, impactedProducts: next }))}
          />
        </label>
        <Input
          label="Your name *"
          placeholder="So reviewers know who to follow up with"
          value={form.submittedBy}
          onChange={upd("submittedBy")}
          required
        />
        <div className="if-form__actions">
          <Button type="submit" variant="accent" disabled={!valid || submitting}>
            {submitting ? "Submitting…" : "Submit idea"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
