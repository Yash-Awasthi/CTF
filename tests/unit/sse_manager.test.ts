import { describe, it, expect } from "vitest";
import { formatSSEMessage, createSSEManager, DEFAULT_SSE_CONFIG } from "../../src/lib/sse_manager";

describe("formatSSEMessage", () => {
  it("formats basic message", () => {
    const msg = formatSSEMessage("hello world");
    expect(msg).toContain("data: hello world");
    expect(msg).toContain("\n\n");
  });

  it("formats with event name", () => {
    const msg = formatSSEMessage("test", "update");
    expect(msg).toContain("event: update");
    expect(msg).toContain("data: test");
  });

  it("formats with event id", () => {
    const msg = formatSSEMessage("test", undefined, "123");
    expect(msg).toContain("id: 123");
  });

  it("formats with retry", () => {
    const msg = formatSSEMessage("test", undefined, undefined, 5000);
    expect(msg).toContain("retry: 5000");
  });

  it("handles multiline data", () => {
    const msg = formatSSEMessage("line1\nline2\nline3");
    expect(msg).toContain("data: line1");
    expect(msg).toContain("data: line2");
    expect(msg).toContain("data: line3");
  });
});

describe("createSSEManager", () => {
  it("creates with default config", () => {
    const mgr = createSSEManager();
    expect(mgr.config.retry).toBe(2000);
    expect(mgr.config.keepAlive).toBe(10000);
  });

  it("creates channels", () => {
    const mgr = createSSEManager();
    const ch = mgr.channel("test");
    expect(ch.name).toBe("test");
    expect(ch.getClientCount()).toBe(0);
  });

  it("returns same channel on re-get", () => {
    const mgr = createSSEManager();
    const ch1 = mgr.channel("test");
    const ch2 = mgr.channel("test");
    expect(ch1).toBe(ch2);
  });

  it("adds clients to channel", () => {
    const mgr = createSSEManager();
    const ch = mgr.channel("test");
    const sent: string[] = [];
    const client = mgr.addClient(
      ch,
      (data) => sent.push(data),
      () => {},
    );
    expect(ch.getClientCount()).toBe(1);
    expect(client.id).toBeDefined();
  });

  it("removes clients from channel", () => {
    const mgr = createSSEManager();
    const ch = mgr.channel("test");
    const client = mgr.addClient(ch, () => {}, () => {});
    mgr.removeClient(ch, client.id);
    expect(ch.getClientCount()).toBe(0);
  });

  it("broadcasts to all clients", () => {
    const mgr = createSSEManager();
    const ch = mgr.channel("test");
    const sent1: string[] = [];
    const sent2: string[] = [];
    mgr.addClient(ch, (data) => sent1.push(data), () => {});
    mgr.addClient(ch, (data) => sent2.push(data), () => {});
    ch.broadcast("hello");
    expect(sent1.length).toBeGreaterThan(0);
    expect(sent2.length).toBeGreaterThan(0);
  });

  it("getStats returns correct counts", () => {
    const mgr = createSSEManager();
    mgr.channel("a");
    mgr.channel("b");
    const ch = mgr.channel("a");
    mgr.addClient(ch, () => {}, () => {});
    mgr.addClient(ch, () => {}, () => {});
    const stats = mgr.getStats();
    expect(stats.channels).toBe(2);
    expect(stats.totalClients).toBe(2);
  });

  it("destroy cleans up", () => {
    const mgr = createSSEManager();
    mgr.channel("test");
    mgr.destroy();
    expect(mgr.getStats().channels).toBe(0);
  });
});
