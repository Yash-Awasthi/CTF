/**
 * Auth configuration generator.
 * Extracted from better-auth-cloudflare — auth file generation patterns.
 */

export interface AuthConfig {
  template: "hono" | "nextjs" | "express";
  database: "sqlite" | "postgres" | "mysql";
  plugins: string[];
  rateLimit: {
    enabled: boolean;
    window: number;
    max: number;
  };
  emailAndPassword: boolean;
  oauth: {
    google: boolean;
    github: boolean;
  };
}

export function generateAuthConfig(config: AuthConfig): string {
  const lines: string[] = [];

  lines.push(`import { betterAuth } from "better-auth";`);
  lines.push("");

  if (config.plugins.length > 0) {
    const pluginImports = config.plugins.map(p => `import { ${p} } from "better-auth/plugins";`);
    lines.push(...pluginImports);
    lines.push("");
  }

  lines.push(`export const auth = betterAuth({`);
  lines.push(`  database: {`);
  lines.push(`    provider: "${config.database}",`);
  lines.push(`  },`);
  lines.push("");

  if (config.emailAndPassword) {
    lines.push(`  emailAndPassword: {`);
    lines.push(`    enabled: true,`);
    lines.push(`    password: {`);
    lines.push(`      hash: async (password: string) => {`);
    lines.push(`        const encoder = new TextEncoder();`);
    lines.push(`        const data = encoder.encode(password);`);
    lines.push(`        const hash = await crypto.subtle.digest("SHA-256", data);`);
    lines.push(`        return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");`);
    lines.push(`      },`);
    lines.push(`      verify: async (password: string, hash: string) => {`);
    lines.push(`        const encoder = new TextEncoder();`);
    lines.push(`        const data = encoder.encode(password);`);
    lines.push(`        const computedHash = await crypto.subtle.digest("SHA-256", data);`);
    lines.push(`        const hex = Array.from(new Uint8Array(computedHash)).map(b => b.toString(16).padStart(2, "0")).join("");`);
    lines.push(`        return hex === hash;`);
    lines.push(`      },`);
    lines.push(`    },`);
    lines.push(`  },`);
    lines.push("");
  }

  if (config.oauth.google || config.oauth.github) {
    lines.push(`  socialProviders: {`);
    if (config.oauth.google) {
      lines.push(`    google: {`);
      lines.push(`      clientId: process.env.GOOGLE_CLIENT_ID!,`);
      lines.push(`      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,`);
      lines.push(`    },`);
    }
    if (config.oauth.github) {
      lines.push(`    github: {`);
      lines.push(`      clientId: process.env.GITHUB_CLIENT_ID!,`);
      lines.push(`      clientSecret: process.env.GITHUB_CLIENT_SECRET!,`);
      lines.push(`    },`);
    }
    lines.push(`  },`);
    lines.push("");
  }

  if (config.plugins.length > 0) {
    lines.push(`  plugins: [${config.plugins.join(", ")}],`);
    lines.push("");
  }

  if (config.rateLimit.enabled) {
    lines.push(`  rateLimit: {`);
    lines.push(`    enabled: true,`);
    lines.push(`    window: ${config.rateLimit.window},`);
    lines.push(`    max: ${config.rateLimit.max},`);
    lines.push(`  },`);
    lines.push("");
  }

  lines.push(`});`);
  lines.push("");
  lines.push(`export type Session = typeof auth.$Infer.Session;`);

  return lines.join("\n");
}

export function generateEnvFile(config: AuthConfig): string {
  const lines: string[] = [];

  lines.push("# Database");
  if (config.database === "sqlite") {
    lines.push('DATABASE_URL="file:./db.sqlite"');
  } else if (config.database === "postgres") {
    lines.push('DATABASE_URL="postgresql://user:password@localhost:5432/dbname"');
  } else {
    lines.push('DATABASE_URL="mysql://user:password@localhost:3306/dbname"');
  }
  lines.push("");

  lines.push("# Better Auth");
  lines.push('BETTER_AUTH_SECRET="your-secret-key-here"');
  lines.push('BETTER_AUTH_URL="http://localhost:3000"');
  lines.push("");

  if (config.oauth.google) {
    lines.push("# Google OAuth");
    lines.push("GOOGLE_CLIENT_ID=");
    lines.push("GOOGLE_CLIENT_SECRET=");
    lines.push("");
  }

  if (config.oauth.github) {
    lines.push("# GitHub OAuth");
    lines.push("GITHUB_CLIENT_ID=");
    lines.push("GITHUB_CLIENT_SECRET=");
    lines.push("");
  }

  return lines.join("\n");
}

export function generateClientConfig(config: AuthConfig): string {
  const lines: string[] = [];

  lines.push(`import { createAuthClient } from "better-auth/react";`);
  lines.push("");
  lines.push(`export const authClient = createAuthClient({`);
  lines.push(`  baseURL: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",`);
  lines.push(`});`);
  lines.push("");
  lines.push(`export const { signIn, signOut, useSession } = authClient;`);

  return lines.join("\n");
}

export function getDefaultConfig(template: string = "nextjs"): AuthConfig {
  return {
    template: template as AuthConfig["template"],
    database: "sqlite",
    plugins: ["anonymous"],
    rateLimit: {
      enabled: true,
      window: 60,
      max: 100,
    },
    emailAndPassword: true,
    oauth: {
      google: false,
      github: false,
    },
  };
}
