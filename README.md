# VẠN ĐẠO TRƯỜNG SINH — Giai đoạn 3: Idle

Game tu tiên 3D trên web. Giai đoạn 3 biến game thành **idle game thật sự**: **Offline Progress** (đóng game, nhân vật vẫn thiền / bế quan / săn quái — quay lại nhận **Báo cáo thành quả**), **Bế quan** (khóa nhân vật, Tu Vi ×2.5), **Động Phủ** với **Tụ Linh Trận** (tăng trần giờ offline) và **Linh Điền** (tự trồng Linh Thảo), thêm 2 tài nguyên **Linh Thảo 🌿 / Tinh Hoa ✨**, **Luyện Đan** (cả đan mới **Độ Kiếp Đan** +15% đột phá) và **Luyện Khí** (chế tạo + **cường hóa trang bị**). Toàn bộ nền Giai đoạn 1–2 được giữ nguyên: tạo nhân vật, 3 bản đồ, 2 bí cảnh + boss, 12 nhiệm vụ, 10 công pháp, túi đồ/trang bị/shop, thiên kiếp.

Chạy hoàn toàn trên máy của bạn (không server, không đăng nhập, không database). Tiến trình lưu tự động trong trình duyệt (localStorage, **save v4** — save v3/v2/v1 cũ được tự động chuyển đổi: giữ nguyên nhân vật, tiến trình, Linh Thạch, nhiệm vụ, công pháp; **trang bị trong túi được tách thành từng món riêng lẻ** để cường hóa, món đang đeo giữ nguyên vị trí).

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
> Kiểm tra công thức offline bằng test tự động (không cần mở game): `npm run test:offline`.

---

## ⭐ Offline Progress — tính năng cốt lõi của Giai đoạn 3

Đóng tab game rồi quay lại sau **≥ 5 phút**, bạn sẽ thấy hộp thoại **📜 Báo cáo offline** liệt kê mọi thành quả nhân vật tự đạt được lúc bạn vắng mặt, kèm nút **Nhận thành quả** (nhận đúng 1 lần — bấm ✕ đóng hộp thoại thì thành quả vẫn chờ, mở lại bằng nút **📜 Có thành quả chưa nhận** ở thanh dưới).

**Hoạt động offline được suy ra từ việc bạn đang làm lúc rời game:**

| Lúc rời game bạn đang... | Offline tính theo |
|---|---|
| Bật **Tự Động (Tab)** | 🏹 **Săn quái** tại bản đồ hiện tại: ước tính số quái hạ được theo Công của bạn ÷ HP quái trung bình của map (tối đa 400 con) → Tu Vi, Linh Thạch, Linh Thảo (0.5/con), tối đa 2 món rơi |
| Đang **Bế quan** | 🏯 **Bế quan**: Tu Vi theo Tĩnh Tọa ×2.5, Căn Cơ +0.2/giây |
| Còn lại (đang thiền hoặc đứng yên) | 🧘 **Thiền** theo phương pháp đang chọn tại bản đồ hiện tại (đủ cả linh khí map ×1.5 ở Linh Khê Cốc, tương hợp linh căn ×1.3 của Vận Chu Thiên, % công pháp, Tụ Linh Trận) |

**Trần thời gian tính thành quả** — vắng lâu hơn nữa cũng chỉ tính đến trần:

| Tụ Linh Trận | Trần offline | Cộng thêm |
|---|---|---|
| Chưa xây (cấp 0) | **8 giờ** | — |
| Cấp 1 | 9 giờ | Tu Vi thiền +4% |
| Cấp 2 | 10 giờ | Tu Vi thiền +8% |
| Cấp 3 | 11 giờ | Tu Vi thiền +12% |
| Cấp 4 | 12 giờ | Tu Vi thiền +16% |
| Cấp 5 | 12 giờ | Tu Vi thiền **+26%** |

