/**
 * Team scoring API endpoint.
 *
 * GET /api/team-score — returns team rankings
 * GET /api/team-score?teamId=xxx — returns specific team details
 */
import type { APIRoute } from "astro";

// Mock team data (wire to D1 when backend is ready)
const MOCK_TEAMS = [
  { id: "t1", name: "Detective Noir", memberCount: 4, totalScore: 2850, solvedCount: 27 },
  { id: "t2", name: "Phantom Lens", memberCount: 3, totalScore: 2640, solvedCount: 25 },
  { id: "t3", name: "Red Thread", memberCount: 5, totalScore: 2410, solvedCount: 23 },
  { id: "t4", name: "Cold Case Files", memberCount: 2, totalScore: 2180, solvedCount: 21 },
  { id: "t5", name: "The Archivist", memberCount: 3, totalScore: 1950, solvedCount: 19 },
];

export const GET: APIRoute = ({ url }) => {
  const teamId = url.searchParams.get("teamId");

  if (teamId) {
    const team = MOCK_TEAMS.find(t => t.id === teamId);
    if (!team) {
      return new Response(JSON.stringify({ error: "Team not found" }), { status: 404 });
    }

    return new Response(JSON.stringify({
      teamId: team.id,
      teamName: team.name,
      totalScore: team.totalScore,
      solvedCount: team.solvedCount,
      memberCount: team.memberCount,
      rank: MOCK_TEAMS.indexOf(team) + 1,
    }), { status: 200 });
  }

  // Return all team rankings
  const rankings = MOCK_TEAMS.map((t, i) => ({
    rank: i + 1,
    teamId: t.id,
    teamName: t.name,
    totalScore: t.totalScore,
    solvedCount: t.solvedCount,
    memberCount: t.memberCount,
    avgScorePerMember: Math.round(t.totalScore / t.memberCount),
  }));

  return new Response(JSON.stringify({
    teams: rankings,
    totalTeams: rankings.length,
    totalChallenges: 30,
  }), { status: 200 });
};
