/**
 * ================================================================
 * FILE CÀI ĐẶT & KHỞI TẠO CƠ SỞ DỮ LIỆU HKPĐ CẤP TỈNH
 * Dự án: WebApp Quản lý đăng ký HKPĐ Cấp Tỉnh (Google Apps Script)
 * Phiên bản tương thích: v3.2.0+
 * ================================================================
 *
 * MỤC ĐÍCH:
 *   File này dùng để TỰ ĐỘNG tạo toàn bộ 5 sheet dữ liệu, cấu trúc các cột,
 *   định dạng màu sắc, đóng băng dòng, thiết lập dropdown xác thực dữ liệu,
 *   tạo tài khoản ADMIN & đơn vị mẫu (băm SHA-256), nạp danh mục 10 môn thi,
 *   tham số cài đặt, và tự động tạo thư mục lưu ảnh thẻ trên Google Drive.
 *
 * CÁCH SỬ DỤNG:
 *   Cách 1 (Khuyên dùng - Chạy từ Apps Script IDE):
 *     1. Mở trình soạn thảo Google Apps Script (script.google.com).
 *     2. Chọn hàm "caiDatTuDong" ở thanh công cụ phía trên.
 *     3. Nhấn "Run" (Chạy) và cấp quyền truy cập khi được hỏi lần đầu.
 *     4. Xem kết quả chi tiết trong mục "Execution log" (Nhật ký thực thi).
 *
 *   Cách 2 (Chạy trực tiếp từ Google Sheets):
 *     1. Mở bảng tính Google Sheets liên kết với script.
 *     2. Trên thanh menu, chọn: "🏆 HKPĐ 2026" -> "⚙️ Cài đặt / Cập nhật cấu trúc Sheets".
 *
 *   Cách 3 (Cài đặt cho bảng tính bên ngoài bằng ID hoặc URL):
 *     - Chạy hàm: caiDatChoSpreadsheet('ID_HOẶC_URL_CỦA_SHEET');
 */

// ================================================================
// CẤU HÌNH HẰNG SỐ CÀI ĐẶT
// ================================================================

var SETUP_CONFIG = {
  FOLDER_ANH_THE: 'HKPD_AnhThe_VDV',
  PASSWORD_SALT: 'HKPD_SALT_2026:',
  SHEETS: {
    VDV: 'VDV',
    DONVI: 'DonVi',
    MON: 'MonThi',
    CAIDAT: 'CaiDat',
    LOG: 'NhatKy'
  },
  THEME_COLORS: {
    VDV: '#1565C0',     // Xanh dương đậm
    DONVI: '#00695C',   // Xanh ngọc lục bảo
    MON: '#E65100',     // Cam thể thao
    CAIDAT: '#37474F',  // Xám xanh
    LOG: '#455A64'      // Xám đá
  }
};

/**
 * Danh mục 10 môn thi tiêu chuẩn HKPĐ Cấp Tỉnh kèm giới hạn VĐV tối đa/đơn vị
 */
var SETUP_SPORT_DEFS = [
  { id: 'DIEN_KINH', ten: 'Điền kinh', nhom: 'Cá nhân / Tiếp sức', gioiHan: 8 },
  { id: 'BOI_LOI', ten: 'Bơi lội', nhom: 'Cá nhân / Tiếp sức', gioiHan: 6 },
  { id: 'CAU_LONG', ten: 'Cầu lông', nhom: 'Đối kháng vợt', gioiHan: 6 },
  { id: 'BONG_BAN', ten: 'Bóng bàn', nhom: 'Đối kháng vợt', gioiHan: 6 },
  { id: 'CO_VUA', ten: 'Cờ vua', nhom: 'Trí tuệ', gioiHan: 8 },
  { id: 'VO_CO_TRUYEN', ten: 'Võ cổ truyền', nhom: 'Võ thuật', gioiHan: 8 },
  { id: 'AEROBIC', ten: 'Aerobic', nhom: 'Biểu diễn nghệ thuật', gioiHan: 12 },
  { id: 'KEO_CO', ten: 'Kéo co', nhom: 'Đồng đội thể lực', gioiHan: 12 },
  { id: 'BONG_CHUYEN', ten: 'Bóng chuyền', nhom: 'Bóng tập thể', gioiHan: 14 },
  { id: 'BONG_DA', ten: 'Bóng đá', nhom: 'Bóng tập thể', gioiHan: 18 }
];

// ================================================================
// HÀM CHÍNH: CÀI ĐẶT TỰ ĐỘNG TOÀN BỘ HỆ THỐNG
// ================================================================

/**
 * Hàm khởi chạy cài đặt chính (Chạy từ Apps Script IDE hoặc Trigger)
 * Tự động nhận diện bảng tính hiện tại (Container-bound) hoặc tạo mới nếu chạy standalone.
 */
