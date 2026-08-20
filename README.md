# LastBite

Nền tảng kết nối cửa hàng F&B có combo đồ ăn/thức uống dư cuối ngày với khách hàng, hướng tới
Net Zero. Xem `CLAUDE.md` và `.claude/rules/` để biết kiến trúc, tech stack, và các ràng buộc
nghiệp vụ bắt buộc.

## Setup checklist (làm một lần)

1. **Cài dependencies**
   ```
   npm install
   ```

2. **Tạo Supabase project**
   - Vào https://supabase.com/dashboard → New project.
   - Vào **Project Settings → API**, lấy `Project URL`, `anon public key`, `service_role key`.
   - Copy `.env.local.example` thành `.env.local` và dán 3 giá trị trên vào.

3. **Bật đăng nhập Email + Google**
   - Vào **Authentication → Providers**:
     - Bật **Email** (yêu cầu xác nhận email).
     - Bật **Google**: cần tạo OAuth Client ID/Secret tại
       [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → OAuth
       consent screen → Credentials → Create OAuth client ID (loại **Web application**).
       - Authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`
       - Dán Client ID/Secret vào phần Google provider trong Supabase.
   - Vào **Authentication → URL Configuration**:
     - Site URL: `http://localhost:3000` (đổi thành domain Vercel khi deploy).
     - Redirect URLs: thêm `http://localhost:3000/auth/callback` (và domain Vercel + `/auth/callback`).

4. **Áp dụng schema database**
   - Cách nhanh nhất (không cần cài Supabase CLI): mở **SQL Editor** trong Supabase Dashboard,
     dán nội dung từng file theo thứ tự và chạy:
     1. `supabase/migrations/0001_init_schema.sql`
     2. `supabase/migrations/0002_add_lat_lng_columns.sql`
     3. `supabase/migrations/0003_storage_combo_images.sql`
     4. `supabase/seed.sql`
   - Hoặc dùng Supabase CLI: `npx supabase link --project-ref <ref>` rồi `npx supabase db push`.
   - Sau khi áp dụng, có thể regenerate types (tuỳ chọn, cần Supabase CLI đăng nhập):
     ```
     npx supabase gen types typescript --project-id <project-ref> > types/database.types.ts
     ```
     (file hiện tại được viết tay khớp với schema — chỉ cần regenerate nếu sau này chỉnh migration).

5. **Chạy dev server**
   ```
   npm run dev
   ```
   Mở http://localhost:3000.

## Luồng thử nghiệm phase 1

1. Đăng ký tài khoản (email hoặc Google) tại `/signup`.
2. Vào `/dashboard` → đăng ký cửa hàng (cần cấp quyền định vị trình duyệt).
3. Mở Supabase Dashboard → bảng `stores` → sửa `verification_status` của cửa hàng vừa tạo
   thành `verified` (chưa có admin UI ở phase 1, xem `CLAUDE.md` mục 1).
4. Quay lại `/dashboard/combos/new` → tạo combo (chọn loại, giờ khoá tự đề xuất, thêm món, thêm
   ảnh thật).
5. Vào trang chủ `/` (hoặc `/map`) với một tài khoản khác/tab ẩn danh → cho phép định vị → combo
   vừa tạo sẽ hiện lên nếu bạn ở gần toạ độ đã đăng ký.

## Thanh toán MoMo (sandbox)

`/orders/[id]` → chọn MoMo → chuyển sang trang thanh toán **thật** của MoMo (môi trường sandbox
của họ, chưa phải giao dịch tiền thật). Bắt buộc phải set `MOMO_PARTNER_CODE`/`MOMO_ACCESS_KEY`/
`MOMO_SECRET_KEY` trong `.env.local` — không có giá trị mặc định nào nằm sẵn trong code (kể cả
lúc chạy demo/dev cũng phải tự set, xem `.env.local.example` để lấy đúng bộ merchant test công
khai MoMo tự công bố, copy y nguyên vào là chạy được ngay, không cần đăng ký gì thêm). Khi nào có
tài khoản merchant thật của riêng bạn thì thay 3 giá trị này bằng credentials thật.

**Lưu ý khi test hết chu trình (kể cả bước MoMo tự gọi ngược về server xác nhận đã thanh
toán — IPN):** `localhost` không phải là địa chỉ MoMo gọi tới được, nên nếu chỉ chạy
`npm run dev` thuần thì bước xác nhận thanh toán tự động (webhook) sẽ không xảy ra dù trang MoMo
báo thành công. Muốn test đầy đủ, cần 1 URL public trỏ về máy (ví dụ `ngrok http 3000`), rồi set
`NEXT_PUBLIC_SITE_URL=https://<ngrok-domain>` trước khi chạy `npm run dev` — hoặc test trực tiếp
trên bản đã deploy Vercel (đã có domain public sẵn).

## Thanh toán VNPay (sandbox)

`/orders/[id]` → chọn VNPAY → chuyển sang trang thanh toán thật của VNPay (sandbox). Cần đăng ký
merchant test tại `sandbox.vnpayment.vn` trước (miễn phí, tự động duyệt), rồi set
`VNPAY_TMN_CODE`/`VNPAY_HASH_SECRET` trong `.env.local` (xem `.env.local.example`) — khác MoMo,
VNPay không có sẵn bộ test công khai nên bắt buộc phải có credentials riêng mới chạy được.

Thẻ test (ngân hàng NCB, do VNPay cấp kèm merchant):
- Số thẻ: `9704198526191432198`
- Tên chủ thẻ: `NGUYEN VAN A`
- Ngày phát hành: `07/15`
- Mật khẩu OTP: `123456`

Cùng lưu ý về webhook (IPN) như MoMo ở trên — cần URL public thật (ngrok hoặc bản deploy Vercel),
`localhost` thuần sẽ không nhận được xác nhận thanh toán.

## Deploy

- Vercel: import repo, thêm 3 biến môi trường ở trên vào Project Settings → Environment
  Variables, deploy. Nhớ thêm domain Vercel vào Redirect URLs của Supabase Auth (bước 3).
