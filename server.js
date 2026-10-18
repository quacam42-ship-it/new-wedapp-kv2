require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const { google } = require('googleapis');
const QRCode = require('qrcode');
const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname));

let auth;
if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
  auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
} else {
  auth = new google.auth.GoogleAuth({
    keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY || './service_account.json',
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

const sheets = google.sheets({ version: 'v4', auth });

const SPREADSHEET_ID = process.env.SHEET_ID_KV2 || '1oAjw3Vp5TtRSKVCXskbALY8e-HlW655WeGc2AFsDdoA';
const SPREADSHEET_TONG_QUAN_ID = process.env.SHEET_ID_TONG_QUAN || '1egevDkO38jiwpsRr_QG3-tvwgePxWMq6sNFznkKlwqw';
const SPREADSHEET_ANH_ID = '1p6zmz_WBqq7SBxrwonwRkrI01Ev-LdV7T1UQyWT9Pw4';
const SPREADSHEET_ACCOUNT_ID = '11LnKW1wqrD9-jwoCLkgYc1OGGmSWb5vIj5GZGaBWfmw';
const SPREADSHEET_INBOUND_COT_ID = '1GIbBPQ1Mp46CyT9T-AurNDCyCA52VZkrp4IBOnQAjow';

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/diem-danh', (req, res) => {
  res.sendFile(path.join(__dirname, 'diem-danh.html'));
});
app.get('/rd-dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'rd-dashboard.html'));
});
// ================= CÁC HÀM TIỆN ÍCH DÙNG CHUNG =================

function toColLetter(colIdx) {
  let temp = colIdx + 1;
  let letter = '';
  while (temp > 0) {
    let rem = (temp - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    temp = Math.floor((temp - 1) / 26);
  }
  return letter;
}

function chuanHoaNgayIso(strNgay) {
  if (!strNgay) return '';
  const s = strNgay.toString().trim();
  if (s.includes('/')) {
    const p = s.split('/');
    if (p.length === 3) {
      const d = String(p[0]).padStart(2, '0');
      const m = String(p[1]).padStart(2, '0');
      const y = p[2].length === 2 ? '20' + p[2] : p[2];
      return `${y}-${m}-${d}`;
    }
  }
  if (s.includes('-')) {
    const p = s.split('-');
    if (p.length === 3 && p[0].length === 4) {
      const y = p[0];
      const m = String(p[1]).padStart(2, '0');
      const d = String(p[2]).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }
  return s;
}

function getPhamViNgayTrongTuan(dateObj) {
  try {
    const d = new Date(dateObj);
    if (isNaN(d.getTime())) return { tuNgay: '--/--/----', denNgay: '--/--/----' };
    const day = d.getDay();
    const diffToMonday = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d);
    monday.setDate(diffToMonday);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const f = (dt) => `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`;
    return { tuNgay: f(monday), denNgay: f(sunday) };
  } catch (e) {
    return { tuNgay: '--/--/----', denNgay: '--/--/----' };
  }
}

function getTuanKey(dateObj) {
  try {
    const d = new Date(dateObj);
    if (isNaN(d.getTime())) return 'Tuần_Hôm_Nay';
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return `Tuần_${weekNo}_Năm_${d.getUTCFullYear()}`;
  } catch (e) {
    return 'Tuần_Hôm_Nay';
  }
}

// ================= API BACKEND CHÍNH =================

// 1. API: Tuyến Rider & Lịch OFF
app.get('/api/rider-data', async (req, res) => {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_TONG_QUAN_ID,
      range: "'TỔNG QUAN RD'!M1:EF",
    });

    const values = response.data.values || [];
    if (values.length < 3) return res.json({ riders: [], dateHeaders: [] });

    const row1 = values[0] || [];
    const row2 = values[1] || [];

    const dateHeaders = [];
    for (let c = 13; c < row2.length; c++) {
      const cellDate = (row2[c] || '').toString().trim();
      const cellThu = (row1[c] || '').toString().trim();
      if (cellDate && (cellDate.includes('/') || cellDate.includes('-'))) {
        dateHeaders.push({
          colIdx: c,
          thu: cellThu || '',
          date: cellDate,
        });
      }
    }

    const riders = [];
    for (let r = 2; r < values.length; r++) {
      const row = values[r];
      if (!row || !row[4] || !row[4].toString().trim()) continue;

      const dailySchedule = {};
      dateHeaders.forEach(dh => {
        dailySchedule[dh.date] = (row[dh.colIdx] || '').toString().trim();
      });

      const rawQuanDeli = (row[8] || '').toString().trim();
      const rawPhuongDeli = (row[9] || '').toString().trim();
      const isBackup = rawQuanDeli.toUpperCase().includes('BK') || rawPhuongDeli.toUpperCase().includes('BACKUP');

      riders.push({
        khuVuc: row[0] || '',
        quanO: row[1] || '',
        ca: (row[2] || '').toString().trim(),
        id: (row[3] || '').toString().trim(),
        name: (row[4] || '').toString().trim(),
        ten: (row[4] || '').toString().trim(),
        quanPick: row[5] || '',
        phuongPick: row[6] || '',
        tuyenPick: row[7] || '',
        quanDeli: rawQuanDeli,
        quan: rawQuanDeli,
        phuongDeli: rawPhuongDeli,
        isBackup: isBackup,
        isBK: isBackup,
        nhom: row[10] || '',
        tongOff: row[11] || '0',
        lichOff: row[12] || '',
        dailySchedule: dailySchedule,
      });
    }

    res.json({ riders, dateHeaders });
  } catch (error) {
    console.error('Lỗi đọc Tuyến Rider:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// 2. API: Performance
app.get('/api/performance-data', async (req, res) => {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "'PERFORMANCE TODAY'!B9:P150",
    });
    const values = response.data.values || [];
    if (values.length < 2) {
      return res.json({ headers: ['Thông báo'], rows: [['Chưa có dữ liệu Performance']] });
    }

    const headers = values[0].filter(Boolean);
    const rows = values.slice(1).filter(r => r.some(c => c && c.toString().trim()));

    res.json({ headers, rows });
  } catch (error) {
    console.warn('Lỗi đọc Performance:', error.message);
    res.json({ headers: ['Thông báo'], rows: [['Đang cập nhật dữ liệu Performance...']] });
  }
});

