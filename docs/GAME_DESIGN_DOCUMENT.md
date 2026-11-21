# GAME_DESIGN_DOCUMENT — Vạn Đạo Trường Sinh (MVP)

Tài liệu này cụ thể hóa GDD gốc của bạn thành con số/cơ chế có thể cân bằng và kiểm thử được. Mọi con số là **điểm khởi đầu để playtest**, nằm trong file dữ liệu, không hard-code.

## 1. Ba lớp tiến trình (chốt cơ chế khác nhau)
| Chỉ số | Bản chất | Tăng bằng | Giảm/Tiêu bằng | Tác dụng |
|---|---|---|---|---|
| **Tu Vi** | Tích lũy tuyến tính, ngưỡng theo cảnh giới × tiểu cảnh | Tu luyện, quái, nhiệm vụ, bí cảnh | Không giảm (trừ sự kiện đặc biệt) | Điều kiện “đủ lượng” để đột phá |
| **Căn Cơ** | Chất lượng 0–100 (% trần cảnh giới) | Luyện thể, đan tốt, bí cảnh tu luyện, đột phá thành công | −10~20 tạm thời khi đột phá thất bại; −5 khi dùng đan cưỡng ép | Hệ số sức mạnh thực = 0.7 + 0.3×(CănCơ/100); tỉ lệ đột phá (xem §3) |
| **Ngộ Tính (Insight)** | Điểm **tiêu được** vào cây lĩnh ngộ | Ngộ đạo, đốn ngộ, bí cảnh, nhiệm vụ kỳ ngộ | Tiêu vĩnh viễn khi mở nút cây | Mở nhánh kỹ năng/bị động; mỗi nút là 1 lựa chọn loại trừ lẫn nhau ở tầng cao |

## 2. Cảnh giới MVP
Luyện Thể → Luyện Khí → Trúc Cơ → Kim Đan, mỗi cảnh giới 4 tiểu cảnh (Sơ/Trung/Hậu/Đại viên mãn).
Ngưỡng Tu Vi gợi ý (hệ số ×2.2 mỗi tiểu cảnh, ×6 mỗi đại cảnh giới) — tinh chỉnh sau playtest. Mở khóa: Luyện Khí → Linh Khê Cốc + công pháp bậc 2; Trúc Cơ → Hắc Phong Lâm + bí cảnh thám hiểm; Kim Đan → pháp bảo Thiên phẩm đầu tiên + động phủ mở rộng.

## 3. Đột phá
Điều kiện: Tu Vi đủ + Căn Cơ ≥ 50 (tiểu cảnh) / ≥ 65 (đại cảnh giới) + vật phẩm (chỉ đại cảnh giới).
Tỉ lệ thành công = 60% + 0.4×Căn Cơ − độ khó cảnh giới (0/10/20/30) + bonus đan dược (0–15%), kẹp [5%, 95%].
Thất bại: mất 15% Tu Vi của tiểu cảnh hiện tại, Căn Cơ −15 (hồi phục bằng tu luyện/linh tuyền), “tâm ma” debuff 30 phút (giảm 20% tốc độ tu luyện). **Không bao giờ** tụt cảnh giới hay mất nhân vật. Đại cảnh giới có thiên kiếp: mini-encounter 3 đợt sét, né vùng + phá khiên — thắng = cộng thêm vào tỉ lệ trên, thua = tính như đột phá thất bại (không chết).

