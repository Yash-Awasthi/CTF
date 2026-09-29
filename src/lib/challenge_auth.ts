/**
 * Challenge authentication system.
 * Extracted from canhackme — user registration, login, flag submission.
 */

export interface User {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  salt: string;
  createdAt: number;
  lastLogin: number;
  solveCount: number;
  totalScore: number;
}

export interface Session {
  userId: string;
  token: string;
  createdAt: number;
  expiresAt: number;
}

const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours
const users: Map<string, User> = new Map();
const sessions: Map<string, Session> = new Map();

function generateId(): string {
  return `user_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
}

function generateToken(): string {
  const bytes = new Uint8Array(64);
  crypto.getRandomValues(bytes);
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from(bytes, (b) => chars.charAt(b % chars.length)).join('');
}

function generateSalt(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from(bytes, (b) => chars.charAt(b % chars.length)).join('');
}

async function hashPassword(password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + salt);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function validateUsername(username: string): string | null {
  if (username.length < 3 || username.length > 20) {
    return 'Username must be 3-20 characters';
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return 'Username must be alphanumeric with underscores only';
  }
  return null;
}

function validateEmail(email: string): string | null {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return 'Invalid email format';
  }
  return null;
}

function validatePassword(password: string): string | null {
  if (password.length < 8) {
    return 'Password must be at least 8 characters';
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must contain an uppercase letter';
  }
  if (!/[a-z]/.test(password)) {
    return 'Password must contain a lowercase letter';
  }
  if (!/[0-9]/.test(password)) {
    return 'Password must contain a number';
  }
  return null;
}

export async function register(
  username: string,
  email: string,
  password: string
): Promise<{ success: boolean; user?: User; error?: string }> {
  const usernameError = validateUsername(username);
  if (usernameError) return { success: false, error: usernameError };

  const emailError = validateEmail(email);
  if (emailError) return { success: false, error: emailError };

  const passwordError = validatePassword(password);
  if (passwordError) return { success: false, error: passwordError };

  for (const user of users.values()) {
    if (user.username.toLowerCase() === username.toLowerCase()) {
      return { success: false, error: 'Username already taken' };
    }
    if (user.email.toLowerCase() === email.toLowerCase()) {
      return { success: false, error: 'Email already registered' };
    }
  }

  const salt = generateSalt();
  const passwordHash = await hashPassword(password, salt);
  const user: User = {
    id: generateId(),
    username,
    email,
    passwordHash,
    salt,
    createdAt: Date.now(),
    lastLogin: Date.now(),
    solveCount: 0,
    totalScore: 0,
  };

  users.set(user.id, user);
  return { success: true, user };
}

export async function login(
  username: string,
  password: string
): Promise<{ success: boolean; session?: Session; error?: string }> {
  let foundUser: User | undefined;
  for (const user of users.values()) {
    if (user.username.toLowerCase() === username.toLowerCase()) {
      foundUser = user;
      break;
    }
  }

  if (!foundUser) {
    return { success: false, error: 'Invalid username or password' };
  }

  const hash = await hashPassword(password, foundUser.salt);
  if (hash !== foundUser.passwordHash) {
    return { success: false, error: 'Invalid username or password' };
  }

  foundUser.lastLogin = Date.now();

  const session: Session = {
    userId: foundUser.id,
    token: generateToken(),
    createdAt: Date.now(),
    expiresAt: Date.now() + SESSION_DURATION,
  };

  sessions.set(session.token, session);
  return { success: true, session };
}

export function validateSession(token: string): User | null {
  const session = sessions.get(token);
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    sessions.delete(token);
    return null;
  }
  return users.get(session.userId) || null;
}

export function logout(token: string): void {
  sessions.delete(token);
}

export function getUser(userId: string): User | undefined {
  return users.get(userId);
}

export function getLeaderboard(limit: number = 50): Array<{ rank: number; user: User }> {
  return Array.from(users.values())
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, limit)
    .map((user, idx) => ({ rank: idx + 1, user }));
}
