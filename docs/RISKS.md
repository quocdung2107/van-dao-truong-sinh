# RISKS — Vạn Đạo Trường Sinh

| # | Rủi ro | Mức | Giảm thiểu (đã đưa vào thiết kế) |
|---|---|---|---|
| R1 | **Asset 3D là nút thắt**: không có kỹ năng Blender/rigging; Meshy cho mesh tĩnh, topology thường hỏng ở khớp; credits free có hạn | 🔴 Cao nhất | Prototype bằng asset rig sẵn CC0/Mixamo; nhân vật chính vào sau với đường lui rõ ràng (ASSET_PIPELINE §2); không đốt credits khi sheet còn lỗi (reaper: tóc) |
| R2 | Phạm vi GDD phình to (15 cảnh giới, linh thú, 7 công trình...) làm MVP không bao giờ xong | 🔴 Cao | Siết MVP ở báo cáo chính §5; linh thú + 5 công trình rời MVP; roadmap có cổng nghiệm thu từng giai đoạn |
| R3 | Hiệu năng trình duyệt: bundle Babylon nặng, máy yếu tụt FPS, nóng máy | 🟠 Cao | Ngân sách hiệu năng cứng (TECHNICAL_DESIGN); stylized thay vì bán chân thực (D2); lazy-load scene; đo FPS ngay ở GĐ0 |
| R4 | Phong cách “bán chân thực” không đạt được với asset miễn phí → game trông rẻ, mất chất tiên hiệp | 🟠 Cao | D2: stylized + sương/ánh sáng/VFX làm chủ lực; concept art khóa phong cách trước khi làm asset hàng loạt |
| R5 | Gian lận offline / nhân bản vật phẩm khi lên cloud | 🟠 Trung-Cao | Server-authoritative, idempotency key, ledger, CHECK constraints (DATABASE_SCHEMA) — nhưng chỉ thật sự kiểm chứng ở GĐ4, đừng hứa “chống hack tuyệt đối” |
| R6 | Supabase Free tự pause sau 1 tuần + không backup | 🟡 Trung | Chấp nhận ở dev/MVP; lên Pro $25/tháng ở GĐ5; migration + export DB định kỳ từ GĐ4 |
| R7 | Một mình + AI: tiến độ phụ thuộc thời gian của bạn để test trên Windows | 🟡 Trung | Mỗi đợt giao nhỏ, có cổng nghiệm thu bạn tự chạy được; ưu tiên GitHub để bạn lấy code dễ (D7) |
| R8 | Giấy phép asset/AI: dùng nhầm asset không được thương mại hóa | 🟡 Trung | `CREDITS.md` bắt buộc; CC0 ưu tiên; kiểm tra điều khoản Meshy/Tripo free (bản free thường giới hạn thương mại) **trước** khi dùng model cho bản public |
| R9 | Cân bằng kinh tế/idle: cho quá tay → đột phá quá nhanh, hết nội dung; quá keo → chán | 🟡 Trung | Mọi con số nằm trong game-data, chỉnh không cần deploy code; playtest 30 phút + 8h offline là cổng ở GĐ1/GĐ3 |
| R10 | WebGPU chưa đồng đều giữa trình duyệt | 🟢 Thấp | WebGL2 là đường chính, WebGPU chỉ là nâng cấp tự động |

## Rủi ro bị loại bỏ có chủ đích
Không làm open-world, không multiplayer ở MVP, không thanh toán — ba nguồn rủi ro lớn nhất của game indie đã được GDD gốc loại đúng; giữ nguyên quyết định đó.