function caiDatTuDong() {
  return caiDatChoSpreadsheet(null);
}

/**
 * Cài đặt cơ sở dữ liệu cho một bảng tính cụ thể (hoặc active/tạo mới nếu target là null)
 * @param {string|null} targetIdOrUrl ID hoặc URL của Google Sheet (bỏ trống để tự nhận diện)
 */
function caiDatChoSpreadsheet(targetIdOrUrl) {
  var logs = [];
  function logMsg(msg) {
    logs.push(msg);
    Logger.log(msg);
  }

  logMsg('🚀 BẮT ĐẦU CÀI ĐẶT CƠ SỞ DỮ LIỆU HKPĐ CẤP TỈNH (v3.2.0)...');

  try {
    var ss = _layHoacTaoSpreadsheet(targetIdOrUrl, logMsg);
    var props = PropertiesService.getScriptProperties();
    props.setProperty('DB_ID', ss.getId());
    logMsg('📌 Đã liên kết DB_ID: ' + ss.getId());

    // 1. Tạo và cấu hình Sheet VDV (20 cột)
    _khoiTaoSheetVDV(ss, logMsg);

    // 2. Tạo và cấu hình Sheet DonVi (10 cột, tài khoản Admin + đơn vị mẫu)
    _khoiTaoSheetDonVi(ss, logMsg);

    // 3. Tạo và cấu hình Sheet MonThi (5 cột, 10 môn thi chuẩn)
    _khoiTaoSheetMonThi(ss, logMsg);

    // 4. Tạo và cấu hình Sheet CaiDat (3 cột, tham số giải đấu)
    _khoiTaoSheetCaiDat(ss, logMsg);

    // 5. Tạo và cấu hình Sheet NhatKy (4 cột)
    _khoiTaoSheetNhatKy(ss, logMsg);

    // 6. Xoá sheet mặc định "Sheet1" hoặc "Trang tính1" nếu trống
    _xoaSheetMacDinhThua(ss, logMsg);

    // 7. Tạo / cấu hình thư mục lưu ảnh thẻ trên Google Drive
    var folderInfo = _khoiTaoThuMucDrive(logMsg);

    // 8. Xoá bộ nhớ đệm CacheService để ứng dụng nhận dữ liệu mới ngay
    try {
      var cache = CacheService.getScriptCache();
      cache.remove('META_MON_LIST');
      cache.remove('META_CAI_DAT');
      logMsg('🔄 Đã làm mới bộ nhớ đệm CacheService.');
    } catch(e) {}

    logMsg('================================================================');
    logMsg('🎉 CÀI ĐẶT THÀNH CÔNG RỰC RỠ!');
    logMsg('🔗 URL Bảng tính: ' + ss.getUrl());
    if (folderInfo && folderInfo.url) {
      logMsg('📁 URL Thư mục ảnh thẻ Drive: ' + folderInfo.url);
    }
    logMsg('👤 Tài khoản Quản trị: ADMIN / Mật khẩu mặc định: admin@hkpd2026');
    logMsg('🏫 Các đơn vị mẫu: THPT01, THPT02, THPT03, PGD01, PGD02 (Mật khẩu: <MãĐơnVị>@hkpd)');
    logMsg('================================================================');

    return {
      ok: true,
      msg: 'Khởi tạo hệ thống thành công!',
      spreadsheetUrl: ss.getUrl(),
      spreadsheetId: ss.getId(),
      folderUrl: folderInfo ? folderInfo.url : '',
      logs: logs
    };
  } catch (err) {
    logMsg('❌ LỖI TRONG QUÁ TRÌNH CÀI ĐẶT: ' + err.message);
    if (err.stack) logMsg(err.stack);
    return {
      ok: false,
      msg: 'Lỗi cài đặt: ' + err.message,
      logs: logs
    };
  }
}

// ================================================================
// CHI TIẾT CẤU TRÚC TỪNG SHEET
// ================================================================

/**
 * 1. Sheet VDV: Lưu hồ sơ đăng ký thi đấu của vận động viên
 * 20 cột chuẩn: ID, MaDonVi, TenDonVi, HoTen, NgaySinh, GioiTinh, Lop, MaMon,
 * TenMon, NoiDung, ChiTietHienThi, ChiTietJSON, TrangThai, GhiChu, ThoiGianDK,
 * ThoiGianDuyet, NguoiDuyet, CCCD, MaHocSinh, AnhThe.
 */
