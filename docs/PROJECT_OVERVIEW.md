# PROJECT_OVERVIEW — Vạn Đạo Trường Sinh

**Thể loại:** 3D Web Hybrid Idle Cultivation RPG (PvE) · **Nền tảng:** Web (ưu tiên PC) · **Mô hình:** Instance, không open-world
**Người chơi mục tiêu:** Người thích tiên hiệp, chơi ngắn 5 phút/lần nhận thành quả + phiên 15–30 phút khám phá, không muốn cày click.

## Tầm nhìn 1 câu
Phàm nhân → Tiên Đế qua vòng lặp: Tu luyện → Chiến đấu/Khám phá → Thu thập → Phát triển → Đột phá → Mở thế giới mới, trong đó nhân vật vẫn tiến triển khi bạn offline.

## Trụ cột thiết kế
1. Mở game là thấy nhân vật sống trong cảnh 3D, không phải bảng số.
2. Ít thao tác lặp — auto là mặc định tử tế, manual là lựa chọn có chiều sâu (boss).
3. Mỗi người chơi một con đường: linh căn + trường phái + cách tiêu Ngộ Tính + chọn Căn Cơ vững hay đột phá nhanh.
4. Mỗi cảnh giới mở khả năng/map mới thật sự, không chỉ tăng số.

## MVP (tóm tắt — chi tiết ở MVP_ROADMAP.md)
1 nhân vật · Luyện Thể → Kim Đan (4 cảnh giới × 4 tiểu cảnh) · 5 linh căn cơ bản · 3 map Phàm Nhân Giới · 5 quái + 2 boss · Auto + Manual · Tu luyện + Offline (cap 8h) · Đột phá có thiên kiếp đơn giản · 2 bí cảnh · 10 công pháp · ~12–15 pháp bảo · Động phủ cơ bản (2 công trình) · Đăng nhập + Cloud Save.

**Ngoài MVP:** multiplayer, PvP, giao dịch, bang hội, thanh toán, linh thú đầy đủ, 11 cảnh giới còn lại, biến dị linh căn.

## Công nghệ (đề xuất chốt, chờ duyệt D1–D5)
Babylon.js 9.x · React 19 + TypeScript + Vite 8 · Supabase (Auth + PostgreSQL) + backend service mỏng cho logic server-authoritative · Blender/GLB cho asset (pipeline xem ASSET_PIPELINE) · Static hosting + CDN.

## Chi phí
MVP: **$0** (Supabase Free + hosting tĩnh free). Public beta: ~$25/tháng Supabase Pro. Không phụ thuộc API AI trả phí nào để game vận hành.

## Tiêu chí thành công của MVP
- Người chơi mới tạo nhân vật, tu luyện, đánh quái auto/manual, đi 1 bí cảnh, đột phá lên Luyện Khí trong phiên đầu < 30 phút.
- Offline 8h quay lại nhận báo cáo đúng, không trùng, không mất.
- Chạy 30 FPS+ ở 1080p trên máy yếu mục tiêu (xem TECHNICAL_DESIGN §ngân sách hiệu năng).
