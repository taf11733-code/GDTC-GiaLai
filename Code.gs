/**
 * ================================================================
 * WEBAPP QUẢN LÝ ĐĂNG KÝ HKPĐ CẤP TỈNH
 * Hội Khỏe Phù Đổng - Đăng ký theo Môn (Form động + Batch + Drive + Token + Lock)
 * Phiên bản: 3.2.0
 * ================================================================
 *
 * CẤU TRÚC GOOGLE SHEETS (tự động tạo khi khởi tạo):
 *   - VDV      : 20 cột (lưu chi tiết theo môn + CCCD + MaHocSinh + AnhThe 'drive:<fileId>')
 *   - DonVi    : Tài khoản các đơn vị dự thi (Mật khẩu băm SHA-256)
 *   - MonThi   : Danh mục 10 môn thi & giới hạn VĐV/đơn vị
 *   - CaiDat   : Cài đặt hệ thống
 *   - NhatKy   : Nhật ký hoạt động
 */

// ================================================================
// HẰNG SỐ CẤU HÌNH & SCHEMA TỪNG MÔN THI
// ================================================================

var SHEET = {
  VDV    : 'VDV',
  DONVI  : 'DonVi',
  MON    : 'MonThi',
  CAIDAT : 'CaiDat',
  LOG    : 'NhatKy'
};

var CACHE_TTL_SEC = 600;       // 10 phút cho danh mục/cài đặt
var SESSION_TTL_SEC = 21600;   // 6 giờ cho phiên đăng nhập
var PASSWORD_SALT = 'HKPD_SALT_2026:';
var PHOTO_FOLDER_NAME = 'HKPD_AnhThe_VDV';

/**
 * Định nghĩa các môn thi và bộ trường dữ liệu (form) riêng của từng môn.
 * Backend và Frontend dùng chung cấu trúc này.
 */
var SPORT_DEFS = [
  {
    id: 'DIEN_KINH', ten: 'Điền kinh', nhom: 'Cá nhân / Tiếp sức', icon: '🏃', gioiHan: 8,
    fields: [
      { key: 'noiDung', label: 'Nội dung thi đấu', type: 'checkboxes', required: true,
        options: ['100m', '200m', '400m', '800m', '1500m', '3000m', 'Nhảy cao', 'Nhảy xa', 'Đẩy tạ', 'Tiếp sức 4x100m'] },
      { key: 'luaTuoi', label: 'Cấp / Lứa tuổi', type: 'select', required: true,
        options: ['Tiểu học', 'THCS (12-13 tuổi)', 'THCS (14-15 tuổi)', 'THPT'] },
      { key: 'thanhTich', label: 'Thành tích tốt nhất (giây / mét)', type: 'text', required: false, placeholder: 'VD: 12.45s hoặc 5m20' }
    ]
  },
  {
    id: 'BOI_LOI', ten: 'Bơi lội', nhom: 'Cá nhân / Tiếp sức', icon: '🏊', gioiHan: 6,
    fields: [
      { key: 'noiDung', label: 'Kiểu bơi / Cự ly', type: 'checkboxes', required: true,
        options: ['Tự do 50m', 'Tự do 100m', 'Bơi ngửa 50m', 'Bơi ếch 50m', 'Bơi ếch 100m', 'Bơi bướm 50m', 'Tiếp sức 4x50m'] },
      { key: 'luaTuoi', label: 'Cấp / Lứa tuổi', type: 'select', required: true,
        options: ['Tiểu học', 'THCS (12-13 tuổi)', 'THCS (14-15 tuổi)', 'THPT'] },
      { key: 'thanhTich', label: 'Thành tích tốt nhất', type: 'text', required: false, placeholder: 'VD: 31.80s' }
    ]
  },
  {
    id: 'CAU_LONG', ten: 'Cầu lông', nhom: 'Đối kháng vợt', icon: '🏸', gioiHan: 6,
    fields: [
      { key: 'noiDung', label: 'Nội dung thi đấu', type: 'select', required: true,
        options: ['Đơn nam', 'Đơn nữ', 'Đôi nam', 'Đôi nữ', 'Đôi nam nữ', 'Đồng đội'] },
      { key: 'banDanhCap', label: 'Họ tên VĐV đánh cặp', type: 'text', required: true,
        placeholder: 'Nhập tên đồng đội cùng cặp', showIf: { key: 'noiDung', contains: 'Đôi' } },
      { key: 'tayThuan', label: 'Tay thuận', type: 'select', required: true,
        options: ['Tay phải', 'Tay trái'] },
      { key: 'thanhTich', label: 'Thành tích cấp huyện/cụm', type: 'text', required: false, placeholder: 'VD: Giải Nhất cấp huyện' }
    ]
  },
  {
    id: 'BONG_BAN', ten: 'Bóng bàn', nhom: 'Đối kháng vợt', icon: '🏓', gioiHan: 6,
    fields: [
      { key: 'noiDung', label: 'Nội dung thi đấu', type: 'select', required: true,
        options: ['Đơn nam', 'Đơn nữ', 'Đôi nam', 'Đôi nữ', 'Đôi nam nữ', 'Đồng đội'] },
      { key: 'banDanhCap', label: 'Họ tên VĐV đánh cặp', type: 'text', required: true,
        placeholder: 'Nhập tên đồng đội cùng cặp', showIf: { key: 'noiDung', contains: 'Đôi' } },
      { key: 'kieuCamVot', label: 'Kiểu cầm vợt', type: 'select', required: true,
        options: ['Vợt ngang', 'Vợt dọc'] },
      { key: 'thanhTich', label: 'Thành tích nổi bật', type: 'text', required: false, placeholder: 'VD: HCĐ năm trước' }
    ]
  },
  {
    id: 'CO_VUA', ten: 'Cờ vua', nhom: 'Trí tuệ', icon: '♟️', gioiHan: 8,
    fields: [
      { key: 'noiDung', label: 'Thể loại cờ', type: 'checkboxes', required: true,
        options: ['Cờ tiêu chuẩn', 'Cờ nhanh', 'Cờ chớp'] },
      { key: 'nhomTuoi', label: 'Nhóm tuổi (Bảng)', type: 'select', required: true,
        options: ['U7 - U9 (Tiểu học)', 'U10 - U11 (Tiểu học)', 'U12 - U13 (THCS)', 'U14 - U15 (THCS)', 'U16 - U18 (THPT)'] },
      { key: 'elo', label: 'Hệ số Elo / Kiện tướng (nếu có)', type: 'text', required: false, placeholder: 'VD: 1450 hoặc Không' }
    ]
  },
  {
    id: 'VO_CO_TRUYEN', ten: 'Võ cổ truyền', nhom: 'Võ thuật', icon: '🥋', gioiHan: 8,
    fields: [
      { key: 'noiDung', label: 'Nội dung thi đấu', type: 'select', required: true,
        options: ['Quyền quy định', 'Quyền tự chọn', 'Binh khí', 'Đối kháng'] },
      { key: 'hangCan', label: 'Hạng cân (kg)', type: 'select', required: true,
        options: ['Dưới 42kg', '42kg - 45kg', '45kg - 48kg', '48kg - 52kg', '52kg - 56kg', '56kg - 60kg', 'Trên 60kg'],
        showIf: { key: 'noiDung', equals: 'Đối kháng' } },
      { key: 'canNang', label: 'Cân nặng hiện tại (kg)', type: 'number', required: true, placeholder: 'VD: 47' },
      { key: 'dangCap', label: 'Đẳng cấp / Đai', type: 'text', required: false, placeholder: 'VD: Hoàng đai I' }
    ]
  },
  {
    id: 'AEROBIC', ten: 'Aerobic', nhom: 'Thể dục', icon: '🤸', gioiHan: 12,
    fields: [
      { key: 'noiDung', label: 'Nội dung biểu diễn', type: 'select', required: true,
        options: ['Bài quy định', 'Bài tự chọn 3 người', 'Bài tự chọn 5 người', 'Nhóm 8 người'] },
      { key: 'capHoc', label: 'Cấp học', type: 'select', required: true,
        options: ['Tiểu học', 'THCS', 'THPT'] },
      { key: 'vaiTro', label: 'Vai trò trong đội', type: 'select', required: true,
        options: ['Đội trưởng', 'Thành viên chính thức', 'Dự bị'] },
      { key: 'tenNhom', label: 'Mã / Tên tổ đội (nếu nhiều đội)', type: 'text', required: false, placeholder: 'VD: Đội 1 - Bài tự chọn' }
    ]
  },
  {
    id: 'KEO_CO', ten: 'Kéo co', nhom: 'Sức mạnh đồng đội', icon: '🪢', gioiHan: 12,
    fields: [
      { key: 'noiDung', label: 'Hạng cân đội', type: 'select', required: true,
        options: ['Nam dưới 480kg', 'Nữ dưới 420kg', 'Nam nữ phối hợp dưới 460kg', 'THPT dưới 520kg'] },
      { key: 'canNang', label: 'Cân nặng VĐV (kg)', type: 'number', required: true, placeholder: 'VD: 54' },
      { key: 'vaiTro', label: 'Vị trí / Vai trò', type: 'select', required: true,
        options: ['Chính thức', 'Người chốt dây (Neo)', 'Dự bị'] }
    ]
  },
  {
    id: 'BONG_CHUYEN', ten: 'Bóng chuyền', nhom: 'Bóng đồng đội', icon: '🏐', gioiHan: 14,
    fields: [
      { key: 'noiDung', label: 'Nội dung đội tuyển', type: 'select', required: true,
        options: ['Bóng chuyền Nam', 'Bóng chuyền Nữ'] },
      { key: 'soAo', label: 'Số áo thi đấu', type: 'number', required: true, placeholder: '1 - 99' },
      { key: 'viTri', label: 'Vị trí thi đấu', type: 'select', required: true,
        options: ['Chủ công', 'Phụ công', 'Chuyền hai', 'Đối chuyền', 'Libero'] },
      { key: 'chieuCao', label: 'Chiều cao (cm)', type: 'number', required: false, placeholder: 'VD: 175' }
    ]
  },
  {
    id: 'BONG_DA', ten: 'Bóng đá', nhom: 'Bóng đồng đội', icon: '⚽', gioiHan: 18,
    fields: [
      { key: 'noiDung', label: 'Nội dung / Cấp học', type: 'select', required: true,
        options: ['Nam Tiểu học (5 người)', 'Nam THCS (7 người)', 'Nam THPT (11 người)', 'Nữ THPT (7 người)'] },
      { key: 'soAo', label: 'Số áo thi đấu', type: 'number', required: true, placeholder: '1 - 99' },
      { key: 'viTri', label: 'Vị trí thi đấu', type: 'select', required: true,
        options: ['Thủ môn', 'Hậu vệ', 'Tiền vệ', 'Tiền đạo'] },
      { key: 'chanThuan', label: 'Chân thuận', type: 'select', required: true,
        options: ['Chân phải', 'Chân trái', 'Hai chân'] }
    ]
  }
];

