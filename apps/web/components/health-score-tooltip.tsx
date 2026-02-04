"use client";

import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const HEALTH_SCORE_EXPLANATION = (
  <>
    Combines downloads, TypeScript, ESM, security, maintenance & GitHub stars into 0–100 (A–F).
    <br />
    <br />
    So you can see at a glance if a package is trustworthy.
  </>
);

export function HealthScoreTooltipTrigger() {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="inline-flex cursor-help rounded p-0.5 text-subtle hover:text-muted focus:outline-none focus:ring-2 focus:ring-muted"
          aria-label="How health score is measured"
        >
          <Info className="size-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        className="!text-[10px]"
        style={{ maxWidth: "220px", fontSize: "10px" }}
      >
        <p className="leading-relaxed text-left">{HEALTH_SCORE_EXPLANATION}</p>
      </TooltipContent>
    </Tooltip>
  );
}

export function HealthScoreTooltip({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn("cursor-help", className)}>{children}</span>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        className="!text-[10px]"
        style={{ maxWidth: "220px", fontSize: "10px" }}
      >
        <p className="leading-relaxed text-left">{HEALTH_SCORE_EXPLANATION}</p>
      </TooltipContent>
    </Tooltip>
  );
}
