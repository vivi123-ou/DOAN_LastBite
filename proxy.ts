import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PROTECTED_PREFIXES = ["/dashboard", "/profile", "/orders", "/admin"];

// Renamed from middleware.ts — the "middleware" file convention is
// deprecated in Next.js 16 in favor of "proxy". See
// node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md.
export async function proxy(request: NextRequest) {
  // Forwarded as a *request* header (not a response header) — that's the
  // documented Next.js way to hand a Server Component's headers() call
  // something computed in middleware/proxy, since headers() reflects the
  // incoming request, not whatever the proxy would otherwise respond with.
  // Root layout (app/layout.tsx) reads this to decide SiteHeader vs
  // AdminHeader/no-footer for /admin — see that file's own comment.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", request.nextUrl.pathname);
  const nextRequestInit = { request: { headers: requestHeaders } };

  let response = NextResponse.next(nextRequestInit);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next(nextRequestInit);
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refreshes the session token if expired — required on every request so
  // Server Components downstream see a valid session (see lib/supabase/server.ts).
  const { data } = await supabase.auth.getClaims();

  const isProtected = PROTECTED_PREFIXES.some((prefix) =>
    request.nextUrl.pathname.startsWith(prefix)
  );

  if (isProtected && !data?.claims) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
