# WebApp Quản Lý Đăng Ký HKPĐ Cấp Tỉnh (Google Apps Script) — v3.3.0

Ứng dụng web chạy trên **Google Apps Script (GAS)** kết hợp **Google Sheets** và **Google Drive** để quản lý đăng ký vận động viên tham gia **Hội khỏe Phù Đổng (HKPĐ) cấp tỉnh** theo **từng Môn thi đấu**, hỗ trợ **đăng ký cùng lúc nhiều VĐV**, **quản lý nội dung môn thi động trên WebApp**, **nạp tài khoản đơn vị từ Excel / Copy & Dán**, **in thẻ thi đấu A4 chuẩn (4 thẻ/trang)**, **nén ảnh bằng Canvas và lưu trên Google Drive**, bảo mật **Session Token + SHA-256 + `LockService`**.

---

## Cấu trúc mã nguồn

- [`Code.gs`](./Code.gs): Backend Google Apps Script — định nghĩa schema 10 môn thi (`SPORT_DEFS`), đọc/ghi cấu hình trường động từ cột 6 `CauHinhFields` (`layDanhSachMon`, `luuToanBoMon`), nạp đơn vị hàng loạt (`importNhieuDonVi`), khởi tạo 5 sheet dữ liệu (`VDV` 20 cột, `MonThi` 6 cột), xác thực bằng **Session Token** (`CacheService`, TTL 6 giờ) & **SHA-256** (`Utilities.computeDigest`), chống ghi đè đồng thời bằng **`LockService.getScriptLock()`** (`_withLock`), lưu/tải ảnh thẻ trên **Google Drive** (`HKPD_AnhThe_VDV`), cache danh mục (`CacheService`), gộp RPC khởi động (`getBootstrapData`), đọc danh sách gọn nhẹ (`layDanhSachVDV`, `layThongKe`), duyệt hàng loạt (`duyetHangLoat`) và xuất sheet báo cáo.
- [`Setup.gs`](./Setup.gs): Script cài đặt & khởi tạo cơ sở dữ liệu tự động — tự động tạo và định dạng 5 sheet (`VDV`, `DonVi`, `MonThi`, `CaiDat`, `NhatKy`), thiết lập 20 cột VDV và 6 cột MonThi (kèm JSON `CauHinhFields`), màu nền tiêu đề, độ rộng cột tối ưu, đóng băng dòng 1, dropdown chọn dữ liệu (`DataValidation`), nạp 10 môn thi, tài khoản Admin và 5 đơn vị mẫu (mật khẩu băm SHA-256), tự động tạo thư mục ảnh thẻ `HKPD_AnhThe_VDV` trên Google Drive, và tích hợp menu tuỳ chỉnh `🏆 HKPĐ 2026` trực tiếp trên thanh công cụ của Google Sheets.
- [`Index.html`](./Index.html): Giao diện web responsive cho Đơn vị dự thi và Ban Tổ Chức (Admin):
  - Form đăng ký VĐV hàng loạt thu gọn 2 dòng gọn nhẹ (`.batch-row-main`, `.batch-row-dyn`, `.fc-sm`).
  - Quản lý nội dung thi đấu môn động (`#mo-edit-sport`): thêm/sửa/xóa nội dung con trực tiếp trên giao diện Admin.
  - Nhập hàng loạt tài khoản đơn vị từ Excel hoặc Sao chép & Dán bảng (`#mo-import-dv`).
  - Tạo & In thẻ thi đấu chuẩn khổ A4 (đúng 4 thẻ / 1 trang A4) theo từng đơn vị (`openStandalonePrintWindow`).
  - Nút lưu toàn bộ danh mục và biểu mẫu môn thi (`saveAllMon`).
  - Nén ảnh qua `<canvas>` (`compressImageDataUrlWithCanvas`) và lazy-load từ Drive (`hydratePhotos`).

---

## 5 Tính năng nâng cấp mới nhất (v3.3.0)

1. **Quản lý nội dung thi đấu con động ngay trên WebApp (Không cần sửa code)**:
   - Admin bấm nút **⚙️ Sửa nội dung & trường** tại bất kỳ môn thi nào trên giao diện Quản lý môn thi.
   - Thêm nội dung thi đấu mới, sửa tên hoặc xóa nội dung không còn tổ chức ngay trên giao diện web.
   - Toàn bộ nội dung và trường động được lưu tự động vào cột 6 `CauHinhFields` của sheet `MonThi`, tự động cập nhật biểu mẫu đăng ký tức thì cho các đơn vị.