// ================================================================
// ENTRY POINT
// ================================================================

function doGet(e) {
  khoiTaoNeuChua();
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('HKPĐ Cấp Tỉnh - Đăng ký theo Môn')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// ================================================================
// KHỞI TẠO HỆ THỐNG & DATABASE
// ================================================================

function getDb() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('DB_ID');
  if (id) {
    try { return SpreadsheetApp.openById(id); } catch(e) {}
  }
  var active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) {
    props.setProperty('DB_ID', active.getId());
    _setupSheets(active);
    return active;
  }
  var ss = SpreadsheetApp.create('HKPD_CapTinh_' + new Date().getFullYear());
  props.setProperty('DB_ID', ss.getId());
  _setupSheets(ss);
  return ss;
}

function khoiTaoNeuChua() {
  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty('DB_ID')) getDb();
}

function khoiTaoHeThong(token) {
  try {
    var props = PropertiesService.getScriptProperties();
    if (props.getProperty('DB_ID')) {
      var auth = _requireSession(token, true);
      if (!auth.ok) return auth;
    }
    var ss = getDb();
    _setupSheets(ss);
    _invalidateMetaCache();
    return { ok: true, msg: 'Khởi tạo thành công! URL: ' + ss.getUrl(), url: ss.getUrl() };
  } catch(e) { return { ok: false, msg: e.message }; }
}

function getDatabaseUrl(token) {
  var auth = _requireSession(token, true);
  if (!auth.ok) return auth;
  try { return { ok: true, url: getDb().getUrl() }; }
  catch(e) { return { ok: false, msg: e.message }; }
}

function _setupSheets(ss) {
  // Sheet VĐV (20 cột)
  var vdvHeaders = [
    'ID','MaDonVi','TenDonVi','HoTen','NgaySinh','GioiTinh',
    'Lop','MaMon','TenMon','NoiDung','ChiTietHienThi','ChiTietJSON',
    'TrangThai','GhiChu','ThoiGianDK','ThoiGianDuyet','NguoiDuyet',
    'CCCD','MaHocSinh','AnhThe'
  ];
  var svdv = _getOrCreate(ss, SHEET.VDV, vdvHeaders);
  if (svdv.getLastColumn() < vdvHeaders.length) {
    svdv.getRange(1, 1, 1, vdvHeaders.length).setValues([vdvHeaders])
      .setBackground('#1565C0').setFontColor('#FFFFFF').setFontWeight('bold');
  }

  // Sheet Đơn vị (mật khẩu lưu băm SHA-256)
  var sdv = _getOrCreate(ss, SHEET.DONVI, [
    'MaDonVi','TenDonVi','LoaiDonVi','Email','DienThoai',
    'NguoiLienHe','DiaChi','MatKhau','TrangThai','NgayTao'
  ]);
  if (sdv.getLastRow() <= 1) {
    sdv.appendRow([
      'ADMIN','Ban Tổ Chức','Admin','admin@hkpd.vn','',
      'Quản trị viên','',_hashPassword('admin@hkpd2026'),'HoatDong',
      new Date().toISOString()
    ]);
  }

  // Sheet Môn thi (10 môn)
  var smon = _getOrCreate(ss, SHEET.MON, ['MaMon','TenMon','Nhom','GioiHan','TrangThai','CauHinhFields']);
  if (smon.getLastColumn() < 6) {
    smon.getRange(1, 6).setValue('CauHinhFields')
      .setBackground('#1565C0').setFontColor('#FFFFFF').setFontWeight('bold');
  }
  if (smon.getLastRow() <= 1) {
    var rows = SPORT_DEFS.map(function(m) {
      return [m.id, m.ten, m.nhom, m.gioiHan, 'HoatDong', JSON.stringify(m.fields || [])];
    });
    smon.getRange(2, 1, rows.length, 6).setValues(rows);
  }

  // Sheet Cài đặt
  var scd = _getOrCreate(ss, SHEET.CAIDAT, ['Khoa','GiaTri','MoTa']);
  if (scd.getLastRow() <= 1) {
    scd.getRange(2, 1, 3, 3).setValues([
      ['TRANG_THAI_DK', 'MO',   'Trạng thái đăng ký: MO / DONG'],
      ['SO_MON_TOI_DA', '3',    'Số môn tối đa mỗi VĐV có thể tham gia'],
      ['TEN_HOI_THI',   'HKPĐ Cấp Tỉnh 2026', 'Tên hội thi']
    ]);
  }

  // Sheet Nhật ký
  _getOrCreate(ss, SHEET.LOG, ['ThoiGian','NguoiDung','HanhDong','ChiTiet']);
}

function _getOrCreate(ss, name, headers) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    var r = sheet.getRange(1, 1, 1, headers.length);
    r.setValues([headers])
     .setBackground('#1565C0')
     .setFontColor('#FFFFFF')
     .setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// ================================================================
// BẢO MẬT: BĂM MẬT KHẨU SHA-256, SESSION TOKEN & LOCKSERVICE
// ================================================================

function _hashPassword(pw) {
  var raw = PASSWORD_SALT + String(pw || '');
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, raw);
  var hex = '';
  for (var i = 0; i < digest.length; i++) {
    var b = (digest[i] < 0 ? digest[i] + 256 : digest[i]).toString(16);
    hex += (b.length === 1 ? '0' : '') + b;
  }
  return 'sha256:' + hex;
}

function _verifyPassword(stored, plain) {
  var s = String(stored || '').trim();
  var p = String(plain || '').trim();
  if (!s || !p) return false;
  if (s.indexOf('sha256:') === 0) {
    return s === _hashPassword(p);
  }
  return s === p;
}

function _getCache() {
  return CacheService.getScriptCache();
}

function _invalidateMetaCache() {
  try {
    var c = _getCache();
    c.remove('META_MON_LIST');
    c.remove('META_CAIDAT');
  } catch(e) {}
}

function _createSession(userObj) {
  var token = Utilities.getUuid();
  var payload = {
    maDonVi  : userObj.maDonVi,
    tenDonVi : userObj.tenDonVi,
    isAdmin  : !!userObj.isAdmin,
    exp      : Date.now() + SESSION_TTL_SEC * 1000
  };
  _getCache().put('SESS_' + token, JSON.stringify(payload), SESSION_TTL_SEC);
  return token;
}

function _requireSession(token, requireAdmin) {
  var tk = String(token || '').trim();
  if (!tk) return { ok: false, authError: true, msg: 'Chưa đăng nhập hoặc thiếu token xác thực!' };
  var raw = _getCache().get('SESS_' + tk);
  if (!raw) return { ok: false, authError: true, msg: 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại!' };
  var sess;
  try { sess = JSON.parse(raw); } catch(e) {
    return { ok: false, authError: true, msg: 'Phiên đăng nhập không hợp lệ!' };
  }
  if (!sess || (sess.exp && Date.now() > sess.exp)) {
    _getCache().remove('SESS_' + tk);
    return { ok: false, authError: true, msg: 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại!' };
  }
  if (requireAdmin && !sess.isAdmin) {
    return { ok: false, msg: 'Không có quyền quản trị!' };
  }
  return { ok: true, session: sess };
}

function _withLock(fn) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
  } catch(e) {
    return { ok: false, msg: 'Hệ thống đang có nhiều thao tác đồng thời, vui lòng thử lại sau giây lát!' };
  }
  try {
    return fn();
  } finally {
    try { lock.releaseLock(); } catch(e2) {}
  }
}

// ================================================================
// LƯU TRỮ ẢNH THẺ TRÊN GOOGLE DRIVE
// ================================================================

function _getPhotoFolder() {
  var props = PropertiesService.getScriptProperties();
  var fid = props.getProperty('PHOTO_FOLDER_ID');
  if (fid) {
    try {
      var f = DriveApp.getFolderById(fid);
      if (f && !f.isTrashed()) return f;
    } catch(e) {}
  }
  var it = DriveApp.getFoldersByName(PHOTO_FOLDER_NAME);
  var folder = it.hasNext() ? it.next() : DriveApp.createFolder(PHOTO_FOLDER_NAME);
  props.setProperty('PHOTO_FOLDER_ID', folder.getId());
  return folder;
}

