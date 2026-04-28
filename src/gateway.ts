// Discord Gateway client. Speaks JSON over WebSocket.
// Handles: identify, heartbeat, resume, reconnect, invalid session.
// Uses Node 22's built-in WebSocket — zero dependencies.

import { EventEmitter } from "node:events";
import { GATEWAY_URL, GatewayPayload, Op, RawReady } from "./types.js";

export interface GatewayOptions {
  token: string;
  intents: number;
  /** Override gateway URL (testing). */
  url?: string;
  /** [shardId, totalShards] */
  shard?: [number, number];
  /** Initial presence */
  presence?: {
    status?: "online" | "idle" | "dnd" | "invisible";
    activities?: { name: string; type?: number; url?: string; state?: string }[];
    afk?: boolean;
    since?: number | null;
  };
}

export class Gateway extends EventEmitter {
  private opts: GatewayOptions;
  private ws?: WebSocket;
  private heartbeatTimer?: NodeJS.Timeout;
  private heartbeatInterval = 0;
  private lastSeq: number | null = null;
  private sessionId: string | null = null;
  private resumeUrl: string | null = null;
  private acked = true;
  private closed = false;
  private reconnectAttempt = 0;

  constructor(opts: GatewayOptions) {
    super();
    this.opts = opts;
  }

  connect(): void {
    this.closed = false;
    const url = this.resumeUrl
      ? `${this.resumeUrl}?v=10&encoding=json`
      : (this.opts.url ?? GATEWAY_URL);
    const ws = new WebSocket(url);
    this.ws = ws;

    ws.addEventListener("message", (ev) => {
      const data = typeof ev.data === "string" ? ev.data : "";
      if (!data) return;
      let payload: GatewayPayload;
      try {
        payload = JSON.parse(data) as GatewayPayload;
      } catch {
        return;
      }
      this.handle(payload);
    });

    ws.addEventListener("close", (ev) => {
      this.stopHeartbeat();
      this.emit("close", { code: ev.code, reason: ev.reason });
      if (this.closed) return;
      const fatal = [4004, 4010, 4011, 4012, 4013, 4014];
      if (fatal.includes(ev.code)) {
        this.emit("fatal", { code: ev.code, reason: ev.reason });
        return;
      }
      if (ev.code === 4007 || ev.code === 4009) {
        this.sessionId = null;
        this.lastSeq = null;
        this.resumeUrl = null;
      }
      this.scheduleReconnect();
    });

    ws.addEventListener("error", (ev) => {
      this.emit("error", ev);
    });
  }

  close(code = 1000): void {
    this.closed = true;
    this.stopHeartbeat();
    this.ws?.close(code);
  }

  send(op: number, d: unknown): void {
    this.ws?.send(JSON.stringify({ op, d }));
  }

  private handle(p: GatewayPayload): void {
    if (p.s !== null) this.lastSeq = p.s;

    switch (p.op) {
      case Op.Hello: {
        const d = p.d as { heartbeat_interval: number };
        this.heartbeatInterval = d.heartbeat_interval;
        this.startHeartbeat();
        if (this.sessionId && this.lastSeq !== null) this.sendResume();
        else this.sendIdentify();
        break;
      }
      case Op.HeartbeatAck:
        this.acked = true;
        break;
      case Op.Heartbeat:
        this.sendHeartbeat();
        break;
      case Op.Reconnect:
        this.ws?.close(4000);
        break;
      case Op.InvalidSession: {
        const resumable = p.d === true;
        if (!resumable) {
          this.sessionId = null;
          this.lastSeq = null;
          this.resumeUrl = null;
        }
        setTimeout(() => this.ws?.close(4000), 1000 + Math.random() * 4000);
        break;
      }
      case Op.Dispatch: {
        if (p.t === "READY") {
          const d = p.d as RawReady;
          this.sessionId = d.session_id;
          this.resumeUrl = d.resume_gateway_url;
          this.reconnectAttempt = 0;
        }
        if (p.t === "RESUMED") this.reconnectAttempt = 0;
        if (p.t) this.emit("dispatch", p.t, p.d);
        break;
      }
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.acked = true;
    const first = this.heartbeatInterval * Math.random();
    setTimeout(() => {
      this.sendHeartbeat();
      this.heartbeatTimer = setInterval(() => this.sendHeartbeat(), this.heartbeatInterval);
    }, first);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = undefined;
  }

  private sendHeartbeat(): void {
    if (!this.acked) {
      this.ws?.close(4000);
      return;
    }
    this.acked = false;
    this.send(Op.Heartbeat, this.lastSeq);
  }

  private sendIdentify(): void {
    const payload: Record<string, unknown> = {
      token: this.opts.token,
      intents: this.opts.intents,
      properties: {
        os: process.platform,
        browser: "supa.js",
        device: "supa.js",
      },
    };
    if (this.opts.shard) payload.shard = this.opts.shard;
    if (this.opts.presence) {
      payload.presence = {
        since: this.opts.presence.since ?? null,
        activities: this.opts.presence.activities ?? [],
        status: this.opts.presence.status ?? "online",
        afk: this.opts.presence.afk ?? false,
      };
    }
    this.send(Op.Identify, payload);
  }

  private sendResume(): void {
    this.send(Op.Resume, {
      token: this.opts.token,
      session_id: this.sessionId,
      seq: this.lastSeq,
    });
  }

  private scheduleReconnect(): void {
    this.reconnectAttempt++;
    const delay = Math.min(1000 * 2 ** this.reconnectAttempt, 30_000);
    setTimeout(() => {
      if (!this.closed) this.connect();
    }, delay);
  }
}
