"use client";

import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db";
import { upsertDailyNote } from "@/db/queries";
import { todayLocal } from "@/lib/date";
import { Card, CardHeader } from "@/components/ui/Card";
import { Textarea } from "@/components/ui/Input";
import { cn } from "@/lib/utils";

/**
 * Compact daily-note widget for the Today screen.
 * - mood / energy / sleep quality as 1-5 emoji rows
 * - free-form notes
 * Writes are debounced so typing doesn't hammer Dexie+sync.
 */

type Rating = 1 | 2 | 3 | 4 | 5;
const FACES: Record<Rating, string> = { 1: "😞", 2: "🙁", 3: "😐", 4: "🙂", 5: "😄" };
const ENERGY: Record<Rating, string> = { 1: "🔋", 2: "🔋", 3: "🔋", 4: "⚡", 5: "⚡" };
const SLEEP: Record<Rating, string> = { 1: "😵", 2: "😪", 3: "😐", 4: "😴", 5: "✨" };

export function DailyNoteCard() {
  const today = todayLocal();
  const note = useLiveQuery(
    () => db.dailyNotes.where("date").equals(today).first(),
    [today],
  );
  const [notesDraft, setNotesDraft] = useState("");
  const [open, setOpen] = useState(false);

  // Keep draft in sync when the live query updates (e.g. cross-tab change).
  useEffect(() => {
    setNotesDraft(note?.notes ?? "");
  }, [note?.notes]);

  // Debounce text writes to Dexie — typing shouldn't fire a sync per keystroke.
  useEffect(() => {
    if (notesDraft === (note?.notes ?? "")) return;
    const id = window.setTimeout(() => {
      void upsertDailyNote(today, { notes: notesDraft.trim() || undefined });
    }, 500);
    return () => window.clearTimeout(id);
  }, [notesDraft, note?.notes, today]);

  const setRating = (key: "mood" | "energy" | "sleepQuality", val: Rating) => {
    void upsertDailyNote(today, { [key]: note?.[key] === val ? undefined : val });
  };

  const summary = (() => {
    const parts: string[] = [];
    if (note?.mood) parts.push(FACES[note.mood as Rating]);
    if (note?.energy) parts.push(`E${note.energy}`);
    if (note?.sleepQuality) parts.push(`💤${note.sleepQuality}`);
    if (note?.notes) parts.push("📝");
    return parts.length > 0 ? parts.join(" ") : "Not logged";
  })();

  return (
    <section>
      <CardHeader
        title="Today's check-in"
        action={
          <button
            type="button"
            className="text-xs text-subtle hover:text-fg"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? "Hide" : "Edit"}
          </button>
        }
      />
      <Card>
        {!open ? (
          <div className="text-sm">{summary}</div>
        ) : (
          <div className="space-y-3">
            <RatingRow label="Mood"  value={note?.mood as Rating | undefined} icons={FACES} onSet={(v) => setRating("mood", v)} />
            <RatingRow label="Energy" value={note?.energy as Rating | undefined} icons={ENERGY} onSet={(v) => setRating("energy", v)} />
            <RatingRow label="Sleep" value={note?.sleepQuality as Rating | undefined} icons={SLEEP} onSet={(v) => setRating("sleepQuality", v)} />
            <Textarea
              placeholder="Anything worth remembering? (gym was crowded, knee felt off, etc.)"
              value={notesDraft}
              onChange={(e) => setNotesDraft(e.target.value)}
              rows={2}
            />
          </div>
        )}
      </Card>
    </section>
  );
}

function RatingRow({
  label,
  value,
  icons,
  onSet,
}: {
  label: string;
  value: Rating | undefined;
  icons: Record<Rating, string>;
  onSet: (v: Rating) => void;
}) {
  return (
    <div>
      <div className="mb-1 text-xs text-subtle">{label}</div>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onSet(n as Rating)}
            aria-pressed={value === n}
            className={cn(
              "flex h-10 flex-1 items-center justify-center rounded-lg border text-lg transition-colors",
              value === n
                ? "border-primary bg-primary/15"
                : "border-border hover:bg-muted",
            )}
          >
            {icons[n as Rating]}
          </button>
        ))}
      </div>
    </div>
  );
}
