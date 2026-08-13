# LastBite — Phân tích thiết kế hệ thống

> Tài liệu này mô tả kiến trúc hiện tại của LastBite (tính đến thời điểm viết), làm nguồn dữ liệu để vẽ sơ đồ PlantUML (component, sequence, ER...). Trọng tâm: **các chức năng tìm kiếm** — tên hàm, file, input/output, index DB đứng sau. Toàn bộ đường dẫn file là tương đối so với gốc repo.

---

## 1. Kiến trúc tổng quan (3 lớp)

```
┌─────────────────────────────────────────────────────────────────┐
│  PRESENTATION — Next.js App Router (app/)                        │
│  - Route groups: (auth) | (customer) | (store)                   │
│  - Server Components (mặc định) + Client Components ("use client"│
│    chỉ khi cần: geolocation, Leaflet map, form state, realtime)  │
│  - API routes: app/api/**/route.ts (dùng cho client-side fetch,  │
│    ví dụ ô tìm kiếm trên header cần gọi qua HTTP thay vì gọi     │
│    repository trực tiếp vì nó chạy trong trình duyệt)            │
│  - Server Actions: app/**/actions.ts (mutation từ Client         │
│    Component — cart, checkout, đổi trạng thái đơn, chat...)      │
└───────────────────────────┬────────────────────────────────────┘
                            │ luôn đi qua, KHÔNG BAO GIỜ gọi thẳng
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  DOMAIN / REPOSITORY — lib/                                      │
│  - lib/repositories/*.repository.ts  → duy nhất nơi được gọi     │
│    supabase.from()/.rpc()/.storage/.auth (bắt buộc, xem          │
│    .claude/rules/stack-and-conventions.md)                       │
│  - lib/domain/*.ts        → kiểu dữ liệu domain (camelCase),     │
│    nơi map từ snake_case cột DB sang object domain                │
│  - lib/factories/*.builder.ts → Builder pattern (combo, order)    │
│  - lib/pricing/strategies/*   → Strategy pattern (giá động)       │
│  - lib/validation/*.schema.ts → zod, validate input từ client     │
│  - lib/events/event-bus.ts    → Observer (chưa có publisher thật) │
└───────────────────────────┬────────────────────────────────────┘
                            │ Supabase JS client (3 loại, xem §2)
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  DATA — Supabase Cloud                                           │
│  - Postgres 15 + PostGIS (geo) + pg_trgm/unaccent (text search)  │
│  - Row Level Security (RLS) bật trên MỌI bảng                    │
│  - Auth (email/password + Google OAuth)                          │
│  - Storage (avatars, combo-images buckets)                       │
│  - Realtime (bảng `messages` — chat 1:1)                         │
│  - supabase/migrations/0001..0024_*.sql (24 migration, cộng dồn) │
└─────────────────────────────────────────────────────────────────┘
```

**Gợi ý PlantUML:** đây là 1 **Component Diagram** hoặc **Deployment Diagram** 3 tier, với ghi chú "arrow chỉ đi 1 chiều xuống, tầng dưới không biết tầng trên".

### 1.1. Ba loại Supabase client (quan trọng cho sơ đồ)

| File | Dùng ở đâu | Quyền |
|---|---|---|
| `lib/supabase/client.ts` | Client Components (`"use client"`) | Theo session người dùng đang đăng nhập, bị chặn bởi RLS |
| `lib/supabase/server.ts` | Server Components, Route Handlers, Server Actions | Theo session người dùng (đọc cookie), bị chặn bởi RLS |
| `lib/supabase/admin.ts` | Chỉ trong code server, cho **ghi xuyên người dùng** (checkout, thanh toán, thông báo, tra hồ sơ bạn bè...) | `service_role` — **bỏ qua RLS hoàn toàn**, không bao giờ lộ ra client |
| `proxy.ts` (gốc repo) | Next.js 16 middleware — refresh session Supabase cho mọi request | — |

---

## 2. Danh mục chức năng TÌM KIẾM (trọng tâm chính)

Có **6 cơ chế tìm kiếm độc lập** trong hệ thống, mỗi cái có lý do kỹ thuật riêng để tách biệt (không dùng chung 1 hàm):

### 2.1. Tìm combo theo tên/cửa hàng + lọc giá + sắp xếp — `search_combos()`

```
UI: components/layout/site-search.tsx (ô tìm kiếm header, dropdown gợi ý)
    app/(customer)/_components/search-results-section.tsx (trang kết quả đầy đủ)
    components/layout/site-search-filters.tsx (icon lọc: giá / bán kính / sắp xếp)
     │  fetch()
     ▼
API: app/api/combos/search/route.ts   (GET, nhận lat/lng/q/sort/minPrice/maxPrice/radiusM/limit)
     │  gọi repository
     ▼
Repo: lib/repositories/combo.repository.ts → search(client, lat, lng, options)
     │  .rpc("search_combos", {...})
     ▼
SQL:  search_combos()  — định nghĩa mới nhất trong
      supabase/migrations/0016_dynamic_pricing.sql (thân hàm),
      lịch sử thay đổi: 0008 (tạo mới) → 0009 → 0011 (thêm lọc best_before) → 0016 (giá động)
```

