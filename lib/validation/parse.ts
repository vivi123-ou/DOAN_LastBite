import type { ZodType } from "zod";

// Every server action in this app validates external input with a zod
// schema (.claude/rules/stack-and-conventions.md), then used to call
// `schema.parse(input)` directly and let it throw straight across the
// server-action boundary on failure. A ZodError's `.message` is the *raw*
// JSON-stringified issues array — Next.js serializes a thrown Error's
// `.message` back to the client unmodified, so a validation failure (e.g.
// "số lượng combo > 999") rendered that JSON blob directly in the form's
// error box instead of a real message. This wraps `.parse()` so every call
// site gets one clean, human-readable message (the first validation issue
// hit) instead — same fix applied at every `Schema.parse(input)` site in
// the app, not just the one that was reported.
export function parseOrThrow<T>(schema: ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    const first = result.error.issues[0];
    throw new Error(first?.message || "Dữ liệu không hợp lệ, vui lòng kiểm tra lại.");
  }
  return result.data;
}
