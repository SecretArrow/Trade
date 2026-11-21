/**
 * Reconnecting WebSocket manager with exponential backoff, jitter and an
 * optional application-level ping interval. Used by every WS-capable
 * provider adapter.
 */

export type WsStatus = 'connecting' | 'open' | 'closed';

export interface ReconnectingWsOptions {
  url: string;
  onMessage: (data: unknown) => void;
  onStatus?: (status: WsStatus) => void;
  /** Send a raw ping payload every N ms while connected. */
  pingPayload?: () => string;
  pingIntervalMs?: number;
  maxBackoffMs?: number;
}

export class ReconnectingWs {
  private ws: WebSocket | null = null;
  private attempts = 0;
  private closedByUser = false;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private sendQueue: string[] = [];

  constructor(private readonly options: ReconnectingWsOptions) {}

  connect(): void {
    this.closedByUser = false;
    this.open();
  }

  private open(): void {
    if (this.closedByUser) return;
    this.options.onStatus?.('connecting');
    try {
      this.ws = new WebSocket(this.options.url);
    } catch {
      this.scheduleRetry();
      return;
    }
    this.ws.onopen = () => {
      this.attempts = 0;
      this.options.onStatus?.('open');
      for (const payload of this.sendQueue) this.ws?.send(payload);
      this.sendQueue = [];
      if (this.options.pingPayload && this.options.pingIntervalMs) {
        this.pingTimer = setInterval(() => {
          if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(this.options.pingPayload());
          }
        }, this.options.pingIntervalMs);
      }
    };
    this.ws.onmessage = (ev) => {
      try {
        this.options.onMessage(JSON.parse(ev.data as string));
      } catch {
        // ignore malformed frames
      }
    };
    this.ws.onclose = () => {
      this.stopPing();
      this.options.onStatus?.('closed');
      if (!this.closedByUser) this.scheduleRetry();
    };
    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  send(payload: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(payload);
    } else if (!this.closedByUser) {
      this.sendQueue.push(payload);
    }
  }

  private stopPing(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private scheduleRetry(): void {
    const base = Math.min(this.options.maxBackoffMs ?? 30_000, 800 * 2 ** this.attempts);
    const delay = base * (0.75 + Math.random() * 0.5);
    this.attempts += 1;
    this.retryTimer = setTimeout(() => this.open(), delay);
  }

  close(): void {
    this.closedByUser = true;
    this.stopPing();
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.ws?.close();
    this.ws = null;
    this.options.onStatus?.('closed');
  }
}
