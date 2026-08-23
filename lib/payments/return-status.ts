import { verifyVnpaySignature } from "@/lib/payments/vnpay";
import { verifyMomoIpnSignature, type MomoIpnPayload } from "@/lib/payments/momo";

// Real gap the user caught live: after finishing a MoMo/VNPay payment, the
// gateway redirects the browser straight back to this app's own page (see
// createVnpayPaymentUrl's returnUrl / createMomoPayment's redirectUrl) — but
// nothing ever looked at *that* redirect's own query params. The customer
// only ever found out payment succeeded once the page re-rendered with
// fresh DB state (itself only updated once the async IPN webhook lands),
// which can lag a moment behind the browser redirect — reading as "nothing
// happened, do I need to reload?".
//
// This derives an immediate, optimistic "did the gateway say this worked"
// signal straight from the return redirect's own query string, for display
// only (a toast + a short bounded auto-refresh) — it never marks anything
// paid/active itself. The IPN webhook stays the one and only place that
// ever writes payment_status/subscription/ad-booking state, unchanged; if
// this ever disagreed with what the IPN later persists, the server-rendered
// page data (not this) is what actually governs everything downstream.
//
// Both gateways' redirect query strings carry the same signature scheme as
// their respective IPN calls (MoMo explicitly reuses one field set/format
// for both; VNPay's vpcpay.html return uses the same sorted-query-string
// signing as its IPN, a separate mechanism from querydr) — so the existing
// verify functions are reused as-is rather than trusting the redirect blindly.
// A failed/missing signature returns null (silently no toast) rather than
// ever risking a false "thành công" on unverified input.
export type PaymentReturnStatus = "success" | "failed" | null;

export function derivePaymentReturnStatus(
  searchParams: Record<string, string | string[] | undefined>
): PaymentReturnStatus {
  const get = (key: string): string | undefined => {
    const v = searchParams[key];
    return Array.isArray(v) ? v[0] : v;
  };

  const vnpResponseCode = get("vnp_ResponseCode");
  if (vnpResponseCode !== undefined) {
    const receivedHash = get("vnp_SecureHash");
    if (!receivedHash) return null;
    const params: Record<string, string> = {};
    for (const [key, value] of Object.entries(searchParams)) {
      if (key === "vnp_SecureHash" || key === "vnp_SecureHashType") continue;
      const v = Array.isArray(value) ? value[0] : value;
      if (v !== undefined) params[key] = v;
    }
    if (!verifyVnpaySignature(params, receivedHash)) return null;
    const transactionStatus = get("vnp_TransactionStatus");
    return vnpResponseCode === "00" && transactionStatus === "00" ? "success" : "failed";
  }

  const momoResultCode = get("resultCode");
  if (momoResultCode !== undefined) {
    const payload: MomoIpnPayload = {
      partnerCode: get("partnerCode") ?? "",
      orderId: get("orderId") ?? "",
      requestId: get("requestId") ?? "",
      amount: get("amount") ?? "",
      orderInfo: get("orderInfo") ?? "",
      orderType: get("orderType") ?? "",
      transId: get("transId") ?? "",
      resultCode: Number(momoResultCode),
      message: get("message") ?? "",
      payType: get("payType") ?? "",
      responseTime: get("responseTime") ?? "",
      extraData: get("extraData") ?? "",
      signature: get("signature") ?? "",
    };
    if (!verifyMomoIpnSignature(payload)) return null;
    return payload.resultCode === 0 ? "success" : "failed";
  }

  return null;
}
