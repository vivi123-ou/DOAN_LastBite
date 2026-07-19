// Observer/pub-sub used from phase 3 onward to decouple "a combo went
// active near you" from the code path that activates a combo — see
// .claude/rules/stack-and-conventions.md. Not wired to any publisher yet in
// phase 1; kept here so the pattern has a home when
// events/handlers/notify-nearby-customers.handler.ts is added.
type Handler<T> = (event: T) => void | Promise<void>;

export class EventBus<Events extends Record<string, unknown>> {
  private handlers: { [K in keyof Events]?: Handler<Events[K]>[] } = {};

  subscribe<K extends keyof Events>(type: K, handler: Handler<Events[K]>): void {
    (this.handlers[type] ??= []).push(handler);
  }

  async publish<K extends keyof Events>(type: K, event: Events[K]): Promise<void> {
    const subscribers = this.handlers[type] ?? [];
    await Promise.all(subscribers.map((handler) => handler(event)));
  }
}
