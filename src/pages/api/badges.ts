/**
 * Badge API — retrieve badge templates, evaluate badge eligibility.
 * Wired from badge_system.ts (extracted from flagforge).
 */
import type { APIRoute } from "astro";
import {
  getDefaultBadges,
  sortBadgesByRarity,
  getBadgesByCategory,
  getRarityColor,
  getRarityXP,
} from "../../lib/badge_system";

export const prerender = false;

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), {
    status: s,
    headers: { "content-type": "application/json" },
  });
}

export const GET: APIRoute = async ({ url }) => {
  const action = url.searchParams.get("action") || "templates";
  const category = url.searchParams.get("category") as
    | "solve"
    | "streak"
    | "speed"
    | "collaboration"
    | "special"
    | null;

  switch (action) {
    case "templates": {
      const badges = getDefaultBadges();
      if (category) {
        return json({ badges: getBadgesByCategory(badges, category) });
      }
      return json({ badges: sortBadgesByRarity(badges) });
    }
    case "rarity-info": {
      const rarities = ["common", "uncommon", "rare", "epic", "legendary"] as const;
      return json({
        rarities: rarities.map((r) => ({
          name: r,
          color: getRarityColor(r),
          xp: getRarityXP(r),
        })),
      });
    }
    default:
      return json({ error: "Unknown action" }, 400);
  }
};
