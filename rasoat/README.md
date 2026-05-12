# Hệ thống rà soát đất Nông trường Việt Mông

Ứng dụng web tĩnh hỗ trợ rà soát **4.536 thửa đất** (tổng **980,2 ha**) phục vụ lập phương án theo Điều 181 Luật Đất đai 2024.

**Tham khảo**: [Bản đồ khu vực Nông trường Việt Mông](https://bandovn.github.io/VietMong/)

## Dữ liệu nguồn

Ranh giới thửa **đã là dữ liệu thật** từ bản đồ địa chính đo đạc 2014-2016 (file `diachinh.geojson` từ UBND xã Yên Bài). Tổng **4.536 thửa** phân bổ trên 7 thôn:

| Xã | Thôn | Số thửa | Diện tích (ha) |
|---|---|---:|---:|
| Vân Hòa | Thôn Việt Hòa | 1.211 | 141,6 |
| Yên Bài | Thôn Phú Yên | 704 | 277,5 |
| Yên Bài | Thôn Việt Yên | 619 | 222,8 |
| Yên Bài | Thôn Muỗi | 918 | 126,8 |
| Yên Bài | Thôn Quảng Phúc | 625 | 118,6 |
| Yên Bài | Thôn Bài | 60 | 18,2 |
| Kim Sơn (Sơn Tây cũ) | Thôn Lòng Hồ | 399 | 74,7 |
| **Tổng** | | **4.536** | **980,2** |

Dữ liệu phân loại 4 trục: kế thừa từ rà soát 2022 (xã Yên Bài + xã Vân Hòa), 4.095/4.536 thửa đã có phân loại sơ bộ tự động; 441 thửa còn lại (chủ yếu thôn Lòng Hồ - Kim Sơn) cần rà soát thực địa mới.

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

## Cập nhật dữ liệu

Nếu sau này cần cập nhật:
- **Phân loại 4 trục**: chỉnh sửa trực tiếp trên web (lưu localStorage), xuất CSV, gộp lại
- **Ranh giới thửa**: thay file `thuadat.geojson` với cùng cấu trúc properties (xem feature đầu tiên làm mẫu)

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