function _khoiTaoSheetVDV(ss, log) {
  var sheetName = SETUP_CONFIG.SHEETS.VDV;
  var headers = [
    'ID',             // 1. Mã định danh hồ sơ VĐV (UUID)
    'MaDonVi',        // 2. Mã đơn vị đăng ký (VD: THPT01)
    'TenDonVi',       // 3. Tên trường / Phòng GD&ĐT
    'HoTen',          // 4. Họ và tên vận động viên
    'NgaySinh',       // 5. Ngày sinh định dạng dd/MM/yyyy
    'GioiTinh',       // 6. Giới tính (Nam / Nữ)
    'Lop',            // 7. Lớp / Cấp học
    'MaMon',          // 8. Mã môn thi (VD: BONG_DA, DIEN_KINH)
    'TenMon',         // 9. Tên môn thi đấu
    'NoiDung',        // 10. Nội dung đăng ký tóm tắt
    'ChiTietHienThi', // 11. Chuỗi hiển thị chuyên môn nhanh
    'ChiTietJSON',    // 12. Dữ liệu form chuyên môn dạng JSON
    'TrangThai',      // 13. ChoDuyet / DaDuyet / TuChoi
    'GhiChu',         // 14. Ghi chú của đơn vị hoặc lý do từ chối
    'ThoiGianDK',     // 15. Thời gian đăng ký (ISO 8601)
    'ThoiGianDuyet',  // 16. Thời gian duyệt hồ sơ
    'NguoiDuyet',     // 17. Tài khoản duyệt hồ sơ
    'CCCD',           // 18. Số CCCD / Định danh cá nhân (9 hoặc 12 số)
    'MaHocSinh',      // 19. Mã học sinh trên CSDL ngành
    'AnhThe'          // 20. Tham chiếu ảnh trên Drive: 'drive:<fileId>'
  ];

  var widths = [
    110, 80, 180, 170, 95, 75, 70, 110, 110, 180,
    220, 150, 95, 160, 140, 140, 100, 120, 110, 140
  ];

  var sheet = _layHoacTaoSheet(ss, sheetName);
  _apDungHeader(sheet, headers, SETUP_CONFIG.THEME_COLORS.VDV, widths);

  // Định dạng định danh và chuỗi cho các cột đặc thù (tránh mất số 0 ở đầu)
  try {
    sheet.getRange('E2:E').setNumberFormat('@'); // NgaySinh dạng text dd/MM/yyyy
    sheet.getRange('R2:R').setNumberFormat('@'); // CCCD dạng text
    sheet.getRange('S2:S').setNumberFormat('@'); // MaHocSinh dạng text
    sheet.getRange('T2:T').setNumberFormat('@'); // AnhThe dạng text 'drive:...'
  } catch(e) {}

  // Thiết lập Data Validation dropdown nếu môi trường hỗ trợ
  try {
    if (SpreadsheetApp.newDataValidation) {
      // Cột Giới tính (cột 6)
      var ruleGT = SpreadsheetApp.newDataValidation()
        .requireValueInList(['Nam', 'Nữ'], true)
        .setAllowInvalid(true)
        .build();
      sheet.getRange(2, 6, Math.max(sheet.getMaxRows() - 1, 100), 1).setDataValidation(ruleGT);

      // Cột Trạng thái duyệt (cột 13)
      var ruleTT = SpreadsheetApp.newDataValidation()
        .requireValueInList(['ChoDuyet', 'DaDuyet', 'TuChoi'], true)
        .setAllowInvalid(true)
        .build();
      sheet.getRange(2, 13, Math.max(sheet.getMaxRows() - 1, 100), 1).setDataValidation(ruleTT);
    }
  } catch(e) {}

  log('  + Đã tạo/cập nhật Sheet [' + sheetName + '] với 20 cột dữ liệu.');
}

/**
 * 2. Sheet DonVi: Quản lý tài khoản đăng nhập của các đơn vị dự thi & Admin
 * 10 cột: MaDonVi, TenDonVi, LoaiDonVi, Email, DienThoai, NguoiLienHe, DiaChi, MatKhau, TrangThai, NgayTao.
 */
