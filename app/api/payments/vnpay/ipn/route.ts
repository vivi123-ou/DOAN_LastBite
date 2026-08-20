import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getById, markPaid } from "@/lib/repositories/order.repository";
import { verifyVnpaySignature, decodeOrderIdFromOrderInfo } from "@/lib/payments/vnpay";

// VNPay's IPN is a GET request (query params), unlike MoMo's POST+JSON body
// — and VNPay has a strict, machine-checked response contract (their own
// SIT conformance tester at sandbox.vnpayment.vn/vnpaygw-sit-testing
// literally scripts through each of these scenarios and checks the exact
// RspCode comes back), so the check ordering below follows their official
// demo code precisely rather than a more casual "verify then proceed" shape.
export async function GET(request: NextRequest) {
  const allParams = Object.fromEntries(request.nextUrl.searchParams.entries());
  const { vnp_SecureHash, ...signedParams } = allParams;
  // Not part of what gets re-signed, same as vnp_SecureHash itself.
  delete signedParams.vnp_SecureHashType;

  if (!verifyVnpaySignature(signedParams, vnp_SecureHash)) {
    return NextResponse.json({ RspCode: "97", Message: "Invalid Checksum" });
  }

  const orderId = decodeOrderIdFromOrderInfo(signedParams.vnp_OrderInfo ?? "");
  const admin = createAdminClient();
  const order = orderId ? await getById(admin, orderId) : null;
  if (!order) {
    return NextResponse.json({ RspCode: "01", Message: "Order not found" });
  }

  // vnp_Amount is the order total * 100 (see vnpay.ts's createVnpayPaymentUrl).
  const vnpAmount = Number(signedParams.vnp_Amount);
  if (vnpAmount !== Math.round(order.totalAmount) * 100) {
    return NextResponse.json({ RspCode: "04", Message: "Invalid Amount" });
  }

  if (order.paymentStatus === "success") {
    // Distinct from markPaid()'s own idempotency guard (order.repository.ts)
    // — that one silently no-ops for any caller; VNPay's conformance test
    // specifically expects "02" here, not "00", so this is checked
    // explicitly before ever calling markPaid().
    return NextResponse.json({ RspCode: "02", Message: "Order already confirmed" });
  }

  // vnp_ResponseCode "00" + vnp_TransactionStatus "00" = the transaction
  // genuinely succeeded. Any other value (cancelled, failed, expired) still
  // gets acknowledged with RspCode 00 below — that code means "IPN received
  // and processed correctly", not "payment succeeded" — the order just
  // stays unpaid in that case, same as if the customer never opened VNPay's
  // page at all.
  if (signedParams.vnp_ResponseCode === "00" && signedParams.vnp_TransactionStatus === "00") {
    try {
      await markPaid(
        admin,
        order.id,
        "vnpay",
        signedParams.vnp_TransactionNo,
        signedParams as unknown as Record<string, unknown>
      );
    } catch (err) {
      console.error("VNPay IPN markPaid failed", err);
      return NextResponse.json({ RspCode: "99", Message: "Unknown error" });
    }
  }

  return NextResponse.json({ RspCode: "00", Message: "Confirm Success" });
}
