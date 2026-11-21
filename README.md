# VẠN ĐẠO TRƯỜNG SINH — Giai đoạn 2: World

Game tu tiên 3D trên web. Giai đoạn 2 mở rộng thế giới: **3 bản đồ** (Thanh Vân Sơn · Linh Khê Cốc · Hắc Phong Lâm) mở khóa theo cảnh giới, **2 bí cảnh** (đợt quái 3 đợt + động phủ 3 gian có **boss Thạch Tượng dựng khiên phản hệ**), **hệ nhiệm vụ 4 nhóm** (12 nhiệm vụ), **10 công pháp** học bằng Ngộ Tính, và **túi đồ + trang bị + shop Linh Thạch** (14 trang bị, 3 đan dược). Toàn bộ nền Giai đoạn 1 (tạo nhân vật, 4 phương pháp tu luyện, sự kiện, 4 kỹ năng/trường phái, thiên kiếp) được giữ nguyên.

Chạy hoàn toàn trên máy của bạn (không server, không đăng nhập, không database). Tiến trình lưu tự động trong trình duyệt (localStorage, **save v3** — save v2/v1 cũ được tự động chuyển đổi: giữ nguyên nhân vật, tiến trình và Linh Thạch; bản đồ/túi đồ/nhiệm vụ bắt đầu mới).

Công nghệ: **Vite + React + TypeScript + Babylon.js 9.37** — mọi cảnh vật, nhân vật, quái và boss dựng bằng hình khối 3D trong code, animation do code điều khiển.

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

> Lần sau chơi tiếp chỉ cần Bước 4. Muốn chơi lại từ đầu: nút **↺ Chơi lại** trong game.

---

## Điều khiển (bổ sung phím mới của Giai đoạn 2)

| Phím / Thao tác | Hành động |
|---|---|
| **W A S D** | Di chuyển (theo hướng camera) |
| **Kéo chuột** | Xoay camera · **Lăn chuột**: zoom |
| **Space** | Né — lướt nhanh, bất tử 0.35 giây |
| **Click chuột trái** | Đánh thường bằng kiếm (tự rút kiếm) |
| **Q / E / R / F** | 4 kỹ năng của trường phái |
| **C** | Thiền / đứng dậy |
| **Tab** | Bật/tắt **Tự Động** săn quái |
| **M** | Panel **Bản đồ & Bí cảnh** (mới) |
| **J** | Panel **Nhiệm vụ** + Thiên Đạo Ký Lục (mới) |
| **K** | Panel **Công pháp** (mới) |
| **B** | Panel **Túi đồ / Trang bị / Shop** (mới) |
| **I** | Panel Nhân vật |

Các panel là lớp phủ bật/tắt — chỉ mở 1 panel tại một thời điểm, không che kín cảnh 3D khi đóng.

## 3 bản đồ (phím M)
| Bản đồ | Mở khóa | Đặc điểm |
|---|---|---|
| 🏔️ **Thanh Vân Sơn** | Từ đầu | Linh khí trung hòa (Tu Vi thiền ×1.0), quái như cũ (chỉ số ×1.0) |
| 🌿 **Linh Khê Cốc** | **Luyện Khí** | Thung lũng xanh, hồ linh + suối, hoa linh phát sáng, đom đóm. Thiền định **Tu Vi ×1.5**. Quái Thủy Xà + Mộc Tinh mạnh ×1.3 |
| 🌑 **Hắc Phong Lâm** | **Trúc Cơ** | Rừng đen sương tím, trăng đỏ, cây khô. Thiền **Tu Vi ×1.2, Căn Cơ ×1.5** (môi trường khắc nghiệt rèn nền tảng). Quái mạnh ×1.8, tinh anh 30%, có **Ám Ảnh Lang** (hệ Kim) |

Bản đồ đang ở được lưu vào save — lần sau vào game sẽ ở đúng bản đồ đó.

