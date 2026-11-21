# VẠN ĐẠO TRƯỜNG SINH — Giai đoạn 1: Core Gameplay

Game tu tiên 3D trên web: **Thanh Vân Sơn** với hệ thống nhân vật đầy đủ (linh căn + trường phái), 4 phương pháp tu luyện + sự kiện kỳ ngộ, chiến đấu có **4 kỹ năng Q/E/R/F**, **3 loại yêu thú + tinh anh**, và **đột phá cảnh giới lớn phải vượt Thiên Kiếp**. Chạy hoàn toàn trên máy của bạn (không server, không đăng nhập, không database). Tiến trình được lưu tự động trong trình duyệt (localStorage, save phiên bản v2 — save prototype cũ v1 được tự động chuyển đổi: giữ tiến trình, chỉ cần tạo nhân vật).

Công nghệ: **Vite + React + TypeScript + Babylon.js 9.37** — nhân vật, yêu thú và cảnh vật dựng bằng hình khối 3D trong code, animation do code điều khiển.

---

## Cách chạy trên Windows (từng bước)

### Bước 1 — Cài Node.js
1. Mở trang https://nodejs.org → tải bản **LTS** → cài như phần mềm bình thường.
2. Kiểm tra: mở **Command Prompt** và gõ `node -v` — thấy số phiên bản là được.

### Bước 2 — Lấy code về
- Trên GitHub: nút xanh **Code → Download ZIP**, giải nén vào một thư mục, ví dụ `D:\Game\van-dao-truong-sinh-game`.
- Mở Command Prompt tại đúng thư mục đó (trong Explorer, gõ `cmd` vào thanh địa chỉ rồi Enter).

### Bước 3 — Cài thư viện (chỉ làm 1 lần)
```
npm install
```

### Bước 4 — Chạy game
```
npm run dev
```
Mở trình duyệt vào **http://localhost:5173/** · Muốn dừng: `Ctrl + C` trong cửa sổ Command Prompt.

> Lần sau chơi tiếp chỉ cần Bước 4. Muốn chơi lại từ đầu (xóa cả nhân vật): nút **↺ Chơi lại** trong game.

---

## Tạo nhân vật (mới ở Giai đoạn 1)
Lần đầu vào game sẽ gặp màn hình tạo nhân vật:
- **Đạo hiệu:** tên nhân vật của bạn.
- **Linh căn (ngũ hành):** Kim / Mộc / Thủy / Hỏa / Thổ — kỹ năng cùng hệ với linh căn được **+15% sát thương**, và ngũ hành tương khắc cho ±20% (xem dưới).
- **Trường phái:** quyết định chỉ số nền và bộ 4 kỹ năng (bảng dưới).

Sau đó bấm **👤 Nhân vật (phím I)** trong game để xem chỉ số suy ra: Công, Thủ, Tốc độ, Bạo kích — tính từ cảnh giới × hệ số Căn Cơ (0.7 + 0.3×CănCơ/100) × hệ số trường phái.

## Điều khiển

| Phím / Thao tác | Hành động |
|---|---|
| **W A S D** | Di chuyển (theo hướng camera) |
| **Kéo chuột** | Xoay camera · **Lăn chuột**: zoom |
| **Space** | Né — lướt nhanh, bất tử 0.35 giây |
| **Click chuột trái** | Đánh thường bằng kiếm (tự rút kiếm) |
| **Q / E / R / F** | 4 kỹ năng của trường phái (xem bảng kỹ năng) |
| **C** | Thiền / đứng dậy — dùng phương pháp tu luyện đang chọn |
| **Tab** | Bật/tắt **Tự Động** săn quái (tự dùng kỹ năng Q khi hết hồi chiêu) |
| **I** | Mở/đóng bảng Nhân vật |

> Thay đổi so với prototype: phím **R** giờ là kỹ năng R (không còn là rút/cất kiếm — kiếm tự rút khi đánh hoặc dùng kỹ năng; vẫn có nút Rút Kiếm trên màn hình), phím **F** là kỹ năng kết liễu (đánh thường chuyển hẳn sang click chuột).

