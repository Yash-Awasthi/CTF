/**
 * OpenAPI 3.1 specification for CTF API endpoints.
 * Serves the full API documentation at /api/openapi.json
 */
import type { APIRoute } from "astro";

export const prerender = false;

const spec = {
  openapi: "3.1.0",
  info: {
    title: "Case Files CTF API",
    description:
      "Real-time CTF competition platform with live scoring, adaptive difficulty, badge system, and challenge generation.",
    version: "1.0.0",
    contact: { name: "CTF Platform Team" },
  },
  servers: [{ url: "/", description: "Current server" }],
  paths: {
    "/api/badges": {
      get: {
        operationId: "getBadges",
        summary: "Get badge templates or rarity information",
        tags: ["Badges"],
        parameters: [
          {
            name: "action",
            in: "query",
            required: false,
            schema: { type: "string", enum: ["templates", "rarity-info"], default: "templates" },
            description: "Action to perform: 'templates' returns badge list, 'rarity-info' returns rarity metadata",
          },
          {
            name: "category",
            in: "query",
            required: false,
            schema: { type: "string", enum: ["solve", "streak", "speed", "collaboration", "special"] },
            description: "Filter badges by category (only applies when action=templates)",
          },
        ],
        responses: {
          "200": {
            description: "Badge templates or rarity info",
            content: {
              "application/json": {
                schema: {
                  oneOf: [
                    {
                      type: "object",
                      properties: {
                        badges: {
                          type: "array",
                          items: { $ref: "#/components/schemas/BadgeTemplate" },
                        },
                      },
                    },
                    {
                      type: "object",
                      properties: {
                        rarities: {
                          type: "array",
                          items: { $ref: "#/components/schemas/RarityInfo" },
                        },
                      },
                    },
                  ],
                },
                examples: {
                  templates: {
                    summary: "All badge templates",
                    value: {
                      badges: [
                        {
                          id: "first_blood",
                          name: "First Blood",
                          description: "Solve a challenge first",
                          icon: "🩸",
                          color: "#f44336",
                          rarity: "epic",
                          category: "solve",
                          criteria: { type: "first_blood", target: 1 },
                          isActive: true,
                          createdAt: "2025-01-01T00:00:00.000Z",
                        },
                      ],
                    },
                  },
                  rarityInfo: {
                    summary: "Rarity metadata",
                    value: {
                      rarities: [
                        { name: "common", color: "#9e9e9e", xp: 10 },
                        { name: "uncommon", color: "#4caf50", xp: 25 },
                        { name: "rare", color: "#2196f3", xp: 50 },
                        { name: "epic", color: "#9c27b0", xp: 100 },
                        { name: "legendary", color: "#ff9800", xp: 250 },
                      ],
                    },
                  },
                },
              },
            },
          },
          "400": {
            description: "Unknown action",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
                example: { error: "Unknown action" },
              },
            },
          },
        },
      },
    },
    "/api/scoreboard-sse": {
      get: {
        operationId: "getScoreboardSSE",
        summary: "Subscribe to live scoreboard updates via SSE",
        tags: ["Scoreboard"],
        description:
          "Server-Sent Events endpoint for real-time competition updates. Emits score_update, challenge_solved, badge_awarded, and heartbeat events.",
        responses: {
          "200": {
            description: "SSE event stream",
            content: {
              "text/event-stream": {
                schema: { type: "string" },
                example:
                  'id: 1700000000000\nevent: score_update\ndata: {"teamId":"team-1","teamName":"HackerOne","newScore":1500,"rank":1}\n\n',
              },
            },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      BadgeTemplate: {
        type: "object",
        required: ["id", "name", "description", "icon", "color", "rarity", "category", "criteria", "isActive"],
        properties: {
          id: { type: "string", example: "first_blood" },
          name: { type: "string", example: "First Blood" },
          description: { type: "string", example: "Solve a challenge first" },
          icon: { type: "string", example: "🩸" },
          color: { type: "string", example: "#f44336" },
          rarity: { type: "string", enum: ["common", "uncommon", "rare", "epic", "legendary"] },
          category: { type: "string", enum: ["solve", "streak", "speed", "collaboration", "special"] },
          criteria: { $ref: "#/components/schemas/BadgeCriteria" },
          isActive: { type: "boolean" },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      BadgeCriteria: {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["challenges_solved", "category_solved", "first_blood", "streak_days", "speed_demon", "hintless", "team_score"],
          },
          target: { type: "integer", example: 1 },
          category: { type: "string", nullable: true },
          timeframe: { type: "string", enum: ["daily", "weekly", "monthly", "all_time"], nullable: true },
        },
      },
      RarityInfo: {
        type: "object",
        properties: {
          name: { type: "string", enum: ["common", "uncommon", "rare", "epic", "legendary"] },
          color: { type: "string", example: "#9e9e9e" },
          xp: { type: "integer", example: 10 },
        },
      },
      Error: {
        type: "object",
        properties: {
          error: { type: "string" },
        },
      },
      SolveEvent: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["solve", "flag_wrong", "hint_used", "badge_awarded"] },
          teamId: { type: "string" },
          teamName: { type: "string" },
          challengeId: { type: "string" },
          challengeName: { type: "string" },
          points: { type: "integer" },
          timestamp: { type: "integer", format: "int64" },
          badge: { $ref: "#/components/schemas/BadgeInfo", nullable: true },
        },
      },
      BadgeInfo: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          icon: { type: "string" },
          rarity: { type: "string" },
        },
      },
      ScoreboardEntry: {
        type: "object",
        properties: {
          rank: { type: "integer" },
          teamId: { type: "string" },
          teamName: { type: "string" },
          score: { type: "integer" },
          solves: { type: "integer" },
          lastSolveAt: { type: "integer" },
          badgeCount: { type: "integer" },
        },
      },
    },
  },
};

export const GET: APIRoute = async () => {
  return new Response(JSON.stringify(spec, null, 2), {
    status: 200,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
    },
  });
};
