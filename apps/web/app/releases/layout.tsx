import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Upcoming Releases | packrun.dev",
  description: "Follow upcoming npm package releases and get notified when they ship.",
};

export default function ReleasesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
