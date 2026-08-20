import crypto from "node:crypto";

// MoMo "Payment Gateway" (captureWallet) integration — the real (sandbox)
// counterpart to the old simulatePaymentAction()/SimulatePaymentButton demo
// flow (retired once both gateways went real — see CLAUDE.md). Wired first
// because MoMo publishes a standing, no-registration-required sandbox
// merchant (test partner) in its public developer docs, meant exactly for
// this kind of pre-production testing — VNPay (lib/payments/vnpay.ts) needed
// the user's own sandbox signup first, done in a later round.
//
// No hardcoded fallback values, on purpose — even though MoMo's own test
// partner credentials are publicly published (not actually secret), keeping
// *any* credential-shaped string literal in source is worse practice than
// requiring it from env, and reads as a red flag on inspection regardless of
// the nuance. Set MOMO_PARTNER_CODE/MOMO_ACCESS_KEY/MOMO_SECRET_KEY in
// .env.local (see .env.local.example) — same MoMo-published test values
// work fine as the *value* you put there, they just don't live in the code
// itself anymore.
const PARTNER_CODE = process.env.MOMO_PARTNER_CODE;
const ACCESS_KEY = process.env.MOMO_ACCESS_KEY;
const SECRET_KEY = process.env.MOMO_SECRET_KEY;
// Sandbox endpoint by default — swap to https://payment.momo.vn/v2/gateway/api/create
// (via MOMO_ENDPOINT) only once real production credentials are configured.
const CREATE_ENDPOINT =
  process.env.MOMO_ENDPOINT ?? "https://test-payment.momo.vn/v2/gateway/api/create";

function requireConfig(): { partnerCode: string; accessKey: string; secretKey: string } {
  if (!PARTNER_CODE || !ACCESS_KEY || !SECRET_KEY) {
    throw new Error(
      "Thiếu cấu hình MoMo — hãy đặt MOMO_PARTNER_CODE/MOMO_ACCESS_KEY/MOMO_SECRET_KEY trong .env.local (xem .env.local.example)."
    );
  }
  return { partnerCode: PARTNER_CODE, accessKey: ACCESS_KEY, secretKey: SECRET_KEY };
}

function hmacSha256(secretKey: string, raw: string): string {
  return crypto.createHmac("sha256", secretKey).update(raw).digest("hex");
}

export interface CreateMomoPaymentInput {
  // LastBite's own order id — never sent to MoMo directly as their `orderId`
  // (MoMo requires a *globally unique per request* orderId, and we may
  // legitimately retry the same LastBite order after a failed/abandoned
  // attempt), so it's carried instead via `extraData`, which MoMo echoes
  // back unchanged on both the redirect and the IPN webhook — the intended
  // mechanism for exactly this "pass my own reference through" case.
  orderId: string;
  amount: number;
  orderInfo: string;
  redirectUrl: string;
  ipnUrl: string;
}

export interface CreateMomoPaymentResult {
  payUrl: string;
  resultCode: number;
  message: string;
}

// Builds the signed request body and calls MoMo's create-payment API —
// live-verified against the sandbox endpoint above (resultCode 0, a real
// payUrl came back) before this was wired into the app. Raw signature field
// order is exact per MoMo's own published Node/PHP/Java sample code — do
// not reorder or add/remove fields, the HMAC won't match if the raw string
// doesn't match byte-for-byte.
export async function createMomoPayment(
  input: CreateMomoPaymentInput
): Promise<CreateMomoPaymentResult> {
  const { partnerCode, accessKey, secretKey } = requireConfig();
  const momoOrderId = `${partnerCode}${Date.now()}`;
  const requestId = momoOrderId;
  const amount = String(Math.round(input.amount));
  const extraData = Buffer.from(input.orderId, "utf8").toString("base64");
  const requestType = "captureWallet";

  const rawSignature =
    `accessKey=${accessKey}&amount=${amount}&extraData=${extraData}` +
    `&ipnUrl=${input.ipnUrl}&orderId=${momoOrderId}&orderInfo=${input.orderInfo}` +
    `&partnerCode=${partnerCode}&redirectUrl=${input.redirectUrl}` +
    `&requestId=${requestId}&requestType=${requestType}`;

  const res = await fetch(CREATE_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      partnerCode,
      partnerName: "LastBite",
      storeId: "LastBiteStore",
      requestId,
      amount,
      orderId: momoOrderId,
      orderInfo: input.orderInfo,
      redirectUrl: input.redirectUrl,
      ipnUrl: input.ipnUrl,
      lang: "vi",
      requestType,
      extraData,
      signature: hmacSha256(secretKey, rawSignature),
    }),
  });

  const data = await res.json();
  if (data.resultCode !== 0 || !data.payUrl) {
    throw new Error(data.message || "Không khởi tạo được giao dịch MoMo.");
  }
  return { payUrl: data.payUrl, resultCode: data.resultCode, message: data.message };
}

export interface MomoIpnPayload {
  partnerCode: string;
  orderId: string;
  requestId: string;
  amount: number | string;
  orderInfo: string;
  orderType: string;
  transId: number | string;
  resultCode: number;
  message: string;
  payType: string;
  responseTime: number | string;
  extraData: string;
  signature: string;
}

// Verifies the signature MoMo attaches to its server-to-server IPN call —
// the only step that makes it safe to trust "this order was really paid"
// (the browser redirect alone can't be trusted: a customer could close the
// tab mid-flow and never actually pay). Field order/set is different from
// the create-payment signature above — per MoMo's own IPN spec, not a typo.
export function verifyMomoIpnSignature(payload: MomoIpnPayload): boolean {
  const { accessKey, secretKey } = requireConfig();
  const rawSignature =
    `accessKey=${accessKey}&amount=${payload.amount}&extraData=${payload.extraData}` +
    `&message=${payload.message}&orderId=${payload.orderId}&orderInfo=${payload.orderInfo}` +
    `&orderType=${payload.orderType}&partnerCode=${payload.partnerCode}&payType=${payload.payType}` +
    `&requestId=${payload.requestId}&responseTime=${payload.responseTime}` +
    `&resultCode=${payload.resultCode}&transId=${payload.transId}`;
  const expected = hmacSha256(secretKey, rawSignature);
  // Constant-time compare — signature verification is a security boundary,
  // a plain === leaks timing information about how many leading bytes matched.
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(payload.signature ?? "", "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Recovers LastBite's own order id from extraData (see CreateMomoPaymentInput's
// own comment for why it's carried this way instead of as MoMo's orderId).
export function decodeExtraDataOrderId(extraData: string): string | null {
  try {
    const decoded = Buffer.from(extraData, "base64").toString("utf8");
    return decoded || null;
  } catch {
    return null;
  }
}