function _khoiTaoSheetDonVi(ss, log) {
  var sheetName = SETUP_CONFIG.SHEETS.DONVI;
  var headers = [
    'MaDonVi',     // 1. Tên đăng nhập (Khóa chính)
    'TenDonVi',    // 2. Tên đầy đủ của trường / phòng GD
    'LoaiDonVi',   // 3. Trường THPT / Trường THCS / Phòng GD&ĐT / Admin
    'Email',       // 4. Email liên hệ
    'DienThoai',   // 5. Số điện thoại liên hệ
    'NguoiLienHe', // 6. Trưởng đoàn / Cán bộ phụ trách
    'DiaChi',      // 7. Địa chỉ đơn vị
    'MatKhau',     // 8. Mật khẩu băm SHA-256 (sha256:...)
    'TrangThai',   // 9. HoatDong / KhoaTaiKhoan
    'NgayTao'      // 10. Ngày tạo tài khoản
  ];

  var widths = [100, 220, 130, 180, 110, 140, 200, 160, 110, 140];

  var sheet = _layHoacTaoSheet(ss, sheetName);
  _apDungHeader(sheet, headers, SETUP_CONFIG.THEME_COLORS.DONVI, widths);

  try {
    sheet.getRange('A2:A').setNumberFormat('@');
    sheet.getRange('E2:E').setNumberFormat('@');
    sheet.getRange('H2:H').setNumberFormat('@'); // Mật khẩu băm
  } catch(e) {}

  // Thiết lập Data Validation cho cột TrangThai (cột 9)
  try {
    if (SpreadsheetApp.newDataValidation) {
      var rule = SpreadsheetApp.newDataValidation()
        .requireValueInList(['HoatDong', 'KhoaTaiKhoan'], true)
        .setAllowInvalid(true)
        .build();
      sheet.getRange(2, 9, Math.max(sheet.getMaxRows() - 1, 50), 1).setDataValidation(rule);
    }
  } catch(e) {}

  // Nạp tài khoản ADMIN mặc định và các đơn vị mẫu nếu sheet còn trống
  if (sheet.getLastRow() <= 1) {
    var now = new Date().toISOString();
    var sampleUnits = [
      [
        'ADMIN', 'Ban Tổ Chức HKPĐ Cấp Tỉnh', 'Admin',
        'admin@hkpd.vn', '028.38221234', 'Quản trị viên', 'Sở Giáo dục và Đào tạo',
        _bapMatKhau('admin@hkpd2026'), 'HoatDong', now
      ],
      [
        'THPT01', 'Trường THPT Chuyên Lê Hồng Phong', 'Trường THPT',
        'thpt01@hkpd.vn', '028.38398506', 'Thầy Nguyễn Văn A', '235 Nguyễn Văn Cừ, Q.5',
        _bapMatKhau('THPT01@hkpd'), 'HoatDong', now
      ],
      [
        'THPT02', 'Trường THPT Nguyễn Thị Minh Khai', 'Trường THPT',
        'thpt02@hkpd.vn', '028.39301416', 'Cô Trần Thị B', '275 Điện Biên Phủ, Q.3',
        _bapMatKhau('THPT02@hkpd'), 'HoatDong', now
      ],
      [
        'THPT03', 'Trường THPT Gia Định', 'Trường THPT',
        'thpt03@hkpd.vn', '028.38412644', 'Thầy Lê Văn C', '44 Đường D2, Bình Thạnh',
        _bapMatKhau('THPT03@hkpd'), 'HoatDong', now
      ],
      [
        'PGD01', 'Phòng GD&ĐT Quận 1', 'Phòng GD&ĐT',
        'pgd01@hkpd.vn', '028.38223456', 'Thầy Phạm Văn D', '12 Lê Duẩn, Quận 1',
        _bapMatKhau('PGD01@hkpd'), 'HoatDong', now
      ],
      [
        'PGD02', 'Phòng GD&ĐT Thành phố Thủ Đức', 'Phòng GD&ĐT',
        'pgdthuduc@hkpd.vn', '028.37221234', 'Cô Hoàng Thị E', '43 Thống Nhất, TP. Thủ Đức',
        _bapMatKhau('PGD02@hkpd'), 'HoatDong', now
      ]
    ];

    sheet.getRange(2, 1, sampleUnits.length, headers.length).setValues(sampleUnits);
    log('  + Đã nạp tài khoản ADMIN và 5 đơn vị mẫu (mật khẩu băm SHA-256 an toàn).');
  } else {
    log('  + Sheet [' + sheetName + '] đã có dữ liệu, giữ nguyên tài khoản hiện hữu.');
  }
}

/**
 * 3. Sheet MonThi: Quản lý danh mục các môn thi đấu, giới hạn số VĐV/đơn vị & trạng thái
 * 5 cột: MaMon, TenMon, Nhom, GioiHan, TrangThai.
 */