Quy tắc công bằng (bản local): Tu Vi offline không vượt quá ngưỡng của tiểu cảnh hiện tại (đầy rồi thì phải vào game đột phá), Căn Cơ không quá 100, đồng hồ hệ thống bị chỉnh **lùi** thì không tính offline. **Lưu ý trung thực:** ở Giai đoạn 3 mọi tính toán vẫn chạy phía client (localStorage) nên người am hiểu kỹ thuật vẫn sửa được save — chống gian lận thật sự (server tính, không tin client) thuộc **Giai đoạn 4** theo đúng kiến trúc đã chốt; công thức tính hiện tại đã viết dạng hàm thuần sẵn sàng bê lên server.

**🧪 Tự kiểm tra ngay trong game:** panel **Động Phủ (H)** → mục Kiểm thử → nút **🧪 Giả lập offline 2 giờ**: game lùi mốc thời gian 2 giờ rồi tải lại trang — bạn sẽ thấy Báo cáo offline hiện ra như vừa đi vắng thật.

## 🏯 Bế quan
Nút **🏯 Bế quan** ở panel trái (hoặc khi đang bế quan: nút **Xuất quan** / banner trên cùng):
- Nhân vật ngồi thiền khóa cứng: **không di chuyển, không đánh, không dùng kỹ năng, không du hành**; yêu thú không quấy nhiễu (kết giới hộ thể).
- Tu Vi theo tốc độ thiền **Tĩnh Tọa ×2.5**, Căn Cơ **+0.2/giây**, màn hình có viền tối tĩnh tâm.
- Thoát game giữa lúc bế quan → offline tính theo **bế quan**; vào lại game nhân vật ở trạng thái bình thường kèm Báo cáo offline.

## 🏯 Động Phủ (phím H)
### 🔮 Tụ Linh Trận (cấp 0–5)
Nâng bằng Linh Thạch: 100 / 250 / 600 / 1400 / 3000. Tác dụng: tăng trần giờ offline + tăng % Tu Vi thiền (bảng ở trên, áp dụng cả khi thiền trực tiếp lẫn offline).
### 🌱 Linh Điền (cấp 0–3)
| Cấp | Chi phí | Sản lượng |
|---|---|---|
| Xây (0→1) | 150 Linh Thạch | 6 Linh Thảo/giờ |
| 1→2 | 400 Linh Thạch + 20 Linh Thảo | 12 Linh Thảo/giờ |
| 2→3 | 900 Linh Thạch + 60 Linh Thảo | 24 Linh Thảo/giờ |

Linh Thảo tự tích lũy theo thời gian thực (cả offline lẫn đang chơi), chứa tối đa bằng 48 giờ sản lượng. Bấm **🌿 Thu hoạch** trong panel Động Phủ để chuyển vào tài nguyên.
### Tài nguyên mới
- **🌿 Linh Thảo:** Linh Điền · quái rơi 30% (1–3 cây) · săn offline. Dùng để luyện đan + nâng Linh Điền.
- **✨ Tinh Hoa:** tinh anh +1 · dẹp Sào Huyệt +2 · diệt Thạch Tượng +5. Dùng để luyện khí (chế tạo + cường hóa).

## ⚗️ Luyện Đan (trong panel Động Phủ)
Linh Thạch luôn tốn khi luyện; **thành công** tốn hết Linh Thảo và nhận đan vào Túi đồ; **thất bại** mất **một nửa** Linh Thảo, không ra đan.

| Đan | Công thức | Tỉ lệ | Công dụng |
|---|---|---|---|
| Hồi Huyết Đan | 3🌿 + 10💰 | 80% | Hồi 50% HP |
| Hồi Linh Đan | 3🌿 + 10💰 | 80% | Hồi đầy Linh Lực |
| Tụ Linh Đan | 6🌿 + 25💰 | 80% | +80 Tu Vi ngay |
| **Độ Kiếp Đan** ⭐ mới | 12🌿 + 80💰 | 70% | Dùng từ Túi đồ trước khi đột phá: **lần đột phá tới +15% tỉ lệ** (cộng cả vào lần có Thiên Kiếp; mất hiệu lực ngay khi đã tung tỉ lệ, không tốn nếu chưa đủ điều kiện đột phá) |

