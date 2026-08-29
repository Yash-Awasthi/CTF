/**
 * Registration API endpoint.
 *
 * POST /api/register
 * Body: { username, email, password }
 *
 * Validates all fields, hashes password, stores in mock DB.
 * All client-side for now — wire to D1 when backend is ready.
 */
import type { APIRoute } from "astro";

// ── Validation ────────────────────────────────────────────────────────────

function validateUsername(username: string): string | null {
  if (username.length < 3) return "Username must be at least 3 characters";
  if (username.length > 20) return "Username must be at most 20 characters";
  if (!/^[a-zA-Z0-9_]+$/.test(username)) return "Username can only contain letters, numbers, and underscores";
  return null;
}

function validateEmail(email: string): string | null {
  if (!email.includes("@") || !email.includes(".")) return "Invalid email format";
  if (email.length > 254) return "Email too long";
  return null;
}

function validatePassword(password: string): string | null {
  if (password.length < 8) return "Password must be at least 8 characters";
  if (!/[a-z]/.test(password)) return "Password must contain a lowercase letter";
  if (!/[A-Z]/.test(password)) return "Password must contain an uppercase letter";
  if (!/[0-9]/.test(password)) return "Password must contain a number";
  return null;
}

// ── Mock User Store ───────────────────────────────────────────────────────

// In production: D1 database
const mockUsers: Array<{ username: string; email: string; passwordHash: string }> = [];

// ── API Handler ───────────────────────────────────────────────────────────

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { username, email, password } = body;

    // Required fields
    if (!username || !email || !password) {
      return new Response(JSON.stringify({ error: "All fields are required" }), { status: 400 });
    }

    // Validate
    const usernameError = validateUsername(username);
    if (usernameError) return new Response(JSON.stringify({ error: usernameError }), { status: 400 });

    const emailError = validateEmail(email);
    if (emailError) return new Response(JSON.stringify({ error: emailError }), { status: 400 });

    const passwordError = validatePassword(password);
    if (passwordError) return new Response(JSON.stringify({ error: passwordError }), { status: 400 });

    // Check uniqueness
    if (mockUsers.some(u => u.username.toLowerCase() === username.toLowerCase())) {
      return new Response(JSON.stringify({ error: "Username already taken" }), { status: 409 });
    }
    if (mockUsers.some(u => u.email.toLowerCase() === email.toLowerCase())) {
      return new Response(JSON.stringify({ error: "Email already registered" }), { status: 409 });
    }

    // Hash password (mock — use Web Crypto in client, bcrypt in production)
    const passwordHash = `mock_hash_${password.length}_${username.length}`;

    mockUsers.push({ username, email, passwordHash });

    return new Response(JSON.stringify({
      success: true,
      message: `Account created for ${username}`,
    }), { status: 201 });

  } catch (e) {
    return new Response(JSON.stringify({ error: "Internal error" }), { status: 500 });
  }
};
