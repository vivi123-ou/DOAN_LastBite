import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { markSubscriptionPaid } from "@/lib/repositories/subscription.repository";
import { verifyMomoIpnSignature, decodeExtraDataOrderId, type MomoIpnPayload } from "@/lib/payments/momo";

// Sibling of app/api/payments/momo/ipn/route.ts, not a shared generic
// handler — deliberately a separate route (and separate ipnUrl, set in
// dashboard/subscription/actions.ts) rather than trying to disambiguate
// "order vs subscription" inside one handler, since the domain-specific
// "what happens after payment" logic (markPaid vs markSubscriptionPaid)
// genuinely differs. `extraData` here carries a store_subscriptions row id,
// not an orders row id — same encoding mechanism (base64), just a
// different table on the other end.
export async function POST(request: NextRequest) {
  let payload: MomoIpnPayload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }

  if (!verifyMomoIpnSignature(payload)) {
    return NextResponse.json({ message: "Invalid signature" }, { status: 400 });
  }

  const subscriptionId = decodeExtraDataOrderId(payload.extraData);
  if (!subscriptionId) {
    return NextResponse.json({ message: "Missing subscription reference" }, { status: 400 });
  }

  if (payload.resultCode === 0) {
    try {
      const admin = createAdminClient();
      await markSubscriptionPaid(admin, subscriptionId, "momo", String(payload.transId));
    } catch (err) {
      console.error("MoMo subscription IPN markSubscriptionPaid failed", err);
      return NextResponse.json({ message: "Internal error" }, { status: 500 });
    }
  }

  return new NextResponse(null, { status: 204 });
}
