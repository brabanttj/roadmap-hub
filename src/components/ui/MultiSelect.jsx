import { useEffect, useRef, useState } from "react";

/**
 * MultiSelect — a button that opens a checkbox panel. `selected` is a
 * string[]; empty means "everything" (no filter applied), matching how the
 * single-select <Select>'s "All ..." option used to behave.
 */
export default function MultiSelect({ label, options, selected, onChange, className = "" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toggle = (value) =>
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);

  const summary =
    selected.length === 0 || selected.length === options.length
      ? `All ${label}`
      : selected.length === 1
      ? options.find((o) => o.value === selected[0])?.label ?? label
      : `${selected.length} ${label}`;

  return (
    <div className={`lt-multiselect ${className}`} ref={ref}>
      <button
        type="button"
        className="lt-multiselect__btn"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="lt-multiselect__label">{summary}</span>
        <span className="lt-multiselect__caret" aria-hidden="true">▾</span>
      </button>
      {open && (
        <div className="lt-multiselect__panel" role="listbox">
          <div className="lt-multiselect__actions">
            <button type="button" onClick={() => onChange([])}>
              All
            </button>
            <button type="button" onClick={() => onChange(options.map((o) => o.value))}>
              Select all
            </button>
          </div>
          {options.map((o) => (
            <label key={o.value} className="lt-multiselect__option">
              <input
                type="checkbox"
                checked={selected.includes(o.value)}
                onChange={() => toggle(o.value)}
              />
              {o.swatch && <span className="lt-multiselect__swatch" style={{ background: o.swatch }} />}
              {o.label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