## 4 phương pháp tu luyện (chọn trong panel trái, áp dụng khi thiền)
| Phương pháp | Hiệu quả |
|---|---|
| 🧘 **Tĩnh Tọa** | Cân bằng: Tu Vi ×3, Căn Cơ +0.6/s, thỉnh thoảng đốn ngộ +1 Ngộ Tính |
| 🌀 **Vận Chu Thiên** | Tu Vi ×4.5, thêm ×1.3 nhờ linh căn tương hợp; Căn Cơ chỉ +0.1/s |
| 🪨 **Luyện Thể** | Tu Vi ×1.5, Căn Cơ +1.5/s — vững nền để đột phá |
| ✨ **Ngộ Đạo** | Tu Vi ×1, mỗi ~8 giây +1 Ngộ Tính |

**Sự kiện tu luyện:** khi đang thiền, mỗi ~45–90 giây có thể xuất hiện kỳ ngộ (thẻ vàng giữa màn hình, 20 giây để chọn): **Đốn Ngộ** (+3 Ngộ Tính hoặc +60 Tu Vi), **Linh Khí Dị Biến** (mạo hiểm +130 Tu Vi/−10 Căn Cơ hoặc an toàn +25), **Tâm Ma** (−30 Tu Vi hoặc dùng 2 Ngộ Tính trấn áp +8 Căn Cơ).

## Bảng kỹ năng theo trường phái (Q / E / R / F)
| Trường phái | Q — chủ lực | E — diện rộng/khống chế | R — hỗ trợ bản thân | F — kết liễu |
|---|---|---|---|---|
| 🗡️ **Kiếm Tu** (Kim, bạo 20%) | Kiếm Khí Trảm ×1.6 (10 MP, 3s) | Vạn Kiếm Quy Tông ×1.1 vùng (20 MP, 8s) | Kiếm Tâm Thông Minh: +35% tốc độ 6s (12 MP, 14s) | Thiên Ngoại Phi Tiên ×3.2 (35 MP, 15s) |
| 🔥 **Pháp Tu** (Hỏa, Linh Lực cao) | Hỏa Cầu Thuật ×1.7 tầm xa (12 MP, 2.5s) | Liệt Diễm Phần Thiên ×1.3 vùng lớn (25 MP, 9s) | Linh Khí Hộ Thể: khiên 45/8s (15 MP, 14s) | Cửu Thiên Huyền Hỏa ×3.0 vùng (40 MP, 16s) |
| 🪨 **Thể Tu** (Thổ, HP/Thủ cao) | Băng Sơn Quyền ×1.5 (8 MP, 2.5s) | Địa Liệt Ba ×1.0 quanh thân (18 MP, 8s) | Kim Cương Bất Hoại: khiên 65/8s (12 MP, 14s) | Phá Thiên Kích ×2.8 (30 MP, 14s) |
| ⚗️ **Đan Tu** (Mộc, tự hồi phục) | Đan Hỏa ×1.4 (10 MP, 3s) | Độc Vụ Mạn Thiên ×1.1 vùng (20 MP, 9s) | Hồi Xuân Đan: hồi 35% HP (18 MP, 16s) | Phần Thiên Đan Lô ×2.6 vùng (35 MP, 15s) |
| 🌀 **Phù Trận Tu** (Thủy, khống chế) | Băng Phù ×1.5 + chậm 2s (11 MP, 2.8s) | Khốn Tiên Trận ×0.8 vùng + chậm 3s (22 MP, 10s) | Tụ Linh Trận: khiên 35/8s (14 MP, 14s) | Ngũ Hành Phù Diệt ×2.9 vùng lớn (38 MP, 16s) |

Sát thương kỹ năng = Công × hệ số × tương khắc ngũ hành × (cùng hệ linh căn: ×1.15). Bạo kích ×1.5, hiện số vàng lớn. Số sát thương bay hiện trên đầu quái.

**Ngũ hành tương khắc:** Kim khắc Mộc · Mộc khắc Thổ · Thổ khắc Thủy · Thủy khắc Hỏa · Hỏa khắc Kim (khắc: +20%, bị khắc: −20%).

## Yêu thú (mới: 3 loại + tinh anh)
Tối đa **4 con** cùng lúc trên núi, hồi sinh sau 5 giây khi bị hạ:
| Quái | Hệ | Đặc điểm | Phần thưởng |
|---|---|---|---|
| Hắc Phong Lang | Hỏa | Cân bằng (HP 120) | +30 Tu Vi, 8–15 Linh Thạch |
| Mộc Tinh | Mộc | Khổng lồ, HP 230, chậm, đánh đau | +45 Tu Vi, 12–20 Linh Thạch |
| Thủy Xà | Thủy | HP 80 nhưng đuổi rất nhanh | +25 Tu Vi, 6–12 Linh Thạch |
| ⭐ **Tinh Anh** (20%) | ngẫu nhiên theo loại | To hơn, viền vàng, HP ×3, thưởng ×2, 50% rơi +1 Ngộ Tính | gấp đôi |

