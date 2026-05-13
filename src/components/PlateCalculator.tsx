"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { computePlates, summarizePlates, DEFAULT_BAR_KG } from "@/lib/plates";
import { Calculator, X } from "lucide-react";

/**
 * Inline plate calculator popover.
 * - Tap the calculator icon → expands a small panel inside the exercise card.
 * - Pre-fills with the most recent target weight if provided.
 * - Uses the user's plate inventory + bar weight from Settings if set.
 */
export function PlateCalculator({ defaultTargetKg }: { defaultTargetKg?: number }) {
  const settings = useLiveQuery(() => db.settings.get("singleton"), []);
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<number | "">(defaultTargetKg ?? "");
  const [barKg, setBarKg] = useState<number>(settings?.barWeightKg ?? DEFAULT_BAR_KG);

  if (!open) {
    return (
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)} aria-label="Plate calculator">
        <Calculator size={14} />
      </Button>
    );
  }

  const inventory = settings?.plateInventory;
  const result =
    target !== "" && target > 0
      ? computePlates(+target, { barKg, inventory })
      : null;

  return (
    <div className="mt-2 rounded-lg border border-border bg-bg p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs font-semibold uppercase text-subtle">Plate calculator</div>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)} aria-label="Close">
          <X size={14} />
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Target (kg)">
          <Input
            type="number"
            inputMode="decimal"
            step="2.5"
            value={target}
            onChange={(e) => setTarget(e.target.value === "" ? "" : +e.target.value)}
          />
        </Field>
        <Field label="Bar (kg)">
          <Input
            type="number"
            inputMode="decimal"
            value={barKg}
            onChange={(e) => setBarKg(+e.target.value)}
          />
        </Field>
      </div>
      {result && (
        <div className="mt-3 space-y-1 text-sm">
          <div>
            <span className="text-subtle">Per side: </span>
            <span className="font-medium">{summarizePlates(result.perSide)}</span>
          </div>
          <div className="text-xs text-subtle">
            Achieves <span className="font-medium text-fg">{result.achieved} kg</span>
            {!result.exact && (
              <span className="ml-1 text-warning">
                ({result.delta > 0 ? "+" : ""}{result.delta} kg vs target)
              </span>
            )}
            {inventory && (
              <span className="ml-1">· using your inventory</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