- **Input SQL:** `in_lat, in_lng, in_query, radius_m, max_results, in_category_id, min_price, max_price, sort_by`
- **Output:** `combo_id, name, current_price, original_price, best_before, store_id, store_name, distance_m, image_url, delivery_supported, pickup_supported`
- **Cách khớp tên (text search):** `lower(f_unaccent(c.name)) ilike '%...%'` và tương tự cho `s.name` — khớp cả tên combo lẫn tên cửa hàng trong 1 lần gọi.
- **Index đứng sau:** GIN trigram trên `lower(f_unaccent(name))` cho cả `combos` và `stores` (tạo ở `0001_init_schema.sql`, tên index: `idx_combos_name_trgm`, `idx_stores_name_trgm`).
- **Vì sao có hàm riêng, không dùng chung `nearby_combos()`:** `nearby_combos()` sắp xếp bằng toán tử KNN `<->` của PostGIS để tận dụng GiST index; bọc `<->` trong `CASE` (cần thiết để sort theo giá) sẽ làm mất khả năng dùng index đó. → tách hẳn 1 hàm SQL khác, chấp nhận trùng lặp logic lọc `ST_DWithin`.
- **Giá trả về không phải cột tĩnh** — mỗi dòng gọi `dynamic_combo_price(...)` (xem §2.7) để tính giá tại đúng thời điểm query.

### 2.2. Tìm combo gần vị trí GPS (mặc định trang chủ) — `nearby_combos()`

```
UI: app/(customer)/_components/combo-sections.tsx (3 dải "Gần bạn nhất" / "Mới nhất" / "Gợi ý cho bạn"
    + 1 dải riêng mỗi category), components/map/store-detail-panel.tsx (panel bản đồ)
     │
     ▼
API: app/api/combos/nearby/route.ts   (GET lat/lng/radiusM/categoryId)
     │
     ▼
Repo: lib/repositories/combo.repository.ts → listNearby(client, lat, lng, radiusM, maxResults, categoryId)
     │  .rpc("nearby_combos", {...})
     ▼
SQL:  nearby_combos() — thân hàm mới nhất: 0016_dynamic_pricing.sql
      Lịch sử: 0001 (gốc) → 0006 (thêm ảnh) → 0009 (thêm delivery/pickup_supported)
               → 0011 (lọc best_before > now()) → 0016 (giá động)
```

- **Input:** `in_lat, in_lng, radius_m (default 5000, route override 10000), max_results, in_category_id`
- **Sắp xếp:** `order by s.geog <-> point` — toán tử KNN, **có dùng index** (`idx_stores_geog`, kiểu `GiST`), không phải tính khoảng cách rồi sort ở tầng ứng dụng.
- **Lọc bán kính:** `ST_DWithin(s.geog, point, radius_m)` — cũng dùng cùng index GiST đó.
- **`DEFAULT_RADIUS_M = 10000`** định nghĩa ở `combo.repository.ts` (từng là 5000, tăng lên sau 1 bug thật: combo cách 6.8km bị "biến mất" khỏi trang chủ mặc định).
- Không có tham số `in_query` — đây thuần là tìm theo **vị trí + loại**, không theo tên.

### 2.3. Ô tìm kiếm nhanh trên header (gợi ý tức thời khi gõ)

```
components/layout/site-search.tsx ("use client")
  - debounce 300ms, tối đa 6 kết quả (DROPDOWN_LIMIT)
  - lấy vị trí 1 lần/phiên qua lib/geo/geolocation.ts → getCurrentPosition()
  - gọi GET /api/combos/search?...&limit=6  (dùng lại đúng route ở §2.1)
  - Enter / bấm "Xem tất cả kết quả" → router.push("/?q=...")
```

Đây không phải 1 cơ chế tìm kiếm riêng về mặt data — nó chỉ là 1 lớp UI (debounce + dropdown) gọi lại **cùng 1 API route** với `search-results-section.tsx`, chỉ khác `limit`.

### 2.4. Bộ lọc giá / bán kính / sắp xếp (panel icon cạnh ô search)

```
components/layout/site-search-filters.tsx ("use client")
  - Không gọi API trực tiếp — chỉ đổi query params trên URL (?sort=&minPrice=&maxPrice=&radiusM=)
  - "Áp dụng" mới thực sự router.push() → search-results-section.tsx tự fetch lại
  - State nháp (draft) tách khỏi state đã áp dụng — không tự tìm khi đang bấm chọn
```

Không gọi DB trực tiếp — chỉ là bộ điều khiển tham số cho §2.1.

### 2.5. Tìm bạn bè theo tên — `search_profiles()`