**Linh Thạch** là tiền tệ mới — hiện tích lũy và hiển thị trong panel (nơi tiêu sẽ có ở các giai đoạn sau: luyện đan, động phủ...).

## Đột phá & Thiên Kiếp
- Đột phá **tiểu cảnh** như cũ: cần Tu Vi đầy + Căn Cơ ≥ 50, tỉ lệ = 60 + 0.4×CănCơ − độ khó (kẹp 5–95%). Thất bại: −15% Tu Vi tiểu cảnh, −15 Căn Cơ, không tụt cảnh giới.
- Đột phá **lên cảnh giới mới** (Đại Viên Mãn → cảnh giới kế): phải vượt **🌩️ Thiên Kiếp** trước — **3 đợt sét**, mỗi đợt 3 tia nhắm quanh bạn: vòng đỏ hiện **1.2 giây** để né (chạy hoặc Space lướt), đứng trong vòng khi sét đánh sẽ mất HP. Vượt qua cả 3 đợt → tung tỉ lệ đột phá với **+10% bonus**. Gục ngã giữa kiếp (HP về 0) = đột phá thất bại với hình phạt như thường, HP hồi lại 30%.

Cảnh giới: **Luyện Thể → Luyện Khí → Trúc Cơ → Kim Đan**, mỗi cảnh giới 4 tiểu cảnh.

## Giai đoạn 1 CÓ gì / CHƯA có gì
**Có (mới):** tạo nhân vật (tên + 5 linh căn + 5 trường phái) · chỉ số suy ra + bảng nhân vật · tương khắc ngũ hành · 4 phương pháp tu luyện · 3 sự kiện tu luyện có lựa chọn · 4 kỹ năng/trường phái có hồi chiêu + tốn Linh Lực + hiệu ứng vòng/đạn bay · số sát thương bay + bạo kích · 3 loại quái + tinh anh (tối đa 4 con) · Linh Thạch · Thiên Kiếp 3 đợt khi lên cảnh giới · lưu v2 (tự chuyển đổi từ save cũ).
**Giữ nguyên từ prototype:** cảnh Thanh Vân Sơn · đi/thiền/rút kiếm · camera thứ ba · chế độ Tự Động (nay nhắm quái gần nhất + tự dùng kỹ năng Q) · né Space.
**Chưa có (đúng phạm vi):** bản đồ mới/bí cảnh · nhiệm vụ · công pháp/pháp bảo/túi đồ · động phủ/luyện đan (nơi tiêu Linh Thạch) · đăng nhập/database/offline server · model 3D ngoài · âm thanh.

## Cấu trúc code
```
src/game/   data.ts (cảnh giới, ngũ hành, linh căn, trường phái, kỹ năng, phương pháp, quái, thiên kiếp)
            cultivation.ts (tu luyện + phương pháp + sự kiện + đột phá + lưu v2/migration v1)
            scene.ts (môi trường) · player.ts (nhân vật) · beast.ts (3 loại quái + tinh anh)
            fx.ts (số sát thương bay, vòng kỹ năng, đạn bay, sét + vòng đỏ thiên kiếp)
            Game.ts (vòng lặp, combat, kỹ năng, auto, thiên kiếp) · store.ts (cầu nối Babylon -> React)
src/ui/     HUD.tsx (giao diện + thanh kỹ năng + thẻ sự kiện) · CreationScreen.tsx (tạo nhân vật)
docs/       Bộ tài liệu kiến trúc Giai đoạn A+B
```

## Ghi chú kỹ thuật
- Build kiểm tra: `npm run build` (TypeScript + Vite) — đạt, 0 lỗi. Bundle ~1.48 MB gzip (gần như không đổi so với prototype 1.47 MB).
- Cần trình duyệt hỗ trợ WebGL2 (Chrome/Edge/Firefox bản mới đều có).
- Bước tiếp theo theo `docs/MVP_ROADMAP.md`: Giai đoạn 2 — World (3 bản đồ, bí cảnh, nhiệm vụ, công pháp, pháp bảo).
