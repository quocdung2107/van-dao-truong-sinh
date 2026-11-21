# SYSTEM_ARCHITECTURE — Vạn Đạo Trường Sinh

## Sơ đồ (văn bản)
```
[Trình duyệt]
  React UI (Management Mode: panel, túi đồ, công pháp...)
        │  ▲  (state qua store mỏng — Zustand hoặc React context; KHÔNG để React re-render theo frame)
  Babylon Canvas (Combat/World: scene, nhân vật, quái, VFX)
        │  HTTPS (Supabase JS: Auth, đọc dữ liệu công khai/nhân vật của mình qua RLS)
        ├──────────────► [Supabase: Auth + PostgreSQL + Storage(avatar/log)]
        │  HTTPS (chỉ các hành động quan trọng)
        └──────────────► [API service (Node/TS): OfflineClaim, Breakthrough, BossLoot, Trade-like exchanges]
                                  └─► PostgreSQL (cùng DB Supabase, qua service role, transaction)
[CDN / Static hosting] ── phục vụ HTML/JS/GLB đã nén, cache dài hạn theo hash
```

## Ranh giới trách nhiệm
| Tầng | Được làm | Không được làm |
|---|---|---|
| React UI | Hiển thị, form, cấu hình auto-battle, mở panel | Tính phần thưởng, tự cộng tài nguyên |
| Babylon scene | Render, input, animation, VFX, dự đoán di chuyển | Quyết định rơi đồ/đột phá |
| API service | Mọi phép tính có giá trị kinh tế, idempotent, có ledger | Render, giữ session game real-time (MVP không cần) |
| Postgres | Nguồn sự thật duy nhất cho tiến trình | — |

## Luồng chính
1. **Đăng nhập:** Supabase Auth → JWT → RLS theo `auth.uid()`.
2. **Vào game:** client tải character + state; API kiểm tra `activity_sessions` đang mở → nếu có thời gian offline hợp lệ, trả `OfflineReport` chờ người chơi bấm Nhận (claim tách khỏi login để tránh cộng trùng khi tải lại trang).
3. **Chơi:** client tự chạy tu luyện/chiến đấu thường; định kỳ (60s) + khi thoát, client gửi heartbeat “vẫn đang hoạt động X” — server chỉ ghi nhận, chưa cộng thưởng.
4. **Hành động quan trọng:** đột phá / mở rương boss / claim offline → gọi API → transaction → trả kết quả + state mới.
5. **Đổi scene:** dispose scene Babylon cũ (texture, mesh, particle) theo checklist ở TEST_STRATEGY — rò rỉ bộ nhớ là lỗi chặn release.

## Vì sao không dồn hết vào Edge Functions (điểm bạn yêu cầu đánh giá)
Edge Functions hợp cho tác vụ ngắn, stateless. Logic offline/đột phá cần transaction nhiều bảng + khóa hàng + tính toán có seed — làm được trong Edge Function nhưng khó test local, khó debug, dễ timeout khi claim phức tạp. Một service Node/TS nhỏ dùng chung `packages/shared` với client (cùng công thức, cùng types) dễ kiểm thử hơn nhiều, chi phí thêm ở MVP = $0 (deploy free tier / cùng nơi host API khác của bạn), và dọn đường cho server real-time sau này nếu làm multiplayer. Supabase vẫn giữ Auth + DB + Storage.