function _savePhotoToDrive(photoInput, nameHint) {
  var val = String(photoInput || '').trim();
  if (!val) return { ok: true, ref: '' };
  if (val.indexOf('drive:') === 0) {
    return { ok: true, ref: val };
  }
  if (val.indexOf('data:image/') !== 0) {
    return { ok: false, msg: 'Định dạng ảnh thẻ không hợp lệ!' };
  }
  if (val.length > 80000) {
    return { ok: false, msg: 'Dung lượng ảnh sau nén quá lớn, vui lòng chọn ảnh khác!' };
  }
  var commaIdx = val.indexOf(',');
  if (commaIdx === -1) return { ok: false, msg: 'Dữ liệu ảnh thẻ không hợp lệ!' };
  var header = val.slice(0, commaIdx);
  var b64 = val.slice(commaIdx + 1);
  var mimeMatch = header.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64$/);
  var mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  var ext = mime === 'image/png' ? 'png' : 'jpg';
  var safeName = String(nameHint || 'vdv').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40) + '_' + Date.now() + '.' + ext;

  var bytes = Utilities.base64Decode(b64);
  var blob = Utilities.newBlob(bytes, mime, safeName);
  var folder = _getPhotoFolder();
  var file = folder.createFile(blob);
  var fileId = file.getId();

  // Cache dataUrl ngắn hạn để hiển thị tức thì ngay sau khi upload
  try { _getCache().put('PHOTO_' + fileId, val, 1800); } catch(e) {}
  return { ok: true, ref: 'drive:' + fileId };
}

function _loadPhotoDataUrl(ref) {
  var val = String(ref || '').trim();
  if (!val) return '';
  if (val.indexOf('data:image/') === 0) return val;
  if (val.indexOf('drive:') !== 0) return '';
  var fileId = val.slice(6);
  if (!fileId) return '';

  try {
    var cached = _getCache().get('PHOTO_' + fileId);
    if (cached) return cached;
  } catch(e) {}

  try {
    var file = DriveApp.getFileById(fileId);
    if (!file || file.isTrashed()) return '';
    var blob = file.getBlob();
    var mime = blob.getContentType() || 'image/jpeg';
    var dataUrl = 'data:' + mime + ';base64,' + Utilities.base64Encode(blob.getBytes());
    try {
      if (dataUrl.length <= 95000) _getCache().put('PHOTO_' + fileId, dataUrl, 1800);
    } catch(e2) {}
    return dataUrl;
  } catch(e3) {
    return '';
  }
}

function _trashDriveFileIfUnused(ss, oldRef, excludeRowIndex) {
  if (!oldRef || oldRef.indexOf('drive:') !== 0) return;
  try {
    var data = ss.getSheetByName(SHEET.VDV).getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (i + 1 === excludeRowIndex) continue;
      if (String(data[i][19] || '').trim() === oldRef) return;
    }
    var fileId = oldRef.slice(6);
    var file = DriveApp.getFileById(fileId);
    if (file) file.setTrashed(true);
    try { _getCache().remove('PHOTO_' + fileId); } catch(e) {}
  } catch(e) {}
}

// ================================================================
// XÁC THỰC - ĐĂNG NHẬP / ĐĂNG XUẤT
// ================================================================

function dangNhap(maDonVi, matKhau) {
  try {
    var ss = getDb();
    var sheet = ss.getSheetByName(SHEET.DONVI);
    var data = sheet.getDataRange().getValues();
    var maIn = String(maDonVi || '').trim();
    var mkIn = String(matKhau || '').trim();

    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (String(row[0]).trim() === maIn && _verifyPassword(row[7], mkIn)) {
        if (String(row[8]).trim() !== 'HoatDong') {
          return { ok: false, msg: 'Tài khoản đã bị vô hiệu hóa.' };
        }
        // Tự động nâng cấp mật khẩu plaintext cũ lên SHA-256
        if (String(row[7] || '').indexOf('sha256:') !== 0) {
          sheet.getRange(i + 1, 8).setValue(_hashPassword(mkIn));
        }

        var user = {
          maDonVi  : String(row[0]).trim(),
          tenDonVi : String(row[1]),
          loai     : String(row[2]),
          email    : String(row[3] || ''),
          lienHe   : String(row[5] || ''),
          isAdmin  : String(row[0]).trim() === 'ADMIN'
        };
        var token = _createSession(user);
        _log(user.maDonVi, 'LOGIN', 'Đăng nhập');
        return { ok: true, user: user, token: token };
      }
    }
    return { ok: false, msg: 'Mã đơn vị hoặc mật khẩu không đúng.' };
  } catch(e) {
    return { ok: false, msg: 'Lỗi hệ thống: ' + e.message };
  }
}

function dangXuat(token) {
  try {
    if (token) _getCache().remove('SESS_' + String(token).trim());
    return { ok: true };
  } catch(e) { return { ok: true }; }
}

function getBootstrapData(token) {
  var auth = _requireSession(token, false);
  if (!auth.ok) return auth;
  var mons = layDanhSachMon();
  var tk = layThongKe(token);
  var res = {
    ok: true,
    mons: mons.ok ? mons.data : [],
    thongKe: tk.ok ? tk.data : null
  };
  if (auth.session.isAdmin) {
    var cd = layCaiDat(token);
    res.caiDat = cd.ok ? cd.data : [];
  }
  return res;
}

// ================================================================
// QUẢN LÝ ĐƠN VỊ (CHỈ ADMIN)
// ================================================================

function layDanhSachDonVi(token) {
  var auth = _requireSession(token, true);
  if (!auth.ok) return auth;
  try {
    var data = getDb().getSheetByName(SHEET.DONVI).getDataRange().getValues();
    var list = [];
    for (var i = 1; i < data.length; i++) {
      var r = data[i];
      var ma = String(r[0] || '').trim();
      if (!ma || ma === 'ADMIN') continue;
      list.push({
        maDonVi     : ma,
        tenDonVi    : String(r[1] || ''),
        loaiDonVi   : String(r[2] || ''),
        email       : String(r[3] || ''),
        dienThoai   : String(r[4] || ''),
        nguoiLienHe : String(r[5] || ''),
        diaChi      : String(r[6] || ''),
        trangThai   : String(r[8] || ''),
        ngayTao     : _formatDate(r[9])
      });
    }
    return { ok: true, data: list };
  } catch(e) { return { ok: false, msg: e.message }; }
}

function themDonVi(token, dv) {
  var auth = _requireSession(token, true);
  if (!auth.ok) return auth;
  return _withLock(function() {
    try {
      var ss = getDb();
      var sheet = ss.getSheetByName(SHEET.DONVI);
      var data = sheet.getDataRange().getValues();
      var maMoi = String(dv.maDonVi || '').trim().toUpperCase();
      if (!maMoi || !String(dv.tenDonVi || '').trim()) {
        return { ok: false, msg: 'Vui lòng nhập mã và tên đơn vị!' };
      }
      if (maMoi === 'ADMIN') {
        return { ok: false, msg: 'Không thể dùng mã ADMIN!' };
      }

      for (var i = 1; i < data.length; i++) {
        if (String(data[i][0]).trim().toUpperCase() === maMoi) {
          return { ok: false, msg: 'Mã đơn vị đã tồn tại!' };
        }
      }

      var mk = String(dv.matKhau || '').trim() || (maMoi + '@hkpd');
      sheet.appendRow([
        maMoi, String(dv.tenDonVi).trim(), dv.loaiDonVi || 'Trường',
        dv.email || '', dv.dienThoai || '', dv.nguoiLienHe || '',
        dv.diaChi || '', _hashPassword(mk), 'HoatDong', new Date().toISOString()
      ]);
      _log('ADMIN', 'ADD_UNIT', 'Thêm: ' + dv.tenDonVi);
      return { ok: true, msg: 'Thêm đơn vị thành công!', matKhauMacDinh: mk };
    } catch(e) { return { ok: false, msg: e.message }; }
  });
}

function capNhatDonVi(token, dv) {
  var auth = _requireSession(token, true);
  if (!auth.ok) return auth;
  return _withLock(function() {
    try {
      var sheet = getDb().getSheetByName(SHEET.DONVI);
      var data = sheet.getDataRange().getValues();
      for (var i = 1; i < data.length; i++) {
        if (String(data[i][0]).trim() === String(dv.maDonVi).trim()) {
          var row = i + 1;
          if (dv.tenDonVi    !== undefined) sheet.getRange(row, 2).setValue(dv.tenDonVi);
          if (dv.loaiDonVi   !== undefined) sheet.getRange(row, 3).setValue(dv.loaiDonVi);
          if (dv.email       !== undefined) sheet.getRange(row, 4).setValue(dv.email);
          if (dv.dienThoai   !== undefined) sheet.getRange(row, 5).setValue(dv.dienThoai);
          if (dv.nguoiLienHe !== undefined) sheet.getRange(row, 6).setValue(dv.nguoiLienHe);
          if (dv.diaChi      !== undefined) sheet.getRange(row, 7).setValue(dv.diaChi);
          if (dv.trangThai   !== undefined) sheet.getRange(row, 9).setValue(dv.trangThai);
          return { ok: true, msg: 'Cập nhật thành công!' };
        }
      }
      return { ok: false, msg: 'Không tìm thấy đơn vị!' };
    } catch(e) { return { ok: false, msg: e.message }; }
  });
}

