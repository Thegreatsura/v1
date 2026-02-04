"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { CommandSearchProvider } from "@/components/command-search";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Scanlines } from "@/components/scanlines";
import { MCPToast } from "@/components/mcp-toast";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            gcTime: 5 * 60 * 1000, // 5 minutes
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider delayDuration={200} skipDelayDuration={0}>
          <Scanlines />
          <CommandSearchProvider>{children}</CommandSearchProvider>
          <MCPToast />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
