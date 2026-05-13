"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db";
import TemplateEditor from "@/components/TemplateEditor";

export default function EditTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const template = useLiveQuery(() => db.templates.get(id), [id]);

  if (!template) return <div className="text-subtle">Loading…</div>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Edit template</h1>
      <TemplateEditor
        initial={template}
        onSaved={() => router.push("/templates")}
        onDeleted={() => router.push("/templates")}
      />
    </div>
  );
}
