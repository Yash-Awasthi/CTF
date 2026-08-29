/**
 * Team management for Case 71-C.
 *
 * Supports create/join/leave teams, invite codes, captain roles,
 * and team scoring.  localStorage persistence (mock backend).
 */

export interface Team {
  id: string;
  name: string;
  inviteCode: string;
  captainId: string;
  memberIds: string[];
  createdAt: string;
}

export interface TeamMember {
  userId: string;
  username: string;
  teamId: string;
  role: "captain" | "member";
  joinedAt: string;
}

const TEAMS_KEY = "case71c_teams";
const MEMBERS_KEY = "case71c_team_members";
const SOLVES_KEY = "case71c_team_solves";

// ── Team CRUD ─────────────────────────────────────────────────────────────

function getTeams(): Team[] {
  try {
    return JSON.parse(localStorage.getItem(TEAMS_KEY) ?? "[]");
  } catch { return []; }
}

function saveTeams(teams: Team[]): void {
  localStorage.setItem(TEAMS_KEY, JSON.stringify(teams));
}

function getMembers(): TeamMember[] {
  try {
    return JSON.parse(localStorage.getItem(MEMBERS_KEY) ?? "[]");
  } catch { return []; }
}

function saveMembers(members: TeamMember[]): void {
  localStorage.setItem(MEMBERS_KEY, JSON.stringify(members));
}

function getSolves(): Record<string, Set<string>> {
  try {
    const raw = JSON.parse(localStorage.getItem(SOLVES_KEY) ?? "{}");
    const result: Record<string, Set<string>> = {};
    for (const [k, v] of Object.entries(raw)) result[k] = new Set(v as string[]);
    return result;
  } catch { return {}; }
}

function saveSolves(solves: Record<string, Set<string>>): void {
  const raw: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(solves)) raw[k] = [...v];
  localStorage.setItem(SOLVES_KEY, JSON.stringify(raw));
}

function generateId(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 10);
}

function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I/O/0/1 for clarity
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

// ── Validation ────────────────────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validateTeamName(name: string): ValidationResult {
  if (name.length < 3) return { valid: false, error: "Team name must be at least 3 characters" };
  if (name.length > 30) return { valid: false, error: "Team name must be at most 30 characters" };
  if (!/^[a-zA-Z0-9_ -]+$/.test(name)) return { valid: false, error: "Team name can only contain letters, numbers, spaces, hyphens, and underscores" };
  return { valid: true };
}

export function validateInviteCode(code: string): ValidationResult {
  if (code.length !== 6) return { valid: false, error: "Invite code must be 6 characters" };
  if (!/^[A-Z0-9]{6}$/.test(code)) return { valid: false, error: "Invalid invite code format" };
  return { valid: true };
}

// ── Create Team ───────────────────────────────────────────────────────────

export function createTeam(
  name: string,
  userId: string,
  username: string,
): { success: boolean; error?: string; team?: Team } {
  const vCheck = validateTeamName(name);
  if (!vCheck.valid) return { success: false, error: vCheck.error };

  const teams = getTeams();

  // Check if user is already in a team
  const existing = teams.find(t => t.memberIds.includes(userId));
  if (existing) return { success: false, error: "You're already in a team. Leave first." };

  // Check name uniqueness
  if (teams.some(t => t.name.toLowerCase() === name.toLowerCase())) {
    return { success: false, error: "Team name already taken" };
  }

  const team: Team = {
    id: generateId(),
    name,
    inviteCode: generateInviteCode(),
    captainId: userId,
    memberIds: [userId],
    createdAt: new Date().toISOString(),
  };

  teams.push(team);
  saveTeams(teams);

  // Add captain membership
  const members = getMembers();
  members.push({
    userId,
    username,
    teamId: team.id,
    role: "captain",
    joinedAt: new Date().toISOString(),
  });
  saveMembers(members);

  return { success: true, team };
}

// ── Join Team ─────────────────────────────────────────────────────────────

