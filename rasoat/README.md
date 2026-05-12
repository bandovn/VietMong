# Hệ thống rà soát đất Nông trường Việt Mông

Ứng dụng web tĩnh hỗ trợ rà soát 4.146 thửa đất phục vụ lập phương án theo Điều 181 Luật Đất đai 2024.

**Tham khảo**: [Bản đồ khu vực Nông trường Việt Mông](https://bandovn.github.io/VietMong/) — phiên bản hiện tại

## Tính năng

- **Bản đồ tương tác** với toàn bộ 4.146 thửa, tô màu theo phân loại đề xuất (bàn giao / giữ lại / cần rà soát)
- **Hồ sơ số từng thửa**: thông tin SMK 2016, đối chiếu rà soát 2022, phân loại 4 trục A-B-C-D
- **Bộ lọc đa chiều**: theo thôn, theo Trục A, theo đề xuất xử lý, theo trạng thái kê khai
- **Tra cứu nhanh**: tìm thửa theo tên chủ sử dụng, sắp xếp, phân trang
- **Dashboard thống kê**: phân bổ theo thôn, theo Trục A, theo trạng thái kê khai 2022
- **Form sửa phân loại**: cán bộ rà soát cập nhật trên trình duyệt (lưu localStorage)
- **In phiếu QR**: tạo phiếu rà soát A5 in được cho cán bộ thôn cầm xuống địa bàn
- **Xuất CSV**: xuất kết quả rà soát ra file để gộp dữ liệu

## Cấu trúc file

```
vietmong_app/
├── index.html         — Trang chính
├── style.css          — Kiểu dáng
├── app.js             — Logic ứng dụng
├── thuadat.geojson    — Dữ liệu 4.146 thửa (~3 MB)
├── thongke.json       — File thống kê tóm tắt
└── README.md          — File này
```

## Triển khai lên GitHub Pages

1. Tạo repo mới hoặc tạo branch trong repo `bandovn/VietMong` hiện có (vd: `ra-soat`).
2. Copy toàn bộ thư mục `vietmong_app/` lên repo.
3. Vào **Settings → Pages**, chọn branch publish và folder (root hoặc `/docs`).
4. Đợi vài phút, truy cập `https://bandovn.github.io/<ten-repo>/`.

Không cần backend, không cần database, không phát sinh chi phí.

## Thay GeoJSON mô phỏng bằng dữ liệu thật

File `thuadat.geojson` hiện tại đang dùng **polygon mô phỏng** (tạo ngẫu nhiên gần trung tâm các thôn) để demo. Khi có dữ liệu ranh giới thửa thật từ bản đồ đo đạc 2016, thay thế như sau:

### Bước 1 — Lấy ranh giới thật từ bản đồ địa chính

Dữ liệu nguồn có thể đến từ:
- File `*.dgn` hoặc `*.shp` của bản đồ địa chính 2016 (đơn vị đo đạc cung cấp)
- File GeoJSON đã có trong website `bandovn.github.io/VietMong/` (nếu nguồn này đầy đủ thuộc tính)

### Bước 2 — Chuẩn hóa thuộc tính

Mỗi feature trong GeoJSON cần các trường sau (xem `thuadat.geojson` mẫu để biết format):

| Trường | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `id` | string | ✓ | ID duy nhất, vd `Yên Bài_15_1` |
| `xa` | string | ✓ | Tên xã |
| `thon` | string | ✓ | Tên thôn |
| `to_bd` | number | ✓ | Số tờ bản đồ |
| `thua` | number | ✓ | Số thửa |
| `chu_sd_2016` | string | | Tên chủ SD theo SMK 2016 |
| `loai_dat_2016` | string | | Mã loại đất, vd "CLN", "ONT+CLN" |
| `dt_2016` | number | | Diện tích đo 2016 (m²) |
| `chu_sd_2022` | string | | Danh sách chủ SD theo rà soát 2022 |
| `so_thua_con` | number | | Số thửa con sau tách (1 nếu không tách) |
| `truc_a` | string | | Mã Trục A (xem `app.js`) |
| `truc_b` | string | | Mã Trục B |
| `truc_c` | string | | Mã Trục C |
| `de_xuat` | string | | Mã đề xuất |
| `trang_thai_ke_khai` | string | | "Không biến động" / "Chưa kê khai" / "Có biến động" |
| `so_cong_trinh` | number | | Số công trình XD trên thửa |

### Bước 3 — Chuyển đổi

Có thể dùng Python với `geopandas`:

```python
import geopandas as gpd
import pandas as pd

# Đọc shapefile bản đồ địa chính
gdf = gpd.read_file('ban_do_2016.shp')
gdf = gdf.to_crs(epsg=4326)  # WGS84 cho Leaflet

# Merge với dữ liệu phân loại
df_class = pd.read_pickle('df_thua_me_v2.pkl')
gdf = gdf.merge(df_class, on=['to_bd','thua'])

# Đặt ID
gdf['id'] = gdf['xa'] + '_' + gdf['to_bd'].astype(str) + '_' + gdf['thua'].astype(str)

# Xuất GeoJSON
gdf.to_file('thuadat.geojson', driver='GeoJSON')
```

## Quy trình rà soát đề xuất

1. **Khởi tạo** (đã làm) — nhập 4.146 thửa SMK 2016 vào hệ thống
2. **In phiếu QR** — cán bộ in 4.146 phiếu A5 từ giao diện chi tiết thửa
3. **Rà soát thực địa** — cán bộ thôn đến từng hộ, cùng đến thực địa, ghi vào phiếu
4. **Nhập dữ liệu** — cán bộ xã nhập kết quả lên hệ thống (mở thửa, sửa phân loại)
5. **Xuất biểu** — admin xuất CSV, gộp dữ liệu, sinh Biểu 01-05 cho phương án 181

## Giới hạn của phiên bản tĩnh

- **Không có đồng bộ**: mỗi trình duyệt lưu riêng. Admin phải gộp file CSV từ các cán bộ thủ công.
- **Không có ảnh thực địa**: muốn lưu ảnh cần backend (xem phương án mở rộng).
- **Không có xác thực hộ dân**: chỉ phục vụ cán bộ nội bộ, không công khai cho hộ dân tự kê khai.

Phương án mở rộng (có backend đầy đủ) trình bày trong báo cáo kèm theo.

## Liên hệ

- Công ty CP Tư vấn ứng dụng và Phát triển công nghệ Thanh Hà
- Phạm Văn Tuấn — 0911 558 628