function importNhieuDonVi(token, danhSachDonVi) {
  var auth = _requireSession(token, true);
  if (!auth.ok) return auth;
  return _withLock(function() {
    try {
      var list = Array.isArray(danhSachDonVi) ? danhSachDonVi : [];
      if (!list.length) return { ok: false, msg: 'Không có dữ liệu đơn vị để nhập!' };

      var ss = getDb();
      var sheet = ss.getSheetByName(SHEET.DONVI);
      var data = sheet.getDataRange().getValues();
      var existingMap = {};
      for (var i = 1; i < data.length; i++) {
        var rowCode = String(data[i][0] || '').trim().toUpperCase();
        if (rowCode) {
          existingMap[rowCode] = { rowIndex: i + 1, currentPass: data[i][7] };
        }
      }

      var inserted = 0;
      var updated = 0;
      var errors = [];
      var now = new Date().toISOString();

      list.forEach(function(item, idx) {
        var ma = String(item.maDonVi || item.ma || '').trim().toUpperCase();
        var ten = String(item.tenDonVi || item.ten || '').trim();
        if (!ma || !ten) {
          errors.push('Dòng #' + (idx + 1) + ': Thiếu Mã hoặc Tên đơn vị');
          return;
        }
        if (ma === 'ADMIN') {
          errors.push('Dòng #' + (idx + 1) + ': Không thể nhập mã ADMIN');
          return;
        }

        var loai = String(item.loaiDonVi || item.loai || 'Trường THPT').trim();
        var email = String(item.email || '').trim();
        var dt = String(item.dienThoai || item.sdt || '').trim();
        var nlh = String(item.nguoiLienHe || '').trim();
        var dc = String(item.diaChi || '').trim();
        var rawMk = String(item.matKhau || '').trim();

        if (existingMap[ma]) {
          var ri = existingMap[ma].rowIndex;
          var passHash = rawMk ? _hashPassword(rawMk) : existingMap[ma].currentPass;
          var rowUpdate = [ma, ten, loai, email, dt, nlh, dc, passHash, 'HoatDong'];
          sheet.getRange(ri, 1, 1, 9).setValues([rowUpdate]);
          updated++;
        } else {
          var defaultMk = rawMk ? rawMk : (ma + '@hkpd');
          var newPassHash = _hashPassword(defaultMk);
          sheet.appendRow([ma, ten, loai, email, dt, nlh, dc, newPassHash, 'HoatDong', now]);
          existingMap[ma] = { rowIndex: sheet.getLastRow(), currentPass: newPassHash };
          inserted++;
        }
      });

      _log('ADMIN', 'IMPORT_UNITS', 'Nhập hàng loạt: ' + inserted + ' thêm mới, ' + updated + ' cập nhật');
      var msg = 'Đã xử lý thành công ' + (inserted + updated) + ' đơn vị (' + inserted + ' thêm mới, ' + updated + ' cập nhật)!';
      if (errors.length > 0) msg += ' (Bỏ qua ' + errors.length + ' dòng lỗi)';
      return { ok: true, count: inserted + updated, inserted: inserted, updated: updated, errors: errors, msg: msg };
    } catch(e) { return { ok: false, msg: 'Lỗi nhập đơn vị: ' + e.message }; }
  });
}

function resetMatKhau(token, maDonVi) {
  var auth = _requireSession(token, true);
  if (!auth.ok) return auth;
  return _withLock(function() {
    try {
      var sheet = getDb().getSheetByName(SHEET.DONVI);
      var data = sheet.getDataRange().getValues();
      for (var i = 1; i < data.length; i++) {
        if (String(data[i][0]).trim() === String(maDonVi).trim()) {
          var mk = String(maDonVi).trim() + '@hkpd';
          sheet.getRange(i + 1, 8).setValue(_hashPassword(mk));
          _log('ADMIN', 'RESET_PW', maDonVi);
          return { ok: true, msg: 'Đã reset mật khẩu: ' + mk, matKhauMoi: mk };
        }
      }
      return { ok: false, msg: 'Không tìm thấy đơn vị!' };
    } catch(e) { return { ok: false, msg: e.message }; }
  });
}

function doiMatKhau(token, mkCu, mkMoi) {
  var auth = _requireSession(token, false);
  if (!auth.ok) return auth;
  var targetDv = auth.session.maDonVi;
  return _withLock(function() {
    try {
      if (!mkMoi || String(mkMoi).length < 4) return { ok: false, msg: 'Mật khẩu mới tối thiểu 4 ký tự!' };
      var sheet = getDb().getSheetByName(SHEET.DONVI);
      var data = sheet.getDataRange().getValues();
      for (var i = 1; i < data.length; i++) {
        if (String(data[i][0]).trim() === targetDv) {
          if (!_verifyPassword(data[i][7], mkCu)) {
            return { ok: false, msg: 'Mật khẩu hiện tại không đúng!' };
          }
          sheet.getRange(i + 1, 8).setValue(_hashPassword(mkMoi));
          _log(targetDv, 'CHANGE_PW', 'Đổi mật khẩu');
          return { ok: true, msg: 'Đổi mật khẩu thành công!' };
        }
      }
      return { ok: false, msg: 'Không tìm thấy tài khoản!' };
    } catch(e) { return { ok: false, msg: e.message }; }
  });
}

// ================================================================
// MÔN THI & BIỂU MẪU ĐỘNG (ADMIN TÙY BIẾN NỘI DUNG & BIỂU MẪU)
// ================================================================

function _getSportDef(maMon) {
  var mid = String(maMon || '').trim();
  var res = layDanhSachMon();
  if (res.ok && Array.isArray(res.data)) {
    for (var i = 0; i < res.data.length; i++) {
      if (res.data[i].id === mid) return res.data[i];
    }
  }
  for (var j = 0; j < SPORT_DEFS.length; j++) {
    if (SPORT_DEFS[j].id === mid) return SPORT_DEFS[j];
  }
  return null;
}

function layDanhSachMon() {
  try {
    var cached = _getCache().get('META_MON_LIST');
    if (cached) {
      return { ok: true, data: JSON.parse(cached) };
    }
    var sheet = getDb().getSheetByName(SHEET.MON);
    var data = sheet.getDataRange().getValues();
    var dbMap = {};
    for (var i = 1; i < data.length; i++) {
      var rowId = String(data[i][0] || '').trim();
      if (!rowId) continue;
      var fldParsed = null;
      if (data[i][5]) {
        try { fldParsed = JSON.parse(String(data[i][5])); } catch(e) {}
      }
      dbMap[rowId] = {
        ten: String(data[i][1] || ''),
        nhom: String(data[i][2] || ''),
        gioiHan: parseInt(data[i][3], 10) || 0,
        trangThai: String(data[i][4] || 'HoatDong'),
        fields: Array.isArray(fldParsed) && fldParsed.length > 0 ? fldParsed : null,
        rowIndex: i + 1
      };
    }

    var list = [];
    var seen = {};
    SPORT_DEFS.forEach(function(def) {
      var db = dbMap[def.id];
      seen[def.id] = true;
      list.push({
        id: def.id,
        ten: db && db.ten ? db.ten : def.ten,
        nhom: db && db.nhom ? db.nhom : def.nhom,
        icon: def.icon,
        gioiHan: db && db.gioiHan ? db.gioiHan : def.gioiHan,
        trangThai: db ? db.trangThai : 'HoatDong',
        fields: db && db.fields ? db.fields : def.fields,
        rowIndex: db ? db.rowIndex : -1
      });
    });

    Object.keys(dbMap).forEach(function(mid) {
      if (!seen[mid]) {
        var db = dbMap[mid];
        list.push({
          id: mid,
          ten: db.ten || mid,
          nhom: db.nhom || 'Môn khác',
          icon: '🏅',
          gioiHan: db.gioiHan || 10,
          trangThai: db.trangThai || 'HoatDong',
          fields: db.fields || [
            { key: 'noiDung', label: 'Nội dung thi đấu', type: 'text', required: true }
          ],
          rowIndex: db.rowIndex
        });
      }
    });

    try { _getCache().put('META_MON_LIST', JSON.stringify(list), CACHE_TTL_SEC); } catch(e) {}
    return { ok: true, data: list };
  } catch(e) { return { ok: false, msg: e.message }; }
}

function luuToanBoMon(token, danhSachMon) {
  var auth = _requireSession(token, true);
  if (!auth.ok) return auth;
  return _withLock(function() {
    try {
      var list = Array.isArray(danhSachMon) ? danhSachMon : [];
      if (!list.length) return { ok: false, msg: 'Danh sách môn thi rỗng!' };

      var sheet = getDb().getSheetByName(SHEET.MON);
      var lastRow = sheet.getLastRow();
      var data = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, Math.max(6, sheet.getLastColumn())).getValues() : [];

      var rowMap = {};
      for (var i = 0; i < data.length; i++) {
        var idInSheet = String(data[i][0] || '').trim();
        if (idInSheet) rowMap[idInSheet] = i + 2;
      }

      var updatedCount = 0;
      var newRows = [];

      list.forEach(function(m) {
        var mid = String(m.id || '').trim();
        if (!mid) return;
        var ten = String(m.ten || '').trim();
        var nhom = String(m.nhom || '').trim();
        var gh = parseInt(m.gioiHan, 10);
        if (isNaN(gh) || gh < 1) gh = 10;
        var tt = (m.trangThai === 'Tat') ? 'Tat' : 'HoatDong';
        var flds = Array.isArray(m.fields) ? m.fields : [];
        var fldsJson = JSON.stringify(flds);

        if (rowMap[mid]) {
          var ri = rowMap[mid];
          sheet.getRange(ri, 1, 1, 6).setValues([[mid, ten, nhom, gh, tt, fldsJson]]);
          updatedCount++;
        } else {
          newRows.push([mid, ten, nhom, gh, tt, fldsJson]);
        }
      });

      if (newRows.length > 0) {
        sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, 6).setValues(newRows);
        updatedCount += newRows.length;
      }

      _invalidateMetaCache();
      _log('ADMIN', 'UPDATE_ALL_SPORTS', 'Lưu toàn bộ ' + updatedCount + ' môn thi và biểu mẫu');
      return { ok: true, count: updatedCount, msg: 'Đã lưu toàn bộ ' + updatedCount + ' môn thi và biểu mẫu thành công!' };
    } catch(e) { return { ok: false, msg: e.message }; }
  });
}

