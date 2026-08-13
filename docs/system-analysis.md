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

## 8. Ghi chú thiết kế quan trọng cần giữ khi vẽ sơ đồ (để không vẽ sai bản chất)

- **`nearby_combos()` và `search_combos()` là 2 hàm SQL tách biệt hoàn toàn**, không phải 1 hàm với tham số optional — lý do kỹ thuật là index-assisted ordering (đã giải thích ở §2.1). Đừng vẽ gộp thành 1 node.
- **Repository pattern là ranh giới bắt buộc**: không có mũi tên nào được vẽ thẳng từ `app/` xuống Supabase — luôn phải qua `lib/repositories/`.
- **3 client Supabase khác nhau** (client thường / server / admin) nên được vẽ là 3 actor/participant khác nhau trong sequence diagram, không gộp thành 1 "Supabase Client" — vì quyền truy cập (RLS áp dụng hay bỏ qua) là khác nhau, và đây là 1 nguyên tắc bảo mật cốt lõi của hệ thống.
- **Giá `current_price` không bao giờ là 1 cột tĩnh đọc thẳng** trong bất kỳ luồng tìm kiếm nào — luôn tính lại qua `dynamic_combo_price()`/`computeStockBasedDecayPrice()` tại đúng thời điểm truy vấn.
- **RLS là named actor ẩn**: mọi kết quả tìm kiếm (trừ `search_profiles()` vì gọi qua admin) đều tự động bị Postgres lọc theo `verification_status='verified'`/`status='active'`/`best_before>now()` ngay trong hàm SQL — không phải lọc thêm ở tầng ứng dụng.
