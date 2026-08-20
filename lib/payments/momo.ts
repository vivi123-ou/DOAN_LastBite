import crypto from "node:crypto";

// MoMo "Payment Gateway" (captureWallet) integration — the real (sandbox)
// counterpart to the old simulatePaymentAction()/SimulatePaymentButton demo
// flow (retired once both gateways went real — see CLAUDE.md). Wired first
// because MoMo publishes a standing, no-registration-required sandbox
// merchant (test partner) in its public developer docs, meant exactly for
// this kind of pre-production testing — VNPay (lib/payments/vnpay.ts) needed
// the user's own sandbox signup first, done in a later round. These are NOT
// secrets — they're MoMo's own published test values, safe to ship as
// defaults; override via env vars once real production merchant credentials
// exist (see .env.local.example).
const PARTNER_CODE = process.env.MOMO_PARTNER_CODE ?? "MOMO";
const ACCESS_KEY = process.env.MOMO_ACCESS_KEY ?? "F8BBA842ECF85";
const SECRET_KEY = process.env.MOMO_SECRET_KEY ?? "K951B6PE1waDMi640xX08PD3vg6EkVlz";
// Sandbox endpoint by default — swap to https://payment.momo.vn/v2/gateway/api/create
// (via MOMO_ENDPOINT) only once real production credentials are configured.
const CREATE_ENDPOINT =
  process.env.MOMO_ENDPOINT ?? "https://test-payment.momo.vn/v2/gateway/api/create";

function hmacSha256(raw: string): string {
  return crypto.createHmac("sha256", SECRET_KEY).update(raw).digest("hex");
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
  const momoOrderId = `${PARTNER_CODE}${Date.now()}`;
  const requestId = momoOrderId;
  const amount = String(Math.round(input.amount));
  const extraData = Buffer.from(input.orderId, "utf8").toString("base64");
  const requestType = "captureWallet";

  const rawSignature =
    `accessKey=${ACCESS_KEY}&amount=${amount}&extraData=${extraData}` +
    `&ipnUrl=${input.ipnUrl}&orderId=${momoOrderId}&orderInfo=${input.orderInfo}` +
    `&partnerCode=${PARTNER_CODE}&redirectUrl=${input.redirectUrl}` +
    `&requestId=${requestId}&requestType=${requestType}`;

  const res = await fetch(CREATE_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      partnerCode: PARTNER_CODE,
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
      signature: hmacSha256(rawSignature),
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
  const rawSignature =
    `accessKey=${ACCESS_KEY}&amount=${payload.amount}&extraData=${payload.extraData}` +
    `&message=${payload.message}&orderId=${payload.orderId}&orderInfo=${payload.orderInfo}` +
    `&orderType=${payload.orderType}&partnerCode=${payload.partnerCode}&payType=${payload.payType}` +
    `&requestId=${payload.requestId}&responseTime=${payload.responseTime}` +
    `&resultCode=${payload.resultCode}&transId=${payload.transId}`;
  const expected = hmacSha256(rawSignature);
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
