"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SearchTrigger } from "@/components/command-search";

export function Header() {
  const pathname = usePathname();

  // Hide header on homepage
  if (pathname === "/") {
    return null;
  }

  return (
    <header className="border-b border-[#333] bg-black">
      <div className="container-page flex py-3 items-center gap-6">
        <Link href="/" className="shrink-0 hover:opacity-80 transition-opacity">
          <Image src="/logo.svg" alt="V1" width={32} height={22} />
        </Link>
        <SearchTrigger />
        <div className="flex-1" />
        <Link
          href="/mcp"
          className={`text-xs uppercase tracking-wider transition-colors ${
            pathname === "/mcp" ? "text-white" : "text-[#666] hover:text-white"
          }`}
        >
          MCP
        </Link>
      </div>
    </header>
  );
}
