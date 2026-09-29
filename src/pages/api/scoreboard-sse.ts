/**
 * Live Scoreboard SSE endpoint — streams real-time updates.
 */
import type { APIRoute } from "astro";
import {
  getScoreboardState,
  formatSSEPayload,
  type ScoreboardState,
} from "../../lib/live_scoreboard";

export const prerender = false;

export const GET: APIRoute = async ({ locals }) => {
  if (!locals.auth) return new Response("unauthorized", { status: 401 });
  const encoder = new TextEncoder();

  let interval: ReturnType<typeof setInterval>;
  let timeout: ReturnType<typeof setTimeout>;
  const stream = new ReadableStream({
    start(controller) {
      // Send initial state
      const state = getScoreboardState();
      controller.enqueue(
        encoder.encode(`data: ${formatSSEPayload(state)}\n\n`)
      );

      // Poll for updates every 2 seconds
      interval = setInterval(() => {
        const state = getScoreboardState();
        controller.enqueue(
          encoder.encode(`data: ${formatSSEPayload(state)}\n\n`)
        );
      }, 2000);

      // Cleanup after 30 minutes
      timeout = setTimeout(() => {
        clearInterval(interval);
        controller.close();
      }, 30 * 60 * 1000);
    },
    cancel() {
      clearInterval(interval);
      clearTimeout(timeout);
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
};
