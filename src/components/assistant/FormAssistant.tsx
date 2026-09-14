"use client";

import { MessageSquare } from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useRef, useState } from "react";
import { useLocale } from "@/components/providers/LocaleProvider";

const AssistantPanel = dynamic(() => import("./AssistantPanel"), { ssr: false });
const preloadPanel = () => { void import("./AssistantPanel").catch(() => undefined); };

export function FormAssistant() {
  const { dictionary: t } = useLocale();
  const [open, setOpen] = useState(false);
  const [activated, setActivated] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => {
    setOpen(false);
    trigger.current?.focus({ preventScroll: true });
  }, []);

  return (
    <>
      <button
        ref={trigger}
        className={`assistant-trigger ${open ? "is-hidden" : ""}`}
        type="button"
        onPointerEnter={preloadPanel}
        onFocus={preloadPanel}
        onClick={() => { setActivated(true); setOpen(true); }}
        aria-label={t.assistant.open}
        aria-expanded={open}
        aria-controls={activated ? "assistant-panel" : undefined}
        tabIndex={open ? -1 : undefined}
        data-testid="assistant-open"
      >
        <MessageSquare size={21} /><span>{t.assistant.trigger}</span>
      </button>
      {activated && <AssistantPanel open={open} onClose={close} />}
    </>
  );
}