function capNhatGioiHanMon(token, rowIndex, gioiHan) {
  var auth = _requireSession(token, true);
  if (!auth.ok) return auth;
  return _withLock(function() {
    try {
      var gh = parseInt(gioiHan, 10);
      if (isNaN(gh) || gh < 1) return { ok: false, msg: 'Giới hạn phải là số nguyên >= 1!' };
      getDb().getSheetByName(SHEET.MON).getRange(rowIndex, 4).setValue(gh);
      _invalidateMetaCache();
      return { ok: true, msg: 'Cập nhật giới hạn thành công!' };
    } catch(e) { return { ok: false, msg: e.message }; }
  });
}

function capNhatTrangThaiMon(token, rowIndex, trangThai) {
  var auth = _requireSession(token, true);
  if (!auth.ok) return auth;
  return _withLock(function() {
    try {
      var tt = (trangThai === 'HoatDong' || trangThai === 'Tat') ? trangThai : 'HoatDong';
      getDb().getSheetByName(SHEET.MON).getRange(rowIndex, 5).setValue(tt);
      _invalidateMetaCache();
      return { ok: true, msg: 'Cập nhật trạng thái môn thành công!' };
    } catch(e) { return { ok: false, msg: e.message }; }
  });
}

// ================================================================
// ĐĂNG KÝ VĐV THEO MÔN (ĐƠN LẺ & HÀNG LOẠT + FORM ĐỘNG + DRIVE)
// ================================================================

function _validateAndBuildDetail(sportDef, chiTietRaw) {
  var raw = chiTietRaw && typeof chiTietRaw === 'object' ? chiTietRaw : {};
  var clean = {};
  var parts = [];
  var noiDungSummary = '';

  for (var i = 0; i < sportDef.fields.length; i++) {
    var f = sportDef.fields[i];

    // Bỏ qua trường không thỏa mãn điều kiện showIf
    if (f.showIf) {
      var depVal = clean[f.showIf.key] !== undefined ? clean[f.showIf.key] : raw[f.showIf.key];
      var depStr = Array.isArray(depVal) ? depVal.join(', ') : String(depVal || '');
      if (f.showIf.equals && depStr !== f.showIf.equals) continue;
      if (f.showIf.contains && depStr.indexOf(f.showIf.contains) === -1) continue;
    }

    var val = raw[f.key];
    if (f.type === 'checkboxes') {
      var arr = Array.isArray(val) ? val : (val ? [String(val)] : []);
      arr = arr.map(function(x) { return String(x).trim(); }).filter(function(x) { return !!x; });
      if (f.required && arr.length === 0) {
        return { ok: false, msg: 'Vui lòng chọn "' + f.label + '"!' };
      }
      clean[f.key] = arr;
      if (arr.length > 0) {
        if (f.key === 'noiDung') noiDungSummary = arr.join(', ');
        else parts.push(f.label + ': ' + arr.join(', '));
      }
    } else {
      var sVal = String(val !== undefined && val !== null ? val : '').trim();
      if (f.required && !sVal) {
        return { ok: false, msg: 'Vui lòng nhập/chọn "' + f.label + '"!' };
      }
      if (sVal && f.type === 'number') {
        var num = Number(sVal);
        if (isNaN(num) || num <= 0) {
          return { ok: false, msg: '"' + f.label + '" phải là số dương hợp lệ!' };
        }
      }
      clean[f.key] = sVal;
      if (sVal) {
        if (f.key === 'noiDung') noiDungSummary = sVal;
        else parts.push(f.label + ': ' + sVal);
      }
    }
  }

  return {
    ok: true,
    chiTiet: clean,
    noiDung: noiDungSummary,
    chiTietHienThi: parts.join(' • ')
  };
}

function _validateIdentity(vdv) {
  var hoTen     = String(vdv.hoTen || '').trim();
  var ngaySinh  = String(vdv.ngaySinh || '').trim();
  var gioiTinh  = String(vdv.gioiTinh || '').trim();
  var lop       = String(vdv.lop || '').trim();
  var cccd      = String(vdv.cccd || '').trim().replace(/\s+/g, '');
  var maHocSinh = String(vdv.maHocSinh || '').trim();
  var anhThe    = vdv.anhThe !== undefined && vdv.anhThe !== null ? String(vdv.anhThe).trim() : '';

  if (!hoTen || !ngaySinh || !gioiTinh) {
    return { ok: false, msg: 'Vui lòng nhập đầy đủ họ tên, ngày sinh, giới tính!' };
  }
  if (!/^(\d{9}|\d{12})$/.test(cccd)) {
    return { ok: false, msg: 'Số CCCD / ĐDCN không hợp lệ (phải gồm 9 hoặc 12 chữ số)!' };
  }
  if (!maHocSinh) {
    return { ok: false, msg: 'Vui lòng nhập Mã học sinh!' };
  }
  if (anhThe && anhThe.indexOf('data:image/') !== 0 && anhThe.indexOf('drive:') !== 0) {
    return { ok: false, msg: 'Định dạng ảnh thẻ không hợp lệ!' };
  }
  if (anhThe && anhThe.indexOf('data:image/') === 0 && anhThe.length > 80000) {
    return { ok: false, msg: 'Dung lượng ảnh thẻ quá lớn, vui lòng chọn ảnh nhỏ hơn!' };
  }
  return {
    ok: true,
    hoTen: hoTen, ngaySinh: ngaySinh, gioiTinh: gioiTinh, lop: lop,
    cccd: cccd, maHocSinh: maHocSinh, anhThe: anhThe
  };
}

function dangKyVDV(token, vdv) {
  return dangKyNhieuVDV(token, [vdv]);
}

