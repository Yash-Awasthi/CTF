/**
 * Puzzle Manager - Challenge lifecycle management.
 * Extracted from cardboard (inspiration).
 * Puzzle creation, assignment, status tracking, and team coordination.
 */

export type PuzzleStatus = "created" | "open" | "solving" | "stuck" | "solved" | "extraction" | "archived";
export type PuzzleDifficulty = "easy" | "medium" | "hard" | "extreme";
export type PuzzleCategory = "crypto" | "web" | "forensics" | "reverse" | "pwn" | "misc" | "osint" | "hardware";

export interface PuzzleTag {
  name: string;
  color: string;
  category?: string;
}

export interface PuzzleActivity {
  userId: string;
  puzzleId: string;
  action: "started" | "hint_requested" | "flag_submitted" | "solved" | "stuck";
  timestamp: Date;
  details?: string;
}

export interface Puzzle {
  id: string;
  name: string;
  description: string;
  difficulty: PuzzleDifficulty;
  category: PuzzleCategory;
  points: number;
  flag: string;
  hints: string[];
  status: PuzzleStatus;
  tags: PuzzleTag[];
  assignedTo?: string[];
  teamId?: string;
  authorId: string;
  url?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  solveCount: number;
  firstBlood?: string;
  firstBloodTime?: Date;
}

export interface PuzzleComment {
  id: string;
  puzzleId: string;
  userId: string;
  content: string;
  timestamp: Date;
}

const STATUS_ORDER: Record<PuzzleStatus, number> = {
  created: 0,
  open: 1,
  solving: 2,
  stuck: 3,
  extraction: 4,
  solved: 5,
  archived: 6,
};

export function createPuzzle(input: {
  name: string;
  description: string;
  difficulty: PuzzleDifficulty;
  category: PuzzleCategory;
  points: number;
  flag: string;
  hints?: string[];
  authorId: string;
  tags?: PuzzleTag[];
}): Puzzle {
  return {
    id: generateId(),
    name: input.name,
    description: input.description,
    difficulty: input.difficulty,
    category: input.category,
    points: input.points,
    flag: input.flag,
    hints: input.hints || [],
    status: "created",
    tags: input.tags || [],
    authorId: input.authorId,
    createdAt: new Date(),
    updatedAt: new Date(),
    solveCount: 0,
  };
}

export function updatePuzzleStatus(puzzle: Puzzle, newStatus: PuzzleStatus): Puzzle {
  const allowedTransitions: Record<PuzzleStatus, PuzzleStatus[]> = {
    created: ["open"],
    open: ["solving", "archived"],
    solving: ["solved", "stuck", "extraction"],
    stuck: ["solving", "extraction"],
    extraction: ["solved", "solving"],
    solved: ["archived"],
    archived: [],
  };
  if (!allowedTransitions[puzzle.status]?.includes(newStatus)) {
    throw new Error(`Invalid status transition: ${puzzle.status} -> ${newStatus}`);
  }
  return {
    ...puzzle,
    status: newStatus,
    updatedAt: new Date(),
  };
}

export function assignPuzzle(puzzle: Puzzle, userId: string): Puzzle {
  const assigned = puzzle.assignedTo || [];
  if (!assigned.includes(userId)) {
    assigned.push(userId);
  }
  return {
    ...puzzle,
    assignedTo: assigned,
    status: puzzle.status === "open" ? "solving" : puzzle.status,
    updatedAt: new Date(),
  };
}

export function unassignPuzzle(puzzle: Puzzle, userId: string): Puzzle {
  return {
    ...puzzle,
    assignedTo: (puzzle.assignedTo || []).filter((id) => id !== userId),
    updatedAt: new Date(),
  };
}

export function verifyFlag(submitted: string, puzzle: Puzzle): boolean {
  const normalize = (s: string) => s.trim().toLowerCase();
  if (normalize(submitted) === normalize(puzzle.flag)) return true;
  const leetVariants: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s", "!": "i" };
  const deLeet = (s: string) => Array.from(s).map((c) => leetVariants[c] || c).join("");
  return deLeet(normalize(submitted)) === deLeet(normalize(puzzle.flag));
}

