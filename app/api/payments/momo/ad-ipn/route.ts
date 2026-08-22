import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { markBookingPaid } from "@/lib/repositories/ad.repository";
import { verifyMomoIpnSignature, decodeExtraDataOrderId, type MomoIpnPayload } from "@/lib/payments/momo";

// Third sibling of app/api/payments/momo/{ipn,subscription-ipn}/route.ts —
// same reasoning as the subscription one: "what happens after payment"
// (markBookingPaid, activating an ad_bookings row) is domain-specific
// enough to warrant its own route rather than branching one handler on
// "order vs subscription vs ad". `extraData` here carries an ad_bookings
// row id.
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

  const bookingId = decodeExtraDataOrderId(payload.extraData);
  if (!bookingId) {
    return NextResponse.json({ message: "Missing booking reference" }, { status: 400 });
  }

  if (payload.resultCode === 0) {
    try {
      const admin = createAdminClient();
      await markBookingPaid(admin, bookingId, "momo", String(payload.transId));
    } catch (err) {
      console.error("MoMo ad IPN markBookingPaid failed", err);
      return NextResponse.json({ message: "Internal error" }, { status: 500 });
    }
  }

  return new NextResponse(null, { status: 204 });
}
