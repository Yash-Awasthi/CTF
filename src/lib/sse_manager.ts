/**
 * Server-Sent Events Manager for CTF
 * Extracted from: server-sent-events (Spring Boot SSE live score app)
 * Patterns: Real-time event streaming, client connection management,
 *           live score updates, heartbeat keepalive, event filtering
 */

export type SSEEventType =
  | 'score_update'
  | 'challenge_solved'
  | 'hint_released'
  | 'leaderboard_change'
  | 'announcement'
  | 'heartbeat';

export interface SSEEvent {
  id: string;
  type: SSEEventType;
  data: unknown;
  timestamp: number;
}

export interface SSEClient {
  id: string;
  write: (data: string) => void;
  isAlive: boolean;
  connectedAt: number;
  subscribedTypes: SSEEventType[];
}

export const DEFAULT_SSE_CONFIG = {
  retry: 2000,
  keepAlive: 10000,
};

/**
 * Format a simple SSE message.
 */
export function formatSSEMessage(
  data: string,
  event?: string,
  id?: string,
  retry?: number,
): string {
  let msg = '';
  if (id) msg += `id: ${id}\n`;
  if (event) msg += `event: ${event}\n`;
  if (retry) msg += `retry: ${retry}\n`;
  const lines = data.split('\n');
  for (const line of lines) {
    msg += `data: ${line}\n`;
  }
  msg += '\n';
  return msg;
}

export class SSEManager {
  private clients: Map<string, SSEClient> = new Map();
  private eventHistory: SSEEvent[] = [];
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private maxHistory = 100;

  constructor(heartbeatMs: number = 30000) {
    this.heartbeatInterval = setInterval(() => this.sendHeartbeat(), heartbeatMs);
  }

  /**
   * Register a new SSE client
   */
  addClient(clientId: string, writeFn: (data: string) => void, subscribedTypes: SSEEventType[] = []): SSEClient {
    const client: SSEClient = {
      id: clientId,
      write: writeFn,
      isAlive: true,
      connectedAt: Date.now(),
      subscribedTypes,
    };
    this.clients.set(clientId, client);

    // Send recent event history
    for (const event of this.eventHistory.slice(-20)) {
      if (subscribedTypes.length === 0 || subscribedTypes.includes(event.type)) {
        writeFn(this.formatEvent(event));
      }
    }

    return client;
  }

  /**
   * Remove a client
   */
  removeClient(clientId: string) {
    this.clients.delete(clientId);
  }

  /**
   * Broadcast an event to all subscribed clients
   */
  broadcast(event: SSEEvent) {
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.maxHistory) {
      this.eventHistory = this.eventHistory.slice(-this.maxHistory);
    }

    const formatted = this.formatEvent(event);
    for (const [, client] of this.clients) {
      if (!client.isAlive) continue;
      if (client.subscribedTypes.length === 0 || client.subscribedTypes.includes(event.type)) {
        try {
          client.write(formatted);
        } catch {
          client.isAlive = false;
        }
      }
    }
  }

  /**
   * Broadcast a score update
   */
  broadcastScoreUpdate(teamId: string, teamName: string, newScore: number, rank: number) {
    this.broadcast({
      id: this.generateId(),
      type: 'score_update',
      data: { teamId, teamName, newScore, rank },
      timestamp: Date.now(),
    });
  }

  /**
   * Broadcast a challenge solve
   */
  broadcastChallengeSolved(challengeId: string, teamId: string, teamName: string, points: number) {
    this.broadcast({
      id: this.generateId(),
      type: 'challenge_solved',
      data: { challengeId, teamId, teamName, points },
      timestamp: Date.now(),
    });
  }

  /**
   * Broadcast an announcement
   */
  broadcastAnnouncement(message: string, priority: 'normal' | 'high' = 'normal') {
    this.broadcast({
      id: this.generateId(),
      type: 'announcement',
      data: { message, priority },
      timestamp: Date.now(),
    });
  }

  private sendHeartbeat() {
    this.broadcast({
      id: this.generateId(),
      type: 'heartbeat',
      data: { clientCount: this.clients.size },
      timestamp: Date.now(),
    });
  }

  private formatEvent(event: SSEEvent): string {
    return `id: ${event.id}\nevent: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  /**
   * Get connection stats
   */
  getStats() {
    return {
      connectedClients: this.clients.size,
      eventHistorySize: this.eventHistory.length,
      clients: Array.from(this.clients.values()).map(c => ({
        id: c.id,
        alive: c.isAlive,
        uptime: Date.now() - c.connectedAt,
        subscriptions: c.subscribedTypes,
      })),
    };
  }

  destroy() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    this.clients.clear();
  }
}

// ── Channel-based API (for tests) ──────────────────────────────────────────

export interface SSEChannel {
  name: string;
  broadcast(data: string): void;
  getClientCount(): number;
}

interface ChannelClient {
  id: string;
  onMessage: (data: string) => void;
  onClose: () => void;
}

export function createSSEManager(config?: { retry?: number; keepAlive?: number }) {
  const channels = new Map<string, SSEChannel>();
  const channelClients = new Map<string, Map<string, ChannelClient>>();

  function getOrCreateChannel(name: string): SSEChannel {
    if (channels.has(name)) return channels.get(name)!;

    const clients = new Map<string, ChannelClient>();
    channelClients.set(name, clients);

    const channel: SSEChannel = {
      name,
      broadcast(data: string) {
        for (const [, client] of clients) {
          client.onMessage(data);
        }
      },
      getClientCount() {
        return clients.size;
      },
    };
    channels.set(name, channel);
    return channel;
  }

  return {
    config: { retry: config?.retry ?? 2000, keepAlive: config?.keepAlive ?? 10000 },
    channel: getOrCreateChannel,
    addClient(
      channel: SSEChannel,
      onMessage: (data: string) => void,
      onClose: () => void,
    ): ChannelClient {
      const id = `client-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const client: ChannelClient = { id, onMessage, onClose };
      channelClients.get(channel.name)?.set(id, client);
      return client;
    },
    removeClient(channel: SSEChannel, clientId: string) {
      channelClients.get(channel.name)?.delete(clientId);
    },
    getStats() {
      let totalClients = 0;
      for (const [, clients] of channelClients) {
        totalClients += clients.size;
      }
      return { channels: channels.size, totalClients };
    },
    destroy() {
      channels.clear();
      channelClients.clear();
    },
  };
}
