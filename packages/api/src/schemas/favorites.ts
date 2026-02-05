/**
 * Favorites Schemas
 *
 * Zod schemas for favorites-related API responses.
 */

import { z } from "zod";

// =============================================================================
// Favorites
// =============================================================================

export const FavoritesListResponseSchema = z.object({
  favorites: z.array(z.string()),
});

export const FavoriteActionResponseSchema = z.object({
  success: z.boolean(),
  packageName: z.string(),
});

export const FavoriteCheckResponseSchema = z.object({
  isFavorite: z.boolean(),
});

// Type exports
export type FavoritesListResponse = z.infer<typeof FavoritesListResponseSchema>;
export type FavoriteActionResponse = z.infer<typeof FavoriteActionResponseSchema>;
export type FavoriteCheckResponse = z.infer<typeof FavoriteCheckResponseSchema>;