export function joinTeam(
  inviteCode: string,
  userId: string,
  username: string,
): { success: boolean; error?: string; team?: Team } {
  const vCheck = validateInviteCode(inviteCode);
  if (!vCheck.valid) return { success: false, error: vCheck.error };

  const teams = getTeams();
  const team = teams.find(t => t.inviteCode === inviteCode);
  if (!team) return { success: false, error: "Invalid invite code" };

  // Check if already in this team
  if (team.memberIds.includes(userId)) {
    return { success: false, error: "You're already in this team" };
  }

  // Check if in another team
  if (teams.some(t => t.memberIds.includes(userId))) {
    return { success: false, error: "Leave your current team first" };
  }

  // Check team size limit
  if (team.memberIds.length >= 5) {
    return { success: false, error: "Team is full (max 5 members)" };
  }

  team.memberIds.push(userId);
  saveTeams(teams);

  const members = getMembers();
  members.push({
    userId,
    username,
    teamId: team.id,
    role: "member",
    joinedAt: new Date().toISOString(),
  });
  saveMembers(members);

  return { success: true, team };
}

// ── Leave Team ────────────────────────────────────────────────────────────

export function leaveTeam(userId: string): { success: boolean; error?: string } {
  const teams = getTeams();
  const team = teams.find(t => t.memberIds.includes(userId));
  if (!team) return { success: false, error: "You're not in a team" };

  // Captain can't leave — must disband or transfer
  if (team.captainId === userId && team.memberIds.length > 1) {
    return { success: false, error: "Captain must transfer leadership or disband the team" };
  }

  // If captain and last member, delete team
  if (team.captainId === userId && team.memberIds.length === 1) {
    const updated = teams.filter(t => t.id !== team.id);
    saveTeams(updated);
    const members = getMembers().filter(m => m.teamId !== team.id);
    saveMembers(members);
    return { success: true };
  }

  team.memberIds = team.memberIds.filter(id => id !== userId);
  saveTeams(teams);

  const members = getMembers().filter(m => m.userId !== userId);
  saveMembers(members);

  return { success: true };
}

// ── Delete Team ───────────────────────────────────────────────────────────

export function deleteTeam(userId: string): { success: boolean; error?: string } {
  const teams = getTeams();
  const team = teams.find(t => t.memberIds.includes(userId));
  if (!team) return { success: false, error: "Team not found" };
  if (team.captainId !== userId) return { success: false, error: "Only the captain can delete the team" };

  const updated = teams.filter(t => t.id !== team.id);
  saveTeams(updated);
  const members = getMembers().filter(m => m.teamId !== team.id);
  saveMembers(members);

  return { success: true };
}

// ── Promote to Captain ────────────────────────────────────────────────────

export function promoteToCaptain(
  currentCaptainId: string,
  targetUserId: string,
): { success: boolean; error?: string } {
  const teams = getTeams();
  const team = teams.find(t => t.memberIds.includes(currentCaptainId));
  if (!team) return { success: false, error: "Team not found" };
  if (team.captainId !== currentCaptainId) return { success: false, error: "Only the captain can promote" };
  if (!team.memberIds.includes(targetUserId)) return { success: false, error: "Target not in team" };

  team.captainId = targetUserId;
  saveTeams(teams);

  const members = getMembers();
  const oldCaptain = members.find(m => m.userId === currentCaptainId && m.teamId === team.id);
  const newCaptain = members.find(m => m.userId === targetUserId && m.teamId === team.id);
  if (oldCaptain) oldCaptain.role = "member";
  if (newCaptain) newCaptain.role = "captain";
  saveMembers(members);

  return { success: true };
}

// ── Remove Member ─────────────────────────────────────────────────────────