function dangKyNhieuVDV(token, vdvs) {
  var auth = _requireSession(token, false);
  if (!auth.ok) return auth;
  var targetDv = auth.session.maDonVi;
  var tenDonVi = auth.session.tenDonVi;

  return _withLock(function() {
    try {
      if (!Array.isArray(vdvs) || vdvs.length === 0) {
        return { ok: false, msg: 'Danh sách VĐV đăng ký đang trống!' };
      }

      var ss = getDb();
      var caiDat = _getCaiDatMap(ss);
      if ((caiDat['TRANG_THAI_DK'] || 'MO') === 'DONG') {
        return { ok: false, msg: 'Hệ thống đã đóng đăng ký!' };
      }

      var monData = ss.getSheetByName(SHEET.MON).getDataRange().getValues();
      var monMeta = {};
      for (var j = 1; j < monData.length; j++) {
        var mid = String(monData[j][0] || '');
        if (!mid) continue;
        var gh = parseInt(monData[j][3], 10);
        monMeta[mid] = {
          ten: String(monData[j][1] || ''),
          gioiHan: isNaN(gh) ? 99 : gh,
          hoatDong: !String(monData[j][4]) || String(monData[j][4]) === 'HoatDong'
        };
      }

      var vdvSheet = ss.getSheetByName(SHEET.VDV);
      var vdvData = vdvSheet.getDataRange().getValues();
      var unitSportCount = {};
      var unitIdentitySports = {};
      var sportCccdUsed = {};
      var sportMhsUsed = {};
      var sportNameUsed = {};

      function trackRecord(dv, maMon, normTen, normNS, cccd, normMhs, hoTen) {
        if (dv === targetDv) {
          unitSportCount[maMon] = (unitSportCount[maMon] || 0) + 1;
          sportNameUsed[maMon + '|' + normTen + '|' + normNS] = true;
          ['N:' + normTen + '|' + normNS, 'C:' + cccd, 'M:' + normMhs].forEach(function(k) {
            if (!unitIdentitySports[k]) unitIdentitySports[k] = {};
            unitIdentitySports[k][maMon] = true;
          });
        }
        if (cccd) sportCccdUsed[maMon + '|' + cccd] = hoTen;
        if (normMhs) sportMhsUsed[maMon + '|' + normMhs] = hoTen;
      }

      for (var k = 1; k < vdvData.length; k++) {
        var row = vdvData[k];
        if (!row[0] || String(row[12]) === 'TuChoi') continue;
        trackRecord(
          String(row[1] || '').trim(),
          String(row[7] || ''),
          String(row[3] || '').trim().toLowerCase(),
          _formatDate(row[4]),
          String(row[17] || '').trim(),
          String(row[18] || '').trim().toUpperCase(),
          String(row[3] || '')
        );
      }

      // Giai đoạn 1: Kiểm tra toàn bộ (atomic) trước khi ghi Drive hoặc Sheets
      var soMonToiDa = parseInt(caiDat['SO_MON_TOI_DA'], 10);
      var validatedItems = [];
      for (var idx = 0; idx < vdvs.length; idx++) {
        var item = vdvs[idx] || {};
        var rowPrefix = vdvs.length > 1 ? ('VĐV #' + (idx + 1) + (item.hoTen ? ' (' + String(item.hoTen).trim() + ')' : '') + ': ') : '';
        var maMon = String(item.maMon || '').trim();
        var sportDef = _getSportDef(maMon);
        if (!sportDef) return { ok: false, msg: rowPrefix + 'Môn thi không hợp lệ!' };

        var meta = monMeta[maMon] || { ten: sportDef.ten, gioiHan: sportDef.gioiHan, hoatDong: true };
        var tenMon = meta.ten || sportDef.ten;
        if (!meta.hoatDong) {
          return { ok: false, msg: rowPrefix + 'Môn ' + tenMon + ' hiện đang tạm khóa đăng ký!' };
        }

        var idRes = _validateIdentity(item);
        if (!idRes.ok) return { ok: false, msg: rowPrefix + idRes.msg };

        var valRes = _validateAndBuildDetail(sportDef, item.chiTiet);
        if (!valRes.ok) return { ok: false, msg: rowPrefix + valRes.msg };

        var normTen = idRes.hoTen.toLowerCase();
        var normNS = _formatDate(idRes.ngaySinh);
        var normMhs = idRes.maHocSinh.toUpperCase();

        if (sportCccdUsed[maMon + '|' + idRes.cccd]) {
          return { ok: false, msg: rowPrefix + 'Số CCCD ' + idRes.cccd + ' đã đăng ký môn ' + tenMon + '!' };
        }
        if (sportMhsUsed[maMon + '|' + normMhs]) {
          return { ok: false, msg: rowPrefix + 'Mã học sinh ' + idRes.maHocSinh + ' đã đăng ký môn ' + tenMon + '!' };
        }
        if (sportNameUsed[maMon + '|' + normTen + '|' + normNS]) {
          return { ok: false, msg: rowPrefix + 'VĐV ' + idRes.hoTen + ' đã đăng ký môn ' + tenMon + ' trước đó!' };
        }
        if ((unitSportCount[maMon] || 0) >= meta.gioiHan) {
          return { ok: false, msg: rowPrefix + 'Môn ' + tenMon + ': Đơn vị đã đủ ' + meta.gioiHan + ' VĐV!' };
        }

        if (!isNaN(soMonToiDa) && soMonToiDa > 0) {
          var sportSet = {};
          ['N:' + normTen + '|' + normNS, 'C:' + idRes.cccd, 'M:' + normMhs].forEach(function(key) {
            if (unitIdentitySports[key]) {
              Object.keys(unitIdentitySports[key]).forEach(function(m) { sportSet[m] = true; });
            }
          });
          if (Object.keys(sportSet).length >= soMonToiDa) {
            return { ok: false, msg: rowPrefix + 'VĐV ' + idRes.hoTen + ' đã đăng ký tối đa ' + soMonToiDa + ' môn!' };
          }
        }

        trackRecord(targetDv, maMon, normTen, normNS, idRes.cccd, normMhs, idRes.hoTen);
        validatedItems.push({ idRes: idRes, valRes: valRes, maMon: maMon, tenMon: tenMon, ghiChu: String(item.ghiChu || '') });
      }

      // Giai đoạn 2: Lưu ảnh lên Drive và ghi hàng loạt vào Sheet VĐV
      var now = new Date().toISOString();
      var rowsToAppend = [];
      for (var w = 0; w < validatedItems.length; w++) {
        var vi = validatedItems[w];
        var photoRef = '';
        if (vi.idRes.anhThe) {
          var pSave = _savePhotoToDrive(vi.idRes.anhThe, targetDv + '_' + vi.idRes.maHocSinh);
          if (!pSave.ok) return pSave;
          photoRef = pSave.ref;
        }
        var newId = 'VDV_' + Date.now() + '_' + w + '_' + Math.random().toString(36).slice(2, 6).toUpperCase() + '_' + vi.maMon;
        rowsToAppend.push([
          newId, targetDv, tenDonVi, vi.idRes.hoTen, vi.idRes.ngaySinh, vi.idRes.gioiTinh,
          vi.idRes.lop, vi.maMon, vi.tenMon, vi.valRes.noiDung, vi.valRes.chiTietHienThi,
          JSON.stringify(vi.valRes.chiTiet), 'ChoDuyet', vi.ghiChu,
          now, '', '', vi.idRes.cccd, vi.idRes.maHocSinh, photoRef
        ]);
      }

      var startRow = vdvSheet.getLastRow() + 1;
      vdvSheet.getRange(startRow, 1, rowsToAppend.length, 20).setValues(rowsToAppend);

      if (rowsToAppend.length === 1) {
        var r0 = rowsToAppend[0];
        _log(targetDv, 'REGISTER', r0[3] + ' - ' + r0[8] + (r0[9] ? ' (' + r0[9] + ')' : ''));
        return { ok: true, count: 1, msg: 'Đăng ký thành công VĐV ' + r0[3] + ' môn ' + r0[8] + '!' };
      }
      _log(targetDv, 'REGISTER_BATCH', rowsToAppend.length + ' VĐV - ' + rowsToAppend[0][8]);
      return { ok: true, count: rowsToAppend.length, msg: 'Đăng ký thành công ' + rowsToAppend.length + ' VĐV môn ' + rowsToAppend[0][8] + '!' };
    } catch(e) { return { ok: false, msg: 'Lỗi đăng ký: ' + e.message }; }
  });
}

/**
 * Tìm hồ sơ VĐV đã nhập trong đơn vị theo CCCD hoặc Mã HS để tự điền sang môn khác
 */
function timHoSoTheoDinhDanh(token, tuKhoa) {
  var auth = _requireSession(token, false);
  if (!auth.ok) return auth;
  try {
    var kw = String(tuKhoa || '').trim().toUpperCase();
    if (!kw) return { ok: false, msg: 'Vui lòng nhập số CCCD hoặc Mã học sinh!' };
    var data = getDb().getSheetByName(SHEET.VDV).getDataRange().getValues();
    var targetDv = auth.session.maDonVi;
    for (var i = data.length - 1; i >= 1; i--) {
      var r = data[i];
      if (!r[0]) continue;
      if (!auth.session.isAdmin && String(r[1] || '').trim() !== targetDv) continue;
      var cccd = String(r[17] || '').trim().toUpperCase();
      var mhs  = String(r[18] || '').trim().toUpperCase();
      if (cccd === kw || mhs === kw) {
        var ref = _str(r[19]);
        return {
          ok: true,
          data: {
            hoTen: _str(r[3]),
            ngaySinh: _formatDate(r[4]),
            gioiTinh: _str(r[5]),
            lop: _str(r[6]),
            cccd: _str(r[17]),
            maHocSinh: _str(r[18]),
            anhRef: ref,
            anhDataUrl: ref ? _loadPhotoDataUrl(ref) : ''
          }
        };
      }
    }
    return { ok: false, msg: 'Chưa tìm thấy hồ sơ VĐV phù hợp!' };
  } catch(e) { return { ok: false, msg: e.message }; }
}

/**
 * Lấy danh sách VĐV (nhẹ payload: chỉ trả coAnh, không trả ảnh base64 nặng)
 */
function layDanhSachVDV(token, boLoc) {
  var auth = _requireSession(token, false);
  if (!auth.ok) return auth;
  try {
    var data = getDb().getSheetByName(SHEET.VDV).getDataRange().getValues();
    var list = [];
    var isAdmin = auth.session.isAdmin;
    var targetDv = auth.session.maDonVi;

    for (var i = 1; i < data.length; i++) {
      var r = data[i];
      if (!r[0]) continue;
      var rowDv = String(r[1] || '').trim();
      if (!isAdmin && rowDv !== targetDv) continue;

      var chiTietObj = {};
      try { if (r[11]) chiTietObj = JSON.parse(String(r[11])); } catch(e) {}
      var anhRef = _str(r[19]);

      var item = {
        id             : _str(r[0]),
        maDonVi        : rowDv,
        tenDonVi       : _str(r[2]),
        hoTen          : _str(r[3]),
        ngaySinh       : _formatDate(r[4]),
        gioiTinh       : _str(r[5]),
        lop            : _str(r[6]),
        maMon          : _str(r[7]),
        tenMon         : _str(r[8]),
        noiDung        : _str(r[9]),
        chiTietHienThi : _str(r[10]),
        chiTiet        : chiTietObj,
        trangThai      : _str(r[12]),
        ghiChu         : _str(r[13]),
        thoiGianDK     : _formatDate(r[14]),
        thoiGianDuyet  : _formatDate(r[15]),
        nguoiDuyet     : _str(r[16]),
        cccd           : _str(r[17]),
        maHocSinh      : _str(r[18]),
        coAnh          : !!anhRef,
        rowIndex       : i + 1
      };

      if (boLoc) {
        if (boLoc.tuKhoa) {
          var kw = String(boLoc.tuKhoa).toLowerCase();
          if (!item.hoTen.toLowerCase().includes(kw) &&
              !item.lop.toLowerCase().includes(kw) &&
              !item.tenDonVi.toLowerCase().includes(kw) &&
              !item.noiDung.toLowerCase().includes(kw) &&
              !item.chiTietHienThi.toLowerCase().includes(kw) &&
              !item.cccd.toLowerCase().includes(kw) &&
              !item.maHocSinh.toLowerCase().includes(kw)) continue;
        }
        if (boLoc.maMon     && item.maMon     !== boLoc.maMon)     continue;
        if (boLoc.trangThai && item.trangThai !== boLoc.trangThai) continue;
        if (boLoc.gioiTinh  && item.gioiTinh  !== boLoc.gioiTinh)  continue;
        if (boLoc.maDonVi   && item.maDonVi   !== boLoc.maDonVi)   continue;
      }
      list.push(item);
    }
    return { ok: true, data: list, total: list.length };
  } catch(e) { return { ok: false, msg: e.message }; }
}

