/**
 * Puzzle compilation and evaluation engine.
 * Patterns extracted from PuzzleScript — game state compilation and rule evaluation.
 */

export type CellType = string;
export type Direction = "up" | "down" | "left" | "right" | "stay";

export interface PuzzleDefinition {
  title: string;
  author: string;
  grid: CellType[][];
  rules: PuzzleRule[];
  winCondition: WinCondition;
  legend: Record<string, string>;
  objects: PuzzleObject[];
}

export interface PuzzleRule {
  type: "move" | "transform" | "destroy" | "create" | "conditional";
  source: string[];
  target: string[];
  direction?: Direction;
  condition?: string;
}

export interface WinCondition {
  type: "all" | "any" | "some";
  target: string;
  count?: number;
}

export interface PuzzleObject {
  name: string;
  color: string;
  symbol: string;
  properties: string[];
}

export interface PuzzleState {
  grid: CellType[][];
  moveCount: number;
  history: PuzzleState[];
  solved: boolean;
  startTime: number;
}

const DIRECTION_VECTORS: Record<Direction, [number, number]> = {
  up: [-1, 0],
  down: [1, 0],
  left: [0, -1],
  right: [0, 1],
  stay: [0, 0],
};

export function createPuzzleState(grid: CellType[][]): PuzzleState {
  return {
    grid: grid.map((row) => [...row]),
    moveCount: 0,
    history: [],
    solved: false,
    startTime: Date.now(),
  };
}

export function cloneGrid(grid: CellType[][]): CellType[][] {
  return grid.map((row) => [...row]);
}

export function getCell(grid: CellType[][], row: number, col: number): CellType {
  if (row < 0 || row >= grid.length || col < 0 || col >= grid[0].length) {
    return "OUT_OF_BOUNDS";
  }
  return grid[row][col];
}

export function setCell(
  grid: CellType[][],
  row: number,
  col: number,
  value: CellType
): void {
  if (row >= 0 && row < grid.length && col >= 0 && col < grid[0].length) {
    grid[row][col] = value;
  }
}

export function findObject(
  grid: CellType[][],
  objectType: string
): Array<[number, number]> {
  const positions: Array<[number, number]> = [];
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      if (grid[r][c] === objectType) {
        positions.push([r, c]);
      }
    }
  }
  return positions;
}

export function evaluateMove(
  state: PuzzleState,
  direction: Direction,
  rules: PuzzleRule[]
): PuzzleState {
  if (state.solved) return state;

  const newGrid = cloneGrid(state.grid);
  const vec = DIRECTION_VECTORS[direction];

  for (const rule of rules) {
    if (rule.type === "move" && direction !== "stay") {
      applyMoveRule(newGrid, rule, vec);
    } else if (rule.type === "transform") {
      applyTransformRule(newGrid, rule);
    } else if (rule.type === "destroy") {
      applyDestroyRule(newGrid, rule);
    } else if (rule.type === "create") {
      applyCreateRule(newGrid, rule);
    }
  }

  return {
    grid: newGrid,
    moveCount: state.moveCount + 1,
    history: [...state.history, { ...state, history: [] }],
    solved: false,
    startTime: state.startTime,
  };
}

function applyMoveRule(
  grid: CellType[][],
  rule: PuzzleRule,
  vec: [number, number]
): void {
  const positions = findObject(grid, rule.source[0]);
  if (positions.length === 0) return;

  const moves: Array<{
    from: [number, number];
    to: [number, number];
  }> = [];

  for (const [r, c] of positions) {
    const nr = r + vec[0];
    const nc = c + vec[1];
    const target = getCell(grid, nr, nc);
    if (target !== "OUT_OF_BOUNDS" && !rule.target.includes(target)) {
      moves.push({ from: [r, c], to: [nr, nc] });
    }
  }

  for (const { from, to } of moves) {
    const [fr, fc] = from;
    const [tr, tc] = to;
    grid[fr][fc] = "empty";
    grid[tr][tc] = rule.source[0];
  }
}

