import { useEffect } from "react";
import Icon from "./Icon.jsx";

/**
 * Modal — centered dialog over a dimmed overlay.
 * Closes on ESC, overlay click, or the close button. Locks body scroll.
 */
export default function Modal({ title, subtitle, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose?.();
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  const onOverlay = (e) => {
    if (e.target === e.currentTarget) onClose?.();
  };

  return (
    <div className="lt-modal__overlay" onClick={onOverlay}>
      <div
        className="lt-modal lt-scroll"
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : undefined}
      >
        <div className="lt-modal__header">
          <button
            className="lt-modal__close lt-icon-btn"
            onClick={onClose}
            aria-label="Close"
          >
            <Icon name="close" size={16} />
          </button>
          {title && <h2 className="lt-modal__title">{title}</h2>}
          {subtitle && <p className="lt-modal__subtitle">{subtitle}</p>}
        </div>
        <div className="lt-modal__body">{children}</div>
      </div>
    </div>
  );
}
