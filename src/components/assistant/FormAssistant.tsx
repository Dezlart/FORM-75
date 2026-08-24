"use client";

import { ArrowUp, MessageSquare, RotateCcw, X } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import { useLocale } from "@/components/providers/LocaleProvider";
import { readStorage, removeStorage, writeStorage } from "@/lib/safeStorage";
import type { ChatMessage, ChatResponse } from "@/types/chat";

const storageKey = "form75-chat-v1";
const createId = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

function readStoredMessages(): ChatMessage[] {
  try {
    const value: unknown = JSON.parse(readStorage(storageKey) ?? "[]");
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is ChatMessage => {
      if (!item || typeof item !== "object") return false;
      const candidate = item as Partial<ChatMessage>;
      return typeof candidate.id === "string" && (candidate.role === "user" || candidate.role === "assistant") && typeof candidate.content === "string";
    }).slice(-20);
  } catch {
    removeStorage(storageKey);
    return [];
  }
}

export function FormAssistant() {
  const { dictionary: t, locale } = useLocale();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() => typeof window === "undefined" ? [] : readStoredMessages());
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    writeStorage(storageKey, JSON.stringify(messages.slice(-20)));
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.body.style.overflow = window.innerWidth < 700 ? "hidden" : previousOverflow;
    window.addEventListener("keydown", onKeyDown);
    window.setTimeout(() => inputRef.current?.focus(), 80);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const send = async (content: string) => {
    const trimmed = content.trim();
    if (!trimmed || loading) return;
    const userMessage: ChatMessage = { id: createId(), role: "user", content: trimmed };
    const nextMessages = [...messages, userMessage].slice(-12);
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ locale, messages: nextMessages.map(({ role, content: messageContent }) => ({ role, content: messageContent })) }),
      });
      const payload = await response.json() as ChatResponse;
      const fallback = payload.error === "unavailable" ? t.assistant.unavailable : t.assistant.genericError;
      const assistantMessage: ChatMessage = { id: createId(), role: "assistant", content: payload.message ?? fallback };
      setMessages((current) => [...current, assistantMessage].slice(-20));
    } catch {
      const assistantMessage: ChatMessage = { id: createId(), role: "assistant", content: t.assistant.genericError };
      setMessages((current) => [...current, assistantMessage].slice(-20));
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void send(input);
  };

  return (
    <>
      <button className={`assistant-trigger ${open ? "is-hidden" : ""}`} type="button" onClick={() => setOpen(true)} aria-label={t.assistant.open} data-testid="assistant-open">
        <MessageSquare size={21} /><span>{t.assistant.trigger}</span>
      </button>
      {open && (
        <aside className="assistant-panel" role="dialog" aria-modal="true" aria-labelledby="assistant-title" data-testid="assistant-panel">
          <header>
            <div><span>F.</span><div><h2 id="assistant-title">{t.assistant.title}</h2><p>{t.assistant.subtitle}</p></div></div>
            <div className="assistant-actions">
              <button type="button" onClick={() => setMessages([])} aria-label={t.assistant.clear}><RotateCcw size={16} /></button>
              <button type="button" onClick={() => setOpen(false)} aria-label={t.assistant.close} data-testid="assistant-close"><X size={18} /></button>
            </div>
          </header>
          <div className="conversation" ref={scrollRef} aria-live="polite">
            {messages.length === 0 && (
              <div className="assistant-welcome"><span>FORM / 75</span><p>{t.assistant.welcome}</p></div>
            )}
            {messages.map((message) => <div key={message.id} className={`message ${message.role}`}>{message.content}</div>)}
            {loading && <div className="typing"><i /><i /><i /><span>{t.assistant.loading}</span></div>}
          </div>
          {messages.length === 0 && <div className="quick-prompts">{t.assistant.prompts.map((prompt) => <button type="button" key={prompt} onClick={() => void send(prompt)}>{prompt}</button>)}</div>}
          <form onSubmit={onSubmit}>
            <input ref={inputRef} value={input} onChange={(event) => setInput(event.target.value)} placeholder={t.assistant.placeholder} maxLength={800} disabled={loading} aria-label={t.assistant.placeholder} />
            <button type="submit" disabled={loading || !input.trim()} aria-label={t.assistant.send}><ArrowUp size={18} /></button>
          </form>
        </aside>
      )}
    </>
  );
}