```
UI: app/(customer)/friends/_components/friends-view.tsx
     │  server action
     ▼
Action: app/(customer)/friends/actions.ts → searchUsersAction(query)
     │
     ▼
Repo: lib/repositories/friend.repository.ts → searchUsers(adminClient, query, excludeUserId, limit)
     │  .rpc("search_profiles", {...})  ⚠ luôn gọi bằng admin client, không phải client thường
     ▼
SQL:  search_profiles()  — supabase/migrations/0010_friends_messages.sql
```

- **Input:** `in_query, exclude_user_id, max_results (default 10)`
- **Output:** `user_id, full_name, avatar_url`
- **Vì sao bắt buộc admin client:** bảng `profiles` chỉ có policy RLS rất hẹp (chỉ đọc được chính mình, hoặc trường hợp đặc biệt store owner ↔ khách đã từng đặt đơn). Không có policy "đọc tất cả để tìm kiếm" — thay vào đó hàm luôn được gọi qua service-role, và hàm **không phải `SECURITY DEFINER`** nên nếu 1 client thường tự gọi RPC này, RLS gốc của `profiles` vẫn chặn như thường — không có lỗ hổng.
- **Index:** GIN trigram trên `lower(f_unaccent(full_name))` (`idx_profiles_full_name_trgm`, tạo cùng migration `0010`).
- Kết quả được đối chiếu tiếp ở tầng UI (`friends-view.tsx`) với danh sách bạn bè đã có, để không hiện nút "Kết bạn" cho người đã là bạn/đang chờ.

### 2.6. Tìm địa chỉ → toạ độ (geocode khi đăng ký/sửa cửa hàng)

```
UI: components/... (form địa chỉ cửa hàng, debounce 900ms khi gõ)
     │
     ▼
API: app/api/geocode/route.ts (GET ?q=...)
     │  fetch() server-side
     ▼
External: Nominatim (OpenStreetMap) — https://nominatim.openstreetmap.org/search
          country=vn, format=json, limit=1
```

- Đây là tìm kiếm ra bên ngoài hệ thống (không đụng DB LastBite) — chỉ dùng để đặt ghim GPS khi đăng ký cửa hàng (`components/map/location-picker-map.tsx`).
- Chạy ở server (route handler), không gọi thẳng từ browser, vì Nominatim yêu cầu `User-Agent` mô tả ứng dụng — trình duyệt chặn việc tự set header đó.

### 2.7. (Không phải "tìm kiếm" nhưng luôn đi kèm) — Tính giá động `dynamic_combo_price()`

Cả `nearby_combos()` lẫn `search_combos()` đều gọi hàm này cho **mỗi dòng** để tính `current_price` tại đúng thời điểm — không đọc cột tĩnh.

```
SQL: dynamic_combo_price(original_price, initial_stock, remaining_stock, created_at, best_before, as_of)
     supabase/migrations/0017_dynamic_pricing_multiplicative.sql (bản mới nhất)
     Công thức: giá = original_price × (1 − 0.5 × timeUrgency × stockPressure), làm tròn bậc 500đ
     - timeUrgency  = tỉ lệ thời gian đã trôi qua trong [created_at, best_before]
     - stockPressure = tỉ lệ hàng còn lại / hàng ban đầu
     - Nhân (không cộng) 2 hệ số này — để combo mới đăng (timeUrgency=0) luôn = 0% giảm

Bản sao TypeScript song song (bắt buộc trùng công thức, dùng ở nơi không gọi được SQL):
lib/pricing/strategies/stock-based-decay.strategy.ts
  - class StockBasedDecayStrategy implements PricingStrategy (dùng cho trang chi tiết combo, dashboard)
  - hàm computeStockBasedDecayPrice() (dùng cho checkout snapshot, map panel — không phải full Combo object)
```

### 2.8. Lịch sử tìm kiếm — lưu, không phải "tìm"

```
lib/repositories/search-history.repository.ts → record(client, userId, queryText)
  - Gọi từ search-results-section.tsx, fire-and-forget, sau khi có kết quả
  - Ghi vào bảng search_history (RLS: search_history_insert_own — client thường được phép, cùng actor)
  - HIỆN CHƯA CÓ nơi nào đọc lại bảng này để gợi ý — chỉ mới ghi, chưa dùng (xem §5 "gợi ý")
```

### 2.9. Liên quan — "Có thể bạn thích" (gợi ý cá nhân hoá, không dùng search_history)

```
lib/repositories/order.repository.ts → getTopPurchasedCategoryIds(client, customerId, limit)
  - Gom nhóm order_items → combos.category_id theo lịch sử ĐÃ MUA (không phải đã tìm)
  - Dùng ở app/(customer)/page.tsx → truyền categoryId đó vào lại nearby_combos() (§2.2)
    để lấy 1 dải combo cùng loại — không phải 1 hàm SQL riêng
```

---