// 3. API: HÀNG HÓA - COUNT ĐÚNG 100% ĐƠN CHƯA GÁN RIDER (LMHub_Received & TRỐNG DRIVER_NAME)
app.get('/api/hang-hoa-data', async (req, res) => {
  try {
    const resSummary = await sheets.spreadsheets.values.batchGet({
      spreadsheetId: SPREADSHEET_ID,
      ranges: [
        "'ĐƠN RỚT TRONG NGÀY'!A4:M7",   // Hàng 4: Tiêu đề KPI, Hàng 5: Số liệu KPI, Hàng 7: Last update
        "'ĐƠN RỚT TRONG NGÀY'!D14:H21", // Bảng Top phường rớt (#1 -> #6)
        "'ĐƠN RỚT TRONG NGÀY'!A8:C50",  // Bảng Pivot danh sách phường 3 quận
        "'DATA INBOUND'!A2:T",          // Toàn bộ dữ liệu đơn Inbound để lấy danh sách chi tiết
      ],
    });

    const valRange = resSummary.data.valueRanges || [];
    const kpiRows = valRange[0]?.values || [];
    const topRows = valRange[1]?.values || [];
    const pivotRows = valRange[2]?.values || [];
    const inboundRows = valRange[3]?.values || [];

    // 1. Last Update từ ô A7
    let lastUpdateStr = '';
    if (kpiRows.length >= 4 && kpiRows[3] && kpiRows[3][0]) {
      lastUpdateStr = kpiRows[3][0].replace(/last update\s*:\s*/i, '').trim();
    } else {
      lastUpdateStr = new Date().toLocaleTimeString('vi-VN');
    }

    // 2. 7 Thẻ KPI từ Hàng 5
    const valRow = kpiRows.length >= 2 ? kpiRows[1] : [];
    const kpi = {
      tongDon: valRow[0] || '0',
      phuNhuan: valRow[2] || '0',
      tanBinh: valRow[4] || '0',
      thuDuc: valRow[6] || '0',
      donMp: valRow[8] || '0',
      donWh: valRow[10] || '0',
      donHv: valRow[12] || '0',
      lastUpdate: lastUpdateStr,
    };

    // 3. Top Phường rớt (#1 -> #6)
    const top5Phuong = [];
    topRows.forEach((r, idx) => {
      if (idx === 0) return;
      if (r && r[1] && r[2] && r[3]) {
        const fullTen = r[2].trim();
        let qName = '';
        if (fullTen.includes('Quận 7')) qName = 'Quận 7';
        else if (fullTen.includes('Quận 4')) qName = 'Quận 4';
        else if (fullTen.includes('Quận 2')) qName = 'Quận 2';

        const cleanP = fullTen.replace(/\s*\([^)]*\)/g, '').trim();

        top5Phuong.push({
          hang: r[1].trim(),
          ten: cleanP,
          quan: qName,
          soLuong: r[3].trim(),
        });
      }
    });

    // 4. Bảng chi tiết phường 3 quận
    const listPN = [], listTB = [], listTD = [];
    let currentDistrict = 'Quận 2';

    pivotRows.forEach(r => {
      if (!r || r.length < 2) return;
      const colA = (r[0] || '').toString().trim();
      const colB = (r[1] || '').toString().trim();
      const colC = (r[2] || '').toString().trim();

      if (colA.includes('Quận Quận 4') && !colA.includes('Total')) {
        currentDistrict = 'Quận 4';
      } else if ((colA.includes('Quận 7') || colA.includes('TP. Quận 7')) && !colA.includes('Total')) {
        currentDistrict = 'Quận 7';
      }

      if (colA.includes('Total') || colB.includes('Total') || colA.includes('Grand')) return;

      if (colB && colC && !isNaN(colC.replace(/,/g, ''))) {
        const item = {
          phuong: colB,
          soLuong: colC,
          quan: currentDistrict,
        };
        if (currentDistrict === 'Quận 2') listPN.push(item);
        else if (currentDistrict === 'Quận 4') listTB.push(item);
        else if (currentDistrict === 'Quận 7') listTD.push(item);
      }
    });

    // Sắp xếp thứ tự quy chuẩn cho 3 quận
    const thuTuThuDuc = [
      'Hiệp Bình Chánh', 'Hiệp Bình Phước', 'Linh Đông', 'Bình Chiểu',
      'Tam Bình', 'Tam Phú', 'Linh Chiểu', 'Bình Thọ',
      'Trường Thọ', 'Linh Trung', 'Linh Xuân', 'Linh Tây',
    ];

    listTD.sort((a, b) => {
      let idxA = thuTuThuDuc.findIndex(t => a.phuong.toLowerCase().includes(t.toLowerCase()));
      let idxB = thuTuThuDuc.findIndex(t => b.phuong.toLowerCase().includes(t.toLowerCase()));
      if (idxA === -1) idxA = 999;
      if (idxB === -1) idxB = 999;
      return idxA - idxB;
    });

    const sortSoNhoDenLon = (arr) => {
      arr.sort((a, b) => {
        const numA = parseInt(a.phuong.replace(/\D/g, ''), 10) || 0;
        const numB = parseInt(b.phuong.replace(/\D/g, ''), 10) || 0;
        return numA - numB;
      });
    };

    sortSoNhoDenLon(listPN);
    sortSoNhoDenLon(listTB);

    // 5. LỌC ĐÚNG 100% CÁC ĐƠN CHƯA GÁN RIDER TỪ DATA INBOUND
    // Điều kiện chuẩn: Cột N (index 13) = LMHub_Received VÀ Cột F (index 5) driver_name trống
    const inboundOrdersCache = [];
    inboundRows.forEach(r => {
      if (!r || !r[0]) return;
      const shipmentId = (r[0] || '').toString().trim();
      const driverId = (r[4] || '').toString().trim();
      const driverName = (r[5] || '').toString().trim();
      const statusV1 = (r[13] || '').toString().trim();

      const isLMHubReceived = statusV1.toLowerCase() === 'lmhub_received' || statusV1.includes('LMHub_Received');
      const isChuaGanRider = driverName === '' || driverName.toLowerCase() === 'chưa gán' || driverName.toLowerCase() === 'nan';

      if (isLMHubReceived && isChuaGanRider) {
        const rawHv = (r[12] || '').toString().toLowerCase().trim();

        const isHv = (rawHv === 'yes' || rawHv === 'y' || rawHv === '1' || rawHv === 'true' || rawHv === 'hv');

        const rawWhs = (r[9] || '').toString().trim();
        const isMP = (rawWhs === '' || rawWhs === '0' || rawWhs.toLowerCase() === 'null');

        inboundOrdersCache.push({
          shipmentId: shipmentId,
          zoneId: (r[1] || '').toString().trim(),
          receivedTime: (r[6] || '').toString().trim(),
          isHv: isHv ? 'yes' : 'no',
          loaiHang: isMP ? 'MP' : 'WH',
          quan: (r[18] || '').toString().trim(),   // Cột S: Quận Cũ
          phuong: (r[19] || '').toString().trim(), // Cột T: Phường Cũ
        });
      }
    });

    res.json({
      kpi,
      top5Phuong,
      phuongPhuNhuan: listPN,
      phuongTanBinh: listTB,
      phuongThuDuc: listTD,
      inboundOrdersCache,
    });
  } catch (error) {
    console.error('Lỗi API Hàng Hóa:', error.message);
    res.json({
      kpi: { tongDon: '0', phuNhuan: '0', tanBinh: '0', thuDuc: '0', donMp: '0', donWh: '0', donHv: '0', lastUpdate: 'Đang kết nối...' },
      top5Phuong: [],
      phuongPhuNhuan: [],
      phuongTanBinh: [],
      phuongThuDuc: [],
      inboundOrdersCache: [],
    });
  }
});