## 4. Chiến đấu
Chỉ số suy ra: HP, Linh Lực (MP), Công, Thủ, Tốc, Bạo kích — từ cảnh giới × Căn Cơ × công pháp × trang bị.
**Auto:** tìm quái trong bán kính khu vực đã chọn → dùng kỹ năng theo thứ tự ưu tiên + điều kiện MP/HP người chơi đặt → nhặt đồ → HP < ngưỡng rút lui (mặc định 20%) thì về điểm hồi phục. Chiến thuật 5 preset như GDD gốc (Công kích / Phòng thủ / Tiết kiệm / Săn tinh anh / Săn tài nguyên) = bộ trọng số có sẵn, người chơi chỉnh được từng mục.
**Manual:** WASD + chuột, LMB đánh thường, Q/E/R/F kỹ năng, Space né (i-frame 0.3s, tốn thể lực). Boss có telegraph vùng đỏ, khiên cần phá bằng đúng hệ, điểm yếu theo linh căn khắc hệ (ngũ hành tương khắc ±20%).
Chuyển Auto↔Manual: tự do ngoài boss; trong boss, chuyển sang Auto = độ khó “hỗ trợ” (AI né kém hơn người, sát thương ×0.8).

## 5. Tu luyện & sự kiện
Phương pháp = bộ hệ số (tốc độ Tu Vi / Căn Cơ / tỉ lệ sự kiện): Tĩnh tọa (cân bằng), Vận chu thiên (+Tu Vi, −Căn Cơ nhẹ nếu quá lâu), Luyện thể (+Căn Cơ), Bế quan (×2.5 Tu Vi, khóa nhân vật, chỉ offline), Ngộ đạo (+Insight), Luyện hóa linh vật (đốt vật phẩm → Tu Vi).
Sự kiện ngẫu nhiên khi tu luyện (bảng trọng số, có seed theo phiên): Đốn ngộ, Linh khí dị biến, Tâm ma, Truyền pháp, Dị tượng, Thức tỉnh huyết mạch — mỗi sự kiện là lựa chọn 2–3 phương án có hậu quả, lưu vào Thiên Đạo Ký Lục.

## 6. Linh căn & trường phái
Ngũ hành cơ bản ở MVP; mỗi linh căn: +15% sát thương hệ mình, −10% hệ khắc, tốc độ tu luyện công pháp cùng hệ ×1.3. Đơn linh căn: tu luyện nhanh nhất, ít lựa chọn. Ngũ hành linh căn: chậm 30% nhưng học được mọi hệ + bonus đột phá +5% (cân bằng “chậm mà chắc”). Biến dị linh căn: để sau MVP.
Trường phái chính (chọn lúc tạo nhân vật): Kiếm (bạo kích, đơn thể), Pháp (AoE, tốn MP), Thể (HP/thủ, cận chiến), Đan (buff/đan hiệu quả +50%, chiến đấu yếu hơn — bù bằng đan chiến đấu), Phù Trận (kiểm soát, đặt trận trước trận đánh). Hướng phụ mở ở Kim Đan.

## 7. Kinh tế (chống lạm phát)
5 tài nguyên như GDD gốc. Nguyên tắc: mọi nguồn (sink) phải có đích tiêu cùng tốc độ tăng trưởng — đan/luyện khí/nâng công trình/đột phá đều tăng giá theo cảnh giới theo cùng hệ số ×6 như ngưỡng Tu Vi. Linh Thạch không mua được Tu Vi trực tiếp. Đạo Nguyên chỉ từ thành tựu/bí cảnh khó, không farm vô hạn. Log mọi giao dịch ≥ ngưỡng vào `resource_ledger` (xem DATABASE_SCHEMA).

## 8. Bí cảnh, nhiệm vụ, động phủ, Thiên Đạo Ký Lục
Theo đúng GDD gốc Phần 3.5–3.7 và Phần 13, với phạm vi MVP đã siết ở báo cáo chính (động phủ 2 công trình; nhiệm vụ đủ 4 nhóm nhưng mỗi nhóm 3–5 nhiệm vụ viết tay + mẫu nhiệm vụ lặp cho Thiên Đạo). Thiên Đạo Ký Lục = bảng `chronicle_events` ghi mốc + danh hiệu có điều kiện kiểm tra được bằng dữ liệu (vd “đột phá không dùng đan” = cờ trong lần đột phá đó).