function _khoiTaoSheetMonThi(ss, log) {
  var sheetName = SETUP_CONFIG.SHEETS.MON;
  var headers = [
    'MaMon',         // 1. Mã định danh môn
    'TenMon',        // 2. Tên môn thi đấu
    'Nhom',          // 3. Phân nhóm môn thi
    'GioiHan',       // 4. Số lượng VĐV tối đa mỗi đơn vị được đăng ký
    'TrangThai',     // 5. HoatDong / Tat
    'CauHinhFields'  // 6. Cấu hình JSON các trường & nội dung thi đấu riêng
  ];

  var widths = [120, 160, 180, 100, 110, 260];

  var sheet = _layHoacTaoSheet(ss, sheetName);
  _apDungHeader(sheet, headers, SETUP_CONFIG.THEME_COLORS.MON, widths);

  // Dropdown cho cột TrangThai (cột 5)
  try {
    if (SpreadsheetApp.newDataValidation) {
      var rule = SpreadsheetApp.newDataValidation()
        .requireValueInList(['HoatDong', 'Tat'], true)
        .setAllowInvalid(true)
        .build();
      sheet.getRange(2, 5, Math.max(sheet.getMaxRows() - 1, 20), 1).setDataValidation(rule);
    }
  } catch(e) {}

  if (sheet.getLastRow() <= 1) {
    var rows = SETUP_SPORT_DEFS.map(function(m) {
      var flds = [];
      if (typeof SPORT_DEFS !== 'undefined') {
        var found = SPORT_DEFS.find(function(x){ return x.id === m.id; });
        if (found && found.fields) flds = found.fields;
      }
      return [m.id, m.ten, m.nhom, m.gioiHan, 'HoatDong', JSON.stringify(flds)];
    });
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
    log('  + Đã nạp 10 môn thi tiêu chuẩn HKPĐ Cấp Tỉnh vào Sheet [' + sheetName + '].');
  } else {
    log('  + Sheet [' + sheetName + '] đã có danh mục môn, giữ nguyên.');
  }
}

/**
 * 4. Sheet CaiDat: Lưu các tham số cấu hình hệ thống
 * 3 cột: Khoa, GiaTri, MoTa.
 */
function _khoiTaoSheetCaiDat(ss, log) {
  var sheetName = SETUP_CONFIG.SHEETS.CAIDAT;
  var headers = ['Khoa', 'GiaTri', 'MoTa'];
  var widths = [160, 220, 320];

  var sheet = _layHoacTaoSheet(ss, sheetName);
  _apDungHeader(sheet, headers, SETUP_CONFIG.THEME_COLORS.CAIDAT, widths);

  try {
    sheet.getRange('A2:A').setNumberFormat('@');
    sheet.getRange('B2:B').setNumberFormat('@');
  } catch(e) {}

  if (sheet.getLastRow() <= 1) {
    var defaultConfigs = [
      ['TRANG_THAI_DK',    'MO',                 'Trạng thái cổng đăng ký trực tuyến: MO (Mở) / DONG (Đóng)'],
      ['SO_MON_TOI_DA',    '3',                  'Số môn thi tối đa mỗi VĐV được phép tham gia'],
      ['TEN_HOI_THI',      'HKPĐ CẤP TỈNH 2026', 'Tên chính thức của Hội thi'],
      ['DON_VI_TO_CHUC',   'SỞ GIÁO DỤC VÀ ĐÀO TẠO', 'Cơ quan chỉ đạo tổ chức'],
      ['NAM_TO_CHUC',      '2026',               'Năm diễn ra giải đấu'],
      ['THOI_HAN_DANG_KY', '31/12/2026',         'Hạn chót tiếp nhận hồ sơ đăng ký'],
      ['DIA_DIEM_THI_DAU', 'Trung tâm TDTT Tỉnh', 'Địa điểm thi đấu chính']
    ];
    sheet.getRange(2, 1, defaultConfigs.length, headers.length).setValues(defaultConfigs);
    log('  + Đã nạp các tham số cài đặt hệ thống vào Sheet [' + sheetName + '].');
  } else {
    log('  + Sheet [' + sheetName + '] đã có cài đặt, giữ nguyên.');
  }
}

/**
 * 5. Sheet NhatKy: Nhật ký hoạt động và kiểm toán hệ thống
 * 4 cột: ThoiGian, NguoiDung, HanhDong, ChiTiet.
 */
function _khoiTaoSheetNhatKy(ss, log) {
  var sheetName = SETUP_CONFIG.SHEETS.LOG;
  var headers = ['ThoiGian', 'NguoiDung', 'HanhDong', 'ChiTiet'];
  var widths = [160, 110, 150, 350];

  var sheet = _layHoacTaoSheet(ss, sheetName);
  _apDungHeader(sheet, headers, SETUP_CONFIG.THEME_COLORS.LOG, widths);

  if (sheet.getLastRow() <= 1) {
    sheet.appendRow([
      new Date().toISOString(),
      'HE_THONG',
      'KHOI_TAO_SHEETS',
      'Tự động khởi tạo cấu trúc cơ sở dữ liệu và các cột chuẩn thành công'
    ]);
    log('  + Đã ghi log khởi tạo đầu tiên vào Sheet [' + sheetName + '].');
  }
}

// ================================================================
// QUẢN LÝ THƯ MỤC GOOGLE DRIVE LƯU ẢNH THẺ
// ================================================================

/**
 * Tạo hoặc tìm thư mục 'HKPD_AnhThe_VDV' trên Google Drive và lưu ID vào ScriptProperties
 */
