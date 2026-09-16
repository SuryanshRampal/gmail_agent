"use client";

import { useEffect, useState } from "react";
import { Moon } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

const THEME_KEY = "gmail-agent-night-mode";

export function ThemeToggle() {
  const [nightMode, setNightMode] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const saved = window.localStorage.getItem(THEME_KEY);
      const enabled = saved === null ? true : saved === "true";
      setNightMode(enabled);
      document.documentElement.classList.toggle("dark", enabled);
      document.documentElement.classList.toggle("light", !enabled);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const toggleNightMode = (enabled: boolean) => {
    setNightMode(enabled);
    window.localStorage.setItem(THEME_KEY, String(enabled));
    document.documentElement.classList.toggle("dark", enabled);
    document.documentElement.classList.toggle("light", !enabled);
  };

  return <div className="flex items-center gap-2 whitespace-nowrap"><Moon className="size-4 text-white/60" /><Switch id="night-mode" checked={nightMode} onCheckedChange={toggleNightMode} aria-label="Toggle night mode" size="sm" /><Label htmlFor="night-mode" className="text-xs text-white/60">Night Mode</Label></div>;
}
