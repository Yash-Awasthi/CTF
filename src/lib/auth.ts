/**
 * Client-side authentication system.
 *
 * Uses Web Crypto API for password hashing (PBKDF2 + SHA-256).
 * Persists users and sessions in localStorage.
 * All validation client-side — wire to D1 API when backend is ready.
 */

export interface User {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  displayName: string;
  solveCount: number;
  points: number;
  joinedAt: string; // ISO timestamp
  lastLogin: string;
}

export interface AuthSession {
  userId: string;
  username: string;
  token: string;
  expiresAt: string;
}

const STORAGE_KEY = "case71c_users";
const SESSION_KEY = "case71c_session";

// ── Password Hashing (Web Crypto API) ─────────────────────────────────────

async function hashPassword(password: string, salt?: string): Promise<string> {
  const encoder = new TextEncoder();
  const saltBytes = salt
    ? Uint8Array.from(atob(salt), c => c.charCodeAt(0))
    : crypto.getRandomValues(new Uint8Array(16));

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: saltBytes,
      iterations: 100_000,
      hash: "SHA-256",
    },
    keyMaterial,
    256,
  );

  const hashArray = new Uint8Array(bits);
  const saltB64 = btoa(String.fromCharCode(...saltBytes));
  const hashB64 = btoa(String.fromCharCode(...hashArray));

  // Format: pbkdf2:iterations:salt:hash
  return `pbkdf2:100000:${saltB64}:${hashB64}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split(":");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;

  const [, iterations, salt, expectedHash] = parts;
  const rehashed = await hashPassword(password, salt);
  const newParts = rehashed.split(":");
  return newParts[3] === expectedHash;
}

// ── User Storage ──────────────────────────────────────────────────────────

function getUsers(): User[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveUsers(users: User[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
}

function generateId(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 12);
}

// ── Validation ────────────────────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validateUsername(username: string): ValidationResult {
  if (username.length < 3) return { valid: false, error: "Username must be at least 3 characters" };
  if (username.length > 20) return { valid: false, error: "Username must be at most 20 characters" };
  if (!/^[a-zA-Z0-9_]+$/.test(username)) return { valid: false, error: "Username can only contain letters, numbers, and underscores" };
  return { valid: true };
}

export function validateEmail(email: string): ValidationResult {
  if (!email.includes("@") || !email.includes(".")) return { valid: false, error: "Invalid email format" };
  if (email.length > 254) return { valid: false, error: "Email too long" };
  return { valid: true };
}

export function validatePassword(password: string): ValidationResult {
  if (password.length < 8) return { valid: false, error: "Password must be at least 8 characters" };
  if (!/[a-z]/.test(password)) return { valid: false, error: "Password must contain a lowercase letter" };
  if (!/[A-Z]/.test(password)) return { valid: false, error: "Password must contain an uppercase letter" };
  if (!/[0-9]/.test(password)) return { valid: false, error: "Password must contain a number" };
  return { valid: true };
}

// ── Registration ──────────────────────────────────────────────────────────

export async function register(
  username: string,
  email: string,
  password: string,
): Promise<{ success: boolean; error?: string; user?: User }> {
  // Validate inputs
  const uCheck = validateUsername(username);
  if (!uCheck.valid) return { success: false, error: uCheck.error };

  const eCheck = validateEmail(email);
  if (!eCheck.valid) return { success: false, error: eCheck.error };

  const pCheck = validatePassword(password);
  if (!pCheck.valid) return { success: false, error: pCheck.error };

  // Check uniqueness
  const users = getUsers();
  if (users.some(u => u.username.toLowerCase() === username.toLowerCase())) {
    return { success: false, error: "Username already taken" };
  }
  if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
    return { success: false, error: "Email already registered" };
  }

  // Create user
  const passwordHash = await hashPassword(password);
  const user: User = {
    id: generateId(),
    username,
    email,
    passwordHash,
    displayName: username,
    solveCount: 0,
    points: 0,
    joinedAt: new Date().toISOString(),
    lastLogin: new Date().toISOString(),
  };

  users.push(user);
  saveUsers(users);

  return { success: true, user };
}

// ── Login ─────────────────────────────────────────────────────────────────

export async function login(
  username: string,
  password: string,
): Promise<{ success: boolean; error?: string; session?: AuthSession }> {
  const users = getUsers();
  const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());

  if (!user) return { success: false, error: "User not found" };

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) return { success: false, error: "Incorrect password" };

  // Update last login
  user.lastLogin = new Date().toISOString();
  saveUsers(users);

  // Create session
  const session: AuthSession = {
    userId: user.id,
    username: user.username,
    token: crypto.randomUUID(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24h
  };

  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return { success: true, session };
}

// ── Session Management ────────────────────────────────────────────────────

export function getCurrentSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session: AuthSession = JSON.parse(raw);
    if (new Date(session.expiresAt) < new Date()) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function getCurrentUser(): User | null {
  const session = getCurrentSession();
  if (!session) return null;
  const users = getUsers();
  return users.find(u => u.id === session.userId) ?? null;
}

export function logout(): void {
  localStorage.removeItem(SESSION_KEY);
}

// ── Score Updates ─────────────────────────────────────────────────────────

export function addPoints(userId: string, points: number): void {
  const users = getUsers();
  const user = users.find(u => u.id === userId);
  if (user) {
    user.points += points;
    user.solveCount += 1;
    saveUsers(users);
  }
}

export function getLeaderboard(): Array<{ rank: number; username: string; points: number; solveCount: number }> {
  const users = getUsers();
  return users
    .sort((a, b) => b.points - a.points || a.joinedAt.localeCompare(b.joinedAt))
    .slice(0, 50)
    .map((u, i) => ({
      rank: i + 1,
      username: u.username,
      points: u.points,
      solveCount: u.solveCount,
    }));
}