// 3.5 API: ĐỌC DỮ LIỆU INBOUND TỪ SHEET MỚI (ĐẾM THEO QUẬN CŨ - PHƯỜNG CŨ)
app.get('/api/hang-hoa-inbound', async (req, res) => {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_INBOUND_COT_ID, 
      range: "'TOTAL INBOUND'!A2:R99000",
    });

    const rows = response.data.values || [];
    const uniqueOrders = new Map();

    // 1. ĐỌC DỮ LIỆU VÀ LỌC TRÙNG SHIPMENT ID
    rows.forEach(r => {
      if (!r || !r[0]) return;
      
      const shipmentId = (r[0] || '').toString().trim();      // Cột A
      const whsId = (r[9] || '').toString().trim();           // Cột J
      const statusV1 = (r[12] || '').toString().trim();       // Cột M
      const cotRC = (r[14] || '').toString().trim();          // Cột O
      const quanCu = (r[16] || '').toString().trim();         // Cột Q (Quận Cũ)
      const phuongCu = (r[17] || '').toString().trim();       // Cột R (Phường Cũ)

      // Chỉ lấy đơn có trạng thái LMHub_Received
      if (statusV1 === 'LMHub_Received') {
        if (!uniqueOrders.has(shipmentId)) {
          uniqueOrders.set(shipmentId, {
            cotRC, whsId, quanCu, phuongCu
          });
        }
      }
    });

    let mapCot1 = {};
    let mapCot2 = {};
    let tongWH = 0, tongMP = 0;
    let sumCot1 = 0, sumCot2 = 0;

    // 2. DUYỆT QUA CÁC ĐƠN ĐÃ LỌC TRÙNG ĐỂ ĐẾM VÀ GOM NHÓM THEO PHƯỜNG CŨ
    uniqueOrders.forEach((data, shipmentId) => {
      const quan = data.quanCu || 'Chưa rõ';
      const phuong = data.phuongCu || 'Chưa rõ';
      const keyGroup = `${quan}|${phuong}`;

      if (data.cotRC === 'COT 1') {
         mapCot1[keyGroup] = (mapCot1[keyGroup] || 0) + 1;
         sumCot1++;
      } else if (data.cotRC === 'COT 2') {
         mapCot2[keyGroup] = (mapCot2[keyGroup] || 0) + 1;
         sumCot2++;
      }

      // MP là khi cột J trống
      if (data.whsId === '' || data.whsId.toLowerCase() === 'nan') tongMP++;
      else tongWH++;
    });

    // 3. CHUYỂN ĐỔI MAP THÀNH ARRAY ĐỂ TRẢ VỀ CHO POPUP
    const formatList = (mapObj) => {
      return Object.keys(mapObj).map(k => {
        const parts = k.split('|');
        return { quan: parts[0], phuong: parts[1], soLuong: mapObj[k] };
      }).sort((a, b) => b.soLuong - a.soLuong);
    };

    res.json({
      success: true,
      data: {
        tongDonKhuVuc: uniqueOrders.size,
        tongCot1: sumCot1,
        tongCot2: sumCot2,
        tongWH: tongWH,
        tongMP: tongMP,
        chiTietCot1: formatList(mapCot1),
        chiTietCot2: formatList(mapCot2)
      }
    });

  } catch (error) {
    console.error('Lỗi API Hàng Hóa INBOUND:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 3.8 API: LƯU GÁN TUYẾN LÊN SHEET (HỖ TRỢ CẢ DELI VÀ PICK)
app.post('/api/luu-backup-ghep', async (req, res) => {
  try {
    const { backupMatches, loai } = req.body;
    if (!backupMatches || backupMatches.length === 0) {
      return res.status(400).json({ success: false, message: 'Không có dữ liệu' });
    }
    
    // Tự động nhận diện lưu vào Sheet nào
    const sheetTab = loai === 'PICK' ? 'KV2 PICK' : 'KV2 DELI';
    const SPREADSHEET_BACKUP_ID = '1S9kl-xKSygGsjQeQOUZD_7o42gBE34psk6lXFje57xw';
    const timestamp = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
    
    const newRows = backupMatches.map(m => [
      m.ngay, m.idGoc, m.tenGoc, m.tuyenGan, m.idBk, m.tenBk, m.nguoiGan, timestamp
    ]);
    
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_BACKUP_ID,
      range: `'${sheetTab}'!A:H`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: newRows }
    });
    res.json({ success: true, message: `Đã lưu thành công lên ${sheetTab}` });
  } catch (error) {
    console.error("Lỗi API luu-backup-ghep:", error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

// HẰNG SỐ CẤU HÌNH SHEET LỊCH OPS 1-2
const SPREADSHEET_OPS_1_2_ID = '16FR3ZguAnhRWbPF3sImEf3gYA-Ha4OA7Y5UeHJLxzYk';
const GID_OPS_1_2 = 1744237792;

// HÀM CHUẨN HÓA NGÀY VỀ ĐỊNH DẠNG DD/MM (CHỈ BẮT Ô NGÀY THUẦN TÚY, BỎ QUA Ô TIÊU ĐỀ CỘT Y)
function chuanHoaNgayDDMM(dStr) {
  if (!dStr) return '';
  let s = dStr.toString().trim();
  
  // Loại bỏ hoàn toàn các ô tiêu đề dài như "THỨ / NGÀY OFF ( TUẦN 12/10 - 18/10 )" ở cột Y
  if (s.toUpperCase().includes('TUẦN') || s.toUpperCase().includes('THÁNG') || s.includes('-')) {
    // Tuy nhiên nếu là định dạng ngày YYYY-MM-DD hoặc DD-MM thì vẫn cho phép
    if (!/^\d{1,4}-\d{1,2}(-\d{1,4})?$/.test(s)) return '';
  }

  // Chỉ nhận diện nếu toàn bộ ô đó là Ngày (VD: "12/10", "12/10/2026")
  const match = s.match(/^(\d{1,2})[\/\-](\d{1,2})(?:[\/\-]\d{2,4})?$/);
  if (match) {
    return `${String(match[1]).padStart(2, '0')}/${String(match[2]).padStart(2, '0')}`;
  }
  return '';
}

// HÀM TỰ ĐỘNG DÒ TỌA ĐỘ VÀ GHI/XÓA LỊCH OFF TRÊN TỔNG QUAN RD & OPS 1-2
async function capNhatLichOffVaoSheet(spreadsheetId, sheetTitleOrGid, ridersData, mode = 'NEW') {
  let sheetTitle = sheetTitleOrGid;

  // Nếu truyền vào mã GID (số), tự động truy vấn tên Tab tương ứng
  if (typeof sheetTitleOrGid === 'number') {
    const meta = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: 'sheets.properties(title,sheetId)'
    });
    const foundSheet = (meta.data.sheets || []).find(s => s.properties.sheetId === sheetTitleOrGid);
    if (!foundSheet) throw new Error(`Không tìm thấy Tab có gid=${sheetTitleOrGid}`);
    sheetTitle = foundSheet.properties.title;
  }

  // Mở rộng vùng đọc lên 1000 dòng để bắt trọn cả KV1 + KV2 trên sheet Ops 1-2
  const resSheet = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${sheetTitle}'!A1:ZZ5000`,
  });
  const rows = resSheet.data.values || [];
  if (rows.length < 2) return { updatedCells: 0, logs: [] };

  // 1. Tự động tìm dòng chứa tiêu đề Ngày (quét 10 dòng đầu, chỉ đếm các ô ngày thuần túy từ cột Z trở đi hoặc từ cột S trở đi)
  let bestDateRowIdx = 1;
  let maxDateCount = 0;
  for (let r = 0; r < Math.min(10, rows.length); r++) {
    let count = 0;
    const rowArr = rows[r] || [];
    for (let c = 18; c < rowArr.length; c++) {
      if (chuanHoaNgayDDMM(rowArr[c]) !== '') count++;
    }
    if (count > maxDateCount) {
      maxDateCount = count;
      bestDateRowIdx = r;
    }
  }

  // Bắt đầu quét cột Ngày từ sau cột Y (tức từ cột Z = index 25 đối với TỔNG QUAN RD, hoặc từ cột S = index 18 đối với Ops 1-2)
  const startDateColIdx = (sheetTitle === 'TỔNG QUAN RD') ? 25 : 18;
  const dateRow = rows[bestDateRowIdx] || [];
  const dateColLetterMap = {};
  const dateColIdxMap = {};

  for (let c = startDateColIdx; c < dateRow.length; c++) {
    const cellVal = dateRow[c];
    if (!cellVal) continue;
    const normKey = chuanHoaNgayDDMM(cellVal);
    if (normKey) {
      const colLetter = toColLetter(c);
      if (!dateColLetterMap[normKey]) {
        dateColLetterMap[normKey] = colLetter;
        dateColIdxMap[normKey] = c;
      }
    }
  }

  // 2. Dò tìm dòng của Rider theo Cột P (index 15 - Cột ID chuẩn trên cả TỔNG QUAN RD và Ops 1-2)
  const riderRowNumMap = {};
  for (let r = bestDateRowIdx + 1; r < rows.length; r++) {
    const row = rows[r] || [];
    const idColP = (row[15] || '').toString().trim(); // Cột P = index 15
    if (idColP) {
      riderRowNumMap[idColP] = r + 1;
    } else {
      // Dự phòng nếu có bảng đặt ID ở cột khác
      for (let c = 0; c < Math.min(18, row.length); c++) {
        const val = (row[c] || '').toString().trim();
        if (/^\d{5,8}$/.test(val) && !riderRowNumMap[val]) {
          riderRowNumMap[val] = r + 1;
        }
      }
    }
  }

  const updateDataList = [];
  const logs = [];

  ridersData.forEach(rd => {
    const riderId = (rd.id || '').toString().trim();
    const rowNum = riderRowNumMap[riderId];
    if (!rowNum) {
      logs.push({ rd, status: `Không tìm thấy ID ${riderId} trên ${sheetTitle}` });
      return;
    }

    const datesToProcess = rd.dates || (rd.ngayOff ? [rd.ngayOff] : []);
    const normNewDates = datesToProcess.map(d => chuanHoaNgayDDMM(d)).filter(Boolean);
    const giaTriGhi = rd.loaiOff || 'OFF';

    // NẾU CHỌN CHẾ ĐỘ THAY ĐỔI NGÀY OFF (REPLACE): Xóa các ngày OFF cũ trong tuần đó trước khi ghi ngày mới
    if (mode === 'REPLACE' && Array.isArray(rd.weekDates)) {
      const currentRowData = rows[rowNum - 1] || [];
      rd.weekDates.forEach(wDate => {
        const normW = chuanHoaNgayDDMM(wDate);
        if (normW && !normNewDates.includes(normW)) {
          const colLetter = dateColLetterMap[normW];
          const colIdx = dateColIdxMap[normW];
          if (colLetter && colIdx !== undefined) {
            const currentCellVal = (currentRowData[colIdx] || '').toString().trim();
            if (currentCellVal.toLowerCase().includes('off')) {
              updateDataList.push({
                range: `'${sheetTitle}'!${colLetter}${rowNum}`,
                values: [['']],
              });
            }
          }
        }
      });
    }

    // Ghi các ngày OFF mới vào đúng cột ngày
    normNewDates.forEach(normKey => {
      const colLetter = dateColLetterMap[normKey];
      if (colLetter) {
        updateDataList.push({
          range: `'${sheetTitle}'!${colLetter}${rowNum}`,
          values: [[giaTriGhi]],
        });
        logs.push({ rd, dVal: normKey, giaTriGhi, status: `Đã ghi ô ${colLetter}${rowNum} (${sheetTitle})` });
      } else {
        logs.push({ rd, dVal: normKey, giaTriGhi, status: `Không tìm thấy cột ngày ${normKey} (${sheetTitle})` });
      }
    });
  });

  if (updateDataList.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: { valueInputOption: 'USER_ENTERED', data: updateDataList },
    });
  }

  return { updatedCells: updateDataList.length, logs };
}

// 4. API: Đồng bộ hàng loạt lịch OFF lên 'TỔNG QUAN RD', 'Ops 1-2' và lưu chuẩn 10 cột vào 'LƯU ĐIỀN OFF'
app.post('/api/dong-bo-hang-loat', async (req, res) => {
  try {
    const payload = req.body || {};
    const userRole = (payload.userRole || req.headers['x-user-role'] || '').toUpperCase();
    const ridersData = payload.ridersData || [];
    const mode = payload.mode || 'NEW'; // 'NEW' hoặc 'REPLACE'
    const nguoiGan = payload.nguoiGan || 'FTE / Admin';
    const tuanLamViecChung = payload.tuanLamViec || '';
    
    if (userRole === 'RIDER') {
      return res.status(403).json({ success: false, error: 'Tài khoản Rider chỉ có quyền XEM!' });
    }

    // 1. Đồng bộ vào Sheet TỔNG QUAN RD
    const resMain = await capNhatLichOffVaoSheet(SPREADSHEET_TONG_QUAN_ID, 'TỔNG QUAN RD', ridersData, mode);

    // 2. Đồng bộ sang Sheet Lịch Ops 1-2 (gid=1744237792)
    const resOps = await capNhatLichOffVaoSheet(SPREADSHEET_OPS_1_2_ID, GID_OPS_1_2, ridersData, mode);
    const opsMsg = ` và đồng bộ sang Lịch Ops 1-2 (${resOps.updatedCells} ô)`;

    // 3. Ghi nhật ký chuẩn 10 cột vào LƯU ĐIỀN OFF:
    // [Thời gian ghi nhận, Tuần làm việc, Mã ID, Họ và tên, Ca làm việc, Địa bàn / Tuyến, Chi tiết ngày OFF, Tổng ngày off, FTE điền, Kiểu off]
    const timestamp = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
    const kieuOffText = mode === 'REPLACE' ? 'Đổi ngày OFF' : 'Đăng ký mới';

    const updateLogRows = ridersData.map(rd => {
      const datesArr = rd.dates || (rd.ngayOff ? [rd.ngayOff] : []);
      const loai = rd.loaiOff || 'OFF';
      const chiTiet = rd.chiTietNgayOff || (datesArr.length > 0 ? `${loai} (${datesArr.join(', ')})` : loai);

      return [
        timestamp,                                    // Cột A: Thời gian ghi nhận
        rd.tuanLamViec || tuanLamViecChung || '—',    // Cột B: Tuần làm việc
        rd.id || '',                                  // Cột C: Mã ID
        rd.ten || rd.name || '',                      // Cột D: Họ và tên
        rd.ca || '—',                                 // Cột E: Ca làm việc
        rd.diaBan || '—',                             // Cột F: Địa bàn / Tuyến
        chiTiet,                                      // Cột G: Chi tiết ngày OFF (Đã tách riêng)
        datesArr.length,                              // Cột H: Tổng ngày OFF
        rd.ghiChu || '—',                             // Cột I: Ghi chú (Nằm kế bên Tổng ngày OFF)
        nguoiGan,                                     // Cột J: FTE điền
        kieuOffText                                   // Cột K: Kiểu OFF (Đăng ký mới / Đổi ngày OFF)
      ];
    });

    if (updateLogRows.length > 0) {
      sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_TONG_QUAN_ID,
        range: "'LƯU ĐIỀN OFF'!A:K",
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: updateLogRows },
      }).catch(e => console.warn("Lỗi ghi log LƯU ĐIỀN OFF:", e.message));
    }

    // 4. Lưu gộp dữ liệu ghép tuyến lên KV2 DELI (nếu có)
    const backupMatches = payload.backupMatches || [];
    if (backupMatches.length > 0) {
      try {
        const SPREADSHEET_BACKUP_ID = '1S9kl-xKSygGsjQeQOUZD_7o42gBE34psk6lXFje57xw';
        const newRows = backupMatches.map(m => [m.ngay, m.idGoc, m.tenGoc, m.tuyenGan, m.idBk, m.tenBk]);
        await sheets.spreadsheets.values.append({
          spreadsheetId: SPREADSHEET_BACKUP_ID,
          range: "'KV2 DELI'!A:F",
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: newRows }
        });
      } catch (err) {
        console.warn("Lỗi lưu Backup Deli vào KV2 DELI:", err.message);
      }
    }

    return res.status(200).json({
      success: true,
      message: `Đã cập nhật TỔNG QUAN RD (${resMain.updatedCells} ô)${opsMsg} thành công!`,
      soLuongCapNhat: resMain.updatedCells,
    });

  } catch (error) {
    console.error('Lỗi thực thi dong-bo-hang-loat:', error);
    return res.status(500).json({ success: false, error: 'Lỗi máy chủ: ' + error.message });
  }
});