## 3. Bảng tổng hợp nhanh (cho legend của sơ đồ)

| # | Chức năng | Hàm chính | File TypeScript | Hàm/RPC SQL | File SQL gốc |
|---|---|---|---|---|---|
| 1 | Tìm combo theo tên/lọc/sort | `search()` | `lib/repositories/combo.repository.ts` | `search_combos()` | `0008`→`0011`→`0016` |
| 2 | Tìm combo gần vị trí | `listNearby()` | `lib/repositories/combo.repository.ts` | `nearby_combos()` | `0001`→`0006`→`0009`→`0011`→`0016` |
| 3 | Giá động (dùng chung 1+2) | `computeStockBasedDecayPrice()` / `dynamic_combo_price()` | `lib/pricing/strategies/stock-based-decay.strategy.ts` | `dynamic_combo_price()` | `0016`→`0017` |
| 4 | Tìm bạn bè theo tên | `searchUsers()` | `lib/repositories/friend.repository.ts` | `search_profiles()` | `0010` |
| 5 | Geocode địa chỉ | route handler | `app/api/geocode/route.ts` | (Nominatim ngoài) | — |
| 6 | Lưu lịch sử tìm | `record()` | `lib/repositories/search-history.repository.ts` | insert `search_history` | `0001` |
| 7 | Gợi ý theo đã mua | `getTopPurchasedCategoryIds()` | `lib/repositories/order.repository.ts` | (JS group-by, không SQL riêng) | — |
| 8 | Đếm tin nhắn chưa đọc (không phải tìm, nhưng cùng dạng RPC scoped-by-auth.uid) | `getUnreadCounts()` | `lib/repositories/message.repository.ts` | `unread_message_counts()` | `0024` |

**Route API liên quan tìm kiếm:**
| Route | File | Gọi repo nào |
|---|---|---|
| `GET /api/combos/search` | `app/api/combos/search/route.ts` | `combo.repository.ts` → `search()` |
| `GET /api/combos/nearby` | `app/api/combos/nearby/route.ts` | `combo.repository.ts` → `listNearby()` + `store.repository.ts` → `getLocationsByIds()` |
| `GET /api/geocode` | `app/api/geocode/route.ts` | (không qua repository — gọi thẳng Nominatim, ngoại lệ có chủ đích vì đây không phải Supabase) |
| `GET /api/stores/[id]` | `app/api/stores/[id]/route.ts` | `store.repository.ts` → `getById()` |
| `GET /api/stores/[id]/combos` | `app/api/stores/[id]/combos/route.ts` | `combo.repository.ts` → `listActiveByStorePaginated()` |

---

## 4. Toàn bộ Repository (lớp Domain) — cho Component/Class Diagram

| Repository | File | Trách nhiệm chính |
|---|---|---|
| `combo.repository.ts` | `lib/repositories/` | CRUD combo, 2 hàm tìm kiếm (§2.1, §2.2), snapshot giá lúc checkout |
| `store.repository.ts` | `lib/repositories/` | Đăng ký/sửa cửa hàng, tra cứu vị trí, danh sách cửa hàng đã verify |
| `order.repository.ts` | `lib/repositories/` | Tạo đơn, đổi trạng thái + lịch sử trạng thái, thống kê cửa hàng, gợi ý theo lịch sử mua |
| `category.repository.ts` | `lib/repositories/` | Danh mục combo (whitelist: đồ uống / ăn vặt-tráng miệng / đồ ăn chín) |
| `net-zero.repository.ts` | `lib/repositories/` | Điểm Net Zero: cộng/trừ, hết hạn, tổng kg CO2, tra điểm theo từng đơn |
| `notification.repository.ts` | `lib/repositories/` | Đọc/tạo thông báo (luôn tạo qua admin client — cross-actor) |
| `review.repository.ts` | `lib/repositories/` | Đánh giá + báo cáo combo sau khi đơn hoàn tất |
| `bulk-discount.repository.ts` | `lib/repositories/` | Bậc giảm giá theo số lượng (mua chung) |
| `group-buy.repository.ts` | `lib/repositories/` | Tạo/tham gia lời mời mua chung, tính giảm giá lúc checkout |
| `friend.repository.ts` | `lib/repositories/` | Kết bạn, tìm người dùng (§2.5), danh sách bạn bè |
| `message.repository.ts` | `lib/repositories/` | Gửi/đọc tin nhắn 1:1, đánh dấu đã đọc, đếm chưa đọc (§3 dòng 8) |
| `search-history.repository.ts` | `lib/repositories/` | Ghi lịch sử tìm kiếm (§2.8) |
| `profile.repository.ts` | `lib/repositories/` | Hồ sơ người dùng (tên, SĐT, avatar) |

