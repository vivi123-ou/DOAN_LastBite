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

## Deploy

- Vercel: import repo, thêm 3 biến môi trường ở trên vào Project Settings → Environment
  Variables, deploy. Nhớ thêm domain Vercel vào Redirect URLs của Supabase Auth (bước 3).
