# VẠN ĐẠO TRƯỜNG SINH — Báo cáo Giai đoạn A + B (tóm tắt điều hành)

> Ngày: 2026-11-22 (Asia/Saigon) · Trạng thái: **CHỜ DUYỆT — chưa code**
> Quy tắc của bạn được tuân thủ tuyệt đối: không scaffold project, không viết code game trong đợt này.

## 1. Kết luận của Game Director (nói thẳng)

GDD của bạn **khả thi làm MVP, không khả thi làm “toàn bộ GDD” trong một lần**. Điểm mạnh nhất là vòng lặp idle + offline progress + đột phá — đó là thứ giữ người chơi quay lại. Điểm nguy hiểm nhất không phải code, mà là **3D asset**:

- Bạn **không có kỹ năng 3D production** (Blender / retopology / rigging / sửa import) — đã xác nhận rõ ngày 2026-11-19. Mọi kế hoạch giả định “tự làm model trong Blender” sẽ chết ở đó.
- Hai nhân vật chibi bạn đã làm character sheet (reaper + cô bé) **chưa có GLB nào**; reaper còn lỗi tóc không nhất quán giữa các view, chưa nên upload Meshy.
- Vì vậy prototype phải chứng minh được bằng **asset miễn phí có giấy phép rõ ràng + 1 nhân vật placeholder rig sẵn (Mixamo / Quaternius / Kenney)**, trước khi đầu tư vào nhân vật chính.

Khuyến nghị: **Giữ nguyên stack bạn đề xuất** (Babylon.js + React + TS + Vite + Supabase) với 3 điều chỉnh ở mục 4. Đừng đổi sang Unity WebGL hay Three.js ở giữa đường.

## 2. Giai đoạn A — Khảo sát thực tế đã làm

### 2.1. Môi trường Muse (máy này — KHÔNG phải máy Windows của bạn)
| Hạng mục | Kết quả kiểm tra thật |
|---|---|
| OS / CPU / RAM | Linux, 4 vCPU dùng chung, ~7.7 GB RAM, 149 GB trống |
| Node / npm | Node **v24.22.1**, npm **10.9.4** |
| Git / Python | git 2.43.0, Python 3.12.3 |
| Blender | **Chưa cài** trên máy Muse |
| Repo game hiện có | **Không có** — thư mục `van-dao-truong-sinh/` được tạo mới cho bộ tài liệu này; không có dữ liệu cũ nào bị đụng tới |
| Phiên bản npm mới nhất (kiểm chứng 2026-11-22) | `@babylonjs/core` **9.37.1**, `vite` **8.3.8**, `react` **19.3.1** |

⚠️ **Điều chưa khảo sát được:** cấu hình máy Windows của bạn (GPU, RAM, Blender đã cài chưa). Đây là máy *của bạn*, Muse không truy cập trực tiếp được. Prototype chạy nặng hay nhẹ phụ thuộc chính vào máy này khi bạn test — xem checklist ở §6, quyết định D6.

### 2.2. Tính khả thi 3D trên trình duyệt
- Babylon.js 9.x (9.0 ra 2026-03, bản vá mới nhất 9.37.1 ngày 2026-11-18) hỗ trợ **WebGPU + WebGL2 fallback**, clustered lighting, volumetric fog — đủ cho cảnh tiên hiệp có sương, thác, ánh sáng thần thánh mà không cần tự viết renderer.
- Rủi ro thật: máy yếu / trình duyệt cũ chỉ có WebGL2, và bundle Babylon rất nặng nếu import sai cách (~1.8 MB gzip khi import toàn bộ `@babylonjs/core` so với ~186 KB của Three.js). Bắt buộc: import theo module (`@babylonjs/core/...`), lazy-load scene, và đặt ngân sách hiệu năng ngay từ prototype (xem TECHNICAL_DESIGN).
- Kết luận: **3D trên web khả thi cho instance nhỏ, stylized** — không khả thi cho “bán chân thực giàu chi tiết” ở quy mô lớn với đội 1 người + AI. Xem quyết định D2 về phong cách đồ họa.

