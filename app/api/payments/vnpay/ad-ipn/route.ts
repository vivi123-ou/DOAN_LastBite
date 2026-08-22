import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getBookingById, markBookingPaid } from "@/lib/repositories/ad.repository";
import { verifyVnpaySignature, decodeOrderIdFromOrderInfo } from "@/lib/payments/vnpay";

// Third sibling of app/api/payments/vnpay/{ipn,subscription-ipn}/route.ts —
// same GET+query-params shape, same RspCode contract, same reasoning for
// staying a separate route (see the subscription-ipn route's own comment).
export async function GET(request: NextRequest) {
  const allParams = Object.fromEntries(request.nextUrl.searchParams.entries());
  const { vnp_SecureHash, ...signedParams } = allParams;
  delete signedParams.vnp_SecureHashType;

  if (!verifyVnpaySignature(signedParams, vnp_SecureHash)) {
    return NextResponse.json({ RspCode: "97", Message: "Invalid Checksum" });
  }

  const bookingId = decodeOrderIdFromOrderInfo(signedParams.vnp_OrderInfo ?? "");
  const admin = createAdminClient();
  const booking = bookingId ? await getBookingById(admin, bookingId) : null;
  if (!booking) {
    return NextResponse.json({ RspCode: "01", Message: "Order not found" });
  }

  const vnpAmount = Number(signedParams.vnp_Amount);
  if (booking.amountPaid !== null && vnpAmount !== Math.round(booking.amountPaid) * 100) {
    return NextResponse.json({ RspCode: "04", Message: "Invalid Amount" });
  }

  if (booking.status === "active") {
    return NextResponse.json({ RspCode: "02", Message: "Order already confirmed" });
  }

  if (signedParams.vnp_ResponseCode === "00" && signedParams.vnp_TransactionStatus === "00") {
    try {
      await markBookingPaid(admin, booking.id, "vnpay", signedParams.vnp_TransactionNo);
    } catch (err) {
      console.error("VNPay ad IPN markBookingPaid failed", err);
      return NextResponse.json({ RspCode: "99", Message: "Unknown error" });
    }
  }

  return NextResponse.json({ RspCode: "00", Message: "Confirm Success" });
}
