import { EventBus } from "@/lib/events/event-bus";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  notifyNearbyCustomers,
  type ComboActivatedEvent,
} from "@/lib/events/handlers/notify-nearby-customers.handler";

type AppEvents = {
  "combo.activated": ComboActivatedEvent;
};

// Single shared bus for the whole app, subscribed once here at module load —
// callers (combo.repository.ts) just publish, they never know or care who's
// listening. Only one subscriber today (phase 3's nearby-notification
// handler), but this is exactly the decoupling
// .claude/rules/stack-and-conventions.md calls for: a future second
// subscriber (e.g. a Supabase Realtime broadcast) attaches here without
// touching combo.repository.ts at all.
export const appEventBus = new EventBus<AppEvents>();

// Own admin client per publish, not a shared module-level singleton — this
// runs in server-side request handlers, and lib/supabase/admin.ts's client
// is cheap to construct (no connection pooling to worry about at this
// project's scale). Best-effort: a notification-fan-out hiccup must never
// fail the combo creation/relist it rides along with.
appEventBus.subscribe("combo.activated", async (event) => {
  await notifyNearbyCustomers(createAdminClient(), event).catch(() => {});
});
