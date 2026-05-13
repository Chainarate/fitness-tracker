"use client";

import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, ensureInitialized } from "@/db";
import { Nav } from "./Nav";
import { isSupabaseConfigured, getSupabase, type Session } from "@/lib/supabase";
import { installSyncHooks, syncAll } from "@/lib/sync";

/**
 * Top-level client wrapper. Owns:
 * - DB initialization (seed defaults on first run)
 * - Theme class application
 * - Auth session tracking + initial sync on sign-in
 * - Dexie sync hooks installation
 * - Layout (mobile = bottom nav; desktop ≥ md = side rail)
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const settings = useLiveQuery(() => db.settings.get("singleton"), []);
  const [session, setSession] = useState<Session | null>(null);

  // One-time DB init + hooks.
  useEffect(() => {
    void ensureInitialized();
    if (isSupabaseConfigured()) installSyncHooks();
  }, []);

  // Track Supabase session.
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const supabase = getSupabase();
    void supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  // Auto-sync on sign-in and on tab focus.
  useEffect(() => {
    if (!session) return;
    void syncAll().catch(() => undefined);
    const onFocus = () => void syncAll().catch(() => undefined);
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [session]);

  // Theme.
  useEffect(() => {
    if (!settings) return;
    const root = document.documentElement;
    const desired =
      settings.theme === "system"
        ? window.matchMedia("(prefers-color-scheme: dark)").matches
        : settings.theme === "dark";
    root.classList.toggle("dark", desired);
  }, [settings]);

  return (
    <div className="min-h-screen flex md:flex-row flex-col">
      <Nav />
      <main className="flex-1 pb-20 md:pb-0 md:pl-60">
        <div className="mx-auto w-full max-w-3xl px-4 py-6 md:py-8">{children}</div>
      </main>
    </div>
  );
}