**Quy ước dùng chung mọi repository:**
- Không có repository nào gọi `supabase.from()`/`supabase.rpc()` ngoài chính file `*.repository.ts` của nó.
- Trả về **domain object** (camelCase, kiểu định nghĩa trong `lib/domain/*.ts`), không trả raw row từ DB.
- Tham số đầu tiên luôn là `SupabaseClient<Database>` — **client thường hoặc admin client tuỳ nơi gọi quyết định**, bản thân hàm repository không tự chọn.

---

## 5. Domain models chính (cho Class Diagram)

```
lib/domain/combo.ts       → Combo, ComboSnapshot, NearbyCombo, StoreComboSummary, ComboStatus
lib/domain/store.ts       → Store, StoreLocation
lib/domain/order.ts       → Order, OrderItem, OrderStatus, OrderStatusEvent, PaymentStatus, StoreMonthlyStats
lib/domain/category.ts    → Category
lib/domain/net-zero.ts    → NetZeroSummary, NetZeroExpiry
lib/domain/notification.ts→ Notification
lib/domain/review.ts      → ComboReview
lib/domain/social.ts      → FriendSummary, PublicProfile, Message, GroupOrderInvite, GroupOrderParticipant
lib/domain/profile.ts     → Profile
```

`NearbyCombo` là kiểu trả về chung cho **cả `search()` lẫn `listNearby()`** (§2.1 và §2.2 trả cùng shape) — đáng chú ý khi vẽ class diagram vì 2 luồng khác nhau hội tụ về 1 kiểu dữ liệu.

---

## 6. Bảng DB liên quan trực tiếp tới tìm kiếm (cho ER Diagram)

| Bảng | Cột liên quan tìm kiếm | Index |
|---|---|---|
| `combos` | `name`, `category_id`, `status`, `best_before`, `store_id` | `idx_combos_name_trgm` (GIN, trigram), `idx_combos_active_best_before` (partial, `where status='active'`), btree trên `store_id`/`category_id` |
| `stores` | `name`, `geog` (point), `verification_status`, `is_active` | `idx_stores_name_trgm` (GIN, trigram), `idx_stores_geog` (GiST, PostGIS) |
| `combo_images` | `combo_id`, `sort_order` | dùng trong `LEFT JOIN LATERAL` để lấy 1 ảnh đại diện |
| `profiles` | `full_name` | `idx_profiles_full_name_trgm` (GIN, trigram) |
| `search_history` | `user_id`, `query_text`, `searched_at` | — (ghi log, chưa được đọc lại) |
| `messages` / `friendships` / `friendship_reads` | dùng cho `unread_message_counts()` | `idx_messages_friendship`, PK ghép `(friendship_id, user_id)` |

**Hàm dùng chung (helper), không phải bảng:**
```sql
f_unaccent(text) returns text   -- wrapper IMMUTABLE quanh unaccent() (vốn chỉ STABLE, không index được trực tiếp)
                                 -- mọi so khớp tên trong toàn hệ thống đều đi qua hàm này để index hoạt động
                                 -- (0001_init_schema.sql)
```

---

## 7. Gợi ý cụ thể để vẽ PlantUML

1. **Component Diagram (tổng thể hệ thống)** — dùng khung §1: 3 package lớn (`app/` presentation, `lib/` domain, Supabase), mũi tên 1 chiều xuống dưới. Vẽ riêng 1 note "RLS bật trên mọi bảng" cạnh khối Supabase.

2. **Sequence Diagram — luồng "tìm combo theo tên"** (ca cụ thể nhất, đề xuất vẽ đầu tiên vì rõ nhất luồng end-to-end):
   ```
   User -> SiteSearch (site-search.tsx)
   SiteSearch -> geolocation.ts : getCurrentPosition()
   SiteSearch -> "/api/combos/search" : GET (debounce 300ms)
   route.ts -> combo.repository.ts : search(client, lat, lng, options)
   combo.repository.ts -> Supabase : rpc("search_combos", {...})
   Supabase -> Postgres : search_combos() SQL function
   Postgres -> Postgres : dynamic_combo_price() cho mỗi dòng
   Postgres --> combo.repository.ts : rows
   combo.repository.ts --> route.ts : NearbyCombo[]
   route.ts --> SiteSearch : JSON { combos }
   SiteSearch -> search-history.repository.ts : record() (fire-and-forget, chỉ khi đã đăng nhập)
   ```

3. **Sequence Diagram — luồng "tìm combo gần vị trí" (trang chủ mặc định):** tương tự nhưng qua `/api/combos/nearby` → `listNearby()` → `nearby_combos()`, kèm chú thích "dùng KNN index, không có tham số `query`".

4. **ER Diagram** — dùng bảng §6, chỉ vẽ các bảng liên quan tìm kiếm + 1-2 bảng đơn hàng để cho thấy `getTopPurchasedCategoryIds()` nối `order_items → combos.category_id` thế nào.

5. **State/Activity Diagram — "Khi nào trang chủ chuyển từ ComboSections sang SearchResultsSection"** (logic ở `app/(customer)/page.tsx`, biến `isFiltered`): hữu ích để giải thích tại sao có 2 UI khác nhau cho cùng 1 khối dữ liệu.

