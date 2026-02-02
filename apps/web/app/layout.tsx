import { GeistMono } from "geist/font/mono";
import type { Metadata } from "next";
import { OpenPanelComponent } from "@openpanel/nextjs";
import { Providers } from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://v1.run"),
  title: "v1.run - npm for agents",
  description:
    "MCP-first npm registry. Security signals and package health in sub-100ms, globally.",
  alternates: {
    canonical: "https://v1.run",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    title: "v1.run - npm for agents",
    description:
      "MCP-first npm registry. Security signals and package health in sub-100ms, globally.",
    url: "https://v1.run",
    siteName: "v1.run",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "v1.run - npm for agents",
    description:
      "MCP-first npm registry. Security signals and package health in sub-100ms, globally.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={GeistMono.variable} suppressHydrationWarning>
      <body className="font-mono bg-background text-foreground">
        <OpenPanelComponent
          clientId={process.env.NEXT_PUBLIC_OPENPANEL_CLIENT_ID!}
          trackScreenViews
          trackOutgoingLinks
        />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
