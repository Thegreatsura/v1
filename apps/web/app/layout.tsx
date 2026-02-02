import { GeistMono } from "geist/font/mono";
import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "v1.run - The fastest npm",
  description: "Health scores, security, and real stats — for humans and agents",
  openGraph: {
    title: "v1.run - The fastest npm",
    description: "Health scores, security, and real stats — for humans and agents",
    url: "https://v1.run",
    siteName: "v1.run",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "v1.run - The fastest npm",
    description: "Health scores, security, and real stats — for humans and agents",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={GeistMono.variable}>
      <body className="font-mono">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
