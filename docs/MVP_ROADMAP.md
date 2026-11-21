# MVP_ROADMAP — Vạn Đạo Trường Sinh

Mỗi giai đoạn có **cổng nghiệm thu** — không qua cổng thì không sang giai đoạn sau. Không code giai đoạn nào trước khi bạn duyệt báo cáo Giai đoạn A+B này.

## Giai đoạn 0 — Technical Prototype *(chỉ bắt đầu khi bạn duyệt D1–D7)*
Phạm vi đúng như Phần 16C của bạn: 1 map Thanh Vân Sơn nhỏ, 1 nhân vật (đi / ngồi thiền / đứng dậy / rút kiếm), camera thứ ba, 1 yêu thú, 1 trận đánh đơn giản, tu vi tăng theo thời gian khi thiền. Lưu local, **không DB, không login**.
**Cổng:** build sạch, không lỗi console quan trọng, ≥30 FPS trên máy test (D6), đổi scene không rò bộ nhớ, bạn tự chạy và xác nhận “đúng cảm giác”.

## Giai đoạn 1 — Core Gameplay
Character + Cultivation (Tu Vi/Căn Cơ/Ngộ Tính) + Combat (Auto/Manual) + Đột phá Luyện Thể→Kim Đan (cục bộ, chưa server).
**Cổng:** chơi được trọn vòng lặp 30 phút, đột phá thành công/thất bại đúng công thức GDD.

## Giai đoạn 2 — World
3 map, 2 bí cảnh, nhiệm vụ 4 nhóm (khung + nội dung đầu), 10 công pháp, ~12–15 pháp bảo, túi đồ + trang bị.
**Cổng:** mở khóa map theo cảnh giới hoạt động; không có vật phẩm “rác vô nghĩa” — mỗi item có đích dùng trong dữ liệu.

## Giai đoạn 3 — Idle
Offline progress (công thức server-ready, chạy local mô phỏng trước), bế quan, động phủ (Tụ Linh Trận + Linh Điền), luyện đan/luyện khí cơ bản.
**Cổng:** test offline 8h cho kết quả khớp công thức ±1%, claim lại không trùng.

## Giai đoạn 4 — Persistence
Supabase Auth + DB theo DATABASE_SCHEMA, API service (claim/đột phá/loot), cloud save, ledger, RLS.
**Cổng:** test chống gian lận cơ bản (sửa giờ client, claim 2 lần, gửi request lặp) đều bị chặn; khôi phục tiến trình trên máy/trình duyệt khác thành công.

## Giai đoạn 5 — Public Beta
Tối ưu hiệu năng + bundle, hướng dẫn người mới, thành tựu + Thiên Đạo Ký Lục đầy đủ, Supabase Pro, deploy CDN, trang giới thiệu.
**Cổng:** TEST_STRATEGY đạt ở mức release; chi phí vận hành đo được < $30/tháng ở quy mô beta nhỏ.

## Ngoài roadmap này
Multiplayer/PvP/giao dịch/bang hội/thanh toán/linh thú đầy đủ/11 cảnh giới còn lại — chỉ thiết kế lại khi MVP có người chơi thật và số liệu giữ chân.
