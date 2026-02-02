"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { searchPackages } from "./api";

export function useSearch(query: string, debounceMs = 100) {
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), debounceMs);
    return () => clearTimeout(timer);
  }, [query, debounceMs]);

  const result = useQuery({
    queryKey: ["search", debouncedQuery],
    queryFn: () => searchPackages(debouncedQuery),
    enabled: debouncedQuery.length > 0,
    staleTime: 30 * 1000,
  });

  return {
    ...result,
    debouncedQuery,
  };
}