## 🔨 Luyện Khí (trong panel Động Phủ + Túi đồ)
- **Chế tạo:** chọn 1 trong 4 ô (Vũ Khí/Áo/Giày/Ngọc Bội), tốn **3✨ Tinh Hoa + 120💰** → nhận 1 trang bị **ngẫu nhiên của ô đó**, phẩm theo trần rơi đồ của cảnh giới hiện tại (giống nhặt đồ từ quái).
- **Cường hóa:** mỗi món trang bị giờ là **một món riêng lẻ** có cấp cường hóa **+0…+5**. Bấm **✨ Cường hóa** ngay trong Túi đồ (phím B) hoặc ở ô đang trang bị: tốn **2✨ Tinh Hoa + Linh Thạch tăng theo cấp** (50/100/150/200/250💰), mỗi cấp **+10% chỉ số gốc** của món đồ. Bán đồ bán theo từng món, giữ nguyên giá bán gốc.

---

## Điều khiển (bổ sung phím mới của Giai đoạn 3)

| Phím / Thao tác | Hành động |
|---|---|
| **W A S D** | Di chuyển (theo hướng camera) |
| **Kéo chuột** | Xoay camera · **Lăn chuột**: zoom |
| **Space** | Né — lướt nhanh, bất tử 0.35 giây |
| **Click chuột trái** | Đánh thường bằng kiếm (tự rút kiếm) |
| **Q / E / R / F** | 4 kỹ năng của trường phái |
| **C** | Thiền / đứng dậy |
| **Tab** | Bật/tắt **Tự Động** săn quái |
| **M** | Panel **Bản đồ & Bí cảnh** |
| **J** | Panel **Nhiệm vụ** + Thiên Đạo Ký Lục |
| **K** | Panel **Công pháp** |
| **B** | Panel **Túi đồ / Trang bị / Shop** |
| **H** | Panel **Động Phủ** — Tụ Linh Trận, Linh Điền, Luyện Đan, Luyện Khí (mới) |
| **I** | Panel Nhân vật |

Các panel là lớp phủ bật/tắt — chỉ mở 1 panel tại một thời điểm, không che kín cảnh 3D khi đóng. **Bế quan** bật bằng nút ở panel trái (không có phím tắt riêng).

## Giữ nguyên từ Giai đoạn 1–2 (tóm tắt)
- **3 bản đồ** mở khóa theo cảnh giới: Thanh Vân Sơn (từ đầu) · Linh Khê Cốc (Luyện Khí — thiền Tu Vi ×1.5) · Hắc Phong Lâm (Trúc Cơ — Căn Cơ ×1.5, quái ×1.8). Panel Bản đồ: phím **M**, bản đồ đang ở được lưu.
- **2 bí cảnh:** Yêu Thú Sào Huyệt (3 đợt quái, rương chắc chắn rơi trang bị) · Cổ Tu Động Phủ (3 gian + bẫy sét + **boss Thạch Tượng**: đòn dậm đất vòng đỏ, khiên 5 lớp ở 50% HP chỉ phá bằng hệ khắc — Mộc khắc Thổ). Chết trong bí cảnh = đẩy ra ngoài với 30% HP.
- **Nhiệm vụ (J):** 12 nhiệm vụ 4 nhóm (Thiên Đạo lặp lại · Kỳ Ngộ chọn 1-trong-2 · Tông Môn · Thám Hiểm) + Thiên Đạo Ký Lục.
- **Công pháp (K):** 10 cuốn, học bằng Ngộ Tính, kích hoạt tối đa 2, hiệu ứng áp thật (Tu Vi/Căn Cơ/sát thương/bạo kích/hồi Linh Lực/hồi chiêu).
- **Túi đồ (B):** 14 trang bị 4 ô × 4 phẩm (Phàm→Địa) + đan dược; quái rơi đồ (thường 12%, tinh anh 40%), shop bán đan dược + đồ Phàm/Hoàng bằng Linh Thạch, bán lại đồ thừa. *(Từ Giai đoạn 3: trang bị là từng món riêng có cấp cường hóa — xem mục Luyện Khí.)*
- Tạo nhân vật (5 linh căn × 5 trường phái) · tương khắc ngũ hành ±20% · 4 phương pháp tu luyện + sự kiện kỳ ngộ khi thiền · kỹ năng Q/E/R/F theo trường phái · số sát thương bay + bạo kích · 3 loại quái + Ám Ảnh Lang + tinh anh · đột phá theo công thức 60 + 0.4×CănCơ − độ khó · **Thiên Kiếp** 3 đợt sét khi lên cảnh giới mới · Tự Động (Tab).
- Phím **R/F là kỹ năng** (đánh thường bằng click chuột) — giữ nguyên từ Giai đoạn 1.