---

## 8. Cơ chế hoạt động chi tiết (để trình bày/bảo vệ đồ án)

Phần này giải thích **bản chất thuật toán**, không chỉ vị trí file — dùng khi cần trình bày miệng "nó hoạt động như thế nào" thay vì chỉ "nó nằm ở đâu".

### 8.1. Cơ chế giảm giá động (Dynamic Pricing) — nằm ở đâu, giảm theo cơ chế gì

**Vị trí 2 bản song song (bắt buộc giống hệt nhau về công thức):**
| Bản | File | Dùng khi nào |
|---|---|---|
| SQL (Postgres function) | `supabase/migrations/0017_dynamic_pricing_multiplicative.sql` — hàm `dynamic_combo_price()` | Bên trong `nearby_combos()` và `search_combos()` — vì 2 RPC này chạy trong Postgres, không gọi được code TypeScript |
| TypeScript | `lib/pricing/strategies/stock-based-decay.strategy.ts` — class `StockBasedDecayStrategy` (dùng cho trang chi tiết combo, dashboard cửa hàng) + hàm `computeStockBasedDecayPrice()` (dùng cho lúc thanh toán và map panel) | Mọi nơi code JS/TS đọc giá combo trực tiếp, không qua 2 RPC trên |

**Cơ chế: giảm giá liên tục theo 2 yếu tố nhân với nhau (multiplicative decay), KHÔNG phải giảm theo mốc thời gian cố định.** Đây là yêu cầu bắt buộc của đồ án (`.claude/rules/business-rules.md`): khách hàng không được "canh giờ" để chắc chắn có giá giảm, vì công thức luôn được **tính lại tại đúng thời điểm truy vấn** (`now()`), không có bước nhảy giá cố định nào cả.

**Công thức:**
```
current_price = round( original_price × (1 − 0.5 × timeUrgency × stockPressure) / 500 ) × 500

trong đó:
  timeUrgency   = (thời điểm hiện tại − created_at) / (best_before − created_at)   , giới hạn [0, 1]
                  → "đã trôi qua bao nhiêu % thời gian được phép bán"

  stockPressure = remaining_stock / initial_stock                                  , giới hạn [0, 1]
                  → "còn tồn lại bao nhiêu % số lượng ban đầu"
```

- **Mức giảm tối đa: 50% giá gốc** (hệ số `0.5` đứng trước) — chỉ đạt được khi `timeUrgency = 1` (sắp hết hạn) **VÀ** `stockPressure = 1` (chưa bán được món nào).
- **Nhân, không cộng** — đây là điểm quan trọng nhất, từng bị sửa 1 lần (bug thật, xem `0016` → `0017`):
  - Bản đầu (`0016`, cộng): `0.5×timeUrgency + 0.5×stockPressure` → 1 combo **vừa đăng** (timeUrgency=0) nhưng chưa bán được gì (stockPressure=1 luôn đúng, vì mới đăng thì chưa ai mua) vẫn bị trừ sẵn `0.5 × 0.5 = 25%` — vô lý, vì mới đăng thì chưa có gì để "giảm".
  - Bản sửa (`0017`, nhân): `timeUrgency × stockPressure` → nếu `timeUrgency = 0` thì tích số **luôn = 0**, bất kể `stockPressure` là bao nhiêu → combo mới đăng = **0% giảm**, đúng bản chất.
- **Làm tròn về bội số 500đ** (`round(... / 500) × 500`) — để giá hiển thị đẹp (vd 47.500đ, không phải 47.328đ).

**Ví dụ số cụ thể** (combo giá gốc 100.000đ, hạn bán 10 tiếng kể từ lúc đăng, ban đầu có 10 phần):

| Tình huống | timeUrgency | stockPressure | Tích | Giá hiện tại | % giảm |
|---|---|---|---|---|---|
| Vừa đăng, chưa bán được gì | 0/10 = 0 | 10/10 = 1.0 | 0 | 100.000đ | 0% |
| Qua 5 tiếng, còn 10/10 phần (ế) | 5/10 = 0.5 | 10/10 = 1.0 | 0.5 | 75.000đ | 25% |
| Qua 5 tiếng, đã bán 7 phần (còn 3) | 5/10 = 0.5 | 3/10 = 0.3 | 0.15 | 92.500đ | 7.5% |
| Sắp hết hạn (9.5/10 tiếng), còn nguyên 10 phần | 0.95 | 1.0 | 0.95 | ~52.500đ | ~47.5% |
| Sắp hết hạn, chỉ còn 1 phần | 0.95 | 0.1 | 0.095 | ~95.500đ | ~4.75% |