/**
 * Tải lười (Lazy-load) ảnh thẻ từ Drive cho các VĐV đang hiển thị/in thẻ
 */
function layAnhTheoDanhSach(token, vdvIds) {
  var auth = _requireSession(token, false);
  if (!auth.ok) return auth;
  try {
    var ids = Array.isArray(vdvIds) ? vdvIds.slice(0, 80) : [];
    if (!ids.length) return { ok: true, data: {} };
    var want = {};
    ids.forEach(function(id) { if (id) want[String(id)] = true; });

    var data = getDb().getSheetByName(SHEET.VDV).getDataRange().getValues();
    var out = {};
    for (var i = 1; i < data.length; i++) {
      var id = _str(data[i][0]);
      if (!id || !want[id]) continue;
      if (!auth.session.isAdmin && String(data[i][1] || '').trim() !== auth.session.maDonVi) continue;
      var ref = _str(data[i][19]);
      if (ref) out[id] = _loadPhotoDataUrl(ref);
    }
    return { ok: true, data: out };
  } catch(e) { return { ok: false, msg: e.message }; }
}

function suaVDV(token, rowIndex, vdvData, vdvId) {
  var auth = _requireSession(token, false);
  if (!auth.ok) return auth;
  var callerDv = auth.session.isAdmin ? 'ADMIN' : auth.session.maDonVi;

  return _withLock(function() {
    try {
      var ss = getDb();
      var sheet = ss.getSheetByName(SHEET.VDV);
      var ri = _resolveVdvRow(sheet, vdvId, rowIndex);
      if (ri < 2) return { ok: false, msg: 'Không tìm thấy VĐV!' };
      var allData = sheet.getDataRange().getValues();
      var row = allData[ri - 1];
      if (!auth.session.isAdmin && String(row[1]).trim() !== auth.session.maDonVi) {
        return { ok: false, msg: 'Không có quyền sửa!' };
      }
      if (String(row[12]) === 'DaDuyet') {
        return { ok: false, msg: 'Không thể sửa VĐV đã được duyệt!' };
      }

      var maMon = String(row[7]);
      var sportDef = _getSportDef(maMon);
      if (!sportDef) return { ok: false, msg: 'Môn thi không hợp lệ!' };

      var idRes = _validateIdentity(vdvData);
      if (!idRes.ok) return idRes;

      var valRes = _validateAndBuildDetail(sportDef, vdvData.chiTiet);
      if (!valRes.ok) return valRes;

      var normMhs = idRes.maHocSinh.toUpperCase();
      for (var i = 1; i < allData.length; i++) {
        if (i + 1 === ri) continue;
        var other = allData[i];
        if (!other[0] || String(other[12]) === 'TuChoi' || String(other[7]) !== maMon) continue;
        if (String(other[17] || '').trim() === idRes.cccd) {
          return { ok: false, msg: 'Số CCCD ' + idRes.cccd + ' đã được đăng ký ở hồ sơ khác trong môn này!' };
        }
        if (String(other[18] || '').trim().toUpperCase() === normMhs) {
          return { ok: false, msg: 'Mã học sinh ' + idRes.maHocSinh + ' đã được đăng ký ở hồ sơ khác trong môn này!' };
        }
      }

      var oldPhotoRef = _str(row[19]);
      var anhTheToSave = oldPhotoRef;
      if (vdvData.anhThe !== undefined) {
        if (!idRes.anhThe) {
          anhTheToSave = '';
        } else {
          var pSave = _savePhotoToDrive(idRes.anhThe, String(row[1]) + '_' + idRes.maHocSinh);
          if (!pSave.ok) return pSave;
          anhTheToSave = pSave.ref;
        }
      }

      sheet.getRange(ri, 4, 1, 4).setValues([[idRes.hoTen, idRes.ngaySinh, idRes.gioiTinh, idRes.lop]]);
      sheet.getRange(ri, 10, 1, 3).setValues([[valRes.noiDung, valRes.chiTietHienThi, JSON.stringify(valRes.chiTiet)]]);
      if (vdvData.ghiChu !== undefined) {
        sheet.getRange(ri, 14).setValue(String(vdvData.ghiChu || ''));
      }
      sheet.getRange(ri, 18, 1, 3).setValues([[idRes.cccd, idRes.maHocSinh, anhTheToSave]]);

      if (oldPhotoRef && oldPhotoRef !== anhTheToSave) {
        _trashDriveFileIfUnused(ss, oldPhotoRef, ri);
      }

      _log(callerDv, 'UPDATE_VDV', 'Sửa: ' + idRes.hoTen + ' (' + row[8] + ')');
      return { ok: true, msg: 'Cập nhật thành công!' };
    } catch(e) { return { ok: false, msg: e.message }; }
  });
}

function xoaVDV(token, rowIndex, vdvId) {
  var auth = _requireSession(token, false);
  if (!auth.ok) return auth;
  var callerDv = auth.session.isAdmin ? 'ADMIN' : auth.session.maDonVi;

  return _withLock(function() {
    try {
      var ss = getDb();
      var sheet = ss.getSheetByName(SHEET.VDV);
      var ri = _resolveVdvRow(sheet, vdvId, rowIndex);
      if (ri < 2) return { ok: false, msg: 'Không tìm thấy VĐV!' };
      var row = sheet.getRange(ri, 1, 1, 20).getValues()[0];
      if (!auth.session.isAdmin && String(row[1]).trim() !== auth.session.maDonVi) {
        return { ok: false, msg: 'Không có quyền xóa!' };
      }
      if (!auth.session.isAdmin && String(row[12]) === 'DaDuyet') {
        return { ok: false, msg: 'Không thể xóa VĐV đã được duyệt!' };
      }
      var ten = String(row[3] || '');
      var oldPhotoRef = _str(row[19]);
      sheet.deleteRow(ri);
      if (oldPhotoRef) _trashDriveFileIfUnused(ss, oldPhotoRef, -1);
      _log(callerDv, 'DELETE_VDV', 'Xóa: ' + ten);
      return { ok: true, msg: 'Đã xóa thành công!' };
    } catch(e) { return { ok: false, msg: e.message }; }
  });
}

function duyetVDV(token, rowIndex, trangThai, ghiChu, vdvId) {
  var auth = _requireSession(token, true);
  if (!auth.ok) return auth;
  return _withLock(function() {
    try {
      var sheet = getDb().getSheetByName(SHEET.VDV);
      var ri = _resolveVdvRow(sheet, vdvId, rowIndex);
      if (ri < 2) return { ok: false, msg: 'Không tìm thấy VĐV!' };
      var now = new Date().toISOString();
      sheet.getRange(ri, 13, 1, 5).setValues([[
        trangThai,
        ghiChu || '',
        sheet.getRange(ri, 15).getValue(),
        now,
        'ADMIN'
      ]]);
      _log('ADMIN', trangThai === 'DaDuyet' ? 'APPROVE' : 'REJECT', 'Dòng ' + ri);
      return { ok: true, msg: (trangThai === 'DaDuyet' ? 'Duyệt' : 'Từ chối') + ' thành công!' };
    } catch(e) { return { ok: false, msg: e.message }; }
  });
}

function duyetHangLoat(token, rowIndicesOrIds, trangThai) {
  var auth = _requireSession(token, true);
  if (!auth.ok) return auth;
  return _withLock(function() {
    try {
      var list = Array.isArray(rowIndicesOrIds) ? rowIndicesOrIds : [];
      if (!list.length) return { ok: false, msg: 'Chưa chọn VĐV!' };

      var sheet = getDb().getSheetByName(SHEET.VDV);
      var lastRow = sheet.getLastRow();
      if (lastRow < 2) return { ok: true, msg: 'Đã xử lý 0 VĐV!' };

      var data = sheet.getRange(2, 1, lastRow - 1, 17).getValues();
      var wantId = {};
      var wantRi = {};
      list.forEach(function(v) {
        if (typeof v === 'string') wantId[v] = true;
        else wantRi[parseInt(v, 10)] = true;
      });

      var now = new Date().toISOString();
      var count = 0;
      var updatedBlock = [];
      for (var i = 0; i < data.length; i++) {
        var row = data[i];
        var matched = (row[0] && wantId[String(row[0])]) || wantRi[i + 2];
        if (matched) {
          row[12] = trangThai;
          row[13] = '';
          row[15] = now;
          row[16] = 'ADMIN';
          count++;
        }
        updatedBlock.push([row[12], row[13], row[14], row[15], row[16]]);
      }

      if (count > 0) {
        sheet.getRange(2, 13, updatedBlock.length, 5).setValues(updatedBlock);
        _log('ADMIN', 'BULK_' + trangThai.toUpperCase(), 'Xử lý hàng loạt ' + count + ' VĐV');
      }
      return { ok: true, msg: 'Đã xử lý ' + count + '/' + list.length + ' VĐV!' };
    } catch(e) { return { ok: false, msg: e.message }; }
  });
}

// ================================================================
// THỐNG KÊ (ĐỌC CỘT GỌN NHẸ, KHÔNG TẢI ẢNH / KHÔNG PARSE JSON)
// ================================================================