## 2 bí cảnh (vào từ panel Bản đồ — phím M)
### 🕳️ Yêu Thú Sào Huyệt (mở ở Luyện Khí)
Đấu trường hang đá: **3 đợt quái** (2 → 3 → 4 con, đợt sau mạnh hơn). Quét sạch cả 3 đợt để mở rương: **+120 Tu Vi, Linh Thạch theo cảnh giới, chắc chắn rơi 1 trang bị**. Quái trong bí cảnh chết là hết, không hồi sinh.

### 🏛️ Cổ Tu Động Phủ (mở ở Trúc Cơ)
3 gian phòng nối tiếp trên một đấu trường, **kết giới** chắn giữa các gian — dọn sạch gian mới mở được gian kế:
- **Gian 1:** 2 yêu thú gác cổng.
- **Gian 2:** 3 yêu thú + **trận pháp cổ**: cứ ~4.5 giây có vòng đỏ sét đánh tại vị trí của bạn (báo trước 1 giây) — vừa đánh vừa né.
- **Gian 3:** 👹 **Hộ Pháp Thạch Tượng** — boss khổng lồ (HP ~×8 lang thường), có **đòn dậm đất diện rộng** (vòng đỏ 1.2 giây rồi giáng xuống, sát thương nặng). Khi boss còn **50% HP**, nó dựng **KHIÊN 5 lớp**: đòn khác hệ chỉ gây 10% sát thương và không phá khiên; chỉ đòn đúng **hệ khắc** (boss hệ Thổ → dùng kỹ năng/đánh thường hệ **Mộc**) mới trừ khiên. Phá khiên → boss **choáng 3 giây**, chịu +50% sát thương. HUD luôn hiện gợi ý hệ cần dùng.
- Hạ boss: **+300 Tu Vi, +200 Linh Thạch, chắc chắn rơi trang bị phẩm cao nhất theo cảnh giới** + ghi vào Thiên Đạo Ký Lục.

Quy tắc chung: bấm **🚪 Rời bí cảnh** (panel phải hoặc panel bản đồ) để ra. **Chết trong bí cảnh = bị đẩy về bản đồ trước đó với 30% HP**, không mất thêm gì. Tiến trình bí cảnh không lưu giữa chừng — rời game giữa chừng là làm lại từ đầu.

## Nhiệm vụ (phím J) — 12 nhiệm vụ, 4 nhóm
- **Thiên Đạo (lặp lại):** Trừ Yêu (hạ quái), Tĩnh Tu (giây thiền), Tiến Cảnh (đột phá) — nhận thưởng xong mục tiêu tăng dần, làm tiếp được mãi.
- **Kỳ Ngộ (chọn 1 trong 2, 1 lần):** Di Vật Cổ Nhân (đạt Luyện Khí), Thương Nhân Bí Ẩn (hạ 15 quái), Tiền Bối Truyền Pháp (kiếm 300 Linh Thạch) — hiện trong panel khi đủ điều kiện, chọn phần thưởng nào là mất phần còn lại.
- **Tông Môn:** Săn 2 tinh anh · Dẹp Sào Huyệt · Tích lũy 500 Linh Thạch.
- **Thám Hiểm:** Đặt chân đủ 3 bản đồ · Vượt Cổ Tu Động Phủ · Diệt Thạch Tượng.

Hoàn thành nhiệm vụ sẽ có thông báo 🎉 trong game; vào panel J bấm **Nhận thưởng** (Tu Vi / Linh Thạch / Ngộ Tính / Căn Cơ / vật phẩm). Panel J cũng chứa **📜 Thiên Đạo Ký Lục** — dòng thời gian các cột mốc: hạ tinh anh đầu tiên, dẹp Sào Huyệt, diệt Thạch Tượng, kết Kim Đan...

## Công pháp (phím K) — 10 cuốn, 2 cuốn mỗi trường phái
Học bằng **Ngộ Tính** (2–6 điểm), yêu cầu cảnh giới tối thiểu. **Chỉ tối đa 2 cuốn đang KÍCH HOẠT mới có hiệu lực** — đổi kích hoạt tùy ý, miễn phí.