export function removeMember(
  captainId: string,
  targetUserId: string,
): { success: boolean; error?: string } {
  const teams = getTeams();
  const team = teams.find(t => t.memberIds.includes(captainId));
  if (!team) return { success: false, error: "Team not found" };
  if (team.captainId !== captainId) return { success: false, error: "Only the captain can remove members" };
  if (targetUserId === captainId) return { success: false, error: "Captain can't remove themselves" };
  if (!team.memberIds.includes(targetUserId)) return { success: false, error: "Target not in team" };

  team.memberIds = team.memberIds.filter(id => id !== targetUserId);
  saveTeams(teams);

  const members = getMembers().filter(m => !(m.userId === targetUserId && m.teamId === team.id));
  saveMembers(members);

  return { success: true };
}

// ── Query Functions ───────────────────────────────────────────────────────

export function getUserTeam(userId: string): Team | null {
  return getTeams().find(t => t.memberIds.includes(userId)) ?? null;
}

export function getTeamMembers(teamId: string): TeamMember[] {
  return getMembers().filter(m => m.teamId === teamId);
}

export function getTeamById(teamId: string): Team | null {
  return getTeams().find(t => t.id === teamId) ?? null;
}

export function getTeamByCode(code: string): Team | null {
  return getTeams().find(t => t.inviteCode === code) ?? null;
}

// ── Team Scoring ──────────────────────────────────────────────────────────

/**
 * Record a solve for a team.
 * Best score per challenge counts once (no duplicate scoring).
 */
export function recordTeamSolve(
  teamId: string,
  challengeId: number,
  points: number,
): void {
  const solves = getSolves();
  if (!solves[teamId]) solves[teamId] = new Set();
  // Only store if better than existing
  const existing = parseInt(solves[teamId].get(`challenge_${challengeId}`) ?? "0");
  if (points > existing) {
    solves[teamId].set(`challenge_${challengeId}`, String(points));
  }
  saveSolves(solves);
}

/**
 * Get team total score (best score per challenge).
 */
export function getTeamScore(teamId: string): { totalScore: number; solvedCount: number } {
  const solves = getSolves();
  const teamSolves = solves[teamId];
  if (!teamSolves) return { totalScore: 0, solvedCount: 0 };

  let totalScore = 0;
  let solvedCount = 0;
  for (const [key, pointsStr] of teamSolves) {
    if (key.startsWith("challenge_")) {
      totalScore += parseInt(pointsStr);
      solvedCount++;
    }
  }
  return { totalScore, solvedCount };
}

/**
 * Get team leaderboard (all teams ranked by score).
 */
export function getTeamLeaderboard(): Array<{
  rank: number;
  teamId: string;
  teamName: string;
  totalScore: number;
  solvedCount: number;
  memberCount: number;
}> {
  const teams = getTeams();
  const scores = teams.map(t => {
    const { totalScore, solvedCount } = getTeamScore(t.id);
    return {
      rank: 0,
      teamId: t.id,
      teamName: t.name,
      totalScore,
      solvedCount,
      memberCount: t.memberIds.length,
    };
  });

  scores.sort((a, b) => b.totalScore - a.totalScore || b.solvedCount - a.solvedCount);
  scores.forEach((s, i) => s.rank = i + 1);

  return scores;
}

/**
 * Check if any teammate has solved a challenge.
 */
export function hasTeamSolved(userId: string, challengeId: number): boolean {
  const team = getUserTeam(userId);
  if (!team) return false;
  const solves = getSolves();
  const teamSolves = solves[team.id];
  if (!teamSolves) return false;
  return teamSolves.has(`challenge_${challengeId}`);
}

/**
 * Check if the current user has solved a challenge.
 */
export function hasUserSolved(userId: string, challengeId: number): boolean {
  const solves = getSolves();
  const userSolves = solves[`user_${userId}`];
  if (!userSolves) return false;
  return userSolves.has(`challenge_${challengeId}`);
}

export function recordUserSolve(userId: string, challengeId: number, points: number): void {
  const solves = getSolves();
  const key = `user_${userId}`;
  if (!solves[key]) solves[key] = new Set();
  const existing = parseInt(solves[key].get(`challenge_${challengeId}`) ?? "0");
  if (points > existing) {
    solves[key].set(`challenge_${challengeId}`, String(points));
  }
  saveSolves(solves);
}
