# VẠN ĐẠO TRƯỜNG SINH — Technical Prototype (Giai đoạn C)

Game tu tiên 3D trên web: bản **prototype kỹ thuật** đầu tiên — 1 bản đồ Thanh Vân Sơn, 1 nhân vật tu sĩ, 1 yêu thú, chiến đấu đơn giản và hệ thống tu luyện + đột phá chạy hoàn toàn trên máy của bạn (không có server, không đăng nhập, không database). Tiến trình tu luyện được lưu tự động trong trình duyệt (localStorage).

Công nghệ: **Vite + React + TypeScript + Babylon.js 9.37** — toàn bộ nhân vật, yêu thú và cảnh vật được dựng bằng hình khối 3D trong code (chưa dùng model ngoài), animation cũng do code điều khiển.

---

## Cách chạy trên Windows (từng bước)

### Bước 1 — Cài Node.js
1. Mở trang https://nodejs.org → tải bản **LTS** (nút xanh lớn) → cài như phần mềm bình thường (cứ bấm Next).
2. Kiểm tra: mở **Command Prompt** (gõ `cmd` trong ô tìm kiếm Windows) và gõ:
   ```
   node -v
   npm -v
   ```
   Thấy hiện số phiên bản (ví dụ `v24.x`) là được.

### Bước 2 — Lấy code về
- Nếu nhận qua GitHub: bấm nút xanh **Code → Download ZIP** trên trang repo, giải nén vào một thư mục, ví dụ `D:\Game\van-dao-truong-sinh-game`.
- Mở Command Prompt tại đúng thư mục đó (trong Explorer, gõ `cmd` vào thanh địa chỉ của thư mục rồi Enter).

### Bước 3 — Cài thư viện (chỉ làm 1 lần)
```
npm install
```
Chờ vài phút tới khi xong, không báo lỗi đỏ là được.

### Bước 4 — Chạy game
```
npm run dev
```
Thấy dòng `Local: http://localhost:5173/` → mở trình duyệt (Chrome/Edge) vào địa chỉ **http://localhost:5173/**

Muốn dừng: quay lại cửa sổ Command Prompt, bấm `Ctrl + C`.

> Lần sau chơi tiếp chỉ cần làm lại Bước 4. Tiến trình (cảnh giới, Tu Vi, Căn Cơ...) đã được lưu trong trình duyệt — muốn chơi lại từ đầu thì bấm nút **↺ Chơi lại** trong game.

---

## Điều khiển

| Phím / Thao tác | Hành động |
|---|---|
| **W A S D** | Di chuyển (theo hướng camera) |
| **Kéo chuột** | Xoay camera · **Lăn chuột**: zoom |
| **Space** | Né — lướt nhanh, né đòn trong thoáng chốc |
| **F** hoặc **Click chuột trái** | Tấn công bằng kiếm (tự rút kiếm nếu chưa rút) |
| **C** | Tĩnh tọa / đứng dậy (thiền: Tu Vi ×3, hồi Căn Cơ + HP) |
| **R** | Rút kiếm / cất kiếm (kiếm phát sáng khi trên tay) |
| **Tab** | Bật/tắt chế độ **Tự Động** săn quái |

## Cách chơi vòng lặp mẫu
1. Bấm **C** để thiền → Tu Vi và Căn Cơ tăng, thỉnh thoảng **đốn ngộ** +1 Ngộ Tính.
2. Khi Tu Vi đầy + Căn Cơ đủ → nút **🌩️ ĐỘT PHÁ** sáng lên → bấm để đột phá lên tiểu cảnh tiếp theo (có tỉ lệ thành công hiển thị sẵn; thất bại mất 15% Tu Vi và 15 Căn Cơ, **không** tụt cảnh giới).
3. Đi tìm **Yêu Thú Hắc Phong** (thanh HP đỏ phía phải màn hình) → rút kiếm, chém hạ nó được +30 Tu Vi. Nó cũng đuổi và đánh bạn — dùng **Space** để né.
4. Lười điều khiển? Bấm **Tab**: nhân vật tự đi săn, HP xuống dưới 25% sẽ chạy về sân tự thiền hồi phục, khỏe lại đi săn tiếp.

Cảnh giới trong prototype: **Luyện Thể → Luyện Khí → Trúc Cơ → Kim Đan**, mỗi cảnh giới 4 tiểu cảnh (Sơ Kỳ → Trung Kỳ → Hậu Kỳ → Đại Viên Mãn).

## Prototype này CÓ gì / CHƯA có gì

**Có:** cảnh Thanh Vân Sơn (địa hình, rừng trúc, hồ nước, mây trôi, sương, hạt linh khí) · nhân vật đi/thiền/rút kiếm/chém do code animate · camera thứ ba · 1 yêu thú có AI lang thang + đuổi đánh + thanh HP + hồi sinh · chiến đấu 2 chiều + né · chế độ tự động · tu luyện 3 lớp (Tu Vi / Căn Cơ / Ngộ Tính) · đột phá đúng công thức thiết kế · lưu tiến trình local.

**Chưa có (đúng phạm vi đã duyệt):** model 3D ngoài/nhân vật chibi · đăng nhập, database, lưu trữ đám mây · offline progress phía server · bí cảnh, nhiệm vụ, công pháp, pháp bảo, động phủ · âm thanh · chơi trên điện thoại (chưa tối ưu cảm ứng).

## Cấu trúc code
```
src/game/   data.ts (số liệu cảnh giới/công thức) · cultivation.ts (tu luyện + đột phá + lưu)
            scene.ts (môi trường) · player.ts (nhân vật) · beast.ts (yêu thú) · Game.ts (vòng lặp, combat, auto)
            store.ts (cầu nối Babylon -> React HUD)
src/ui/     HUD.tsx (giao diện tiếng Việt)
docs/       Bộ tài liệu kiến trúc Giai đoạn A+B
```

## Bước tiếp theo (sau khi nghiệm thu prototype)
Theo `docs/MVP_ROADMAP.md`: Giai đoạn 1 — Core Gameplay đầy đủ (hệ thống nhân vật, chiến đấu có kỹ năng Q/E/R/F, đột phá có thiên kiếp) — chỉ bắt đầu khi bạn chạy thử prototype này và xác nhận cảm giác chơi.

## Ghi chú kỹ thuật
- Build kiểm tra: `npm run build` (TypeScript + Vite) — đạt, 0 lỗi.
- Bundle hiện ~1.47 MB gzip (Babylon.js khá nặng) — sẽ tối ưu bằng lazy-load ở giai đoạn sau, xem ngân sách hiệu năng trong `docs/TECHNICAL_DESIGN.md`.
- Cần trình duyệt hỗ trợ WebGL2 (Chrome/Edge/Firefox bản mới đều có).
