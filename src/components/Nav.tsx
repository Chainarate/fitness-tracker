"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  Home,
  Dumbbell,
  LineChart,
  Settings as SettingsIcon,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  match: (p: string) => boolean;
}

const items: NavItem[] = [
  { href: "/", label: "Today", icon: Home, match: (p) => p === "/" },
  { href: "/calendar", label: "Calendar", icon: CalendarDays, match: (p) => p.startsWith("/calendar") },
  // "Exercises" tab covers the library / templates / cardio-log / active workout —
  // they're all under the "training inventory & execution" umbrella.
  { href: "/exercises", label: "Library", icon: Dumbbell, match: (p) => p.startsWith("/exercises") || p.startsWith("/templates") || p.startsWith("/workout") || p.startsWith("/cardio") },
  { href: "/progress", label: "Progress", icon: LineChart, match: (p) => p.startsWith("/progress") || p.startsWith("/metrics") },
  { href: "/settings", label: "Settings", icon: SettingsIcon, match: (p) => p.startsWith("/settings") },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <>
      {/* Desktop side rail */}
      <nav
        aria-label="Primary"
        className="hidden md:flex fixed inset-y-0 left-0 w-60 flex-col border-r border-border bg-surface px-3 py-6"
      >
        <div className="px-2 pb-6 text-lg font-semibold">Fitness Tracker</div>
        <ul className="flex flex-col gap-1">
          {items.map((item) => {
            const active = item.match(pathname);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium",
                    active ? "bg-muted text-fg" : "text-subtle hover:bg-muted hover:text-fg",
                  )}
                >
                  <Icon size={18} />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Mobile bottom tab bar */}
      <nav
        aria-label="Primary"
        className="md:hidden fixed bottom-0 inset-x-0 z-30 border-t border-border bg-surface/95 backdrop-blur pb-[env(safe-area-inset-bottom)]"
      >
        <ul className="grid grid-cols-5">
          {items.map((item) => {
            const active = item.match(pathname);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-medium",
                    active ? "text-primary" : "text-subtle",
                  )}
                >
                  <Icon size={20} />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
