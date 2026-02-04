import striptags from "striptags";

/**
 * Strip HTML tags from a string
 * Used to clean package descriptions that may contain HTML
 */
export function stripHtml(html: string | undefined | null): string | undefined {
  if (!html) return undefined;
  return striptags(html).trim() || undefined;
}
