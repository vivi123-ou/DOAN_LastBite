-- Real reconciliation infrastructure, not another patch on top of the
-- manual "Đánh dấu đã thanh toán" fallback. VNPay publishes a genuine
-- "query transaction status" API (querydr) — a merchant can ask VNPay
-- directly "did this specific transaction actually succeed?" instead of
-- only ever passively waiting for their IPN webhook. Real platforms
-- (Shopee included) use exactly this as the second line of defense behind
-- webhook confirmation, with a human manual override kept only as the
-- last-resort exception path, not the primary mechanism.
--
-- To query a transaction later, VNPay's querydr API needs the *exact*
-- vnp_TxnRef and vnp_CreateDate used when the payment URL was originally
-- built (see createVnpayPaymentUrl() in lib/payments/vnpay.ts) — neither
-- was ever persisted anywhere before this, so there was nothing to query
-- against for an already-created booking. Scoped to ad_bookings only this
-- round (the flow that's actually broken); the same two columns / the same
-- reconciliation function can be added to orders/store_subscriptions later
-- if their own webhook confirmation ever needs the same safety net — not
-- done now since both are already confirmed working live via IPN.
alter table ad_bookings
  add column vnp_txn_ref text,
  add column vnp_create_date text;
