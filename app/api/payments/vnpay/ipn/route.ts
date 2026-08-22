import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getById, markPaid } from "@/lib/repositories/order.repository";
import { getSubscriptionById, markSubscriptionPaid } from "@/lib/repositories/subscription.repository";
import { getBookingById, markBookingPaid } from "@/lib/repositories/ad.repository";
import { verifyVnpaySignature, decodeOrderIdFromOrderInfo } from "@/lib/payments/vnpay";

// VNPay, unlike MoMo, has no per-request "ipnUrl" field anywhere in its
// create-payment API (see vnpay.ts's createVnpayPaymentUrl — there's
// genuinely no such param to send). A VNPay merchant configures exactly
// ONE IPN URL for their whole sandbox account, in VNPay's own merchant
// admin dashboard, not per transaction. That makes the "one sibling IPN
// route per domain" pattern that works fine for MoMo (subscription-ipn,
// ad-ipn) architecturally impossible for VNPay — whichever single URL is
// registered in the merchant dashboard is the only one VNPay will ever
// call, for every kind of payment LastBite has. Found live: a real test
// payment completed and redirected back successfully, but payment_status
// never updated, because at most one of the three separate VNPay routes
// could ever actually be the one registered.
//
// Fix: one shared route, dispatching by inspecting vnp_OrderInfo's own
// text — each caller already writes a distinguishing phrase into it
// ("don hang" / "goi dich vu" / "quang cao", see orders/[id]/actions.ts,
// dashboard/subscription/actions.ts, dashboard/ads/actions.ts respectively)
// so no new field or migration is needed. The now-unreachable
// subscription-ipn/ad-ipn VNPay routes were deleted, not left as dead code
// VNPay could never actually call. MoMo's three sibling routes are
// unaffected — that gateway genuinely does support a per-request ipnUrl.
function detectKind(orderInfo: string): "subscription" | "ad" | "order" {
  if (orderInfo.includes("goi dich vu")) return "subscription";
  if (orderInfo.includes("quang cao")) return "ad";
  return "order";
}

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

  const refId = decodeOrderIdFromOrderInfo(signedParams.vnp_OrderInfo ?? "");
  const admin = createAdminClient();
  const vnpAmount = Number(signedParams.vnp_Amount);
  const paidOk = signedParams.vnp_ResponseCode === "00" && signedParams.vnp_TransactionStatus === "00";
  const kind = detectKind(signedParams.vnp_OrderInfo ?? "");

  if (kind === "subscription") {
    const subscription = refId ? await getSubscriptionById(admin, refId) : null;
    if (!subscription) return NextResponse.json({ RspCode: "01", Message: "Order not found" });
    if (subscription.amountPaid !== null && vnpAmount !== Math.round(subscription.amountPaid) * 100) {
      return NextResponse.json({ RspCode: "04", Message: "Invalid Amount" });
    }
    if (subscription.status === "active") {
      return NextResponse.json({ RspCode: "02", Message: "Order already confirmed" });
    }
    if (paidOk) {
      try {
        await markSubscriptionPaid(admin, subscription.id, "vnpay", signedParams.vnp_TransactionNo);
      } catch (err) {
        console.error("VNPay IPN markSubscriptionPaid failed", err);
        return NextResponse.json({ RspCode: "99", Message: "Unknown error" });
      }
    }
    return NextResponse.json({ RspCode: "00", Message: "Confirm Success" });
  }

  if (kind === "ad") {
    const booking = refId ? await getBookingById(admin, refId) : null;
    if (!booking) return NextResponse.json({ RspCode: "01", Message: "Order not found" });
    if (booking.amountPaid !== null && vnpAmount !== Math.round(booking.amountPaid) * 100) {
      return NextResponse.json({ RspCode: "04", Message: "Invalid Amount" });
    }
    if (booking.status === "active") {
      return NextResponse.json({ RspCode: "02", Message: "Order already confirmed" });
    }
    if (paidOk) {
      try {
        await markBookingPaid(admin, booking.id, "vnpay", signedParams.vnp_TransactionNo);
      } catch (err) {
        console.error("VNPay IPN markBookingPaid failed", err);
        return NextResponse.json({ RspCode: "99", Message: "Unknown error" });
      }
    }
    return NextResponse.json({ RspCode: "00", Message: "Confirm Success" });
  }

  // kind === "order"
  const order = refId ? await getById(admin, refId) : null;
  if (!order) {
    return NextResponse.json({ RspCode: "01", Message: "Order not found" });
  }
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
  if (paidOk) {
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
