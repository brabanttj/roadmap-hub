import { createContext, useContext, useRef, useState } from "react";
import { Modal, Input, Button } from "../components/ui/index.js";
import "./PasswordGate.css";

// Shared reviewer/admin password gating mutating actions (approve/reject a
// submitted idea, schedule or edit a roadmap item, manage taxonomy). Idea
// submission itself stays open to anyone.
const GATE_PASSWORD = "asdf";

const PasswordGateContext = createContext(null);

export function PasswordGateProvider({ children }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const pendingRef = useRef(null);

  const close = () => {
    pendingRef.current = null;
    setOpen(false);
  };

  const guard = (action) => (...args) => {
    pendingRef.current = () => action(...args);
    setValue("");
    setError("");
    setOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (value !== GATE_PASSWORD) {
      setError("That's not it — try again.");
      return;
    }
    const run = pendingRef.current;
    close();
    run?.();
  };

  return (
    <PasswordGateContext.Provider value={guard}>
      {children}
      {open && (
        <Modal title="Enter password to continue" onClose={close}>
          <form className="pw-gate" onSubmit={handleSubmit}>
            <Input
              type="password"
              label="Password"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              autoFocus
              required
            />
            {error && <p className="pw-gate__error">{error}</p>}
            <div className="mt-confirm__actions">
              <Button type="button" variant="secondary" onClick={close}>
                Cancel
              </Button>
              <Button type="submit" variant="accent">
                Continue
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </PasswordGateContext.Provider>
  );
}

export function usePasswordGate() {
  const guard = useContext(PasswordGateContext);
  if (!guard) throw new Error("usePasswordGate must be used within PasswordGateProvider");
  return guard;
}