function applyTransformRule(grid: CellType[][], rule: PuzzleRule): void {
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      if (rule.source.includes(grid[r][c])) {
        grid[r][c] = rule.target[0];
      }
    }
  }
}

function applyDestroyRule(grid: CellType[][], rule: PuzzleRule): void {
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      if (rule.source.includes(grid[r][c])) {
        grid[r][c] = "empty";
      }
    }
  }
}

function applyCreateRule(grid: CellType[][], rule: PuzzleRule): void {
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      if (rule.source.includes(grid[r][c])) {
        for (const [dr, dc] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
          const nr = r + dr;
          const nc = c + dc;
          if (
            nr >= 0 && nr < grid.length &&
            nc >= 0 && nc < grid[0].length &&
            grid[nr][nc] === "empty"
          ) {
            grid[nr][nc] = rule.target[0];
          }
        }
      }
    }
  }
}

export function checkWinCondition(
  grid: CellType[][],
  condition: WinCondition
): boolean {
  const positions = findObject(grid, condition.target);
  switch (condition.type) {
    case "all":
      return positions.length === (condition.count ?? 1);
    case "any":
      return positions.length > 0;
    case "some":
      return positions.length >= (condition.count ?? 1);
    default:
      return false;
  }
}

export function undoMove(state: PuzzleState): PuzzleState {
  if (state.history.length === 0) return state;
  const prev = state.history[state.history.length - 1];
  return {
    ...prev,
    history: state.history.slice(0, -1),
    moveCount: state.moveCount - 1,
  };
}

export function parsePuzzleSource(source: string): PuzzleDefinition {
  const lines = source.split("\n").map((l) => l.trim()).filter(Boolean);
  const result: PuzzleDefinition = {
    title: "Untitled",
    author: "Unknown",
    grid: [],
    rules: [],
    winCondition: { type: "all", target: "goal" },
    legend: {},
    objects: [],
  };

  let section = "";
  const gridLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith("title ")) {
      result.title = line.slice(6);
    } else if (line.startsWith("author ")) {
      result.author = line.slice(7);
    } else if (line === "objects" || line === "legend" || line === "rules" ||
               line === "wincondition" || line === "levels") {
      section = line.toLowerCase();
    } else if (section === "levels") {
      gridLines.push(line);
    } else if (section === "rules") {
      result.rules.push(parseRule(line));
    } else if (section === "wincondition") {
      result.winCondition = parseWinCondition(line);
    }
  }

  if (gridLines.length > 0) {
    result.grid = gridLines.map((l) => l.split("").filter((c) => c !== " "));
  }

  return result;
}

function parseRule(line: string): PuzzleRule {
  const parts = line.split(/\s+->\s+/);
  const directionMatch = line.match(/\[(.*?)\]/);
  const dir = directionMatch?.[1] as Direction | undefined;

  if (parts.length >= 2) {
    return {
      type: "transform",
      source: parts[0].split(",").map((s) => s.trim()),
      target: parts[1].split(",").map((s) => s.trim()),
      direction: dir,
    };
  }

  return { type: "transform", source: [line], target: ["empty"] };
}

function parseWinCondition(line: string): WinCondition {
  const parts = line.split(/\s+/);
  if (parts[0] === "all") {
    return { type: "all", target: parts[1] };
  }
  return { type: "any", target: parts[1] || parts[0] };
}

export function generateLevel(
  rows: number,
  cols: number,
  objects: Array<{ type: string; count: number; position?: [number, number] }>
): CellType[][] {
  const grid: CellType[][] = Array.from({ length: rows }, () =>
    Array(cols).fill("empty")
  );

  for (const obj of objects) {
    let placed = 0;
    let attempts = 0;
    while (placed < obj.count && attempts < 1000) {
      const r = obj.position ? obj.position[0] : Math.floor(Math.random() * rows);
      const c = obj.position ? obj.position[1] : Math.floor(Math.random() * cols);
      if (grid[r][c] === "empty") {
        grid[r][c] = obj.type;
        placed++;
      }
      attempts++;
    }
  }

  return grid;
}
