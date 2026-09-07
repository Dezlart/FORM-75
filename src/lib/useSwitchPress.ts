"use client";

import { useCallback, useEffect, useRef, type ButtonHTMLAttributes } from "react";
import { requestSceneFrames } from "@/lib/storyProgress";
import { playSwitchClick } from "@/lib/switchSound";
import { useConfiguratorStore } from "@/stores/configurator";

type PressOwner = { pointerId: number } | { key: string };

export function useSwitchPress() {
  const owner = useRef<PressOwner | null>(null);

  const begin = useCallback((nextOwner: PressOwner) => {
    if (owner.current) return false;
    const state = useConfiguratorStore.getState();
    if (state.switchPressed) return false;
    owner.current = nextOwner;
    state.setSwitchPressed(true);
    playSwitchClick(state.switchType);
    requestSceneFrames("story", 0);
    return true;
  }, []);

  const release = useCallback(() => {
    if (!owner.current) return;
    owner.current = null;
    useConfiguratorStore.getState().setSwitchPressed(false);
    requestSceneFrames("story", 0);
  }, []);

  const pressPointer = useCallback((pointerId: number) => begin({ pointerId }), [begin]);
  const releasePointer = useCallback((pointerId: number) => {
    if (owner.current && "pointerId" in owner.current && owner.current.pointerId === pointerId) release();
  }, [release]);

  useEffect(() => {
    const endPointer = (event: PointerEvent) => releasePointer(event.pointerId);
    const endHidden = () => { if (document.hidden) release(); };
    window.addEventListener("pointerup", endPointer);
    window.addEventListener("pointercancel", endPointer);
    window.addEventListener("blur", release);
    document.addEventListener("visibilitychange", endHidden);
    return () => {
      window.removeEventListener("pointerup", endPointer);
      window.removeEventListener("pointercancel", endPointer);
      window.removeEventListener("blur", release);
      document.removeEventListener("visibilitychange", endHidden);
      release();
    };
  }, [release, releasePointer]);

  const pressButtonHandlers: ButtonHTMLAttributes<HTMLButtonElement> = {
    onPointerDown: (event) => {
      if (event.button !== 0 || !pressPointer(event.pointerId)) return;
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // Synthetic activation may have no native pointer; global release still works.
      }
    },
    onPointerUp: (event) => releasePointer(event.pointerId),
    onPointerCancel: (event) => releasePointer(event.pointerId),
    onLostPointerCapture: (event) => releasePointer(event.pointerId),
    onKeyDown: (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      if (!event.repeat) begin({ key: event.key });
    },
    onKeyUp: (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      if (owner.current && "key" in owner.current && owner.current.key === event.key) release();
    },
    onClick: (event) => {
      // Assistive technology can activate a button without pointer/key events.
      if (event.detail === 0 && begin({ key: "activation" })) release();
    },
    onBlur: release,
  };

  return { pressButtonHandlers, pressPointer, releasePointer };
}
