"use client";

import dynamic from "next/dynamic";

const LiveFeedBackground = dynamic(
  () => import("@/components/live-feed-background").then((m) => m.LiveFeedBackground),
  { ssr: false },
);

export function LiveFeedWrapper() {
  return <LiveFeedBackground />;
}