### 2.3. Chi phí hosting + backend (kiểm chứng từ trang pricing, tháng 11/2026)
| Dịch vụ | Free | Khi nào phải trả |
|---|---|---|
| **Supabase Free** | $0 — 500 MB DB, 50k MAU Auth, 5 GB egress, 1 GB storage, 500k Edge Function calls/tháng, tối đa 2 project | Project **tự pause sau 1 tuần không hoạt động**; không backup tự động |
| Supabase Pro | $25/tháng (gồm $10 credit compute) | Khi public beta có người chơi thật, cần backup + không pause |
| Static hosting (Vercel / Netlify / Cloudflare Pages) | $0 cho MVP | Chỉ tốn khi băng thông asset 3D lớn — GLB phải nén (Draco/meshopt + KTX2) và để CDN cache |
| Domain | ~$10–15/năm | Tùy chọn ở MVP, dùng subdomain miễn phí trước |

**Tổng chi phí MVP: $0.** Chi phí đầu tiên phát sinh là Supabase Pro $25/tháng ở Giai đoạn 5 — không phải bây giờ.

## 3. Đánh giá lại stack bạn đề xuất

| Lựa chọn của bạn | Giữ / Đổi | Lý do ngắn |
|---|---|---|
| Babylon.js | ✅ **GIỮ** | Engine đầy đủ (physics Havok, GUI, particles, animation state machine, Inspector) — Three.js chỉ là thư viện render, bạn sẽ phải tự lắp physics/audio/UI, tốn thời gian hơn nhiều cho đội nhỏ |
| React + TypeScript + Vite | ✅ GIỮ | React chỉ làm UI/menus; Babylon làm canvas. Ranh giới này phải giữ sạch (xem SYSTEM_ARCHITECTURE) |
| Supabase (Auth + Postgres) | ✅ GIỮ, có điều kiện | Đủ cho MVP. **Không** nhét toàn bộ logic offline vào Edge Functions — xem D4 |
| Blender + GLB | ⚠️ GIỮ định dạng, ĐỔI quy trình | GLB là đúng. Nhưng quy trình “tự model trong Blender” không khớp kỹ năng hiện tại → pipeline mới ở ASSET_PIPELINE.md |
| Static hosting + CDN | ✅ GIỮ | Chuẩn cho web game tĩnh |