// 4.5 API: KIỂM TRA LỊCH SỬ VÀ DANH SÁCH ĐÃ GÁN TRONG NGÀY (HỖ TRỢ CẢ DELI VÀ PICK)
app.get('/api/danh-sach-bk-da-gan', async (req, res) => {
  try {
    const { ngay, loai } = req.query;
    if (!ngay) return res.json({ success: true, bkDaGan: [], tuyenDaGan: [], lichSuGan: [] });

    const sheetTab = loai === 'PICK' ? 'KV2 PICK' : 'KV2 DELI';
    const SPREADSHEET_BACKUP_ID = '1S9kl-xKSygGsjQeQOUZD_7o42gBE34psk6lXFje57xw';
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_BACKUP_ID,
      range: `'${sheetTab}'!A2:H5000`, 
    });
    
    const rows = response.data.values || [];
    let bkDaGan = [];
    let tuyenDaGan = []; // Thêm mảng khóa tuyến bên trái
    const groupMap = {}; 
    
    rows.forEach(r => {
      const rNgay = (r[0] || '').toString().trim();
      const idGoc = (r[1] || '').toString().trim();
      const tuyenGan = (r[3] || '').toString().trim();
      const idBk = (r[4] || '').toString().trim();
      const tenBk = (r[5] || '').toString().trim();
      const nguoiGan = (r[6] || '').toString().trim();

      if (rNgay === ngay && idBk) {
        if (idGoc === 'HỦY GÁN' || tuyenGan === 'HỦY GÁN') {
            bkDaGan = bkDaGan.filter(id => String(id) !== String(idBk));
            if (groupMap[idBk] && groupMap[idBk].originalIds) {
                groupMap[idBk].originalIds.forEach(tId => {
                    tuyenDaGan = tuyenDaGan.filter(id => String(id) !== String(tId));
                });
            }
            delete groupMap[idBk];
        } else {
            if (!bkDaGan.includes(idBk)) bkDaGan.push(idBk);
            if (idGoc !== 'TUYẾN TỔNG' && !tuyenDaGan.includes(idGoc)) tuyenDaGan.push(idGoc);
            
            if (!groupMap[idBk]) {
              groupMap[idBk] = { idBk, tenBk, routes: [], originalIds: [], nguoiGan };
            }
            groupMap[idBk].routes.push(tuyenGan !== '' ? tuyenGan : idGoc);
            groupMap[idBk].originalIds.push(idGoc);
            if (nguoiGan) groupMap[idBk].nguoiGan = nguoiGan;
        }
      }
    });
    
    const lichSuGan = Object.values(groupMap);
    res.json({ success: true, bkDaGan, tuyenDaGan, lichSuGan });
  } catch (error) {
    console.warn(`Lỗi đọc sheet ${loai === 'PICK' ? 'KV2 PICK' : 'KV2 DELI'}:`, error.message);
    res.json({ success: true, bkDaGan: [], tuyenDaGan: [], lichSuGan: [] });
  }
});

// 5. Cấu hình đóng/mở cổng điểm danh
let cauHinhHaiCa = {
  COT1: { trangThaiThuCong: 'MO', gioMo: '11:40', gioDong: '12:15' },
  COT2: { trangThaiThuCong: 'MO', gioMo: '15:30', gioDong: '16:15' },
};

function kiemTraCaDangMo(caKey) {
  const ca = caKey === 'COT2' ? 'COT2' : 'COT1';
  const cfg = cauHinhHaiCa[ca];
  if (cfg.trangThaiThuCong === 'DONG') {
    return { dangMo: false, lyDo: `Điều phối đã KHÓA cổng điểm danh của ${ca === 'COT2' ? 'COT 2' : 'COT 1'}!` };
  }
  if (cfg.trangThaiThuCong === 'EP_MO') return { dangMo: true };

  const now = new Date();
  const gioHienTai = now.toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour12: false, hour: '2-digit', minute: '2-digit' });
  if (gioHienTai < cfg.gioMo || gioHienTai > cfg.gioDong) {
    return { dangMo: false, lyDo: `Hết giờ điểm danh ${ca === 'COT2' ? 'COT 2' : 'COT 1'} (Khung giờ: ${cfg.gioMo} - ${cfg.gioDong})!` };
  }
  return { dangMo: true };
}

app.get('/api/cau-hinh-diem-danh', (req, res) => {
  const check1 = kiemTraCaDangMo('COT1');
  const check2 = kiemTraCaDangMo('COT2');
  res.json({
    COT1: { ...cauHinhHaiCa.COT1, dangMoThucTe: check1.dangMo, thongBao: check1.lyDo || 'Đang mở' },
    COT2: { ...cauHinhHaiCa.COT2, dangMoThucTe: check2.dangMo, thongBao: check2.lyDo || 'Đang mở' },
  });
});

app.post('/api/cap-nhat-cau-hinh-ca', (req, res) => {
  const userRole = (req.body.userRole || req.headers['x-user-role'] || '').toUpperCase();
  if (userRole === 'RIDER') {
    return res.status(403).json({ success: false, message: 'Rider không có quyền chỉnh sửa cấu hình ca!' });
  }

  const { caKey, trangThaiThuCong, gioMo, gioDong } = req.body;
  const ca = caKey === 'COT2' ? 'COT2' : 'COT1';
  if (trangThaiThuCong) cauHinhHaiCa[ca].trangThaiThuCong = trangThaiThuCong;
  if (gioMo) cauHinhHaiCa[ca].gioMo = gioMo;
  if (gioDong) cauHinhHaiCa[ca].gioDong = gioDong;
  const check1 = kiemTraCaDangMo('COT1');
  const check2 = kiemTraCaDangMo('COT2');
  res.json({
    success: true,
    message: `Đã cập nhật cấu hình cho ${ca === 'COT2' ? 'COT 2' : 'COT 1'}!`,
    cauHinhMoi: {
      COT1: { ...cauHinhHaiCa.COT1, dangMoThucTe: check1.dangMo, thongBao: check1.lyDo || 'Đang mở' },
      COT2: { ...cauHinhHaiCa.COT2, dangMoThucTe: check2.dangMo, thongBao: check2.lyDo || 'Đang mở' },
    },
  });
});

// ================= HỆ THỐNG LƯU TRỮ ẢNH & ALBUM =================
const khoAnhDon = {};
const khoAlbumCa = {};
const BAY_NGAY_MS = 7 * 24 * 60 * 60 * 1000;

function donDepAnhCuQua7Ngay() {
  try {
    const bayGio = Date.now();
    for (const maAnh in khoAnhDon) {
      if (khoAnhDon[maAnh] && khoAnhDon[maAnh].timestamp) {
        if (bayGio - khoAnhDon[maAnh].timestamp > BAY_NGAY_MS) {
          delete khoAnhDon[maAnh];
        }
      }
    }
  } catch (e) {}
}

