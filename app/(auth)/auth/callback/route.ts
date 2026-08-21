import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getById } from "@/lib/repositories/profile.repository";

// Handles both the Google OAuth redirect and the email-confirmation link —
// both deliver a `code` query param to exchange for a session.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Same override as the email/password login form (login/page.tsx) —
      // role='admin' is a "pure staff" account, always lands in /admin
      // rather than wherever `next` would otherwise have sent it.
      const profile = user ? await getById(supabase, user.id) : null;
      return NextResponse.redirect(`${origin}${profile?.role === "admin" ? "/admin" : next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
