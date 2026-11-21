# TECHNICAL_DESIGN — Vạn Đạo Trường Sinh

## Stack chốt (chờ duyệt D1)
- **Client:** Vite 8 + React 19 + TypeScript (strict). Babylon.js **9.37.1** (`@babylonjs/core` + `@babylonjs/loaders` theo module, tuyệt đối không import nguyên package vào bundle chính).
- **Render:** WebGL2 là đường chính; tự nâng WebGPU khi `navigator.gpu` khả dụng. Fallback thông báo rõ nếu không có WebGL2.
- **Vật lý/va chạm MVP:** Dùng collision có sẵn của Babylon + navmesh đơn giản cho auto-move; Havok chỉ bật khi boss cần ragdoll/physics thật (tránh nặng sớm).
- **Backend:** Supabase Postgres + Auth; **backend service mỏng Node/TS** (vd `apps/api`) là nơi duy nhất chạy: tính offline, đột phá, rơi đồ boss, giao dịch hiếm. Client không bao giờ tự quyết phần thưởng (RLS + RPC có kiểm tra).
- **Dữ liệu game:** `packages/game-data/*.json` có JSON Schema validate lúc build + lúc server khởi động.

## Ngân sách hiệu năng (máy yếu mục tiêu — chốt ở D6)
1080p, ≥30 FPS ổn định trong map Thanh Vân Sơn; draw calls < 150/scene; triangles hiển thị < 400k; texture atlas + KTX2; GLB nén Draco/meshopt, mỗi nhân vật < 30 MB (mục tiêu < 8 MB); bundle JS ban đầu < 1.2 MB gzip (Babylon lazy-load theo scene); không load map khác khi chưa mở khóa.

## Vòng lặp & mô phỏng
- Game loop phía client chỉ lo hiển thị + input + dự đoán di chuyển; kết quả chiến đấu quan trọng (boss, đột phá, rơi đồ hiếm) do server xác nhận.
- **Offline simulation:** không mô phỏng frame. Server tính theo công thức chu kỳ 1 phút: với mỗi phút offline hợp lệ: `gain = rate(activity, build, technique) × modifiers`, loot = quay bảng loot bằng RNG có seed lưu trong `activity_sessions`. Cap mặc định 8h (động phủ nâng 12/16h). Tính trong 1 transaction, ghi `offline_claims` với khóa idempotency = `session_id + last_claim_at` — gọi lại không cộng trùng.
- Đồng hồ: chỉ tin `now()` của server. Client gửi `last_active_at` để hiển thị, server tự kẹp thời gian offline vào [0, cap].

## Cấu trúc thư mục (đề xuất)
```
apps/web/        # React + Babylon client
apps/api/        # backend service mỏng (offline, breakthrough, loot)
packages/game-data/  # JSON dữ liệu game + schema
packages/shared/     # types + công thức thuần dùng chung client/server
supabase/migrations/ # SQL migrations
assets/          # nguồn asset (không commit file nặng > giới hạn Git LFS — xem ASSET_PIPELINE)
```

## Bảo mật & chống gian lận (MVP vừa đủ)
RLS bật trên mọi bảng người chơi; service role chỉ ở server; validate input bằng schema ở API; rate-limit claim offline (1 lần/phút/tài khoản); ledger cho tài nguyên hiếm; không có secret nào trong client ngoài Supabase anon key + URL công khai.