→ Ý nghĩa kinh doanh: **combo bán chạy (stockPressure thấp) gần như không bị giảm giá dù sắp hết hạn** — vì không có áp lực tồn kho; **combo ế (stockPressure cao) mới thực sự bị giảm sâu khi gần hết hạn** — đúng tinh thần "giảm để đẩy hàng tồn trước khi hết hạn", không phải giảm đại trà.

**Nơi công thức được áp dụng thực tế (3 điểm chạm, đều tính lại "tươi" mỗi lần, không đọc giá đã lưu sẵn):**
1. Danh sách/tìm kiếm trang chủ (`nearby_combos()`, `search_combos()`) — giá hiển thị lúc lướt.
2. Trang chi tiết combo + dashboard cửa hàng — qua `StockBasedDecayStrategy` (Strategy pattern, `lib/pricing/strategies/pricing-strategy.factory.ts` chọn class này vì `combos.pricing_strategy = 'stock_based_decay'`).
3. **Lúc thanh toán** (`order.builder.ts` gọi `getSnapshotsByIds()` → `computeStockBasedDecayPrice()`) — tính lại giá **tại đúng khoảnh khắc bấm mua**, không tin giá đã cache trên trình duyệt trước đó. Đây chính là cơ chế khiến khách "không thể canh giờ để chắc chắn mua được giá rẻ" — vì giá luôn được chốt lại ngay lúc submit đơn, không phải giá nhìn thấy lúc lướt web trước đó.

### 8.2. Cơ chế các hàm tìm kiếm hiện tại — giảm/lọc theo cơ chế gì

Có 2 cơ chế lọc/tìm khác hẳn nhau về bản chất thuật toán, dùng 2 loại index Postgres khác nhau:

**a) Tìm theo VỊ TRÍ (`nearby_combos()`) — cơ chế K-Nearest-Neighbor (KNN) trên dữ liệu địa lý:**
- Toạ độ cửa hàng lưu ở kiểu `geography(Point, 4326)` (chuẩn WGS84 — cùng hệ toạ độ GPS/Google Maps dùng).
- **Lọc bán kính:** `ST_DWithin(store.geog, điểm_người_dùng, radius_m)` — hàm PostGIS tính "cửa hàng có nằm trong bán kính X mét không", có index hỗ trợ (không phải tính khoảng cách từng dòng rồi lọc).
- **Sắp xếp gần → xa:** `ORDER BY store.geog <-> điểm_người_dùng` — toán tử `<->` là **KNN distance operator** của PostGIS, được tối ưu bởi **chỉ mục GiST** (`idx_stores_geog`). Nghĩa là Postgres **không quét hết bảng** rồi tính khoảng cách từng dòng — chỉ mục GiST tự "duyệt" theo thứ tự gần dần, dừng lại khi đủ `max_results` dòng. Đây là lý do tài liệu nhấn mạnh "không bao giờ tính `ST_Distance` cho mọi dòng rồi sort ở tầng ứng dụng" — làm vậy sẽ chậm dần khi số cửa hàng tăng lên (quét toàn bảng), còn cách hiện tại thì gần như không đổi tốc độ dù có bao nhiêu cửa hàng.
- Không có so khớp chữ/tên nào ở đây — thuần vị trí + loại combo (`category_id`, optional).

**b) Tìm theo TÊN (`search_combos()`, `search_profiles()`) — cơ chế Trigram (chuỗi con 3 ký tự):**
- Dùng extension `pg_trgm` của Postgres: mỗi chuỗi được băm thành các "trigram" — cụm 3 ký tự liên tiếp. Ví dụ `"Trà Sữa"` (sau khi bỏ dấu, viết thường → `"tra sua"`) được băm thành các trigram: `  t`, ` tr`, `tra`, `ra `, `a s`, ` su`, `sua`, `ua ` ...
- So khớp bằng `ILIKE '%từ_khoá%'` trên biểu thức `lower(f_unaccent(tên))` — nghĩa là **tìm không phân biệt hoa/thường, không phân biệt dấu tiếng Việt** (gõ "tra sua" vẫn ra "Trà Sữa"). `f_unaccent()` là hàm bọc riêng quanh `unaccent()` gốc của Postgres — lý do phải bọc là vì `unaccent()` gốc không thể đánh index trực tiếp (thuộc tính `STABLE`, không phải `IMMUTABLE`), nên phải có 1 wrapper `IMMUTABLE` mới cho phép tạo index trên biểu thức đó.
- **Chỉ mục GIN kiểu `gin_trgm_ops`** trên chính biểu thức `lower(f_unaccent(tên))` — đây là điều khiến `ILIKE '%...%'` (tìm chuỗi con ở **bất kỳ vị trí nào** trong tên, không chỉ đầu chuỗi) vẫn dùng được index, thay vì quét toàn bảng như `ILIKE` thông thường không có index trợ giúp.
- **Vì sao không dùng Full-Text Search (`tsvector`) như thường thấy:** Postgres không có bộ từ điển tiếng Việt cho FTS — trigram cho kết quả "gõ thiếu/gõ tắt vẫn ra" tốt hơn nhiều so với FTS trong trường hợp tiếng Việt, nên đây là lựa chọn kỹ thuật có chủ đích, không phải thiếu sót.
- `search_combos()` so khớp trên **cả 2 cột cùng lúc** (`combos.name` OR `stores.name`) — gõ tên món hoặc tên quán đều ra kết quả.

