# ASSET_PIPELINE — Vạn Đạo Trường Sinh

## Sự thật cần đối mặt trước (không vòng vo)
Đội hiện tại = bạn + AI. Bạn **không có kỹ năng Blender/retopo/rigging** (đã xác nhận 2026-11-19). Vì vậy pipeline “AI concept → tự model trong Blender → rig → GLB” như GDD gốc là **không thực thi được** ở bước Blender. Pipeline dưới đây thay bước đó bằng các nguồn hợp lệ, theo thứ tự ưu tiên:

## Pipeline chốt cho MVP
1. **Prototype (GĐ0):** Nhân vật + quái rig sẵn, giấy phép rõ ràng:
   - Quaternius (CC0) — nhân vật/quái low-poly có rig + animation.
   - Kenney (CC0) — môi trường, props.
   - Mixamo (miễn phí với tài khoản Adobe; animation + auto-rig cho nhân vật dạng người — điều khoản: dùng cho dự án, không phân phối lại file gốc).
   → Mục tiêu: chứng minh gameplay + hiệu năng, **không** chứng minh nhan sắc cuối cùng.
2. **Nhân vật chính (sau prototype):** Character sheet bạn đã có (cô bé — sẵn sàng upload; reaper — **phải sửa tóc trước**) → Meshy/Tripo image-to-3D → GLB tĩnh → **Mixamo auto-rig** → kiểm tra cực đoan (ngồi thiền, rút kiếm, né) → nếu topology hỏng ở khớp, chấp nhận dùng model đó làm “hình đại diện động phủ/tu luyện” và giữ nhân vật chiến đấu bằng model rig sẵn mặc trang phục gần giống. Không đốt credits Meshy trước khi chốt tóc reaper + váy/quần cô bé.
3. **Môi trường:** Ghép từ kit CC0/CC-BY có ghi nguồn trong `assets/CREDITS.md` + terrain tự sinh bằng heightmap trong Babylon + cây/đá low-poly. Sương mù, thác (particle), mây trôi, ánh sáng — làm bằng hiệu ứng engine, rẻ hơn model chi tiết rất nhiều và đúng chất tiên hiệp.
4. **Tối ưu bắt buộc trước khi vào game:** glTF Transform / Blender (nếu có người hỗ trợ) — nén Draco/meshopt, texture KTX2, gộp material, LOD đơn giản (2 mức), xóa animation thừa. Ngân sách: xem TECHNICAL_DESIGN.
5. **Giấy phép:** Mọi asset có 1 dòng trong `CREDITS.md` (tên, tác giả, license, link gốc, ngày lấy). Asset không rõ giấy phép = không vào repo. Không dùng nhân vật/thương hiệu game khác.

## Animation tối thiểu MVP
Nhân vật: idle, đi, chạy, ngồi thiền (loop), đứng dậy, rút kiếm, đánh thường (combo 2 đòn), 4 kỹ năng dùng chung hiệu ứng, né, trúng đòn, chết. Quái: idle, đi, đuổi, cắn/đánh, chết. Lấy từ Mixamo/Quaternius trước, tự làm sau nếu có người.

## Lưu trữ
File nguồn nặng để ngoài Git thường (Git LFS hoặc thư mục asset riêng có link trong repo). Repo chỉ chứa GLB đã tối ưu cho MVP.