## Giai đoạn 3 CÓ gì / CHƯA có gì
**Có (mới):** offline progress theo 3 hoạt động (thiền/bế quan/săn) với trần giờ theo Tụ Linh Trận + báo cáo nhận thưởng 1 lần · bế quan ×2.5 · động phủ (Tụ Linh Trận 5 cấp + Linh Điền 3 cấp có thu hoạch) · Linh Thảo + Tinh Hoa với nguồn/đích đầy đủ · luyện đan 4 công thức (gồm Độ Kiếp Đan) · luyện khí chế tạo + cường hóa trang bị +5 · trang bị dạng từng món riêng lẻ · nút giả lập offline 2 giờ để tự kiểm tra · lưu v4 (tự chuyển đổi từ v3/v2/v1) · test tự động cho công thức offline (`npm run test:offline`).
**Chưa có (đúng phạm vi):** server/đăng nhập/database (Giai đoạn 4 — khi đó offline sẽ tính phía server, chống sửa giờ/sửa save) · linh thú · thêm công trình động phủ ngoài 2 công trình trên · model 3D ngoài · âm thanh.

## Cấu trúc code
```
src/game/   data.ts (cảnh giới, ngũ hành, trường phái, kỹ năng, quái + boss, ĐỊA ĐIỂM, CÔNG PHÁP, VẬT PHẨM,
              NHIỆM VỤ + GĐ3: BẾ QUAN, OFFLINE, TỤ LINH TRẬN, LINH ĐIỀN, CÔNG THỨC ĐAN, LUYỆN KHÍ)
            cultivation.ts (tu luyện + save v4/migration + túi đồ/trang bị dạng instance + công pháp + nhiệm vụ
              + OFFLINE: computeOffline/prepareOffline/claimOffline + động phủ + luyện đan/khí)
            scene.ts (dựng môi trường theo từng địa điểm) · player.ts · beast.ts (quái + tinh anh + boss)
            fx.ts (số sát thương, vòng kỹ năng, đạn bay, sét) · Game.ts (vòng lặp, combat, auto, thiên kiếp,
              du hành, bí cảnh, bế quan, ghi dấu hoạt động offline) · store.ts (cầu nối Babylon -> React)
src/ui/     HUD.tsx (HUD + panel Bản đồ/Nhiệm vụ/Công pháp/Túi đồ/Nhân vật/ĐỘNG PHỦ + báo cáo offline)
            CreationScreen.tsx (tạo nhân vật)
scripts/    test-offline.mjs (test tự động công thức offline — chạy: npm run test:offline)
docs/       Bộ tài liệu kiến trúc Giai đoạn A+B
```

## Ghi chú kỹ thuật
- Build kiểm tra: `npm run build` (TypeScript + Vite) — đạt, 0 lỗi. Bundle ~1.50 MB gzip.
- Test offline: `npm run test:offline` — 20 kiểm tra (tốc độ thiền khớp công thức dùng chung ±1%, trần 8 giờ khi vắng 24 giờ, nhận thưởng 2 lần không cộng trùng, săn offline xác định theo hạt giống + trần 400 quái, đồng hồ lùi/vắng ngắn không tạo báo cáo) — tất cả đạt.
- Cần trình duyệt hỗ trợ WebGL2 (Chrome/Edge/Firefox bản mới đều có).
- Bước tiếp theo theo `docs/MVP_ROADMAP.md`: Giai đoạn 4 — Persistence (Supabase Auth + database, offline tính phía server, cloud save).