export function recordSolve(puzzle: Puzzle, userId: string): Puzzle {
  const isFirstBlood = puzzle.solveCount === 0;
  return {
    ...puzzle,
    status: "solved",
    solveCount: puzzle.solveCount + 1,
    firstBlood: isFirstBlood ? userId : puzzle.firstBlood,
    firstBloodTime: isFirstBlood ? new Date() : puzzle.firstBloodTime,
    updatedAt: new Date(),
  };
}

export function calculateDynamicPoints(puzzle: Puzzle, totalParticipants: number): number {
  if (puzzle.solveCount === 0) return puzzle.points;
  const solveRate = puzzle.solveCount / Math.max(totalParticipants, 1);
  const difficultyMultiplier: Record<PuzzleDifficulty, number> = {
    easy: 0.5, medium: 0.75, hard: 1.0, extreme: 1.5,
  };
  const multiplier = difficultyMultiplier[puzzle.difficulty] || 1.0;
  const decayFactor = Math.max(0.3, 1 - solveRate * 0.7);
  return Math.round(puzzle.points * multiplier * decayFactor);
}

export function filterPuzzles(
  puzzles: Puzzle[],
  filters: {
    status?: PuzzleStatus;
    difficulty?: PuzzleDifficulty;
    category?: PuzzleCategory;
    tag?: string;
    assignedTo?: string;
    search?: string;
  }
): Puzzle[] {
  return puzzles.filter((p) => {
    if (filters.status && p.status !== filters.status) return false;
    if (filters.difficulty && p.difficulty !== filters.difficulty) return false;
    if (filters.category && p.category !== filters.category) return false;
    if (filters.tag && !p.tags.some((t) => t.name === filters.tag)) return false;
    if (filters.assignedTo && !p.assignedTo?.includes(filters.assignedTo)) return false;
    if (filters.search) {
      const q = filters.search.toLowerCase();
      if (!p.name.toLowerCase().includes(q) && !p.description.toLowerCase().includes(q)) return false;
    }
    return true;
  });
}

export function sortPuzzles(puzzles: Puzzle[], sortBy: "points" | "status" | "difficulty" | "solveCount" | "createdAt"): Puzzle[] {
  const difficultyOrder: Record<PuzzleDifficulty, number> = { easy: 0, medium: 1, hard: 2, extreme: 3 };
  return [...puzzles].sort((a, b) => {
    switch (sortBy) {
      case "points": return b.points - a.points;
      case "status": return STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
      case "difficulty": return difficultyOrder[a.difficulty] - difficultyOrder[b.difficulty];
      case "solveCount": return b.solveCount - a.solveCount;
      case "createdAt": return b.createdAt.getTime() - a.createdAt.getTime();
      default: return 0;
    }
  });
}

export function getPuzzleStats(puzzles: Puzzle[]): {
  total: number;
  solved: number;
  unsolved: number;
  byDifficulty: Record<PuzzleDifficulty, number>;
  byCategory: Record<string, number>;
  avgSolveRate: number;
} {
  const byDifficulty: Record<string, number> = { easy: 0, medium: 0, hard: 0, extreme: 0 };
  const byCategory: Record<string, number> = {};
  let solved = 0;
  for (const p of puzzles) {
    byDifficulty[p.difficulty] = (byDifficulty[p.difficulty] || 0) + 1;
    byCategory[p.category] = (byCategory[p.category] || 0) + 1;
    if (p.status === "solved") solved++;
  }
  return {
    total: puzzles.length,
    solved,
    unsolved: puzzles.length - solved,
    byDifficulty: byDifficulty as Record<PuzzleDifficulty, number>,
    byCategory,
    avgSolveRate: puzzles.length > 0 ? solved / puzzles.length : 0,
  };
}

function generateId(): string {
  return `pz_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