2. **Nhập hàng loạt tài khoản đơn vị từ Excel / Copy & Dán nhanh chóng**:
   - Hỗ trợ tải file mẫu CSV chuẩn (`downloadDVTemplate()`).
   - Cho phép tải file lên (`.xlsx`, `.csv`) hoặc copy & dán trực tiếp từ bảng tính Excel / bảng Word (`handleDVPasteInput`).
   - Tự động nhận diện cột (Mã, Tên, Loại đơn vị, Email, SĐT, Người liên hệ), kiểm tra lỗi và xem trước trực tiếp trên bảng.
   - Tự động tạo mật khẩu băm SHA-256 mặc định `<MaDonVi>@hkpd` và lưu vào hệ thống an toàn.
3. **Khu vực nhập VĐV được thu gọn tối ưu, chống cảm giác choáng ngợp**:
   - Thiết kế lại hàng nhập VĐV (`addBatchRow`) theo layout 2 dòng nhỏ gọn:
     - Dòng 1: STT, Họ tên VĐV, Ngày sinh, Giới tính, Lớp, CCCD, Mã học sinh, Ảnh thẻ (nút tải ảnh nhỏ gọn + xem trước), Nút xóa dòng.
     - Dòng 2: Toàn bộ các trường chuyên môn riêng của môn thi (nội dung, số áo, vị trí, lứa tuổi...).
   - Giảm chiều cao và padding của ô nhập liệu (`.fc-sm`), hiển thị gọn gàng, theo dõi dễ dàng khi đăng ký nhiều VĐV.
4. **Tạo & In thẻ thi đấu theo đơn vị — Chuẩn khổ A4 (4 thẻ / trang)**:
   - Bộ lọc theo đơn vị (`#cf-dv`) giúp xuất thẻ cho từng trường/đơn vị một cách tiện lợi.
   - Định dạng in A4 chuẩn (`@page { size: A4 portrait; margin: 8mm; }`), chia đúng 4 VĐV trên một trang (2 cột x 2 dòng).
   - Đường viền nét đứt hỗ trợ việc cắt thẻ đồng đều, thẩm mỹ và chuyên nghiệp.
   - Tự động nạp sẵn toàn bộ ảnh thẻ (`S.photoCache`) để in sắc nét ngay cả khi không có kết nối mạng ổn định.
5. **Nút lưu toàn bộ danh mục & biểu mẫu nhiều môn cùng lúc**:
   - Thêm nút **💾 Lưu toàn bộ danh mục & biểu mẫu** trên thanh tiêu đề và nút **💾 Lưu toàn bộ** ở từng dòng môn thi.
   - Bấm lưu ở bất kỳ dòng nào đều sẽ lưu đồng loạt toàn bộ các môn và biểu mẫu, cập nhật giới hạn số lượng và trạng thái hoạt động ngay lập tức mà không cần bấm lưu từng dòng riêng lẻ.

---

## Điểm mới ở phiên bản v3.2.0

1. **Chuyển đổi & nén ảnh qua Canvas → lưu trên Google Drive**:
   - Ở trình duyệt, `compressImageDataUrlWithCanvas` vẽ lại ảnh người dùng tải lên vào thẻ `<canvas>` kích thước `210x280` (tỷ lệ 3x4) và nén về định dạng JPEG giảm dung lượng trước khi gửi lên GAS.
   - Ở backend, `_savePhotoToDrive` giải mã base64 và lưu thành tệp trong thư mục **`HKPD_AnhThe_VDV`** trên Google Drive; cột `AnhThe` trong Sheet chỉ lưu tham chiếu **`drive:<fileId>`**.
   - Khi VĐV đổi ảnh hoặc bị xoá hồ sơ, `_trashDriveFileIfUnused` kiểm tra nếu không còn hồ sơ nào khác dùng chung `<fileId>` thì mới chuyển tệp Drive cũ vào Thùng rác (`setTrashed(true)`).
