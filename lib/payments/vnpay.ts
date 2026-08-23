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
// VNPay's "Merchant Webservice" — a genuinely separate API from the
// vpcpay.html redirect above, used for querydr (query transaction status).
// Same sandbox host, different path — live-verified against the real
// endpoint before this went into the app (see queryVnpayTransaction()'s
// own comment).
const QUERY_URL = process.env.VNPAY_QUERY_URL ?? "https://sandbox.vnpayment.vn/merchant_webapi/api/transaction";

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

export interface CreateVnpayPaymentResult {
  payUrl: string;
  // Both needed later to query this exact transaction's real status via
  // queryVnpayTransaction() (VNPay's querydr requires the original
  // vnp_TxnRef + vnp_CreateDate to identify which attempt you mean) —
  // callers that want reconciliation must persist these against their own
  // row (see ad.repository.ts's recordVnpayTxnRef()).
  txnRef: string;
  createDate: string;
}

// Returns the full URL to redirect the customer's browser to (plus the
// txn reference needed to query it later) — there's no "create payment,
// get a token back" step to await the way MoMo has.
export function createVnpayPaymentUrl(input: CreateVnpayPaymentInput): CreateVnpayPaymentResult {
  const now = new Date();
  // vnp_TxnRef only needs to be unique per attempt to VNPay itself — it's
  // not how LastBite's own order id gets recovered later (that's
  // vnp_OrderInfo's job, see below), so a plain timestamp is enough.
  const txnRef = String(Date.now());
  const createDate = formatVnpayDate(now);

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
    vnp_CreateDate: createDate,
  };

  const pairs = sortAndEncode(params);
  const signData = buildSignData(pairs);
  const secureHash = hmacSha512(signData);

  return { payUrl: `${PAYMENT_URL}?${signData}&vnp_SecureHash=${secureHash}`, txnRef, createDate };
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

export interface QueryVnpayTransactionInput {
  txnRef: string;
  // The original vnp_CreateDate from when the payment URL was built — this
  // is what tells VNPay *which specific attempt* you're asking about
  // (vnp_TxnRef alone isn't guaranteed unique forever in their system).
  transactionDate: string;
  orderInfo: string;
  ipAddr: string;
}

export interface QueryVnpayTransactionResult {
  responseCode: string;
  message: string;
  transactionStatus: string | null;
  transactionNo: string | null;
  amount: number | null;
  // Convenience — true only for the one combination that actually means
  // "this payment genuinely succeeded" (mirrors the exact check the IPN
  // route already uses).
  succeeded: boolean;
}

// VNPay's "querydr" API — a *separate* webservice from the vpcpay.html
// redirect (different host path, different request shape: one signed JSON
// POST instead of a signed query string), letting a merchant ask directly
// "did this specific transaction actually succeed?" instead of only ever
// passively waiting on the IPN webhook. This is the real second line of
// defense real payment integrations use behind webhook confirmation (a
// webhook can fail to arrive for reasons that have nothing to do with
// whether the payment itself succeeded) — a manual admin override is only
// ever the last-resort fallback behind *this*, not a replacement for it.
//
// Request signature is a *different* shape from every other VNPay
// signature in this file: a plain `|`-joined string in a fixed field order
// (VNPay's own querydr spec), not the sorted-query-string form
// vpcpay.html/IPN use. Live-verified against the real sandbox endpoint
// before shipping — a deliberately-fake vnp_TxnRef correctly got back
// `vnp_ResponseCode: "91"` ("Giao dịch không tồn tại"), confirming the
// request shape itself (not just "some" response) is right.
//
// Deliberately does NOT re-verify a signature on the *response* — unlike
// the IPN webhook (a public inbound endpoint anyone could POST/GET to,
// where signature verification is the only thing standing between "real
// VNPay" and "anyone pretending to be VNPay"), this is an outbound HTTPS
// request *we* initiate straight to VNPay's own sandbox host — TLS already
// authenticates that the response really came from vnpayment.vn. Several
// plausible field orderings for VNPay's undocumented response-signature
// format were tried against a real captured response and none matched;
// shipping a guessed verification that might silently reject genuine
// responses would be worse than relying on the transport-level guarantee
// that's already there.
export async function queryVnpayTransaction(
  input: QueryVnpayTransactionInput
): Promise<QueryVnpayTransactionResult> {
  const requestId = String(Date.now());
  const createDate = formatVnpayDate(new Date());
  const command = "querydr";
  const version = "2.1.0";

  const signData = [
    requestId,
    version,
    command,
    TMN_CODE,
    input.txnRef,
    input.transactionDate,
    createDate,
    input.ipAddr,
    input.orderInfo,
  ].join("|");
  const secureHash = hmacSha512(signData);

  const res = await fetch(QUERY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      vnp_RequestId: requestId,
      vnp_Version: version,
      vnp_Command: command,
      vnp_TmnCode: TMN_CODE,
      vnp_TxnRef: input.txnRef,
      vnp_OrderInfo: input.orderInfo,
      vnp_TransactionDate: input.transactionDate,
      vnp_CreateDate: createDate,
      vnp_IpAddr: input.ipAddr,
      vnp_SecureHash: secureHash,
    }),
  });
  const json = (await res.json()) as Record<string, string | undefined>;

  const responseCode = json.vnp_ResponseCode ?? "";
  const transactionStatus = json.vnp_TransactionStatus ?? null;

  return {
    responseCode,
    message: json.vnp_Message ?? "",
    transactionStatus,
    transactionNo: json.vnp_TransactionNo ?? null,
    amount: json.vnp_Amount ? Number(json.vnp_Amount) / 100 : null,
    succeeded: responseCode === "00" && transactionStatus === "00",
  };
}
