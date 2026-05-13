"use client";

import { useRouter } from "next/navigation";
import TemplateEditor from "@/components/TemplateEditor";

export default function NewTemplatePage() {
  const router = useRouter();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">New template</h1>
      <TemplateEditor onSaved={(id) => router.push(`/templates/${id}`)} />
    </div>
  );
}