Phương án thay thế đã cân nhắc và **loại**: Unity WebGL (build nặng 10–30 MB+, load chậm, bạn không dùng C#/Unity), PlayCanvas (editor cloud tốt nhưng hệ sinh thái nhỏ hơn, ít hợp React), Three.js + tự lắp engine (nhẹ nhất nhưng chậm nhất cho gameplay đầy đủ).

## 4. Ba điều chỉnh kiến trúc quan trọng so với GDD gốc

1. **Offline progress tính bằng công thức thống kê phía server, không mô phỏng trận đánh.** Mỗi hoạt động có `rate` (tu vi/phút, tỉ lệ rơi đồ theo bảng loot có seed) — server tính `min(offline_seconds, cap) × rate` và cộng dồn trong 1 transaction idempotent. Đây là cách duy nhất vừa chống gian lận vừa không đốt CPU server.
2. **Tách “game data” thành JSON/CSV có schema** (`data/realms.json`, `techniques.json`, `items.json`, `monsters.json`, `instances.json`...) ngay từ đầu. Thêm cảnh giới/map/công pháp = thêm dữ liệu, không sửa code. Đúng nguyên tắc số 5 của bạn.
3. **Ba chỉ số Tu Vi / Căn Cơ / Ngộ Tính phải khác nhau về *cơ chế*, không chỉ khác tên:**
   - *Tu Vi* = điểm tích lũy thuần túy, chỉ tăng, là điều kiện “đủ lượng” để đột phá.
   - *Căn Cơ* = **điểm chất lượng có trần động** (0–100% so với trần của cảnh giới hiện tại), tăng chậm bằng luyện thể/đan dược tốt, **giảm tạm thời khi đột phá thất bại hoặc dùng đan dược cưỡng ép** — nó quyết định tỉ lệ thành công + hệ số sức mạnh thực chiến.
   - *Ngộ Tính* = **điểm mở khóa dạng cây** (insight points tiêu được), kiếm từ ngộ đạo/bí cảnh/sự kiện, tiêu để mở nhánh kỹ năng — tiêu là mất, nên người chơi phải chọn đường đi. Không phải thanh EXP thứ ba.

## 5. Phạm vi MVP — cắt giảm có chủ đích so với Phần 14 của bạn

Giữ nguyên khung của bạn, nhưng siết lại những chỗ sẽ làm vỡ lịch:

| Hạng mục | GDD của bạn | Đề xuất chốt cho MVP |
|---|---|---|
| Công pháp | 10 | 10 ✅ (mỗi trường phái 2) |
| Pháp bảo | 15 | **12** (15 cũng được nếu kịp — không cam kết cứng) |
| Quái | 5 loại + 2 boss | ✅ giữ |
| Bí cảnh | 2 | ✅ giữ (1 săn quái + 1 thám hiểm 3 phòng; bí cảnh tu luyện gộp vào Động phủ ở GĐ3) |
| Động phủ | “phiên bản cơ bản” | Chỉ **Tụ Linh Trận + Linh Điền** ở MVP; 5 công trình còn lại để GĐ3 |
| Linh thú | Có trong hệ thống | **Ra khỏi MVP** — chỉ để khung dữ liệu. Linh thú = thêm AI + animation + tiến hóa, là cả 1 module riêng |
| Trường phái | 5 | Chọn 1 chính lúc tạo nhân vật; **hướng phụ khóa tới Kim Đan** |

## 6. Các quyết định cần bạn duyệt (trả lời D1–D7)

- **D1 — Engine:** Chốt Babylon.js 9.x + WebGL2 làm đường chính, WebGPU là nâng cấp tự động khi trình duyệt hỗ trợ? *(Khuyến nghị: Đồng ý)*
- **D2 — Phong cách đồ họa:** Hạ mục tiêu từ “bán chân thực” xuống **stylized tiên hiệp, low-to-mid poly, màu tươi, sương + ánh sáng làm chủ lực** cho MVP? Bán chân thực sẽ quay lại đánh giá sau prototype. *(Khuyến nghị: Đồng ý — đây là quyết định ảnh hưởng lớn nhất tới khả thi)*
- **D3 — Nhân vật prototype:** Dùng nhân vật rig sẵn miễn phí (Mixamo/Quaternius) cho Technical Prototype, nhân vật chibi của bạn vào sau khi pipeline Meshy → rig đã kiểm chứng? *(Khuyến nghị: Đồng ý)*
- **D4 — Backend offline:** Supabase Postgres + **1 backend service mỏng riêng** (Node/TS, cùng repo) làm nơi duy nhất tính offline/đột phá, thay vì dồn hết vào Edge Functions? Edge Functions chỉ dùng cho webhook/nhiệm vụ nhẹ. *(Khuyến nghị: Đồng ý)*
- **D5 — Tài khoản ở prototype:** Technical Prototype (Giai đoạn C) **không có đăng nhập, không có database** — lưu local bằng localStorage/IndexedDB, đúng như bạn đã ghi. Auth + cloud save chỉ vào ở Giai đoạn 4. *(Khuyến nghị: Đồng ý)*
- **D6 — Máy test:** Bạn cho mình biết cấu hình máy Windows bạn sẽ chạy thử (GPU/VRAM, RAM, đã cài Blender chưa, trình duyệt chính) — hoặc nói “bỏ qua, cứ nhắm máy yếu” thì mình đặt ngân sách hiệu năng theo máy yếu (GTX 1050 / Iris Xe, 1080p, 30 FPS tối thiểu).
- **D7 — Nơi chứa code:** Khi được duyệt code, tạo repo GitHub mới riêng `van-dao-truong-sinh` dưới `quocdung2107` và push lên đó (đúng thói quen bạn thích nhận code trên GitHub), hay để trong workspace trước?

**Cách duyệt nhanh:** trả lời kiểu `D1 ok, D2 ok, D3 ok, D4 ok, D5 ok, D6: máy ..., D7: GitHub` — hoặc bấm nút bên dưới nếu chỉ muốn duyệt toàn bộ theo khuyến nghị và bổ sung D6/D7 sau.

## 7. Bộ tài liệu đi kèm (9 file theo đúng yêu cầu Phần 16B)

1. `PROJECT_OVERVIEW.md` 2. `GAME_DESIGN_DOCUMENT.md` 3. `TECHNICAL_DESIGN.md` 4. `SYSTEM_ARCHITECTURE.md` 5. `DATABASE_SCHEMA.md` 6. `ASSET_PIPELINE.md` 7. `MVP_ROADMAP.md` 8. `TEST_STRATEGY.md` 9. `RISKS.md`

Bước tiếp theo **chỉ xảy ra khi bạn duyệt**: Giai đoạn C — Technical Prototype (1 map Thanh Vân Sơn nhỏ, 1 nhân vật đi/thiền/rút kiếm, 1 yêu thú, 1 trận đánh đơn giản, tu vi tăng theo thời gian). Không có database, không multiplayer.