function _khoiTaoThuMucDrive(log) {
  try {
    var props = PropertiesService.getScriptProperties();
    var folderName = SETUP_CONFIG.FOLDER_ANH_THE;
    var existingFid = props.getProperty('PHOTO_FOLDER_ID');
    var folder = null;

    if (existingFid) {
      try {
        var f = DriveApp.getFolderById(existingFid);
        if (f && !f.isTrashed()) folder = f;
      } catch(e) {}
    }

    if (!folder) {
      var it = DriveApp.getFoldersByName(folderName);
      while (it.hasNext()) {
        var candidate = it.next();
        if (!candidate.isTrashed()) {
          folder = candidate;
          break;
        }
      }
    }

    if (!folder) {
      folder = DriveApp.createFolder(folderName);
      log('  + Đã tạo mới thư mục Google Drive: [' + folderName + ']');
    } else {
      log('  + Đã kết nối thư mục Google Drive hiện có: [' + folderName + ']');
    }

    props.setProperty('PHOTO_FOLDER_ID', folder.getId());
    return { id: folder.getId(), url: folder.getUrl(), name: folderName };
  } catch(e) {
    log('  ⚠️ Cảnh báo tạo thư mục Drive (có thể do quyền hạn): ' + e.message);
    return null;
  }
}

// ================================================================
// CÁC HÀM TIỆN ÍCH HỖ TRỢ ĐỊNH DẠNG & BẢO MẬT
// ================================================================

function _layHoacTaoSpreadsheet(targetIdOrUrl, log) {
  var props = PropertiesService.getScriptProperties();

  // 1. Nếu có ID hoặc URL được truyền vào
  if (targetIdOrUrl) {
    var str = String(targetIdOrUrl).trim();
    var idMatch = str.match(/\/d\/([a-zA-Z0-9-_]+)/);
    var id = idMatch ? idMatch[1] : str;
    try {
      var targetSs = SpreadsheetApp.openById(id);
      log('📂 Mở bảng tính được chỉ định theo ID/URL: ' + targetSs.getName());
      return targetSs;
    } catch(e) {
      log('⚠️ Không mở được sheet theo ID chỉ định, chuyển sang cơ chế tự động.');
    }
  }

  // 2. Kiểm tra nếu script được gắn vào bảng tính (Container-bound)
  try {
    var active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) {
      log('📂 Sử dụng Bảng tính hiện tại đang liên kết script: ' + active.getName());
      return active;
    }
  } catch(e) {}

  // 3. Kiểm tra DB_ID đã lưu trong Script Properties
  var savedId = props.getProperty('DB_ID');
  if (savedId) {
    try {
      var savedSs = SpreadsheetApp.openById(savedId);
      log('📂 Mở Bảng tính đã lưu trong ScriptProperties: ' + savedSs.getName());
      return savedSs;
    } catch(e) {}
  }

  // 4. Tạo mới bảng tính Google Sheets nếu chưa có
  var newName = 'HKPD_CapTinh_' + new Date().getFullYear();
  var newSs = SpreadsheetApp.create(newName);
  log('✨ Đã tạo mới Bảng tính Google Sheets: [' + newName + ']');
  return newSs;
}

function _layHoacTaoSheet(ss, name) {
  var s = ss.getSheetByName(name);
  if (!s) {
    s = ss.insertSheet(name);
  }
  return s;
}

function _apDungHeader(sheet, headers, bgHex, widths) {
  var lastCol = sheet.getLastColumn();
  var needCols = headers.length;

  // Mở rộng số cột nếu sheet hiện tại chưa đủ
  if (sheet.getMaxColumns() < needCols) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), needCols - sheet.getMaxColumns());
  }

  var headerRange = sheet.getRange(1, 1, 1, needCols);
  headerRange.setValues([headers]);

  // Áp dụng kiểu dáng tiêu đề chuyên nghiệp
  try {
    headerRange.setBackground(bgHex || '#1565C0')
      .setFontColor('#FFFFFF')
      .setFontWeight('bold')
      .setFontSize(10)
      .setHorizontalAlignment('center')
      .setVerticalAlignment('middle')
      .setWrap(true);

    sheet.setRowHeight(1, 38);
    sheet.setFrozenRows(1);

    // Cài đặt độ rộng cột tối ưu
    if (Array.isArray(widths)) {
      for (var i = 0; i < widths.length; i++) {
        sheet.setColumnWidth(i + 1, widths[i]);
      }
    }
  } catch(e) {}
}

function _xoaSheetMacDinhThua(ss, log) {
  var defaultNames = ['Sheet1', 'Trang tính1', 'Trang tính 1'];
  for (var i = 0; i < defaultNames.length; i++) {
    var def = ss.getSheetByName(defaultNames[i]);
    if (def && ss.getSheets().length > 1 && def.getLastRow() === 0) {
      try {
        ss.deleteSheet(def);
        log('  + Đã dọn dẹp sheet trống mặc định [' + defaultNames[i] + '].');
      } catch(e) {}
    }
  }
}