**Bảng so sánh nhanh:**
| | `nearby_combos()` | `search_combos()` |
|---|---|---|
| Lọc theo | Vị trí (bán kính) | Vị trí + **tên** + giá + loại |
| Cơ chế lõi | KNN + GiST index (`<->`, `ST_DWithin`) | Trigram + GIN index (`ILIKE` trên `f_unaccent`) |
| Sắp xếp mặc định | Gần → xa (tận dụng index) | Có thể đổi (giá/mới nhất/gần) — vì vậy phải tách hàm riêng, không gộp chung |
| Có tham số tên (`in_query`) | Không | Có |

### 8.3. Cơ chế "tìm kiếm" trên bản đồ (`/map`) — thực ra không phải 1 thuật toán riêng

Đây là điểm hay bị hiểu nhầm là "bản đồ có tìm kiếm riêng" — **thực tế `/map` không có hàm tìm kiếm nào của chính nó**. Cơ chế thật sự:

```
1. app/(customer)/map/page.tsx lấy vị trí GPS trình duyệt (navigator.geolocation)
2. Gọi ĐÚNG API /api/combos/nearby (giống hệt §8.2a — nearby_combos(), bán kính mặc định 10km,
   KHÔNG có ô nhập từ khoá trên bản đồ)
3. components/map/map-view.tsx nhận danh sách combo trả về, GOM NHÓM lại theo store_id ở
   phía client (useMemo) — vì 1 cửa hàng có thể có nhiều combo, nhưng bản đồ chỉ cần
   1 ghim (marker) cho mỗi cửa hàng, không phải 1 ghim cho mỗi combo
4. Bấm vào 1 ghim → mở components/map/store-detail-panel.tsx, GỌI TIẾP 2 API RIÊNG:
   - GET /api/stores/[id]          → thông tin cửa hàng (tên, ảnh bìa, địa chỉ, SĐT)
   - GET /api/stores/[id]/combos   → danh sách combo của RIÊNG cửa hàng đó, có PHÂN TRANG
     (listActiveByStorePaginated() trong combo.repository.ts — mỗi lần lấy 10 combo)
5. Cuộn tới cuối danh sách trong panel → IntersectionObserver phát hiện, tự gọi tiếp
   /api/stores/[id]/combos?offset=10, offset=20... ("kéo tới đâu tải tới đó", không tải hết
   1 lần để tránh giật/lag nếu cửa hàng có rất nhiều combo)
```

→ Tóm lại: **bản đồ dùng lại đúng cơ chế KNN + GiST ở §8.2a để tìm cửa hàng gần**, chỉ khác ở bước hiển thị (gom theo cửa hàng thành ghim) và có thêm 1 lớp phân trang riêng khi xem chi tiết 1 cửa hàng cụ thể. Nếu vẽ sequence diagram, đây nên là **1 nhánh dùng lại participant `nearby_combos()` đã vẽ ở luồng tìm theo vị trí**, không phải 1 hộp thoại "Map Search Engine" riêng biệt.

---

## 9. Ghi chú thiết kế quan trọng cần giữ khi vẽ sơ đồ (để không vẽ sai bản chất)

- **`nearby_combos()` và `search_combos()` là 2 hàm SQL tách biệt hoàn toàn**, không phải 1 hàm với tham số optional — lý do kỹ thuật là index-assisted ordering (đã giải thích ở §2.1). Đừng vẽ gộp thành 1 node.
- **Repository pattern là ranh giới bắt buộc**: không có mũi tên nào được vẽ thẳng từ `app/` xuống Supabase — luôn phải qua `lib/repositories/`.
- **3 client Supabase khác nhau** (client thường / server / admin) nên được vẽ là 3 actor/participant khác nhau trong sequence diagram, không gộp thành 1 "Supabase Client" — vì quyền truy cập (RLS áp dụng hay bỏ qua) là khác nhau, và đây là 1 nguyên tắc bảo mật cốt lõi của hệ thống.
- **Giá `current_price` không bao giờ là 1 cột tĩnh đọc thẳng** trong bất kỳ luồng tìm kiếm nào — luôn tính lại qua `dynamic_combo_price()`/`computeStockBasedDecayPrice()` tại đúng thời điểm truy vấn.
- **RLS là named actor ẩn**: mọi kết quả tìm kiếm (trừ `search_profiles()` vì gọi qua admin) đều tự động bị Postgres lọc theo `verification_status='verified'`/`status='active'`/`best_before>now()` ngay trong hàm SQL — không phải lọc thêm ở tầng ứng dụng.
