import { useState } from "react";
import { Modal, Input, Button } from "../components/ui/index.js";
import "./InitiativeModal.css";

const FRIENDLY_ERROR = "Something went wrong. Please try again.";

// Discussion is open to anyone -- unlike editing an initiative, asking or
// answering a question isn't a mutating action worth password-gating, so
// this is its own small modal instead of living inside InitiativeModal.
export default function InitiativeChatModal({ initiative, onClose, onUpdated }) {
  const [chat, setChat] = useState(initiative?.chat || []);
  const [chatDraft, setChatDraft] = useState("");
  const [chatAuthor, setChatAuthor] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [chatError, setChatError] = useState("");

  const sendChatMessage = async () => {
    const body = chatDraft.trim();
    if (!body || chatBusy) return;
    setChatBusy(true);
    setChatError("");
    try {
      const res = await fetch(`/api/initiatives/${initiative.id}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, author: chatAuthor.trim() }),
      });
      const j = await res.json();
      if (!res.ok || !j.ok) throw new Error(j.error || FRIENDLY_ERROR);
      setChat(j.initiative.chat);
      onUpdated?.(j.initiative);
      setChatDraft("");
    } catch (err) {
      setChatError(err.message || FRIENDLY_ERROR);
    } finally {
      setChatBusy(false);
    }
  };

  const deleteChatMessage = async (messageId) => {
    if (chatBusy) return;
    setChatBusy(true);
    setChatError("");
    try {
      const res = await fetch(`/api/initiatives/${initiative.id}/chat/${messageId}`, { method: "DELETE" });
      const j = await res.json();
      if (!res.ok || !j.ok) throw new Error(j.error || FRIENDLY_ERROR);
      setChat(j.initiative.chat);
      onUpdated?.(j.initiative);
    } catch (err) {
      setChatError(err.message || FRIENDLY_ERROR);
    } finally {
      setChatBusy(false);
    }
  };

  return (
    <Modal title="Discussion" subtitle={initiative.title} onClose={onClose}>
      <div className="im-chat im-chat--standalone">
        {chatError && (
          <div className="mt-banner" role="alert">
            <span className="mt-banner__icon" aria-hidden="true">⚠️</span>
            <span>{chatError}</span>
          </div>
        )}
        <ul className="im-chat__list">
          {chat.map((c) => (
            <li key={c.id} className="im-chat__item">
              <p className="im-chat__body">{c.body}</p>
              <div className="im-chat__meta">
                {c.author && <span>{c.author}</span>}
                <span>{new Date(c.createdAt).toLocaleString()}</span>
                <Button type="button" size="sm" variant="ghost" disabled={chatBusy} onClick={() => deleteChatMessage(c.id)}>
                  Delete
                </Button>
              </div>
            </li>
          ))}
          {chat.length === 0 && <li className="im-chat__empty">No questions yet — be the first to ask.</li>}
        </ul>
        <div className="im-chat__add">
          <textarea
            className="lt-input"
            rows={2}
            placeholder="Ask a question…"
            value={chatDraft}
            onChange={(e) => setChatDraft(e.target.value)}
          />
          <Input placeholder="Your name (optional)" value={chatAuthor} onChange={(e) => setChatAuthor(e.target.value)} />
          <Button type="button" variant="accent" onClick={sendChatMessage} disabled={chatBusy || !chatDraft.trim()}>
            Send
          </Button>
        </div>
      </div>
    </Modal>
  );
}
