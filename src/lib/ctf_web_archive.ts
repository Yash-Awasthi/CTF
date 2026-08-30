/**
 * CTF Web Archive — Browser-based web archive viewer for CTF challenges.
 *
 * Inspired by replayweb.page.
 * Provides web archive playback, challenge reconstruction,
 * and forensic analysis capabilities.
 */

import { createHash, randomBytes } from 'crypto';

// ============================================================================
// Types
// ============================================================================

export interface ArchiveEntry {
  url: string;
  timestamp: Date;
  mimeType: string;
  status: number;
  headers: Record<string, string>;
  body: string | Buffer;
  size: number;
}

export interface ArchiveCollection {
  id: string;
  name: string;
  description: string;
  entries: ArchiveEntry[];
  createdAt: Date;
  totalSize: number;
  challengeId?: string;
}

export interface PlaybackSession {
  id: string;
  collectionId: string;
  currentIndex: number;
  isPlaying: boolean;
  speed: number;
  startedAt: Date;
  lastAccessedAt: Date;
}

export interface ForensicFinding {
  type: 'hidden_content' | 'suspicious_header' | 'encoded_data' | 'javascript_anomaly' | 'form_data';
  severity: 'low' | 'medium' | 'high';
  description: string;
  evidence: string;
  url: string;
  timestamp: Date;
}

// ============================================================================
// CTF Web Archive Manager
// ============================================================================

export class CTFWebArchiveManager {
  private collections: Map<string, ArchiveCollection> = new Map();
  private sessions: Map<string, PlaybackSession> = new Map();
  private findings: Map<string, ForensicFinding[]> = new Map();

  /**
   * Create a new archive collection.
   */
  createCollection(name: string, description: string = '', challengeId?: string): ArchiveCollection {
    const collection: ArchiveCollection = {
      id: randomBytes(8).toString('hex'),
      name,
      description,
      entries: [],
      createdAt: new Date(),
      totalSize: 0,
      challengeId,
    };

    this.collections.set(collection.id, collection);
    return collection;
  }

  /**
   * Add an entry to a collection.
   */
  addEntry(collectionId: string, entry: Omit<ArchiveEntry, 'size'>): ArchiveEntry {
    const collection = this.collections.get(collectionId);
    if (!collection) throw new Error('Collection not found');

    const fullEntry: ArchiveEntry = {
      ...entry,
      size: typeof entry.body === 'string' ? entry.body.length : entry.body.length,
    };

    collection.entries.push(fullEntry);
    collection.totalSize += fullEntry.size;
    return fullEntry;
  }

  /**
   * Create a playback session.
   */
  createPlaybackSession(collectionId: string): PlaybackSession {
    const collection = this.collections.get(collectionId);
    if (!collection) throw new Error('Collection not found');

    const session: PlaybackSession = {
      id: randomBytes(8).toString('hex'),
      collectionId,
      currentIndex: 0,
      isPlaying: false,
      speed: 1,
      startedAt: Date.now() as unknown as Date,
      lastAccessedAt: Date.now() as unknown as Date,
    };

    this.sessions.set(session.id, session);
    return session;
  }

  /**
   * Navigate to next entry in playback.
   */
  nextEntry(sessionId: string): ArchiveEntry | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    const collection = this.collections.get(session.collectionId);
    if (!collection) return null;

    if (session.currentIndex < collection.entries.length - 1) {
      session.currentIndex++;
      session.lastAccessedAt = Date.now() as unknown as Date;
      return collection.entries[session.currentIndex];
    }

    return null;
  }

  /**
   * Navigate to previous entry in playback.
   */
  prevEntry(sessionId: string): ArchiveEntry | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    const collection = this.collections.get(session.collectionId);
    if (!collection) return null;

    if (session.currentIndex > 0) {
      session.currentIndex--;
      session.lastAccessedAt = Date.now() as unknown as Date;
      return collection.entries[session.currentIndex];
    }

    return null;
  }

  /**
   * Analyze archive for forensic findings.
   */
  analyzeArchive(collectionId: string): ForensicFinding[] {
    const collection = this.collections.get(collectionId);
    if (!collection) return [];

    const findings: ForensicFinding[] = [];

    for (const entry of collection.entries) {
      const body = typeof entry.body === 'string' ? entry.body : entry.body.toString();

      // Check for hidden content
      if (body.includes('hidden') || body.includes('display:none') || body.includes('visibility:hidden')) {
        findings.push({
          type: 'hidden_content',
          severity: 'medium',
          description: 'Hidden HTML content detected',
          evidence: body.match(/<[^>]*hidden[^>]*>/gi)?.[0] || 'hidden attribute',
          url: entry.url,
          timestamp: entry.timestamp,
        });
      }

      // Check for suspicious headers
      if (entry.headers['x-powered-by'] || entry.headers['server']?.includes('Apache/2.2')) {
        findings.push({
          type: 'suspicious_header',
          severity: 'low',
          description: 'Server version disclosure',
          evidence: `X-Powered-By: ${entry.headers['x-powered-by'] || 'unknown'}`,
          url: entry.url,
          timestamp: entry.timestamp,
        });
      }

      // Check for encoded data
      if (body.includes('base64') || body.includes('atob') || body.includes('btoa')) {
        findings.push({
          type: 'encoded_data',
          severity: 'high',
          description: 'Base64 encoded data detected',
          evidence: body.match(/base64[^"']*/gi)?.[0] || 'base64 encoding',
          url: entry.url,
          timestamp: entry.timestamp,
        });
      }

      // Check for JavaScript anomalies
      if (body.includes('eval(') || body.includes('Function(') || body.includes('document.write')) {
        findings.push({
          type: 'javascript_anomaly',
          severity: 'high',
          description: 'Suspicious JavaScript function detected',
          evidence: body.match(/(eval|Function|document\.write)\([^)]*\)/gi)?.[0] || 'suspicious function',
          url: entry.url,
          timestamp: entry.timestamp,
        });
      }

      // Check for form data
      if (body.includes('<form') && body.includes('action=')) {
        findings.push({
          type: 'form_data',
          severity: 'medium',
          description: 'Form submission detected',
          evidence: body.match(/<form[^>]*action=["'][^"']*["'][^>]*>/gi)?.[0] || 'form element',
          url: entry.url,
          timestamp: entry.timestamp,
        });
      }
    }

    this.findings.set(collectionId, findings);
    return findings;
  }

  /**
   * Get collection entries by URL pattern.
   */
  searchEntries(collectionId: string, pattern: string): ArchiveEntry[] {
    const collection = this.collections.get(collectionId);
    if (!collection) return [];

    const regex = new RegExp(pattern, 'i');
    return collection.entries.filter((e) => regex.test(e.url));
  }

  /**
   * Get all collections.
   */
  getCollections(): ArchiveCollection[] {
    return Array.from(this.collections.values());
  }

  /**
   * Get findings for a collection.
   */
  getFindings(collectionId: string): ForensicFinding[] {
    return this.findings.get(collectionId) || [];
  }

  /**
   * Get statistics.
   */
  getStats(): {
    totalCollections: number;
    totalEntries: number;
    totalFindings: number;
    totalSize: number;
  } {
    const collections = Array.from(this.collections.values());
    const totalEntries = collections.reduce((sum, c) => sum + c.entries.length, 0);
    const totalFindings = Array.from(this.findings.values()).reduce((sum, f) => sum + f.length, 0);
    const totalSize = collections.reduce((sum, c) => sum + c.totalSize, 0);

    return {
      totalCollections: collections.length,
      totalEntries,
      totalFindings,
      totalSize,
    };
  }
}