| Trường phái | Cuốn 1 | Cuốn 2 |
|---|---|---|
| Kiếm Tu | Kiếm Ý Thông Minh (✨2): Sát thương +8%, Bạo +3% | Thanh Phong Kiếm Pháp (✨4, Luyện Khí): Tu Vi +15%, Hồi chiêu −10% |
| Pháp Tu | Hỏa Diệm Quyết (✨2): Sát thương +10% | Cửu Chuyển Linh Pháp (✨5, Trúc Cơ): Tu Vi +20%, Hồi Linh Lực +30% |
| Thể Tu | Kim Cang Thể Phách (✨2): Căn Cơ tăng +25%, Sát thương +4% | Long Tượng Bàn Nhược Công (✨6, Trúc Cơ): Sát thương +14%, Căn Cơ +15% |
| Đan Tu | Đan Đạo Tâm Kinh (✨2): Tu Vi +10%, Căn Cơ +10% | Thảo Mộc Linh Quyết (✨4, Luyện Khí): Hồi Linh Lực +25%, Tu Vi +10% |
| Phù Trận Tu | Tụ Linh Trận Pháp (✨3): Tu Vi +18% | Ngũ Hành Trận Đồ (✨5, Trúc Cơ): Hồi chiêu −15%, Sát thương +8% |

Hiệu ứng áp dụng thật vào: tốc độ Tu Vi khi tu luyện, tốc độ tăng Căn Cơ, sát thương đánh thường + kỹ năng, bạo kích, hồi Linh Lực, hồi chiêu kỹ năng.

## Túi đồ · Trang bị · Shop (phím B)
**14 trang bị** ở 4 ô — Vũ Khí / Áo Giáp / Giày / Ngọc Bội — 4 phẩm **Phàm → Hoàng → Huyền → Địa**, mỗi món cộng chỉ số thật (Công/Thủ/HP/Linh Lực/Tốc độ/Bạo kích) vào chỉ số nhân vật. Trang bị vũ khí còn **đổi màu phát sáng của lưỡi kiếm** theo phẩm.

| Ô | Phàm | Hoàng | Huyền | Địa |
|---|---|---|---|---|
| Vũ Khí | Thanh Mộc Kiếm (Công +4) | Huyền Thiết Kiếm (Công +9, Bạo +2%) | Lưu Hỏa Kiếm (Công +16, Bạo +3%) | Địa Tâm Cổ Kiếm (Công +26, Bạo +4%) |
| Áo | Bố Y (Thủ +3, HP +15) | Linh Tàm Bảo Y (Thủ +7, HP +35) | Huyền Vũ Giáp (Thủ +13, HP +70) | Địa Long Bì Giáp (Thủ +20, HP +120) |
| Giày | Tật Phong Ngoa (Tốc +0.3) | Vân Du Ngoa (Tốc +0.6, Thủ +2) | Lăng Ba Ngoa (Tốc +1.0, Thủ +4) | — |
| Ngọc Bội | Linh Thạch Trụy (Linh Lực +15) | Tụ Linh Ngọc Bội (LL +30, Công +3) | Ngũ Hành Châu (LL +50, Công +6, Bạo +2%) | — |

**3 đan dược tiêu hao:** Hồi Huyết Đan (hồi 50% HP · 20💰), Hồi Linh Đan (đầy Linh Lực · 25💰), Tụ Linh Đan (+80 Tu Vi · 40💰).

**Nguồn vật phẩm:** quái rơi (thường 12%, tinh anh 40% — phẩm tối đa theo cảnh giới, tinh anh +1 bậc) · rương Sào Huyệt + boss Thạch Tượng (chắc chắn rơi) · thưởng nhiệm vụ · **shop** trong panel Túi đồ (bán đan dược + trang bị Phàm/Hoàng). Trang bị thừa **bán lại** lấy Linh Thạch ngay trong túi đồ. Món phẩm Huyền/Địa không bán trong shop — chỉ rơi từ quái/bí cảnh/boss.