async function damBaoTabAnhHomNayTonTai(tenTab) {
  try {
    const meta = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ANH_ID,
      fields: 'sheets.properties.title',
    });
    const danhSachTabs = (meta.data.sheets || []).map(s => s.properties.title);
    if (!danhSachTabs.includes(tenTab)) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ANH_ID,
        requestBody: { requests: [{ addSheet: { properties: { title: tenTab } } }] }
      });
      const tieuDe = [['Mã Ảnh', 'Mã RD', 'Họ Tên', 'Ca', 'Giờ', 'Ngày', 'Key ISO', 'Tuần Key', 'Timestamp', 'Dữ Liệu Ảnh Base64']];
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ANH_ID,
        range: `'${tenTab}'!A1:J1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: tieuDe }
      });
    }
  } catch (err) {}
}

async function napAnhTuSheetVaoAlbum() {
  try {
    const meta = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ANH_ID,
      fields: 'sheets.properties.title',
    });
    const danhSachTabs = (meta.data.sheets || []).map(s => s.properties.title);
    const bayGio = Date.now();

    for (const title of danhSachTabs) {
      if (!title.startsWith('ảnh -')) continue;

      try {
        const res = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ANH_ID,
          range: `'${title}'!A2:J500`,
        });
        const rows = res.data.values || [];

        rows.forEach(r => {
          const maAnh = r[0];
          const ts = parseInt(r[8], 10) || bayGio;

          if (maAnh && (bayGio - ts <= BAY_NGAY_MS)) {
            const item = {
              maAnh: r[0],
              id: r[1],
              name: r[2],
              ca: r[3],
              gio: r[4],
              ngay: r[5],
              keyNgayIso: r[6] || chuanHoaNgayIso(r[5]),
              tuanKey: r[7] || getTuanKey(new Date(ts)),
              timestamp: ts,
              anhBase64: r[9] || '',
            };

            khoAnhDon[maAnh] = item;
            const caTag = (r[3] || '').includes('2') ? 'COT2' : 'COT1';
            const keyAlbum = `${item.keyNgayIso}_${caTag}`;
            if (!khoAlbumCa[keyAlbum]) khoAlbumCa[keyAlbum] = [];
            if (!khoAlbumCa[keyAlbum].includes(maAnh)) khoAlbumCa[keyAlbum].push(maAnh);
          }
        });
      } catch (e) {}
    }
    console.log(`Đã nạp ${Object.keys(khoAnhDon).length} ảnh điểm danh vào Album!`);
  } catch (err) {
    console.error("Lỗi nạp ảnh từ file DATA ẢNH ĐIỂM DANH:", err.message);
  }
}

// 6. API: Điểm danh Rider
app.post('/api/diem-danh', async (req, res) => {
  try {
    const { riderId, riderName, caDiemDanh, caThucTe, anhBase64, ghiChu, coLichLam } = req.body;
    if (!riderId) return res.status(400).json({ success: false, message: 'Thiếu mã Rider' });

    const caCheckKey = (caDiemDanh || '').toUpperCase().includes('2') ? 'COT2' : 'COT1';
    const checkCong = kiemTraCaDangMo(caCheckKey);
    if (!checkCong.dangMo) return res.status(403).json({ success: false, message: checkCong.lyDo });

    if (coLichLam === false) {
      return res.status(400).json({ success: false, message: 'Hôm nay bạn không có lịch làm, vui lòng check lại với FTE khu vực!' });
    }

    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    const parts = formatter.formatToParts(now);
    const p = {};
    parts.forEach(({ type, value }) => { p[type] = value; });

    const timestamp = `${p.hour}:${p.minute}:${p.second} ${p.day}/${p.month}/${p.year}`;
    const ngayDiemDanh = `${p.day}/${p.month}/${p.year}`;
    const gioDiemDanh = `${p.hour}:${p.minute}:${p.second}`;
    const keyNgayIso = `${p.year}-${p.month}-${p.day}`;
    const tenTabAnhNgay = `ảnh - ${p.day}/${p.month}/${p.year}`;

    const caChuan = (caThucTe || caDiemDanh || 'COT 1').toUpperCase().includes('2') ? 'COT 2' : 'COT 1';
    const caTag = caChuan === 'COT 2' ? 'COT2' : 'COT1';
    const tuanKey = getTuanKey(now);
    const maAnh = `IMG_${riderId}_${Date.now()}`;
    const tsNow = Date.now();

    if (anhBase64) {
      donDepAnhCuQua7Ngay();
      khoAnhDon[maAnh] = {
        maAnh,
        id: riderId,
        name: riderName,
        ca: caChuan,
        gio: gioDiemDanh,
        ngay: ngayDiemDanh,
        keyNgayIso,
        tuanKey,
        timestamp: tsNow,
        anhBase64,
      };

      const keyAlbum = `${keyNgayIso}_${caTag}`;
      if (!khoAlbumCa[keyAlbum]) khoAlbumCa[keyAlbum] = [];
      khoAlbumCa[keyAlbum].push(maAnh);

      (async () => {
        try {
          await damBaoTabAnhHomNayTonTai(tenTabAnhNgay);
          const rowAnh = [
            maAnh,
            riderId,
            riderName,
            caChuan,
            gioDiemDanh,
            ngayDiemDanh,
            keyNgayIso,
            tuanKey,
            tsNow.toString(),
            anhBase64
          ];
          await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ANH_ID,
            range: `'${tenTabAnhNgay}'!A:J`,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [rowAnh] }
          });
        } catch (e) {}
      })();
    }

    const ghiChuFinal = anhBase64 ? 'Đã chụp ảnh xác thực tại trạm' : (ghiChu || 'Quét QR');

    const newRow = [timestamp, ngayDiemDanh, gioDiemDanh, riderId, riderName, caChuan, 'Đã điểm danh', ghiChuFinal];
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: "'LƯU ĐIỂM DANH'!A:H",
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [newRow] },
    });

    return res.status(200).json({ success: true, message: `Đã điểm danh thành công lúc ${gioDiemDanh}!`, trangThai: 'Đã điểm danh' });
  } catch (error) {
    console.error('Lỗi điểm danh:', error.message);
    return res.status(500).json({ success: false, message: 'Lỗi ghi nhận điểm danh: ' + error.message });
  }
});

// 7. API: Lịch sử điểm danh hôm nay
app.get('/api/lich-su-diem-danh', async (req, res) => {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "'LƯU ĐIỂM DANH'!A2:H500",
    });
    const rows = response.data.values || [];

    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const parts = formatter.formatToParts(now);
    const p = {};
    parts.forEach(({ type, value }) => { p[type] = value; });
    const homNayChuan = `${p.day}/${p.month}/${p.year}`;
    const homNayKhongSo0 = `${parseInt(p.day, 10)}/${parseInt(p.month, 10)}/${p.year}`;

    let list = rows
      .filter(r => {
        const valB = (r[1] || '').toString().trim();
        return valB === homNayChuan || valB === homNayKhongSo0 || chuanHoaNgayIso(valB) === `${p.year}-${p.month}-${p.day}`;
      })
      .map((r, idx) => ({
        stt: idx + 1,
        thoiGian: r[0] || '',
        ngay: r[1] || '',
        gio: r[2] || '',
        id: r[3] || '',
        name: r[4] || '',
        ca: r[5] || '',
        trangThai: 'Đã điểm danh',
        ghiChu: r[7] || '',
      }))
      .reverse();

    res.json(list);
  } catch (e) {
    console.warn('Lỗi đọc lịch sử điểm danh:', e.message);
    res.json([]);
  }
});

// 8. API: Thông Tin Chung Rider (SERVER TỰ SINH CHUỖI ẢNH QR BASE64 100% HIỂN THỊ)
app.get('/api/thong-tin-chung-rider', async (req, res) => {
  try {
    const response = await sheets.spreadsheets.values.batchGet({
      spreadsheetId: '1tBjwEVJrbv4UNxdKH0wIEX5ar62gg3YQIVNWwE5ik54',
      ranges: [
        "'HUB TO HUB'!B6:H500",
        "'GROUP ZALO'!A2:B20",
      ]
    });

    const valueRanges = response.data.valueRanges || [];

    // 1. Dữ liệu Hub to Hub
    const rawHub = valueRanges[0]?.values || [];
    const hubToHub = [];
    for (let i = 1; i < rawHub.length; i++) {
      const r = rawHub[i];
      if (!r || !r[0]) continue;
      hubToHub.push({
        zoneId: r[0] || '',
        quanCu: r[1] || '',
        phuongMoi: r[2] || '',
        phuongCu: r[3] || '',
        hubTraHang: r[4] || '',
        maTram: r[5] || '',
        diaChiTram: r[6] || ''
      });
    }

    // 2. Dữ liệu Group Zalo
    const rawZalo = valueRanges[1]?.values || [];
    let listZaloRaw = rawZalo.filter(r => r && r[0] && r[1]).map(r => ({
      ten: r[0].toString().trim(),
      link: r[1].toString().trim()
    }));

    if (listZaloRaw.length === 0) {
      listZaloRaw = [
        { ten: "GROUP THÔNG BÁO KV2", link: "https://zalo.me/g/h8puwqvaamwwl36wr9no" },
        { ten: "RIDER SDD KV 2 ( Quận 7 - Quận 2 - Quận 4 )", link: "https://zalo.me/g/kpxlvv436" },
        { ten: "RIDER BACKUP FT KV1+2", link: "https://zalo.me/g/aavbzd404" },
        { ten: "TRUYỀN THÔNG KV2 COT1", link: "https://zalo.me/g/ydwzt3qrj3bxyy9bbz1p" },
        { ten: "TRUYỀN THÔNG KV2 COT2", link: "https://zalo.me/g/gx20fka06kgq4m6d2nek" }
      ];
    }

    // SERVER SINH MÃ QR TRỰC TIẾP DẠNG BASE64 CHO TỪNG NHÓM (KHÔNG LO BỊ CHẶN MẠNG)
    const groupZalo = await Promise.all(listZaloRaw.map(async (g) => {
      let qrBase64 = '';
      try {
        qrBase64 = await QRCode.toDataURL(g.link, {
          width: 200,
          margin: 1,
          color: { dark: '#000000', light: '#ffffff' }
        });
      } catch (errQr) {
        console.error("Lỗi tạo QR cho nhóm:", g.ten);
      }
      return {
        ten: g.ten,
        link: g.link,
        qrImage: qrBase64 // Trả về chuỗi ảnh data:image/png;base64,...
      };
    }));

    res.json({
      hubToHub,
      groupZalo,
      quyDinh: []
    });
  } catch (error) {
    console.error("Lỗi đọc sheet Thông Tin Chung:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// ================= HỆ THỐNG PHÂN QUYỀN VÀ TÀI KHOẢN (ACCOUNT WED APP KV2) =================

// 9. API: ĐĂNG NHẬP (CÓ TỰ ĐỘNG CẤP TÀI KHOẢN RIDER VÀ YÊU CẦU ĐỔI PASS)
app.post('/api/auth/login', async (req, res) => {
  try {
    const { loaiDangNhap, username, password, riderId } = req.body;

    // A. RIDER: Đăng nhập bằng ID & Mật khẩu
    if (loaiDangNhap === 'RIDER') {
      if (!riderId || !password) return res.status(400).json({ success: false, message: 'Vui lòng nhập ID và Mật khẩu!' });

      const cleanInputId = riderId.toString().trim().toLowerCase();

      // 1. Kiểm tra có tồn tại trong TỔNG QUAN RD không
      const resRiders = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_TONG_QUAN_ID,
        range: "'TỔNG QUAN RD'!P3:Q250",
      });
      const rows = resRiders.data.values || [];
      const foundRider = rows.find(r => (r[0] || '').toString().trim().toLowerCase() === cleanInputId);

      if (!foundRider) {
        return res.status(401).json({ success: false, message: `Mã ID [${riderId}] không thuộc danh sách nhân sự Khu Vực 2!` });
      }

      // 2. Kiểm tra trong ACCOUNT_RIDER
      const resAcc = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ACCOUNT_ID,
        range: "'ACCOUNT_RIDER'!A2:D5000",
      });
      const accRows = resAcc.data.values || [];
      const riderAccIndex = accRows.findIndex(r => (r[0] || '').toString().trim().toLowerCase() === cleanInputId);

      let currentPassword = cleanInputId; // Pass mặc định là ID
      let isFirstTime = false;
      let currentPhone = '';

      if (riderAccIndex !== -1) {
        currentPassword = (accRows[riderAccIndex][1] || '').toString().trim();
        // Nếu pass hiện tại vẫn giống hệt ID thì coi là lần đầu
        if (currentPassword.toLowerCase() === cleanInputId) isFirstTime = true;
        currentPhone = (accRows[riderAccIndex][3] || '').toString().trim(); // <--- THÊM DÒNG NÀY LẤY CỘT D
      } else {
        // CẤP ACCOUNT TỰ ĐỘNG CHO RIDER LÊN SHEET
        isFirstTime = true;
        await sheets.spreadsheets.values.append({
          spreadsheetId: SPREADSHEET_ACCOUNT_ID,
          range: "'ACCOUNT_RIDER'!A:C",
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: [[foundRider[0], foundRider[0], foundRider[1] || foundRider[0]]] }
        });
      }

      if (password !== currentPassword) {
        return res.status(401).json({ success: false, message: 'Sai mật khẩu!' });
      }

      // Đọc quyền cấu hình chung của RIDER từ Sheet1 (Dò lên tới 1000 dòng cho chắc ăn)
      let riderCustomPerms = { tuyenRider: {view:true, edit:false}, lichOff: {view:false, edit:false}, performance: {view:false, edit:false}, hangHoa: {view:false, edit:false}, diemDanh: {view:true, edit:false}, thongTinRider: {view:true, edit:false} };
      try {
        const resPerm = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ACCOUNT_ID, range: "'Sheet1'!A2:G1000" });
        const pRows = resPerm.data.values || [];
        const rDefault = pRows.find(r => (r[3] || '').trim() === 'RIDER_DEFAULT');
        if (rDefault && rDefault[6]) {
            riderCustomPerms = JSON.parse(rDefault[6]); // Ghi đè bằng dữ liệu bạn đã lưu trên Sheet
        }
      } catch(e) {}

      return res.json({
    success: true,
    requirePasswordChange: isFirstTime,
    user: { role: 'RIDER', id: foundRider[0], name: foundRider[1] || foundRider[0], phone: currentPhone, permissions: riderCustomPerms }
});
    }

    // B. FTE / SUPER ADMIN
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Vui lòng điền đủ tài khoản và mật khẩu!' });
    }

    const cleanUser = username.toString().trim().toLowerCase();
    const cleanPass = password.toString().trim();

    const resUsers = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ACCOUNT_ID,
      range: "'Sheet1'!A2:G100"
    });
    const users = resUsers.data.values || [];

    const foundUser = users.find(u => {
      const uVal = (u[0] || '').toString().trim().toLowerCase();
      const pVal = (u[1] || '').toString().trim();
      return uVal === cleanUser && pVal === cleanPass;
    });

    if (!foundUser) {
      return res.status(401).json({ success: false, message: 'Sai tên đăng nhập hoặc mật khẩu!' });
    }

    const trangThai = (foundUser[4] || 'Chờ duyệt').toString().trim();
    if (trangThai !== 'Đã duyệt') {
      return res.status(403).json({ success: false, message: `Tài khoản đang ở trạng thái: [${trangThai}].` });
    }

    let userPerms = null;
    try { userPerms = foundUser[6] ? JSON.parse(foundUser[6]) : null; } catch(e) {}
    if (!userPerms) {
      const isFTE = (foundUser[3] || '').trim() === 'FTE';
      userPerms = { tuyenRider: {view:true, edit:isFTE}, lichOff: {view:true, edit:isFTE}, performance: {view:true, edit:false}, hangHoa: {view:true, edit:isFTE}, diemDanh: {view:true, edit:isFTE}, thongTinRider: {view:true, edit:false} };
    }

    return res.json({
      success: true,
      requirePasswordChange: false, // FTE thì có thể đổi lúc nào tùy thích
      user: { role: (foundUser[3] || 'FTE').toString().trim(), username: foundUser[0], name: foundUser[2] || foundUser[0], permissions: userPerms }
    });

  } catch (err) {
    console.error("Lỗi đăng nhập:", err.message);
    res.status(500).json({ success: false, message: 'Lỗi xác thực: ' + err.message });
  }
});

// 9.8 API CẬP NHẬT SỐ ĐIỆN THOẠI RIDER LÊN CỘT D (ACCOUNT_RIDER)
app.post('/api/auth/update-phone', async (req, res) => {
  try {
    const { riderId, phone } = req.body;
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ACCOUNT_ID, range: "'ACCOUNT_RIDER'!A2:D5000"
    });
    const rows = response.data.values || [];
    const index = rows.findIndex(r => (r[0] || '').toString().trim().toLowerCase() === riderId.toLowerCase());

    if (index !== -1) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ACCOUNT_ID,
        range: `'ACCOUNT_RIDER'!D${index + 2}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [[phone]] }
      });
      res.json({ success: true, message: 'Đã lưu số điện thoại thành công!' });
    } else {
      res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản!' });
    }
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// 9.5 API: ĐỔI MẬT KHẨU (TỰ ĐỘNG DÒ SHEET THEO ROLE)
app.post('/api/auth/change-password', async (req, res) => {
  try {
    const { username, oldPassword, newPassword, role } = req.body;
    if (!username || !oldPassword || !newPassword || !role) {
      return res.status(400).json({ success: false, message: 'Thiếu thông tin đổi mật khẩu!' });
    }

    // Tự động phân luồng: Rider lưu ở tab ACCOUNT_RIDER, FTE lưu ở tab Sheet1
    const sheetTab = role === 'RIDER' ? 'ACCOUNT_RIDER' : 'Sheet1';
    const range = role === 'RIDER' ? `'ACCOUNT_RIDER'!A2:C5000` : `'Sheet1'!A2:G1000`;

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ACCOUNT_ID,
      range: range
    });
    
    const rows = response.data.values || [];
    const cleanUser = username.toString().trim().toLowerCase();
    
    // TỰ ĐỘNG DÒ ĐÚNG DÒNG
    const index = rows.findIndex(r => (r[0] || '').toString().trim().toLowerCase() === cleanUser);
    if (index === -1) return res.status(404).json({ success: false, message: 'Tài khoản không tồn tại trên hệ thống!' });

    const currentPass = (rows[index][1] || '').toString().trim();
    if (currentPass !== oldPassword) {
      return res.status(401).json({ success: false, message: 'Mật khẩu cũ không chính xác!' });
    }

    // GHI ĐÈ VÀO CỘT B (Mật khẩu)
    const rowNumber = index + 2;
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ACCOUNT_ID,
      range: `'${sheetTab}'!B${rowNumber}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[newPassword]] }
    });

    res.json({ success: true, message: 'Đổi mật khẩu thành công!' });
  } catch (err) {
    console.error("Lỗi đổi mật khẩu:", err);
    res.status(500).json({ success: false, message: 'Lỗi server: ' + err.message });
  }
});

// 10. API: Đăng ký FTE
app.post('/api/auth/register-fte', async (req, res) => {
  try {
    const { username, password, fullName } = req.body;
    if (!username || !password || !fullName) {
      return res.status(400).json({ success: false, message: 'Vui lòng điền đầy đủ thông tin!' });
    }

    const resUsers = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ACCOUNT_ID,
      range: "'Sheet1'!A2:A100"
    });
    const existingUsers = (resUsers.data.values || []).map(r => (r[0] || '').toString().trim().toLowerCase());

    if (existingUsers.includes(username.trim().toLowerCase())) {
      return res.status(400).json({ success: false, message: 'Tên đăng nhập này đã tồn tại!' });
    }

    const now = new Date().toLocaleDateString('vi-VN');
    const newRow = [username.trim(), password.trim(), fullName.trim(), 'FTE', 'Chờ duyệt', now, ''];

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ACCOUNT_ID,
      range: "'Sheet1'!A:G",
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [newRow] }
    });

    res.json({ success: true, message: 'Đăng ký thành công! Vui lòng chờ Super Admin phê duyệt tài khoản.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi đăng ký: ' + err.message });
  }
});

// 11. API: Super Admin xem danh sách tài khoản & phân quyền (Bao gồm dòng Cấu hình toàn bộ Rider)
app.get('/api/admin/users-permissions', async (req, res) => {
  try {
    const resUsers = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ACCOUNT_ID,
      range: "'Sheet1'!A2:G100"
    });
    const rows = resUsers.data.values || [];
    
    // Tìm dòng cấu hình mặc định cho Rider (hoặc tạo mặc định nếu chưa có)
    let riderRow = rows.find(r => (r[3] || '').trim() === 'RIDER_DEFAULT');
    let riderPerms = null;
    let riderRowIndex = -1;

    if (riderRow) {
      riderRowIndex = rows.indexOf(riderRow) + 2;
      try { riderPerms = riderRow[6] ? JSON.parse(riderRow[6]) : null; } catch(e) {}
    }

    if (!riderPerms) {
      riderPerms = {
        tuyenRider: { view: true, edit: false },
        lichOff: { view: true, edit: false },
        performance: { view: true, edit: false },
        hangHoa: { view: true, edit: false },
        diemDanh: { view: true, edit: false },
        thongTinRider: { view: true, edit: false }
      };
    }

    const users = [];

    // Luôn đưa dòng cấu hình TOÀN BỘ RIDER lên đầu danh sách
    users.push({
      rowIndex: riderRowIndex, // Nếu -1 thì sẽ append mới khi lưu
      username: 'ALL_RIDERS',
      fullName: '🛵 TOÀN BỘ RIDER KV2 (Cấu hình chung)',
      role: 'RIDER_DEFAULT',
      status: 'Áp dụng chung',
      createdAt: '--/--',
      permissions: riderPerms
    });

    // Sau đó đến các tài khoản FTE và Super Admin
    rows.forEach((r, idx) => {
      if ((r[3] || '').trim() === 'RIDER_DEFAULT') return; // Bỏ qua dòng rider đã xử lý ở trên

      let perms = null;
      try { perms = r[6] ? JSON.parse(r[6]) : null; } catch (e) {}

      if (!perms) {
        const isFTE = (r[3] || '').trim() === 'FTE';
        perms = {
          tuyenRider: { view: true, edit: isFTE },
          lichOff: { view: true, edit: isFTE },
          performance: { view: true, edit: false },
          hangHoa: { view: true, edit: isFTE },
          diemDanh: { view: true, edit: isFTE },
          thongTinRider: { view: true, edit: false }
        };
      }

      users.push({
        rowIndex: idx + 2,
        username: r[0] || '',
        fullName: r[2] || '',
        role: r[3] || 'FTE',
        status: r[4] || 'Chờ duyệt',
        createdAt: r[5] || '',
        permissions: perms
      });
    });

    res.json(users);
  } catch (error) {
    console.error("Lỗi đọc danh sách phân quyền:", error.message);
    res.status(500).json([]);
  }
});

// 12. API: Super Admin lưu phân quyền từng menu (Hỗ trợ cả lưu cấu hình Rider chung)
app.post('/api/admin/save-user-permissions', async (req, res) => {
  try {
    const { rowIndex, permissions, role, status, username } = req.body;

    // Nếu lưu cấu hình chung của Rider mà chưa có dòng trên Sheet thì append mới
    if (role === 'RIDER_DEFAULT' && (!rowIndex || rowIndex === -1)) {
      const now = new Date().toLocaleDateString('vi-VN');
      const newRow = ['ALL_RIDERS', 'N/A', 'Cấu hình chung Rider KV2', 'RIDER_DEFAULT', 'Áp dụng chung', now, JSON.stringify(permissions)];
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ACCOUNT_ID,
        range: "'Sheet1'!A:G",
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [newRow] }
      });
      return res.json({ success: true, message: 'Đã lưu cấu hình phân quyền cho TOÀN BỘ RIDER thành công!' });
    }

    if (!rowIndex || rowIndex === -1) {
      return res.status(400).json({ success: false, message: 'Thiếu vị trí dòng cần cập nhật' });
    }

    const updates = [];
    if (role) updates.push({ range: `'Sheet1'!D${rowIndex}`, values: [[role]] });
    if (status) updates.push({ range: `'Sheet1'!E${rowIndex}`, values: [[status]] });
    if (permissions) {
      updates.push({ range: `'Sheet1'!G${rowIndex}`, values: [[JSON.stringify(permissions)]] });
    }

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SPREADSHEET_ACCOUNT_ID,
      requestBody: {
        valueInputOption: 'USER_ENTERED',
        data: updates
      }
    });

    res.json({ success: true, message: 'Cập nhật phân quyền thành công!' });
  } catch (error) {
    console.error("Lỗi lưu phân quyền:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 13. API XIN OFF CỦA RIDER & DUYỆT OFF
const SPREADSHEET_XIN_OFF_ID = '1-dJZvM-GMHpeBK6OrsdCoVKPn-5jb5JMtSW1uEqmfJw';

app.get('/api/xin-off/list', async (req, res) => {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_XIN_OFF_ID, range: "'Sheet1'!A2:I1000"
    });
    const rows = response.data.values || [];
    const list = rows.map((r, i) => ({
      rowIndex: i + 2, timestamp: r[0] || '', riderId: r[1] || '', riderName: r[2] || '',
      ngayNghi: r[3] || '', tongNgay: r[4] || '', lyDo: r[5] || '', hopLe: r[6] || '',
      trangThai: r[7] || 'Chờ duyệt', hinhAnh: r[8] || ''
    }))
    // CHỈNH SỬA: Lọc triệt để, chỉ ném về web những đơn nào có chứa chữ "chờ duyệt"
    .filter(item => item.trangThai.toLowerCase().includes('chờ'))
    .reverse(); 
    
    res.json({ success: true, data: list });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// API MỚI: Dành cho Rider xem lịch sử và thông báo của riêng mình
app.get('/api/xin-off/my-requests', async (req, res) => {
  try {
    const { riderId } = req.query;
    if (!riderId) return res.json({ success: false, message: 'Thiếu ID' });
    
    const response = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_XIN_OFF_ID, range: "'Sheet1'!A2:I1000" });
    const rows = response.data.values || [];
    const list = rows.map((r, i) => ({
      rowIndex: i + 2, // Gắn kèm vị trí dòng để biết mà ghi đè
      timestamp: r[0] || '', riderId: r[1] || '', ngayNghi: r[3] || '', 
      tongNgay: r[4] || '', lyDo: r[5] || '', hopLe: r[6] || '', 
      trangThai: r[7] || 'Chờ duyệt', hinhAnh: r[8] || ''
    })).filter(r => r.riderId === riderId).reverse();
    res.json({ success: true, data: list });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// API MỚI: Ghi đè (Chỉnh sửa) đơn xin OFF cũ
app.post('/api/xin-off/update', async (req, res) => {
  try {
    const { rowIndex, riderId, riderName, ngayBatDau, ngayKetThuc, tongNgay, lyDo, hinhAnhBase64 } = req.body;
    if (!rowIndex) return res.status(400).json({ success: false, message: 'Không tìm thấy ID đơn!' });

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const targetDate = new Date(ngayBatDau); targetDate.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((targetDate - today) / (1000 * 60 * 60 * 24));
    
    let hopLe = '';
    if (diffDays >= 3) hopLe = 'Hợp lệ (>= 3 ngày)'; else if (diffDays >= 1) hopLe = 'Cần xem lại (< 3 ngày)'; else if (diffDays === 0) hopLe = 'Gấp (Trong ngày)'; else hopLe = 'Đã qua ngày';

    const fDate = (dStr) => { if (!dStr) return ''; const d = new Date(dStr); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`; };
    let ngayNghiHienThi = fDate(ngayBatDau); if (ngayKetThuc && ngayKetThuc !== ngayBatDau) ngayNghiHienThi += ` đến ${fDate(ngayKetThuc)}`;
    
    const timestamp = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) + ' (Đã sửa)';
    const updatedRow = [ timestamp, riderId, riderName, ngayNghiHienThi, tongNgay + ' ngày', lyDo, hopLe, 'Chờ duyệt', hinhAnhBase64 || '' ];

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_XIN_OFF_ID, 
      range: `'Sheet1'!A${rowIndex}:I${rowIndex}`,
      valueInputOption: 'USER_ENTERED', 
      requestBody: { values: [updatedRow] }
    });
    res.json({ success: true, message: 'Đã cập nhật đơn xin OFF thành công!' });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

