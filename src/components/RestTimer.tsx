"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { beep, vibrate } from "@/lib/audio";
import { X, Plus, Minus, Play } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Floating rest timer that docks at the bottom of the screen above the
 * mobile nav. Driven by a single `endsAt` epoch ms so it stays accurate
 * even if the tab is backgrounded and tick handler is throttled.
 *
 * The parent owns the "currently resting" state; this component is purely
 * presentational + audio side effects.
 */
export function RestTimer({
  endsAt,
  onSkip,
  onAdd,
}: {
  endsAt: number | null;
  onSkip: () => void;
  onAdd: (deltaSec: number) => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const firedRef = useRef(false);

  useEffect(() => {
    if (endsAt == null) {
      firedRef.current = false;
      return;
    }
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [endsAt]);

  useEffect(() => {
    if (endsAt == null) return;
    const remaining = endsAt - now;
    if (remaining <= 0 && !firedRef.current) {
      firedRef.current = true;
      beep("double");
      vibrate([200, 100, 200]);
    }
  }, [now, endsAt]);

  if (endsAt == null) return null;

  const remainingMs = endsAt - now;
  const remainingSec = Math.max(0, Math.ceil(remainingMs / 1000));
  const done = remainingMs <= 0;
  const mins = Math.floor(remainingSec / 60);
  const secs = remainingSec % 60;

  return (
    <div
      className="fixed bottom-16 md:bottom-4 inset-x-0 z-30 flex justify-center px-3"
      role="status"
      aria-live="polite"
    >
      <div
        className={cn(
          "flex items-center gap-2 rounded-full border bg-surface px-3 py-2 shadow-lg",
          done ? "border-success text-success" : "border-border",
        )}
      >
        <Button size="sm" variant="ghost" onClick={() => onAdd(-15)} aria-label="-15s">
          <Minus size={14} />
        </Button>
        <div className="min-w-[70px] text-center font-mono text-lg font-semibold tabular-nums">
          {mins}:{secs.toString().padStart(2, "0")}
        </div>
        <Button size="sm" variant="ghost" onClick={() => onAdd(15)} aria-label="+15s">
          <Plus size={14} />
        </Button>
        <Button size="sm" variant={done ? "primary" : "secondary"} onClick={onSkip}>
          {done ? <Play size={14} /> : <X size={14} />}
          {done ? "Next" : "Skip"}
        </Button>
      </div>
    </div>
  );
}
