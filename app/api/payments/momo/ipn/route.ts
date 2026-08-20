import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { markPaid } from "@/lib/repositories/order.repository";
import { verifyMomoIpnSignature, decodeExtraDataOrderId, type MomoIpnPayload } from "@/lib/payments/momo";

// The real payment-confirmation source of truth — MoMo calls this
// server-to-server once a transaction actually settles, independent of
// whether the customer's browser ever made it back to redirectUrl (see
// initiateMomoPaymentAction()'s own comment: closing the tab mid-payment
// must NOT be trusted as "not paid" — this webhook is what actually decides
// that). `payments` has zero client-facing RLS policies by design
// (.claude/rules/database-and-schema.md) — this is exactly the kind of
// server-only, cross-actor write that pattern exists for, hence the admin
// client for the whole handler.
export async function POST(request: NextRequest) {
  let payload: MomoIpnPayload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }

  if (!verifyMomoIpnSignature(payload)) {
    // Deliberately not calling markPaid() below this point under any
    // circumstance — an unverified signature could be anyone POSTing to
    // this public URL claiming "this order is paid".
    return NextResponse.json({ message: "Invalid signature" }, { status: 400 });
  }

  const orderId = decodeExtraDataOrderId(payload.extraData);
  if (!orderId) {
    return NextResponse.json({ message: "Missing order reference" }, { status: 400 });
  }

  // resultCode 0 = success; anything else (cancelled, failed, expired) is a
  // real MoMo response we should acknowledge but not act on — the order
  // simply stays unpaid, same as if the customer had never opened the
  // MoMo page at all.
  if (payload.resultCode === 0) {
    try {
      const admin = createAdminClient();
      await markPaid(admin, orderId, "momo", String(payload.transId), payload as unknown as Record<string, unknown>);
    } catch (err) {
      // Surfacing a 500 here makes MoMo retry the IPN later (their
      // documented retry behavior on a non-2xx response) rather than
      // silently losing a genuinely successful payment to a transient
      // error on our side (e.g. a momentary DB hiccup).
      console.error("MoMo IPN markPaid failed", err);
      return NextResponse.json({ message: "Internal error" }, { status: 500 });
    }
  }

  // MoMo only requires a 2xx to consider the IPN delivered. A 204 response
  // must not carry a body — plain NextResponse, not .json(), or Next throws.
  return new NextResponse(null, { status: 204 });
}