2. **Tối ưu hiệu năng đọc/ghi & giảm quota GAS**:
   - **Tải ảnh theo nhu cầu (Lazy-load)**: `layDanhSachVDV` chỉ trả cờ boolean `coAnh` thay vì truyền chuỗi ảnh; giao diện tự nạp ảnh theo trang đang xem hoặc khi mở thẻ/modal qua `layAnhTheoDanhSach` kết hợp bộ nhớ đệm client (`S.photoCache`).
   - **Gộp RPC khởi động (`getBootstrapData`)** & **`CacheService`**: Danh mục môn và cài đặt hệ thống được cache 10 phút (`CACHE_TTL_SEC = 600`) và tự động xoá cache khi Admin cập nhật.
   - **Phân trang 50 dòng/trang** ở bảng danh sách, bảng duyệt Admin và trang Thẻ thi đấu (`#list-pager`, `#adm-pager`, `#cards-pager`).
   - **Ghi theo lô (Batch)**: `duyetHangLoat` và `taoSheetBaoCao` (`setBackgrounds`) ghi một lần thay vì gọi API theo từng dòng.
3. **Bảo mật & Toàn vẹn dữ liệu**:
   - Mật khẩu trong sheet `DonVi` được băm **SHA-256** với salt (`_hashPassword`, `_verifyPassword`, tự động nâng cấp mật khẩu cũ).
   - Toàn bộ hàm nghiệp vụ xác thực `token` phiên từ server (`_requireSession`) và kiểm tra quyền Admin khi cần; tự động đăng xuất khi token hết hạn (`authError: true`).
   - Toàn bộ thao tác ghi/sửa/xoá/duyệt đều bọc trong `LockService.getScriptLock()` (`_withLock`).
4. **Tự điền VĐV đa môn & In thẻ ổn định**:
   - Nút **Tự điền CCCD/Mã HS** (`autofillBatchRow` → `timHoSoTheoDinhDanh`) nạp lại họ tên, ngày sinh, giới tính, lớp và tái sử dụng trực tiếp tham chiếu `drive:<fileId>` khi VĐV đăng ký môn thứ 2, thứ 3.
   - In thẻ thi đấu qua cửa sổ HTML riêng (`openStandalonePrintWindow`) giúp tránh bị cắt trang bên trong `<iframe>` của Google Apps Script.

---

## Cơ chế đăng ký theo Môn & Form động (10 môn thi)

| Mã môn | Tên môn | Giới hạn mặc định / ĐV | Các trường chuyên môn riêng trên form |
| :--- | :--- | :---: | :--- |
| `DIEN_KINH` | Điền kinh | 8 | `noiDung` (chọn nhiều cự ly/nội dung), `luaTuoi`, `thanhTich` |
| `BOI_LOI` | Bơi lội | 6 | `noiDung` (chọn nhiều kiểu bơi/cự ly), `luaTuoi`, `thanhTich` |
| `CAU_LONG` | Cầu lông | 6 | `noiDung`, `banDanhCap` *(chỉ hiện & bắt buộc khi chọn nội dung Đôi)*, `tayThuan`, `thanhTich` |
| `BONG_BAN` | Bóng bàn | 6 | `noiDung`, `banDanhCap` *(chỉ hiện & bắt buộc khi chọn nội dung Đôi)*, `kieuCamVot`, `thanhTich` |
| `CO_VUA` | Cờ vua | 8 | `noiDung` (chọn nhiều thể loại cờ), `nhomTuoi`, `elo` |
| `VO_CO_TRUYEN` | Võ cổ truyền | 8 | `noiDung`, `hangCan` *(chỉ hiện & bắt buộc khi chọn Đối kháng)*, `canNang`, `dangCap` |
| `AEROBIC` | Aerobic | 12 | `noiDung`, `capHoc`, `vaiTro`, `tenNhom` |
| `KEO_CO` | Kéo co | 12 | `noiDung` (hạng cân đội), `canNang`, `vaiTro` |
| `BONG_CHUYEN` | Bóng chuyền | 14 | `noiDung`, `soAo`, `viTri`, `chieuCao` |
| `BONG_DA` | Bóng đá | 18 | `noiDung`, `soAo`, `viTri`, `chanThuan` |

---

## Cấu trúc Google Sheets (tự động tạo khi khởi tạo)

1. **`VDV`** *(20 cột)*: `ID`, `MaDonVi`, `TenDonVi`, `HoTen`, `NgaySinh`, `GioiTinh`, `Lop`, `MaMon`, `TenMon`, `NoiDung`, `ChiTietHienThi`, `ChiTietJSON`, `TrangThai`, `GhiChu`, `ThoiGianDK`, `ThoiGianDuyet`, `NguoiDuyet`, `CCCD`, `MaHocSinh`, `AnhThe`.
   - `CCCD` (9 hoặc 12 chữ số) và `MaHocSinh` dùng để đối chiếu, tự điền và chặn trùng lặp VĐV cùng môn trên toàn hệ thống.
   - `AnhThe` lưu tham chiếu tệp Drive dạng `drive:<fileId>` trong thư mục `HKPD_AnhThe_VDV`.
