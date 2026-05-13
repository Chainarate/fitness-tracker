"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db";
import { Card, EmptyState } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Plus } from "lucide-react";

export default function TemplatesPage() {
  const templates = useLiveQuery(
    () => db.templates.filter((t) => !t.deletedAt).sortBy("name"),
    [],
  );

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Templates</h1>
        <Link href="/templates/new"><Button><Plus size={16} /> New</Button></Link>
      </header>

      {!templates || templates.length === 0 ? (
        <EmptyState
          title="No templates yet"
          description="Templates are reusable strength workouts (Push, Pull, Legs)."
          action={<Link href="/templates/new"><Button>Create one</Button></Link>}
        />
      ) : (
        <ul className="space-y-2">
          {templates.map((t) => (
            <li key={t.id}>
              <Link href={`/templates/${t.id}`}>
                <Card className="hover:bg-muted/40">
                  <div className="font-medium">{t.name}</div>
                  <div className="text-xs text-subtle">
                    {t.exercises.length} exercise{t.exercises.length === 1 ? "" : "s"}
                    {t.description ? ` · ${t.description}` : ""}
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
