"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

/**
 * Magic-link callback. Supabase JS auto-parses the URL hash and stores
 * the session on `getSession()`. We just need to wait until that resolves
 * and then redirect home.
 */
export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<div className="p-8 text-subtle">Signing in…</div>}>
      <Inner />
    </Suspense>
  );
}

function Inner() {
  const router = useRouter();
  const [status, setStatus] = useState("Signing you in…");

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setStatus("Cloud sync is not configured.");
      return;
    }
    void (async () => {
      try {
        const supabase = getSupabase();
        // Wait for session to be established (Supabase reads the URL hash).
        await supabase.auth.getSession();
        setStatus("Signed in — redirecting…");
        setTimeout(() => router.replace("/settings?welcome=1"), 500);
      } catch (err) {
        setStatus(`Sign-in failed: ${(err as Error).message}`);
      }
    })();
  }, [router]);

  return (
    <div className="p-8 text-center text-sm text-subtle">{status}</div>
  );
}
