import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSubscriptionById, markSubscriptionPaid } from "@/lib/repositories/subscription.repository";
import { verifyVnpaySignature, decodeOrderIdFromOrderInfo } from "@/lib/payments/vnpay";

// Sibling of app/api/payments/vnpay/ipn/route.ts (same GET+query-params
// shape, same RspCode contract VNPay's own SIT conformance tester checks),
// deliberately a separate route rather than one handler branching on
// "order vs subscription" — see the MoMo subscription-ipn route's own
// comment for the same reasoning.
export async function GET(request: NextRequest) {
  const allParams = Object.fromEntries(request.nextUrl.searchParams.entries());
  const { vnp_SecureHash, ...signedParams } = allParams;
  delete signedParams.vnp_SecureHashType;

  if (!verifyVnpaySignature(signedParams, vnp_SecureHash)) {
    return NextResponse.json({ RspCode: "97", Message: "Invalid Checksum" });
  }

  const subscriptionId = decodeOrderIdFromOrderInfo(signedParams.vnp_OrderInfo ?? "");
  const admin = createAdminClient();
  const subscription = subscriptionId ? await getSubscriptionById(admin, subscriptionId) : null;
  if (!subscription) {
    return NextResponse.json({ RspCode: "01", Message: "Order not found" });
  }

  const vnpAmount = Number(signedParams.vnp_Amount);
  if (subscription.amountPaid !== null && vnpAmount !== Math.round(subscription.amountPaid) * 100) {
    return NextResponse.json({ RspCode: "04", Message: "Invalid Amount" });
  }

  if (subscription.status === "active") {
    return NextResponse.json({ RspCode: "02", Message: "Order already confirmed" });
  }

  if (signedParams.vnp_ResponseCode === "00" && signedParams.vnp_TransactionStatus === "00") {
    try {
      await markSubscriptionPaid(admin, subscription.id, "vnpay", signedParams.vnp_TransactionNo);
    } catch (err) {
      console.error("VNPay subscription IPN markSubscriptionPaid failed", err);
      return NextResponse.json({ RspCode: "99", Message: "Unknown error" });
    }
  }

  return NextResponse.json({ RspCode: "00", Message: "Confirm Success" });
}
