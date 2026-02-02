"use client";

import Link from "next/link";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function Footer() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  };

  return (
    <footer className="border-t border-border mt-auto">
      <div className="container-page py-4 flex items-center justify-between text-xs text-muted">
        <Link href="/" className="hover:text-foreground transition-colors">
          v1.run
        </Link>
        {mounted && (
          <button
            onClick={toggleTheme}
            className="hover:text-foreground transition-colors"
            aria-label={`Switch to ${resolvedTheme === "dark" ? "light" : "dark"} mode`}
          >
            {resolvedTheme === "dark" ? "light" : "dark"}
          </button>
        )}
      </div>
    </footer>
  );
}
