import crypto from "node:crypto";

// VNPay "Payment Gateway" integration — sibling of lib/payments/momo.ts,
// same overall shape (build+sign an outgoing request, verify an incoming
// IPN's signature) but a genuinely different mechanism: VNPay has no
// create-payment REST API — the merchant builds one big signed URL and
// redirects the customer's browser directly to it, no separate "create"
// round trip. Credentials are the user's own real VNPay sandbox merchant
// (registered at sandbox.vnpayment.vn) — real secrets, unlike MoMo's
// publicly-published test values, so these have no safe hardcoded default
// and must come from env.
const TMN_CODE = process.env.VNPAY_TMN_CODE ?? "";
const HASH_SECRET = process.env.VNPAY_HASH_SECRET ?? "";
const PAYMENT_URL = process.env.VNPAY_URL ?? "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html";

// Same diacritic-stripping technique as lib/storage/image-upload.ts's
// slugifyFilename() (NFD-normalize + drop combining marks, handle đ/Đ
// separately since it has no NFD decomposition) — VNPay's own integration
// docs require vnp_OrderInfo to be plain ASCII, no Vietnamese diacritics.
// The original order-checkout flow's default text always respected this by
// construction (never embeds a free-text Vietnamese name). The
// subscription/ad flows built afterward broke that convention by embedding
// a store/admin-chosen name (e.g. "Đối tác Kim Cương") straight into
// orderInfo — live-caught: the ad-booking VNPay flow never confirmed
// payment because of exactly this. Sanitizing once, here, inside
// createVnpayPaymentUrl() itself, fixes every caller at once and prevents
// the same class of bug for any future one.
const DIACRITIC_MARKS_RE = new RegExp("[̀-ͯ]", "g");
const D_WITH_STROKE_RE = /[dđĐ]/g;

function toAsciiSafe(text: string): string {
  return text
    .normalize("NFD")
    .replace(DIACRITIC_MARKS_RE, "")
    .replace(D_WITH_STROKE_RE, (m) => (m === "Đ" ? "D" : "d"))
    .replace(/[^\x20-\x7E]/g, "");
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

// VNPay wants vnp_CreateDate/vnp_PayDate as yyyyMMddHHmmss, local time.
function formatVnpayDate(d: Date): string {
  return (
    String(d.getFullYear()) +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds())
  );
}

// Exact algorithm from VNPay's own official demo code (their Node.js sample
// repo) — live-verified against the real sandbox endpoint before this went
// into the app (got back a real 302 redirect to VNPay's bank-selection page
// with a payment session token, not an "invalid checksum" error page).
// Key details that matter and are easy to get subtly wrong:
//  - keys AND values get encodeURIComponent'd while sorting (VNPay's own
//    sortObject() does this, not just the values)
//  - a literal space becomes `+` (application/x-www-form-urlencoded
//    convention), not `%20` — encodeURIComponent alone produces %20, hence
//    the .replace() below
//  - the raw string signed is `key=value&key=value...` with values
//    ALREADY encoded from the sort step, joined with & and NOT re-encoded
function sortAndEncode(params: Record<string, string>): [string, string][] {
  const encodedKeys = Object.keys(params)
    .map((k) => encodeURIComponent(k))
    .sort();
  return encodedKeys.map((encodedKey) => {
    const originalKey = decodeURIComponent(encodedKey);
    const encodedValue = encodeURIComponent(params[originalKey]).replace(/%20/g, "+");
    return [encodedKey, encodedValue];
  });
}

function buildSignData(pairs: [string, string][]): string {
  return pairs.map(([k, v]) => `${k}=${v}`).join("&");
}

function hmacSha512(raw: string): string {
  return crypto.createHmac("sha512", HASH_SECRET).update(Buffer.from(raw, "utf-8")).digest("hex");
}

export interface CreateVnpayPaymentInput {
  // Carried inside vnp_OrderInfo (see decodeOrderIdFromOrderInfo below) —
  // VNPay has no dedicated "pass my own reference through unchanged" field
  // the way MoMo's extraData is, but vnp_OrderInfo is free text and VNPay
  // echoes it back unchanged on both the return redirect and the IPN call,
  // so it serves the same purpose here.
  orderId: string;
  amount: number;
  ipAddr: string;
  returnUrl: string;
  // Optional — defaults to the original "thanh toan don hang" wording for
  // backward compatibility with the existing order-checkout caller.
  // Subscription purchases (dashboard/subscription/actions.ts) pass their
  // own text so the VNPay payment page doesn't misleadingly say "đơn hàng"
  // for something that isn't one.
  orderInfo?: string;
}

// Returns the full URL to redirect the customer's browser to — there's no
// "create payment, get a token back" step to await the way MoMo has.
export function createVnpayPaymentUrl(input: CreateVnpayPaymentInput): string {
  const now = new Date();
  // vnp_TxnRef only needs to be unique per attempt to VNPay itself — it's
  // not how LastBite's own order id gets recovered later (that's
  // vnp_OrderInfo's job, see below), so a plain timestamp is enough.
  const txnRef = String(Date.now());

  const params: Record<string, string> = {
    vnp_Version: "2.1.0",
    vnp_Command: "pay",
    vnp_TmnCode: TMN_CODE,
    vnp_Locale: "vn",
    vnp_CurrCode: "VND",
    vnp_TxnRef: txnRef,
    // Sanitized regardless of what the caller passed in — see toAsciiSafe()'s
    // own comment above for why this has to be enforced here, not trusted
    // to every call site.
    vnp_OrderInfo: toAsciiSafe(input.orderInfo ?? `LastBite thanh toan don hang ${input.orderId}`),
    vnp_OrderType: "other",
    // VNPay wants the smallest currency unit — VND has no subunit in
    // practice, but their API still requires amount * 100.
    vnp_Amount: String(Math.round(input.amount) * 100),
    vnp_ReturnUrl: input.returnUrl,
    vnp_IpAddr: input.ipAddr,
    vnp_CreateDate: formatVnpayDate(now),
  };

  const pairs = sortAndEncode(params);
  const signData = buildSignData(pairs);
  const secureHash = hmacSha512(signData);

  return `${PAYMENT_URL}?${signData}&vnp_SecureHash=${secureHash}`;
}

// Recovers LastBite's own order id from vnp_OrderInfo — see
// CreateVnpayPaymentInput's own comment for why it's carried this way.
export function decodeOrderIdFromOrderInfo(orderInfo: string): string | null {
  const match = orderInfo.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  return match ? match[0] : null;
}

// Verifies the signature on an incoming IPN (or return-redirect) query
// string — the same "don't trust anything until the signature checks out"
// boundary as momo.ts's verifyMomoIpnSignature. `params` should be every
// vnp_* field VNPay sent EXCEPT vnp_SecureHash/vnp_SecureHashType — callers
// pull those two out before calling this, since they're not part of what
// gets re-signed.
export function verifyVnpaySignature(
  params: Record<string, string>,
  receivedHash: string
): boolean {
  const pairs = sortAndEncode(params);
  const signData = buildSignData(pairs);
  const expected = hmacSha512(signData);
  // Constant-time compare — same reasoning as momo.ts's timingSafeEqual use.
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(receivedHash ?? "", "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