function layThongKe(token) {
  var auth = _requireSession(token, false);
  if (!auth.ok) return auth;
  try {
    var monRes = layDanhSachMon();
    var monMap = {};
    if (monRes.ok) {
      monRes.data.forEach(function(m) {
        monMap[m.id] = { ten: m.ten, nhom: m.nhom, icon: m.icon, gioiHan: m.gioiHan, soLuong: 0 };
      });
    }

    var tk = {
      tong: 0, choDuyet: 0, daDuyet: 0, tuChoi: 0,
      theoMon: monMap, theoDonVi: {}
    };

    var sheet = getDb().getSheetByName(SHEET.VDV);
    var lastRow = sheet.getLastRow();
    if (lastRow >= 2) {
      var isAdmin = auth.session.isAdmin;
      var targetDv = auth.session.maDonVi;
      // Chỉ đọc cột 1..13 (bỏ qua cột ThoiGian, CCCD, MaHS, AnhThe nặng)
      var data = sheet.getRange(2, 1, lastRow - 1, 13).getValues();
      for (var i = 0; i < data.length; i++) {
        var r = data[i];
        if (!r[0]) continue;
        var rowDv = String(r[1] || '').trim();
        if (!isAdmin && rowDv !== targetDv) continue;

        var tenDv = _str(r[2]);
        var maMon = _str(r[7]);
        var tt = _str(r[12]);

        tk.tong++;
        if (tt === 'ChoDuyet') tk.choDuyet++;
        else if (tt === 'DaDuyet') tk.daDuyet++;
        else if (tt === 'TuChoi') tk.tuChoi++;

        if (tt !== 'TuChoi' && tk.theoMon[maMon]) {
          tk.theoMon[maMon].soLuong++;
        }

        if (isAdmin) {
          if (!tk.theoDonVi[rowDv]) {
            tk.theoDonVi[rowDv] = { ten: tenDv, tong: 0, daDuyet: 0, choDuyet: 0, tuChoi: 0 };
          }
          tk.theoDonVi[rowDv].tong++;
          if (tt === 'DaDuyet') tk.theoDonVi[rowDv].daDuyet++;
          if (tt === 'ChoDuyet') tk.theoDonVi[rowDv].choDuyet++;
          if (tt === 'TuChoi') tk.theoDonVi[rowDv].tuChoi++;
        }
      }
    }

    return { ok: true, data: tk };
  } catch(e) { return { ok: false, msg: e.message }; }
}

// ================================================================
// CÀI ĐẶT
// ================================================================

function layCaiDat(token) {
  var auth = _requireSession(token, true);
  if (!auth.ok) return auth;
  try {
    var data = getDb().getSheetByName(SHEET.CAIDAT).getDataRange().getValues();
    var list = [];
    for (var i = 1; i < data.length; i++) {
      if (!data[i][0]) continue;
      list.push({ khoa: data[i][0], giaTri: String(data[i][1]), moTa: data[i][2], rowIndex: i + 1 });
    }
    return { ok: true, data: list };
  } catch(e) { return { ok: false, msg: e.message }; }
}

function capNhatCaiDat(token, rowIndex, giaTri) {
  var auth = _requireSession(token, true);
  if (!auth.ok) return auth;
  return _withLock(function() {
    try {
      getDb().getSheetByName(SHEET.CAIDAT).getRange(rowIndex, 2).setValue(giaTri);
      _invalidateMetaCache();
      return { ok: true, msg: 'Đã lưu cài đặt!' };
    } catch(e) { return { ok: false, msg: e.message }; }
  });
}

// ================================================================
// XUẤT BÁO CÁO (TỐI ƯU GHI 1 LẦN + BUNG CỘT THEO MÔN)
// ================================================================

function taoSheetBaoCao(token, maDonVi, trangThai, maMon) {
  var auth = _requireSession(token, true);
  if (!auth.ok) return auth;
  try {
    var filters = {};
    if (maDonVi && maDonVi !== 'ALL') filters.maDonVi = maDonVi;
    if (trangThai) filters.trangThai = trangThai;
    if (maMon) filters.maMon = maMon;

    var res = layDanhSachVDV(token, Object.keys(filters).length ? filters : null);
    if (!res.ok) return res;

    var ss = getDb();
    var sportDef = maMon ? _getSportDef(maMon) : null;
    var sheetName = 'BaoCao_' + (maMon || 'TatCa') + '_' + new Date().toISOString().slice(0,10);
    var old = ss.getSheetByName(sheetName);
    if (old) ss.deleteSheet(old);

    var rpt = ss.insertSheet(sheetName);
    rpt.getRange('A1').setValue('DANH SÁCH VĐV ĐĂNG KÝ HKPĐ CẤP TỈNH' + (sportDef ? ' - MÔN ' + sportDef.ten.toUpperCase() : ''))
      .setFontSize(14).setFontWeight('bold');
    rpt.getRange('A2').setValue('Ngày xuất: ' + new Date().toLocaleString('vi-VN'));

    var headers = ['STT','Mã ĐV','Đơn vị','Họ và tên','Ngày sinh','Giới tính','Lớp','Số CCCD','Mã học sinh','Ảnh thẻ','Môn thi'];
    if (sportDef) {
      sportDef.fields.forEach(function(f) { headers.push(f.label); });
    } else {
      headers.push('Nội dung', 'Thông tin chuyên môn');
    }
    headers.push('Trạng thái','Ghi chú','Ngày đăng ký');

    rpt.getRange(4, 1, 1, headers.length).setValues([headers])
      .setBackground('#1565C0').setFontColor('#FFFFFF').setFontWeight('bold');

    if (res.data.length > 0) {
      var bgMatrix = [];
      var rows = res.data.map(function(a, i) {
        var tt = { ChoDuyet:'Chờ duyệt', DaDuyet:'Đã duyệt', TuChoi:'Từ chối' }[a.trangThai] || a.trangThai;
        var row = [i+1, a.maDonVi, a.tenDonVi, a.hoTen, a.ngaySinh, a.gioiTinh, a.lop, a.cccd, a.maHocSinh, a.coAnh ? 'Đã có' : 'Chưa có', a.tenMon];
        if (sportDef) {
          sportDef.fields.forEach(function(f) {
            var val = a.chiTiet ? a.chiTiet[f.key] : '';
            row.push(Array.isArray(val) ? val.join(', ') : (val || ''));
          });
        } else {
          row.push(a.noiDung, a.chiTietHienThi);
        }
        row.push(tt, a.ghiChu, a.thoiGianDK);

        var rowBg = i % 2 === 1 ? '#E3F2FD' : '#FFFFFF';
        var bgRow = [];
        for (var c = 0; c < headers.length; c++) bgRow.push(rowBg);
        bgMatrix.push(bgRow);
        return row;
      });
      var dataRange = rpt.getRange(5, 1, rows.length, headers.length);
      dataRange.setValues(rows);
      dataRange.setBackgrounds(bgMatrix);
    }
    rpt.autoResizeColumns(1, headers.length);
    _log('ADMIN', 'CREATE_REPORT', sheetName);
    return { ok: true, msg: 'Tạo báo cáo thành công! Mở Google Sheets để xem.', url: ss.getUrl() };
  } catch(e) { return { ok: false, msg: e.message }; }
}

// ================================================================
// TIỆN ÍCH NỘI BỘ
// ================================================================

function _str(val) {
  if (val === null || val === undefined) return '';
  return String(val);
}

function _resolveVdvRow(sheet, vdvId, rowIndex) {
  if (vdvId) {
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(vdvId)) return i + 1;
    }
  }
  var ri = parseInt(rowIndex, 10);
  if (ri >= 2 && ri <= sheet.getLastRow()) return ri;
  return -1;
}

function _getCaiDatMap(ss) {
  try {
    var cached = _getCache().get('META_CAIDAT');
    if (cached) return JSON.parse(cached);
  } catch(e) {}
  var map = {};
  try {
    var data = ss.getSheetByName(SHEET.CAIDAT).getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (data[i][0]) map[String(data[i][0])] = String(data[i][1]);
    }
    try { _getCache().put('META_CAIDAT', JSON.stringify(map), CACHE_TTL_SEC); } catch(e2) {}
  } catch(e3) {}
  return map;
}

function _formatDate(val) {
  if (!val) return '';
  try {
    if (Object.prototype.toString.call(val) === '[object Date]') {
      if (isNaN(val.getTime())) return '';
      var tz = (typeof Session !== 'undefined' && Session.getScriptTimeZone) ? Session.getScriptTimeZone() : 'Asia/Ho_Chi_Minh';
      return Utilities.formatDate(val, tz || 'Asia/Ho_Chi_Minh', 'dd/MM/yyyy');
    }
    var s = String(val).trim();
    var mIso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (mIso) return mIso[3] + '/' + mIso[2] + '/' + mIso[1];
    var mVn = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (mVn) return s;

    var d = new Date(s);
    if (isNaN(d.getTime())) return s;
    return Utilities.formatDate(d, 'Asia/Ho_Chi_Minh', 'dd/MM/yyyy');
  } catch(e) { return String(val || ''); }
}

function _log(user, action, detail) {
  try {
    var sheet = getDb().getSheetByName(SHEET.LOG);
    if (!sheet) return;
    sheet.appendRow([new Date().toISOString(), user, action, detail]);
    var last = sheet.getLastRow();
    if (last > 2001) sheet.deleteRows(2, last - 2001);
  } catch(e) {}
}
