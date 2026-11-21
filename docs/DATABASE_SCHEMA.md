# DATABASE_SCHEMA — Vạn Đạo Trường Sinh (PostgreSQL / Supabase)

Nguyên tắc: mọi bảng người chơi có `owner_id uuid references auth.users`, bật RLS (chỉ chủ sở hữu đọc/ghi qua client; ghi quan trọng chỉ qua API service role). Tiền/tài nguyên là số nguyên. Mọi phép cộng/trừ quan trọng ghi `resource_ledger`.

## Bảng cốt lõi
- **profiles**(`id` PK = auth uid, `display_name`, `created_at`)
- **characters**(`id`, `owner_id`, `name`, `school`, `created_at`, `deleted_at`) — MVP: 1 character active / account (unique partial index)
- **character_stats**(`character_id` PK, `realm`, `sub_realm`, `tu_vi bigint`, `can_co int 0..100`, `insight int`, `hp/mp` suy ra không lưu — chỉ lưu hệ số nền nếu cần)
- **cultivation_state**(`character_id` PK, `current_activity`, `activity_config jsonb`, `activity_started_at`, `last_active_at`, `offline_cap_seconds int default 28800`)
- **spirit_roots**(`character_id`, `root_type`, `elements text[]`) — 1..n hàng theo linh căn
- **techniques** (dữ liệu tĩnh — seed từ game-data, không phải dữ liệu người chơi: `id`, `name`, `element`, `school`, `tier`, `effects jsonb`)
- **learned_techniques**(`character_id`, `technique_id`, `level`, `insight_nodes jsonb`, PK kép)
- **inventory**(`id`, `character_id`, `item_id`, `qty`, `bound bool`) + **equipment**(`character_id`, `slot`, `item_id`, unique theo slot)
- **resources**(`character_id`, `resource_type`, `amount bigint`, PK kép) — linh_thach / linh_thao / tinh_hoa / dao_nguyen (Tu Vi nằm ở character_stats, không ở đây)
- **resource_ledger**(`id`, `character_id`, `resource_type`, `delta`, `reason`, `ref_id`, `created_at`) — chỉ append
- **activity_sessions**(`id`, `character_id`, `activity`, `config jsonb`, `started_at`, `ended_at`, `rng_seed`)
- **offline_claims**(`id`, `character_id`, `session_id`, `from_at`, `to_at`, `result jsonb`, `claimed_at`, **unique(session_id, from_at)** ← khóa chống claim trùng)
- **quests** (tĩnh) + **character_quests**(`character_id`, `quest_id`, `state`, `progress jsonb`)
- **achievements** (tĩnh) + **character_achievements**(`character_id`, `achievement_id`, `unlocked_at`)
- **buildings**(`character_id`, `building_type`, `level`, `last_collected_at`, PK kép)
- **chronicle_events**(`id`, `character_id`, `event_type`, `payload jsonb`, `created_at`) — Thiên Đạo Ký Lục
- **breakthrough_attempts**(`id`, `character_id`, `from_realm`, `success bool`, `used_items jsonb`, `can_co_before/after`, `created_at`) — phục vụ danh hiệu “không dùng đan” + cân bằng tỉ lệ

## Toàn vẹn
- Giao dịch nhiều bảng (claim, đột phá, luyện đan) = 1 DB transaction trong API.
- `qty/amount >= 0` bằng CHECK constraint; trừ tài nguyên dùng `UPDATE ... WHERE amount >= cost` và kiểm tra số hàng bị ảnh hưởng (không đọc-rồi-ghi rời rạc).
- Migration bằng file SQL có số thứ tự trong `supabase/migrations/`, không sửa trực tiếp trên dashboard khi đã lên production.