2. **`DonVi`**: Tài khoản đơn vị dự thi, mật khẩu lưu dạng băm `sha256:...` và trạng thái (`HoatDong` / `KhoaTaiKhoan`).
3. **`MonThi`**: Danh mục 10 môn thi, giới hạn VĐV tối đa/đơn vị và trạng thái bật/tắt đăng ký (`capNhatGioiHanMon`, `capNhatTrangThaiMon`).
4. **`CaiDat`**: Cấu hình hệ thống (`SO_MON_TOI_DA` mặc định `3`, `TRANG_THAI_DK` mặc định `MO`, `TEN_HOI_THI`).
5. **`NhatKy`**: Nhật ký thao tác hệ thống.

---

## Hướng dẫn cài đặt tự động bằng `Setup.gs`

File [`Setup.gs`](./Setup.gs) cung cấp giải pháp cài đặt và chuẩn hoá cơ sở dữ liệu hoàn toàn tự động:

### Cách 1: Chạy từ Apps Script IDE (Nhanh nhất)
1. Thêm file script mới tên **`Setup`** trong dự án Apps Script và dán nội dung từ [`Setup.gs`](./Setup.gs).
2. Tại thanh công cụ phía trên, chọn hàm **`caiDatTuDong`** và bấm **Run (Chạy)**.
3. Khi được hỏi quyền lần đầu, chọn **Review Permissions** và bấm **Allow** để cấp quyền Google Sheets & Google Drive.
4. Xem mục **Execution log** (Nhật ký thực thi) để nhận URL Bảng tính và Thư mục ảnh Drive đã được tạo tự động.

### Cách 2: Chạy trực tiếp từ Menu trên Google Sheets
Nếu dự án Apps Script được tạo từ một file Google Sheets (Container-bound script), khi mở Google Sheets sẽ xuất hiện thanh menu:
```
🏆 HKPĐ 2026
  ├── ⚙️ Cài đặt / Cập nhật cấu trúc Sheets
  ├── 📁 Kiểm tra & Tạo thư mục ảnh Drive
  ├── 🔑 Đặt lại mật khẩu ADMIN (admin@hkpd2026)
  ├── 📊 Thống kê nhanh số lượng VĐV
  ├── 🌐 Xem thông tin kết nối & URL WebApp
  └── 🧹 Dọn dẹp dữ liệu VĐV thử nghiệm (Reset VDV)
```
- Chỉ cần bấm **`⚙️ Cài đặt / Cập nhật cấu trúc Sheets`**, hệ thống sẽ tự động tạo đủ 5 sheet, đặt màu sắc chuyên nghiệp, thiết lập dropdown chọn giới tính & trạng thái duyệt, cố định dòng 1, và nạp tài khoản mẫu.

---

## Hướng dẫn triển khai Web App

1. Truy cập [script.google.com](https://script.google.com/) và tạo dự án mới (hoặc mở Apps Script gắn với Google Sheets đã cài đặt).
2. Dán nội dung các file:
   - `Code.gs` → file `Code.gs`
   - `Setup.gs` → file `Setup.gs`
   - `Index.html` → file HTML tên `Index` (không cần gõ `.html`)
3. Chạy hàm **`caiDatTuDong`** trong `Setup.gs` 1 lần để tạo cấu trúc dữ liệu và thư mục Drive.
4. Chọn **Deploy → New deployment → Web app**:
   - **Execute as**: `Me` *(bắt buộc để Web App sử dụng quyền Google Drive/Sheets tập trung của chủ sở hữu và giữ URL/tệp Drive hoạt động cho mọi đơn vị)*
   - **Who has access**: `Anyone` (hoặc theo phạm vi tổ chức)
5. Mở URL Web App sau khi deploy để sử dụng ngay.

### Tài khoản mặc định
- **Ban Tổ Chức (Admin)**: Tab Admin, mật khẩu mặc định `admin@hkpd2026` *(nên đổi ngay sau khi đăng nhập)*.
- **Đơn vị mới tạo**: Mật khẩu mặc định là `<MaDonVi>@hkpd`.