/**
 * Thuật toán băm mật khẩu SHA-256 kèm SALT (tương thích 100% với Code.gs v3.2.0)
 */
function _bapMatKhau(pw) {
  var raw = SETUP_CONFIG.PASSWORD_SALT + String(pw || '');
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, raw);
  var hex = '';
  for (var i = 0; i < digest.length; i++) {
    var b = (digest[i] < 0 ? digest[i] + 256 : digest[i]).toString(16);
    hex += (b.length === 1 ? '0' : '') + b;
  }
  return 'sha256:' + hex;
}

// ================================================================
// TÍCH HỢP MENU TRÊN GOOGLE SHEETS (onOpen)
// ================================================================

/**
 * Tự động tạo Menu khi mở file Google Sheets liên kết
 */
function onOpen() {
  try {
    var ui = SpreadsheetApp.getUi();
    ui.createMenu('🏆 HKPĐ 2026')
      .addItem('⚙️ Cài đặt / Cập nhật cấu trúc Sheets', 'menuCaiDatSheets')
      .addItem('📁 Kiểm tra & Tạo thư mục ảnh Drive', 'menuKiemTraThuMucDrive')
      .addSeparator()
      .addItem('🔑 Đặt lại mật khẩu ADMIN (admin@hkpd2026)', 'menuDatLaiMatKhauAdmin')
      .addItem('📊 Thống kê nhanh số lượng VĐV', 'menuThongKeNhanh')
      .addItem('🌐 Xem thông tin kết nối & URL WebApp', 'menuThongTinKetNoi')
      .addSeparator()
      .addItem('🧹 Dọn dẹp dữ liệu VĐV thử nghiệm (Reset VDV)', 'menuResetDuLieuVDV')
      .addToUi();
  } catch(e) {}
}

function menuCaiDatSheets() {
  var ui = SpreadsheetApp.getUi();
  var resp = ui.alert('Xác nhận cài đặt',
    'Hệ thống sẽ kiểm tra và tự động khởi tạo 5 sheet dữ liệu (VDV, DonVi, MonThi, CaiDat, NhatKy) kèm định dạng cột chuẩn.\n\nDữ liệu VĐV và tài khoản hiện có sẽ KHÔNG bị mất.\n\nBạn có muốn tiếp tục?',
    ui.ButtonSet.YES_NO);

  if (resp === ui.Button.YES) {
    var res = caiDatTuDong();
    if (res.ok) {
      ui.alert('Thành công', 'Khởi tạo cấu trúc bảng tính thành công!\n\nURL: ' + res.spreadsheetUrl, ui.ButtonSet.OK);
    } else {
      ui.alert('Có lỗi', 'Lỗi: ' + res.msg, ui.ButtonSet.OK);
    }
  }
}

function menuKiemTraThuMucDrive() {
  var ui = SpreadsheetApp.getUi();
  var logFunc = function(m) { Logger.log(m); };
  var res = _khoiTaoThuMucDrive(logFunc);
  if (res && res.url) {
    ui.alert('Thư mục ảnh Google Drive', 'Thư mục: ' + res.name + '\nID: ' + res.id + '\n\nĐường dẫn:\n' + res.url, ui.ButtonSet.OK);
  } else {
    ui.alert('Lỗi', 'Không thể tạo hoặc kết nối thư mục Google Drive.', ui.ButtonSet.OK);
  }
}

function menuDatLaiMatKhauAdmin() {
  var ui = SpreadsheetApp.getUi();
  var resp = ui.alert('Đặt lại mật khẩu ADMIN',
    'Mật khẩu tài khoản ADMIN sẽ được đặt lại về mặc định: "admin@hkpd2026".\n\nBạn có chắc chắn muốn thực hiện?',
    ui.ButtonSet.YES_NO);

  if (resp !== ui.Button.YES) return;

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var s = ss ? ss.getSheetByName(SETUP_CONFIG.SHEETS.DONVI) : null;
    if (!s) {
      ui.alert('Lỗi', 'Không tìm thấy Sheet DonVi!', ui.ButtonSet.OK);
      return;
    }
    var data = s.getDataRange().getValues();
    var found = false;
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]).toUpperCase() === 'ADMIN') {
        s.getRange(i + 1, 8).setValue(_bapMatKhau('admin@hkpd2026'));
        found = true;
        break;
      }
    }
    if (found) {
      ui.alert('Thành công', 'Đã đặt lại mật khẩu ADMIN thành công!\nMật khẩu mới: admin@hkpd2026', ui.ButtonSet.OK);
    } else {
      ui.alert('Không tìm thấy', 'Chưa có tài khoản ADMIN trong Sheet DonVi!', ui.ButtonSet.OK);
    }
  } catch(e) {
    ui.alert('Lỗi', e.message, ui.ButtonSet.OK);
  }
}

