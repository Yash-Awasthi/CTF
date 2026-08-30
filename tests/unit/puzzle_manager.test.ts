/**
 * Tests for Puzzle Manager.
 */
import { describe, it, expect } from "vitest";
import {
  createPuzzle,
  updatePuzzleStatus,
  assignPuzzle,
  unassignPuzzle,
  verifyFlag,
  recordSolve,
  calculateDynamicPoints,
  filterPuzzles,
  sortPuzzles,
  getPuzzleStats,
} from "../../src/lib/puzzle_manager";

function makePuzzle(overrides = {}) {
  return createPuzzle({
    name: "Test Puzzle",
    description: "A test",
    difficulty: "medium",
    category: "crypto",
    points: 500,
    flag: "flag{test_flag}",
    authorId: "author1",
    ...overrides,
  });
}

describe("createPuzzle", () => {
  it("creates a puzzle with defaults", () => {
    const p = makePuzzle();
    expect(p.name).toBe("Test Puzzle");
    expect(p.status).toBe("created");
    expect(p.solveCount).toBe(0);
    expect(p.flag).toBe("flag{test_flag}");
  });
});

describe("updatePuzzleStatus", () => {
  it("transitions created -> open", () => {
    const p = makePuzzle();
    const updated = updatePuzzleStatus(p, "open");
    expect(updated.status).toBe("open");
  });

  it("rejects invalid transition", () => {
    const p = makePuzzle();
    expect(() => updatePuzzleStatus(p, "solved")).toThrow("Invalid status transition");
  });

  it("allows solving -> stuck", () => {
    const p = updatePuzzleStatus(makePuzzle(), "open");
    const solving = updatePuzzleStatus(p, "solving");
    const stuck = updatePuzzleStatus(solving, "stuck");
    expect(stuck.status).toBe("stuck");
  });
});

describe("assignPuzzle", () => {
  it("assigns a user", () => {
    const p = makePuzzle();
    const open = updatePuzzleStatus(p, "open");
    const assigned = assignPuzzle(open, "user1");
    expect(assigned.assignedTo).toContain("user1");
    expect(assigned.status).toBe("solving");
  });

  it("does not duplicate assignment", () => {
    const p = makePuzzle();
    const open = updatePuzzleStatus(p, "open");
    const assigned = assignPuzzle(assignPuzzle(open, "user1"), "user1");
    expect(assigned.assignedTo?.length).toBe(1);
  });
});

describe("unassignPuzzle", () => {
  it("removes user", () => {
    let p = assignPuzzle(updatePuzzleStatus(makePuzzle(), "open"), "user1");
    p = unassignPuzzle(p, "user1");
    expect(p.assignedTo).not.toContain("user1");
  });
});

describe("verifyFlag", () => {
  it("exact match", () => {
    expect(verifyFlag("flag{test_flag}", makePuzzle())).toBe(true);
  });

  it("case insensitive", () => {
    expect(verifyFlag("FLAG{TEST_FLAG}", makePuzzle())).toBe(true);
  });

  it("with whitespace", () => {
    expect(verifyFlag("  flag{test_flag}  ", makePuzzle())).toBe(true);
  });

  it("wrong flag", () => {
    expect(verifyFlag("flag{wrong}", makePuzzle())).toBe(false);
  });

  it("leet speak variant", () => {
    const p = makePuzzle({ flag: "flag{hello}" });
    expect(verifyFlag("flag{h3ll0}", p)).toBe(true);
  });
});

describe("recordSolve", () => {
  it("records first blood", () => {
    const p = makePuzzle();
    const solved = recordSolve(p, "user1");
    expect(solved.firstBlood).toBe("user1");
    expect(solved.firstBloodTime).toBeDefined();
    expect(solved.solveCount).toBe(1);
  });

  it("not first blood", () => {
    let p = makePuzzle();
    p = recordSolve(p, "user1");
    p = recordSolve(p, "user2");
    expect(p.firstBlood).toBe("user1");
    expect(p.solveCount).toBe(2);
  });
});

describe("calculateDynamicPoints", () => {
  it("no solves returns full points", () => {
    const p = makePuzzle({ points: 500 });
    expect(calculateDynamicPoints(p, 100)).toBe(500);
  });

  it("high solve rate reduces points", () => {
    const p = makePuzzle({ points: 500, difficulty: "easy" });
    (p as any).solveCount = 90;
    const pts = calculateDynamicPoints(p, 100);
    expect(pts).toBeLessThan(500);
  });
});

describe("filterPuzzles", () => {
  it("filters by difficulty", () => {
    const puzzles = [makePuzzle({ difficulty: "easy" }), makePuzzle({ difficulty: "hard" })];
    const filtered = filterPuzzles(puzzles, { difficulty: "easy" });
    expect(filtered.length).toBe(1);
  });

  it("filters by search", () => {
    const puzzles = [makePuzzle({ name: "RSA Challenge" }), makePuzzle({ name: "XOR Puzzle" })];
    const filtered = filterPuzzles(puzzles, { search: "RSA" });
    expect(filtered.length).toBe(1);
  });
});

describe("sortPuzzles", () => {
  it("sorts by points descending", () => {
    const puzzles = [makePuzzle({ points: 100 }), makePuzzle({ points: 500 }), makePuzzle({ points: 300 })];
    const sorted = sortPuzzles(puzzles, "points");
    expect(sorted[0].points).toBe(500);
  });
});

describe("getPuzzleStats", () => {
  it("calculates stats", () => {
    const puzzles = [
      makePuzzle({ difficulty: "easy", category: "crypto" }),
      makePuzzle({ difficulty: "hard", category: "web" }),
    ];
    (puzzles[0] as any).status = "solved";
    const stats = getPuzzleStats(puzzles);
    expect(stats.total).toBe(2);
    expect(stats.solved).toBe(1);
    expect(stats.byDifficulty.easy).toBe(1);
  });
});
