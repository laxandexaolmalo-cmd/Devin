// Debug / inspector — opt-in via `new Bot(token, { debug: true })`.
//
//   bot.debug.on()                 // start logging
//   bot.debug.off()
//   bot.debug.tap("MESSAGE_CREATE", d => console.log(d))
//   bot.debug.dump()               // print bot state summary
//   bot.debug.last("MESSAGE_CREATE")  // last payload of an event (capture mode)

import type { Bot } from "./bot.js";

interface RestSample {
  method: string;
  path: string;
  status: number;
  ms: number;
  bucket?: string;
  ratelimit?: { remaining: number; resetAfter: number };
  errorBody?: unknown;
  ts: number;
}

export class Debugger {
  private enabled = false;
  private logEvents = true;
  private logRest = true;
  private capturedEvents = new Map<string, unknown>();
  private taps = new Map<string, ((d: unknown) => void)[]>();
  private restSamples: RestSample[] = [];
  private maxSamples = 200;

  constructor(private bot: Bot, autoEnable: boolean) {
    // Hook the gateway dispatch
    this.bot.gateway.on("dispatch", (t: string, d: unknown) => {
      this.capturedEvents.set(t, d);
      if (this.enabled && this.logEvents) {
        // eslint-disable-next-line no-console
        console.log(`${pfx("event")} ${t} ${preview(d)}`);
      }
      const arr = this.taps.get(t);
      if (arr) for (const fn of arr) try { fn(d); } catch (e) { console.error(e); }
    });

    // Hook REST events emitted by the rest client.
    const rest = this.bot.rest as unknown as { on?: (e: string, fn: (s: RestSample) => void) => void };
    if (typeof rest.on === "function") {
      rest.on("request", (s: RestSample) => {
        this.restSamples.push(s);
        if (this.restSamples.length > this.maxSamples) this.restSamples.shift();
        if (this.enabled && this.logRest) {
          const status = s.status >= 400 ? `\x1b[31m${s.status}\x1b[0m` : `\x1b[32m${s.status}\x1b[0m`;
          // eslint-disable-next-line no-console
          console.log(`${pfx("rest")} ${s.method} ${s.path} ${status} ${s.ms.toFixed(0)}ms${s.ratelimit ? ` rl:${s.ratelimit.remaining}/${s.ratelimit.resetAfter.toFixed(1)}s` : ""}`);
        }
      });
    }

    if (autoEnable) this.on();
  }

  on(opts: { events?: boolean; rest?: boolean } = {}): void {
    this.enabled = true;
    if (opts.events !== undefined) this.logEvents = opts.events;
    if (opts.rest !== undefined) this.logRest = opts.rest;
    // eslint-disable-next-line no-console
    console.log(`${pfx("debug")} enabled (events=${this.logEvents}, rest=${this.logRest})`);
  }

  off(): void {
    this.enabled = false;
    // eslint-disable-next-line no-console
    console.log(`${pfx("debug")} disabled`);
  }

  /** Subscribe to raw payloads of a given dispatch event. */
  tap(event: string, fn: (d: unknown) => void): () => void {
    const arr = this.taps.get(event) ?? [];
    arr.push(fn);
    this.taps.set(event, arr);
    return () => {
      const next = (this.taps.get(event) ?? []).filter((f) => f !== fn);
      if (next.length === 0) this.taps.delete(event);
      else this.taps.set(event, next);
    };
  }

  /** Get the last captured payload for an event. */
  last<T = unknown>(event: string): T | undefined {
    return this.capturedEvents.get(event) as T | undefined;
  }

  /** Get recent REST samples, optionally filtered. */
  rest(filter?: { method?: string; path?: string; status?: number; minMs?: number }): RestSample[] {
    return this.restSamples.filter((s) => {
      if (filter?.method && s.method !== filter.method) return false;
      if (filter?.path && !s.path.includes(filter.path)) return false;
      if (filter?.status !== undefined && s.status !== filter.status) return false;
      if (filter?.minMs !== undefined && s.ms < filter.minMs) return false;
      return true;
    });
  }

  /** Print a one-screen summary of the bot's state. */
  dump(): void {
    const me = this.bot.me;
    const stats = {
      bot: me ? `${me.name} (${me.id})` : "not ready",
      applicationId: this.bot.applicationId,
      shard: this.bot.shard,
      events_seen: [...this.capturedEvents.keys()].length,
      rest_samples: this.restSamples.length,
      rest_avg_ms:
        this.restSamples.length > 0
          ? Math.round(this.restSamples.reduce((s, r) => s + r.ms, 0) / this.restSamples.length)
          : 0,
      rest_errors: this.restSamples.filter((s) => s.status >= 400).length,
    };
    // eslint-disable-next-line no-console
    console.table(stats);
  }
}

function pfx(tag: string) {
  return `\x1b[90m[supa:${tag}]\x1b[0m`;
}

function preview(v: unknown): string {
  try {
    const s = JSON.stringify(v);
    return s.length > 160 ? s.slice(0, 157) + "..." : s;
  } catch {
    return String(v);
  }
}
