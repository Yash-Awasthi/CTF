import { describe, it, expect } from 'vitest';
import { GET } from '../badges';

function makeContext(urlStr: string) {
  return { url: new URL(urlStr) } as any;
}

describe('/api/badges', () => {
  it('returns badge templates', async () => {
    const ctx = makeContext('http://localhost/api/badges?action=templates');
    const res = await GET(ctx);
    const data: any = await res.json();
    expect(data).toHaveProperty('badges');
    expect(Array.isArray(data.badges)).toBe(true);
    expect(data.badges.length).toBeGreaterThan(0);
    for (const badge of data.badges) {
      expect(badge).toHaveProperty('id');
      expect(badge).toHaveProperty('name');
      expect(badge).toHaveProperty('category');
    }
  });

  it('returns rarity info', async () => {
    const ctx = makeContext('http://localhost/api/badges?action=rarity-info');
    const res = await GET(ctx);
    const data: any = await res.json();
    expect(data).toHaveProperty('rarities');
    expect(Array.isArray(data.rarities)).toBe(true);
    expect(data.rarities.length).toBeGreaterThan(0);
  });

  it('defaults to templates when no action specified', async () => {
    const ctx = makeContext('http://localhost/api/badges');
    const res = await GET(ctx);
    const data: any = await res.json();
    expect(data).toHaveProperty('badges');
  });

  it('returns 400 for unknown action', async () => {
    const ctx = makeContext('http://localhost/api/badges?action=unknown');
    const res = await GET(ctx);
    expect(res.status).toBe(400);
  });

  it('filters badges by category', async () => {
    const ctx = makeContext('http://localhost/api/badges?action=templates&category=solve');
    const res = await GET(ctx);
    const data: any = await res.json();
    expect(data).toHaveProperty('badges');
    for (const badge of data.badges) {
      expect(badge.category).toBe('solve');
    }
  });
});
