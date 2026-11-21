# TEST_STRATEGY — Vạn Đạo Trường Sinh

## Tầng kiểm thử
1. **Unit (Vitest):** mọi công thức thuần trong `packages/shared` — ngưỡng cảnh giới, tỉ lệ đột phá, offline gain, loot theo seed. Công thức đổi = test đổi cùng commit.
2. **Integration (API):** claim offline idempotent (gọi 2 lần, song song), đột phá trừ đúng tài nguyên, transaction rollback khi thiếu điều kiện, RLS chặn đọc nhân vật người khác.
3. **E2E (Playwright):** tạo nhân vật → thiền tăng tu vi → đánh quái auto → đột phá → đăng xuất → “offline” (giả lập đồng hồ server) → đăng nhập → nhận báo cáo đúng số.
4. **3D/Performance (thủ công có checklist + Babylon Inspector):** FPS ở 3 map, draw calls, bộ nhớ trước/sau 10 lần đổi scene (rò rỉ = lỗi chặn), animation checklist (đi/thiền/rút kiếm/né không vỡ khớp), WebGL2 trên Chrome/Edge/Firefox.
5. **Chống gian lận:** sửa giờ hệ thống client, sửa localStorage, replay request claim, gửi qty âm — tất cả phải bị server từ chối/bỏ qua.

## Tiêu chí nghiệm thu theo module (Giai đoạn E)
Mỗi module khi triển khai phải kèm: mục tiêu, phạm vi, file thay đổi dự kiến, test cases, tiêu chí nghiệm thu — đúng mẫu bạn yêu cầu ở Phần 16E — và chỉ được tính là xong khi test cases đó chạy đạt, không tính “code xong”.

## Báo cáo
Mỗi đợt bàn giao báo: build (đạt/lỗi gì), test (số đạt/tổng), FPS đo trên máy nào, lỗi console còn lại, việc chưa làm. Không báo “xong” khi chưa có số đo.
