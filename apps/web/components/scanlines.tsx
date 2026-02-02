"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function Scanlines() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Avoid hydration mismatch
  if (!mounted) {
    return (
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-9999"
        style={{
          background: `repeating-linear-gradient(
            0deg,
            transparent 0px,
            transparent 1px,
            var(--scanline) 1px,
            var(--scanline) 2px
          )`,
        }}
      />
    );
  }

  const scanlineColor =
    resolvedTheme === "dark" ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.04)";

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-9999"
      style={{
        background: `repeating-linear-gradient(
          0deg,
          transparent 0px,
          transparent 1px,
          ${scanlineColor} 1px,
          ${scanlineColor} 2px
        )`,
      }}
    />
  );
}