app.post('/api/xin-off/create', async (req, res) => {
  try {
    const { riderId, riderName, ngayBatDau, ngayKetThuc, tongNgay, lyDo, hinhAnhBase64 } = req.body;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const targetDate = new Date(ngayBatDau); targetDate.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((targetDate - today) / (1000 * 60 * 60 * 24));
    
    let hopLe = '';
    if (diffDays >= 3) hopLe = 'Hợp lệ (>= 3 ngày)'; else if (diffDays >= 1) hopLe = 'Cần xem lại (< 3 ngày)'; else if (diffDays === 0) hopLe = 'Gấp (Trong ngày)'; else hopLe = 'Đã qua ngày';

    const fDate = (dStr) => { if (!dStr) return ''; const d = new Date(dStr); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`; };
    let ngayNghiHienThi = fDate(ngayBatDau); if (ngayKetThuc && ngayKetThuc !== ngayBatDau) ngayNghiHienThi += ` đến ${fDate(ngayKetThuc)}`;
    const timestamp = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
    const newRow = [ timestamp, riderId, riderName, ngayNghiHienThi, tongNgay + ' ngày', lyDo, hopLe, 'Chờ duyệt', hinhAnhBase64 || '' ];

    await sheets.spreadsheets.values.append({ spreadsheetId: SPREADSHEET_XIN_OFF_ID, range: "'Sheet1'!A:I", valueInputOption: 'USER_ENTERED', requestBody: { values: [newRow] } });
    res.json({ success: true, message: 'Gửi đơn xin OFF thành công!' });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// HÀM TÁCH CHUỖI NGÀY NGHỈ (VD: "14/10" HOẶC "14/10 đến 16/10") THÀNH MẢNG CÁC NGÀY DD/MM
function tachChuoiNgayNghi(ngayNghiStr) {
  if (!ngayNghiStr) return [];
  const parts = ngayNghiStr.split(' đến ').map(s => s.trim());
  if (parts.length === 1) return [chuanHoaNgayDDMM(parts[0])];

  const [d1, m1] = parts[0].split('/').map(Number);
  const [d2, m2] = parts[1].split('/').map(Number);
  if (!d1 || !m1 || !d2 || !m2) return [chuanHoaNgayDDMM(parts[0])];

  const year = new Date().getFullYear();
  const start = new Date(year, m1 - 1, d1);
  const end = new Date(year, m2 - 1, d2);
  const result = [];

  for (let dt = new Date(start); dt <= end; dt.setDate(dt.getDate() + 1)) {
    result.push(`${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}`);
  }
  return result;
}

// API: Đẩy Trạng thái (Duyệt/Từ chối) lên Sheet & Tự động điền OFF / OFF PICK / OFF DELI / Đột xuất vào TỔNG QUAN RD + OPS 1-2 + LƯU ĐIỀN OFF
app.post('/api/xin-off/update-status', async (req, res) => {
  try {
    const { rowIndex, newStatus, nguoiDuyet } = req.body;
    const fteName = nguoiDuyet || 'FTE / Admin';

    const resRow = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_XIN_OFF_ID, range: `'Sheet1'!A${rowIndex}:I${rowIndex}` });
    const rowData = (resRow.data.values && resRow.data.values[0]) ? resRow.data.values[0] : [];
    const thoiGianGui = (rowData[0] || '').toString().trim();
    const riderId = (rowData[1] || '').toString().trim();
    const riderName = (rowData[2] || '').toString().trim();
    const ngayNghiStr = (rowData[3] || '').toString().trim();
    const lyDoGoc = (rowData[5] || '').toString().trim();
    const checkBaoTruoc = (rowData[6] || '').toString().trim();

    await sheets.spreadsheets.values.update({ spreadsheetId: SPREADSHEET_XIN_OFF_ID, range: `'Sheet1'!H${rowIndex}`, valueInputOption: 'USER_ENTERED', requestBody: { values: [[newStatus]] } });

    let syncMessage = 'Đã cập nhật trạng thái đơn!';
    if (newStatus === 'Đã duyệt' && riderId && ngayNghiStr) {
      const datesList = tachChuoiNgayNghi(ngayNghiStr);
      
      // BÓC TÁCH LOẠI OFF (VD: Từ "[OFF PICK] Đau bụng" -> Loại: "OFF PICK", Lý do: "Đau bụng")
      let loaiOffTuyChon = 'OFF';
      let lyDoThucSu = lyDoGoc;
      const matchLoai = lyDoGoc.match(/^\[(.*?)\]\s*(.*)$/);
      if (matchLoai) {
        loaiOffTuyChon = matchLoai[1].trim(); // Chứa OFF, OFF PICK hoặc OFF DELI
        lyDoThucSu = matchLoai[2].trim();
      }

      // TÍNH TOÁN OFF ĐỘT XUẤT
      const nowVN = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
      const todayDDMM = `${String(nowVN.getDate()).padStart(2, '0')}/${String(nowVN.getMonth() + 1).padStart(2, '0')}`;
      const isOffTrongNgay = checkBaoTruoc.toLowerCase().includes('gấp') || checkBaoTruoc.toLowerCase().includes('trong ngày') || datesList.includes(todayDDMM) || (datesList[0] && thoiGianGui.includes(datesList[0]));

      // TỔNG HỢP KẾT QUẢ CUỐI CÙNG ĐỂ GHI SHEET
      let giaTriOffCanDien = loaiOffTuyChon;
      if (isOffTrongNgay) {
         if (loaiOffTuyChon === 'OFF') giaTriOffCanDien = 'OFF đột xuất';
         else giaTriOffCanDien = `${loaiOffTuyChon} (ĐX)`; // VD: OFF PICK (ĐX)
      }

      let caRider = '—', diaBanRider = '—', tuanLamViecStr = 'Tuần hiện tại';
      try {
        const resRdInfo = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_TONG_QUAN_ID, range: "'TỔNG QUAN RD'!M3:W250" });
        const rdRows = resRdInfo.data.values || [];
        const foundRd = rdRows.find(r => (r[3] || '').toString().trim() === riderId);
        if (foundRd) {
          caRider = (foundRd[2] || '—').toString().trim();
          const qDeli = (foundRd[8] || '').toString().trim();
          diaBanRider = qDeli ? `${qDeli} (P.${(foundRd[9] || '').toString().trim() || '-'})` : (foundRd[5] || '—');
        }
        if (datesList[0]) {
          const [d, m] = datesList[0].split('/').map(Number);
          const phamVi = getPhamViNgayTrongTuan(new Date(nowVN.getFullYear(), m - 1, d));
          tuanLamViecStr = `Tuần: ${phamVi.tuNgay.substring(0, 5)} - ${phamVi.denNgay.substring(0, 5)}`;
        }
      } catch (eInfo) {}

      const riderPayload = [{ id: riderId, ten: riderName, dates: datesList, loaiOff: giaTriOffCanDien, ghiChu: `Duyệt đơn: ${lyDoThucSu}` }];
      await capNhatLichOffVaoSheet(SPREADSHEET_TONG_QUAN_ID, 'TỔNG QUAN RD', riderPayload, 'NEW'); syncMessage = `Đã tự động điền [${giaTriOffCanDien}] cho ${riderName}`;
      await capNhatLichOffVaoSheet(SPREADSHEET_OPS_1_2_ID, GID_OPS_1_2, riderPayload, 'NEW'); syncMessage += ` vào cả 2 Sheet!`;

      // GHI LOG 11 CỘT (CỘT I LÀ GHI CHÚ)
      const timestamp = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
      const logRow = [[ timestamp, tuanLamViecStr, riderId, riderName, caRider, diaBanRider, `${giaTriOffCanDien} (${datesList.join(', ')})`, datesList.length, lyDoThucSu || '—', fteName, 'Duyệt đơn xin OFF' ]];
      sheets.spreadsheets.values.append({ spreadsheetId: SPREADSHEET_TONG_QUAN_ID, range: "'LƯU ĐIỀN OFF'!A:K", valueInputOption: 'USER_ENTERED', requestBody: { values: logRow } }).catch(e => console.warn("Lỗi ghi log:", e.message));
    }
    res.json({ success: true, message: syncMessage });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// 5. API: Đọc Sheet DATA XẾP TUYẾN LẤY HÀNG (Phân phường cho Backup)
app.get('/api/tuyen-pick-bk', async (req, res) => {
  try {
    const SPREADSHEET_PICK_ID = '1ebwePJj2LDsNXpWYQAREAnVIIfKUICVFvsaLqhjdZC0';
    // Lấy thông tin Sheet để tự động tìm Tab có gid = 0
    const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_PICK_ID });
    const sheet0 = meta.data.sheets.find(s => s.properties.sheetId === 0);
    if (!sheet0) throw new Error("Không tìm thấy Tab dữ liệu (gid=0) trong file!");
    
    // Đọc toàn bộ vùng dữ liệu
    const resSheet = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_PICK_ID,
      range: `'${sheet0.properties.title}'!A1:Z500`
    });
    
    res.json({ success: true, data: resSheet.data.values || [] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Khởi chạy server
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend server đang chạy tại cổng: ${PORT}`);
  
  // MẸO CHỐNG TIMEOUT RENDER: Trì hoãn việc tải ảnh nặng 15 giây để server qua vòng kiểm duyệt
  setTimeout(() => {
      console.log("Bắt đầu nạp dữ liệu ảnh chạy ngầm...");
      napAnhTuSheetVaoAlbum();
  }, 15000); 
});