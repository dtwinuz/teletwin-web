// Demo-only stand-in for `@microsoft/signalr` (aliased in `vite.config.ts` for `--mode demo` only).
// It "connects" at once, forwards events of the in-memory corp server and lets simulated colleagues write now and then.
import { onDemoHub, startDemoLife } from './corpServer';

type Handler = (payload: unknown) => void;

const CONNECT_DELAY = 200;

export const HttpTransportType = {
  None: 0, WebSockets: 1, ServerSentEvents: 2, LongPolling: 4,
} as const;

export const LogLevel = {
  Trace: 0, Debug: 1, Information: 2, Warning: 3, Error: 4, Critical: 5, None: 6,
} as const;

export class HubConnection {
  private handlers = new Map<string, Handler[]>();

  private stopFns: (() => void)[] = [];

  on(event: string, handler: Handler) {
    this.handlers.set(event, [...(this.handlers.get(event) || []), handler]);
  }

  onclose(handler: Handler) {
    void handler;
  }

  async start() {
    await new Promise((resolve) => {
      setTimeout(resolve, CONNECT_DELAY);
    });
    this.stopFns.push(onDemoHub((event, payload) => {
      this.handlers.get(event)?.forEach((handler) => handler(payload));
    }));
    this.stopFns.push(startDemoLife());
  }

  stop() {
    this.stopFns.splice(0).forEach((stop) => stop());
    return Promise.resolve();
  }

  invoke<T>(method: string): Promise<T> {
    return Promise.resolve((method === 'Ready' ? 0 : undefined) as T);
  }
}

export class HubConnectionBuilder {
  withUrl() {
    return this;
  }

  configureLogging() {
    return this;
  }

  build() {
    return new HubConnection();
  }
}