## Giữ nguyên từ Giai đoạn 1
Tạo nhân vật (5 linh căn × 5 trường phái) · tương khắc ngũ hành ±20% · 4 phương pháp tu luyện + 3 sự kiện kỳ ngộ khi thiền · 4 kỹ năng Q/E/R/F mỗi trường phái (hồi chiêu + Linh Lực + hiệu ứng) · số sát thương bay + bạo kích · 3 loại quái + tinh anh · đột phá tiểu cảnh theo công thức 60 + 0.4×CănCơ − độ khó · **Thiên Kiếp** 3 đợt sét khi lên cảnh giới mới · chế độ Tự Động (Tab).

> Lưu ý phím: **R/F là kỹ năng** (đánh thường bằng click chuột) — giữ nguyên từ Giai đoạn 1. Phím panel mới M/J/K/B không trùng với phím chiến đấu nào.

## Giai đoạn 2 CÓ gì / CHƯA có gì
**Có (mới):** 3 bản đồ du hành tức thì + lưu bản đồ · linh khí từng map (Tu Vi/Căn Cơ) · quái nhân hệ số theo map + Ám Ảnh Lang · 2 bí cảnh (3 đợt quái / 3 gian phòng + bẫy sét + boss có khiên phản hệ và đòn dậm đất) · 12 nhiệm vụ 4 nhóm + nhận thưởng + Thiên Đạo Ký Lục · 10 công pháp học bằng Ngộ Tính, kích hoạt tối đa 2 · túi đồ + 14 trang bị 4 ô + 3 đan dược + rơi đồ + shop/mua/bán bằng Linh Thạch · kiếm đổi màu theo vũ khí · lưu v3 (tự chuyển đổi từ v2/v1).
**Chưa có (đúng phạm vi):** động phủ/luyện đan · offline progress/server · đăng nhập/database · linh thú · model 3D ngoài · âm thanh. Nơi tiêu Linh Thạch hiện tại: shop trang bị/đan dược + (sau này) luyện đan, động phủ.

## Cấu trúc code
```
src/game/   data.ts (cảnh giới, ngũ hành, trường phái, kỹ năng, quái + boss, ĐỊA ĐIỂM, CÔNG PHÁP, VẬT PHẨM, NHIỆM VỤ)
            cultivation.ts (tu luyện + save v3/migration + túi đồ/trang bị + công pháp + nhiệm vụ + ký lục)
            scene.ts (dựng môi trường theo từng địa điểm, dispose sạch khi du hành)
            player.ts (nhân vật, kiếm đổi màu theo vũ khí) · beast.ts (quái + tinh anh + boss golem: khiên/dậm đất)
            fx.ts (số sát thương, vòng kỹ năng, đạn bay, sét + vòng đỏ)
            Game.ts (vòng lặp, combat, auto, thiên kiếp, du hành, bí cảnh) · store.ts (cầu nối Babylon -> React)
src/ui/     HUD.tsx (HUD + panel Bản đồ/Nhiệm vụ/Công pháp/Túi đồ/Nhân vật) · CreationScreen.tsx (tạo nhân vật)
docs/       Bộ tài liệu kiến trúc Giai đoạn A+B
```

## Ghi chú kỹ thuật
- Build kiểm tra: `npm run build` (TypeScript + Vite) — đạt, 0 lỗi. Bundle ~1.50 MB gzip (Giai đoạn 1: 1.48 MB — tăng nhẹ do dữ liệu + panel mới).
- Cần trình duyệt hỗ trợ WebGL2 (Chrome/Edge/Firefox bản mới đều có).
- Bước tiếp theo theo `docs/MVP_ROADMAP.md`: Giai đoạn 3 — Idle (offline progress, bế quan, động phủ, luyện đan/luyện khí).