function menuThongKeNhanh() {
  var ui = SpreadsheetApp.getUi();
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sVdv = ss.getSheetByName(SETUP_CONFIG.SHEETS.VDV);
    var sDv = ss.getSheetByName(SETUP_CONFIG.SHEETS.DONVI);
    var sMon = ss.getSheetByName(SETUP_CONFIG.SHEETS.MON);

    var totalVdv = sVdv ? Math.max(0, sVdv.getLastRow() - 1) : 0;
    var totalDv = sDv ? Math.max(0, sDv.getLastRow() - 1) : 0;
    var totalMon = sMon ? Math.max(0, sMon.getLastRow() - 1) : 0;

    var choDuyet = 0, daDuyet = 0, tuChoi = 0;
    if (sVdv && totalVdv > 0) {
      var statusVals = sVdv.getRange(2, 13, totalVdv, 1).getValues();
      for (var i = 0; i < statusVals.length; i++) {
        var st = String(statusVals[i][0]);
        if (st === 'DaDuyet') daDuyet++;
        else if (st === 'TuChoi') tuChoi++;
        else choDuyet++;
      }
    }

    var msg = '📊 THỐNG KÊ NHANH HỆ THỐNG:\n' +
      '-----------------------------------------\n' +
      '• Tổng số đơn vị: ' + totalDv + '\n' +
      '• Số môn thi đấu: ' + totalMon + '\n' +
      '• Tổng hồ sơ VĐV đăng ký: ' + totalVdv + '\n' +
      '   - Đang chờ duyệt: ' + choDuyet + '\n' +
      '   - Đã phê duyệt: ' + daDuyet + '\n' +
      '   - Bị từ chối: ' + tuChoi;

    ui.alert('Thống kê HKPĐ', msg, ui.ButtonSet.OK);
  } catch(e) {
    ui.alert('Lỗi', e.message, ui.ButtonSet.OK);
  }
}

function menuThongTinKetNoi() {
  var ui = SpreadsheetApp.getUi();
  try {
    var props = PropertiesService.getScriptProperties();
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var dbId = props.getProperty('DB_ID') || (ss ? ss.getId() : 'Chưa thiết lập');
    var photoId = props.getProperty('PHOTO_FOLDER_ID') || 'Chưa thiết lập';

    var msg = 'ℹ️ THÔNG TIN KẾT NỐI HỆ THỐNG:\n' +
      '-----------------------------------------\n' +
      '• Spreadsheet ID: ' + dbId + '\n' +
      '• Bảng tính URL:\n' + (ss ? ss.getUrl() : 'N/A') + '\n\n' +
      '• Drive Photo Folder ID: ' + photoId + '\n\n' +
      '💡 Để triển khai WebApp: Chọn Deploy -> New deployment -> Web app -> Execute as: "Me" -> Access: "Anyone".';

    ui.alert('Thông tin kết nối', msg, ui.ButtonSet.OK);
  } catch(e) {
    ui.alert('Lỗi', e.message, ui.ButtonSet.OK);
  }
}

function menuResetDuLieuVDV() {
  var ui = SpreadsheetApp.getUi();
  var resp = ui.alert('⚠️ CẢNH BÁO DỌN DẸP DỮ LIỆU',
    'Thao tác này sẽ XOÁ TOÀN BỘ dữ liệu đăng ký VĐV trong Sheet "VDV" (chỉ giữ lại hàng tiêu đề 20 cột) và làm sạch nhật ký.\n\nTài khoản các đơn vị, 10 môn thi và cài đặt giải đấu VẪN ĐƯỢC GIỮ NGUYÊN.\n\nBạn có CHẮC CHẮN muốn xoá sạch dữ liệu VĐV?',
    ui.ButtonSet.YES_NO);

  if (resp !== ui.Button.YES) return;

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sVdv = ss.getSheetByName(SETUP_CONFIG.SHEETS.VDV);
    if (sVdv && sVdv.getLastRow() > 1) {
      sVdv.deleteRows(2, sVdv.getLastRow() - 1);
    }
    var sLog = ss.getSheetByName(SETUP_CONFIG.SHEETS.LOG);
    if (sLog && sLog.getLastRow() > 1) {
      sLog.deleteRows(2, sLog.getLastRow() - 1);
      sLog.appendRow([new Date().toISOString(), 'ADMIN', 'RESET_DATA', 'Đã xoá dữ liệu VĐV thử nghiệm']);
    }
    ui.alert('Hoàn tất', 'Đã xoá sạch dữ liệu VĐV thử nghiệm và đưa hệ thống về trạng thái sẵn sàng nhận đăng ký chính thức!', ui.ButtonSet.OK);
  } catch(e) {
    ui.alert('Lỗi', e.message, ui.ButtonSet.OK);
  }
}
