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

const fs = require('fs');

// Tự động tìm và trả về file lich-off.js mới nhất (dù bạn lưu ở thư mục gốc hay trong public/js) & chống kẹt Cache
app.get(['/js/lich-off.js', '/lich-off.js'], (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  const candidates = [
    path.join(__dirname, 'public', 'js', 'lich-off.js'),
    path.join(__dirname, 'js', 'lich-off.js'),
    path.join(__dirname, 'lich-off.js')
  ].filter(p => fs.existsSync(p));

  if (candidates.length === 0) return res.status(404).send('// Không tìm thấy lich-off.js');
  candidates.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  res.sendFile(candidates[0]);
});

app.get(['/js/performance_rider.js', '/performance_rider.js'], (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  const candidates = [
    path.join(__dirname, 'public', 'js', 'performance_rider.js'),
    path.join(__dirname, 'js', 'performance_rider.js'),
    path.join(__dirname, 'performance_rider.js')
  ].filter(p => fs.existsSync(p));
  if (candidates.length === 0) return res.status(404).send('// Không tìm thấy performance_rider.js');
  candidates.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  res.sendFile(candidates[0]);
});

// Bộ nhớ đệm ngắn 10 giây chống lỗi 429 khi nhiều tab gọi cùng lúc
let riderDataCache = null;
let riderDataCacheTime = 0;

// Bộ nhớ đệm 15 giây giúp 100 Rider quét QR cùng lúc nhận danh sách tức thì (0.01s)
let cachedRiderDataResponse = null;
let lastRiderDataFetchTime = 0;

// 1. API: Tuyến Rider & Lịch OFF
app.get('/api/rider-data', async (req, res) => {
  try {
    const now = Date.now();
    // Nếu dữ liệu vừa tải trong vòng 15 giây gần nhất -> Trả về ngay lập tức từ RAM
    if (!req.query.force && cachedRiderDataResponse && (now - lastRiderDataFetchTime < 15000)) {
      return res.json(cachedRiderDataResponse);
    }

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_TONG_QUAN_ID,
      range: "'TỔNG QUAN RD'!M1:ZZ1000",
    });

    const values = response.data.values || [];
    if (values.length < 3) {
      if (cachedRiderDataResponse) return res.json(cachedRiderDataResponse);
      return res.json({ riders: [], dateHeaders: [] });
    }

    // Tự động quét 30 dòng đầu để tìm đúng dòng chứa Ngày (Dòng 16 trên Sheet)
    let dateRowIdx = 1;
    let maxDates = 0;
    for (let r = 0; r < Math.min(30, values.length); r++) {
      let cnt = 0;
      const rowArr = values[r] || [];
      for (let c = 13; c < rowArr.length; c++) {
        const val = (rowArr[c] || '').toString().trim();
        if (/^\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?$/.test(val)) cnt++;
      }
      if (cnt > maxDates) {
        maxDates = cnt;
        dateRowIdx = r;
      }
    }

    const thuRowIdx = dateRowIdx > 0 ? dateRowIdx - 1 : 0;
    const rowThu = values[thuRowIdx] || [];
    const rowDate = values[dateRowIdx] || [];

    const dateHeaders = [];
    for (let c = 13; c < rowDate.length; c++) {
      const cellDate = (rowDate[c] || '').toString().trim();
      const cellThu = (rowThu[c] || '').toString().trim();
      if (cellDate && /^\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?$/.test(cellDate)) {
        dateHeaders.push({
          colIdx: c,
          thu: cellThu || '',
          date: cellDate,
        });
      }
    }

    const riders = [];
    for (let r = dateRowIdx + 1; r < values.length; r++) {
      const row = values[r];
      if (!row || !row[3] || !row[3].toString().trim()) continue; // Kiểm tra trực tiếp cột Mã ID (row[3] = Cột P)

      const dailySchedule = {};
      dateHeaders.forEach(dh => {
        dailySchedule[dh.date] = (row[dh.colIdx] || '').toString().trim();
      });

      let rawQuanDeli = (row[8] || '').toString().trim();
      if (rawQuanDeli.toUpperCase() === 'BACKUP') rawQuanDeli = 'BK';
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

    cachedRiderDataResponse = { riders, dateHeaders };
    lastRiderDataFetchTime = Date.now();
    res.json(cachedRiderDataResponse);
  } catch (error) {
    console.error('Lỗi đọc Tuyến Rider:', error.message);
    // Nếu Google Sheet bị quá tải tạm thời, trả về dữ liệu Cache gần nhất thay vì báo lỗi 500
    if (cachedRiderDataResponse) return res.json(cachedRiderDataResponse);
    res.status(500).json({ error: error.message });
  }
});

// ================= 2. API: PERFORMANCE TODAY (ĐỌC GID=1048493669 & ON-HOLD TỪ GID=296426696) =================
const GID_PERF_RAW_ORDERS = 1048493669;
const GID_PERF_TODAY_VIEW = 1561639417;
const GID_ONHOLD_HISTORY = 296426696;
let lastValidPerformanceResponse = null;
let cachedPerfOrdersByRider = {};
let cachedTodayOnHoldOrders = [];

// Làm sạch các ô công thức trả về '0' hoặc ký tự rỗng trên Sheet
function cleanZeroVal(val) {
  const s = (val ?? '').toString().trim();
  if (s === '0' || s === '-' || s === '—' || s.toLowerCase() === 'nan' || s.toLowerCase() === '#n/a' || s.toLowerCase() === 'null' || s.toLowerCase() === 'trống' || s.toLowerCase() === 'trong') {
    return '';
  }
  return s;
}

function chuanHoaQuanPerf(qRaw) {
  const s = cleanZeroVal(qRaw).toLowerCase();
  if (s.includes('quận 2') || s === 'q2') return 'Quận 2';
  if (s.includes('quận 4') || s === 'q4') return 'Quận 4';
  if (s.includes('quận 7') || s === 'q7') return 'Quận 7';
  if (s.includes('quận 9') || s === 'q9') return 'Quận 9';
  if (s.includes('bình thạnh') || s === 'bt') return 'Bình Thạnh';
  if (s.includes('bk') || s.includes('backup')) return 'Backup (BK)';
  return cleanZeroVal(qRaw) || 'Chưa phân tuyến';
}

// Kiểm tra chuỗi ngày/thời gian có phải là ngày hôm nay (theo giờ Việt Nam) không
function laNgayHomNayVN(strDate, todayParts) {
  const s = cleanZeroVal(strDate);
  if (!s) return false;
  const { dInt, mInt, yInt } = todayParts;

  // 1. Định dạng YYYY-MM-DD hoặc YYYY/MM/DD (VD: 2026-11-12 11:21:49)
  const mIso = s.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (mIso) {
    return parseInt(mIso[1], 10) === yInt && parseInt(mIso[2], 10) === mInt && parseInt(mIso[3], 10) === dInt;
  }

  // 2. Định dạng DD/MM/YYYY hoặc DD-MM-YYYY (VD: 12/11/2026)
  const mVN = s.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (mVN) {
    let yr = parseInt(mVN[3], 10);
    if (yr < 100) yr += 2000;
    return yr === yInt && parseInt(mVN[2], 10) === mInt && parseInt(mVN[1], 10) === dInt;
  }

  // 3. Định dạng ngắn DD/MM (VD: 12/11)
  const mShort = s.match(/(?:^|\s)(\d{1,2})[\/\-](\d{1,2})(?:\s|$)/);
  if (mShort) {
    return parseInt(mShort[2], 10) === mInt && parseInt(mShort[1], 10) === dInt;
  }

  return false;
}

app.get('/api/performance-data', async (req, res) => {
  try {
    const meta = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_TONG_QUAN_ID,
      fields: 'sheets.properties(title,sheetId)'
    });
    const allSheets = meta.data.sheets || [];
    const rawSheetObj = allSheets.find(s => s.properties.sheetId === GID_PERF_RAW_ORDERS);
    const viewSheetObj = allSheets.find(s => s.properties.sheetId === GID_PERF_TODAY_VIEW);
    const ohSheetObj = allSheets.find(s => s.properties.sheetId === GID_ONHOLD_HISTORY);

    const rawSheetTitle = rawSheetObj ? rawSheetObj.properties.title : 'DATA INBOUND';
    const viewSheetTitle = viewSheetObj ? viewSheetObj.properties.title : 'PERFORMANCE TODAY';
    const ohSheetTitle = ohSheetObj ? ohSheetObj.properties.title : 'LỊCH SỬ ONHOLD';

    const batchRes = await sheets.spreadsheets.values.batchGet({
      spreadsheetId: SPREADSHEET_TONG_QUAN_ID,
      ranges: [
        `'${rawSheetTitle}'!A2:V50000`,
        `'${viewSheetTitle}'!A1:AZ250`,
        "'TỔNG QUAN RD'!M1:W1000",
        `'${ohSheetTitle}'!A1:Z50000`
      ]
    });

    const valueRanges = batchRes.data.valueRanges || [];
    const rawOrderRows = valueRanges[0]?.values || [];
    const viewRows = valueRanges[1]?.values || [];
    const rdRosterRows = valueRanges[2]?.values || [];
    const ohHistoryRows = valueRanges[3]?.values || [];

    if (rawOrderRows.length === 0 && ohHistoryRows.length === 0 && lastValidPerformanceResponse) {
      return res.json({ ...lastValidPerformanceResponse, restoredFromCache: true });
    }

    // Lấy ngày hôm nay theo chuẩn giờ Việt Nam
    const nowVN = new Date();
    const fmt = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' });
    const parts = {};
    fmt.formatToParts(nowVN).forEach(({ type, value }) => { parts[type] = value; });
    const todayParts = {
      dInt: parseInt(parts.day, 10),
      mInt: parseInt(parts.month, 10),
      yInt: parseInt(parts.year, 10)
    };

    // 1. Xây dựng danh bạ Rider từ TỔNG QUAN RD (kèm Map tìm theo Tên để đối chiếu với LỊCH SỬ ONHOLD)
    const riderDirectory = {};
    const riderNameMap = {};
    for (let r = 2; r < rdRosterRows.length; r++) {
      const row = rdRosterRows[r] || [];
      const id = cleanZeroVal(row[3]);
      const name = cleanZeroVal(row[4]);
      if (!id || !name) continue;
      const caRaw = cleanZeroVal(row[2]).toUpperCase();
      const quanDeliRaw = cleanZeroVal(row[8]);
      const rdObj = {
        id,
        name,
        ca: caRaw.includes('2') ? 'COT 2' : 'COT 1',
        quanGiao: chuanHoaQuanPerf(quanDeliRaw),
        phuongGiao: cleanZeroVal(row[9])
      };
      riderDirectory[id] = rdObj;
      riderNameMap[name.toLowerCase()] = rdObj;
    }

    // 2. Quét bảng PERFORMANCE TODAY (gid=1561639417) để bổ sung thông tin Ca/Quận
    const sheetPerfFallback = {};
    let headerRowPerfIdx = -1;
    for (let r = 0; r < Math.min(20, viewRows.length); r++) {
      const rowStr = (viewRows[r] || []).map(c => (c || '').toString().toLowerCase().trim());
      if (rowStr.includes('mã rider') || rowStr.includes('tổng assigned')) {
        headerRowPerfIdx = r;
        break;
      }
    }

    if (headerRowPerfIdx !== -1) {
      const hRow = (viewRows[headerRowPerfIdx] || []).map(c => (c || '').toString().toLowerCase().trim());
      const idColIndices = [];
      hRow.forEach((colName, idx) => {
        if (colName === 'mã rider' || colName === 'id' || colName === 'driver id') idColIndices.push(idx);
      });

      idColIndices.forEach((idCol, tableIdx) => {
        const caFromTable = tableIdx === 0 ? 'COT 1' : 'COT 2';
        for (let r = headerRowPerfIdx + 1; r < viewRows.length; r++) {
          const row = viewRows[r] || [];
          const rId = cleanZeroVal(row[idCol]);
          const rName = cleanZeroVal(row[idCol + 1]);
          const rQuan = cleanZeroVal(row[idCol + 2]);
          if (!rId || !/^\d{4,10}$/.test(rId)) continue;

          if (!riderDirectory[rId]) {
            const newRd = { id: rId, name: rName || rId, ca: caFromTable, quanGiao: chuanHoaQuanPerf(rQuan), phuongGiao: '' };
            riderDirectory[rId] = newRd;
            if (rName) riderNameMap[rName.toLowerCase()] = newRd;
          } else if (rQuan && riderDirectory[rId].quanGiao === 'Backup (BK)') {
            riderDirectory[rId].quanGiao = chuanHoaQuanPerf(rQuan);
          }

          sheetPerfFallback[rId] = {
            id: rId,
            name: rName || riderDirectory[rId]?.name || rId,
            ca: caFromTable,
            quanGiao: chuanHoaQuanPerf(rQuan || riderDirectory[rId]?.quanGiao),
            orderInSheet: r
          };
        }
      });
    }

    // 3. Đọc DATA INBOUND (gid=1048493669) để lấy thông tin gốc của đơn & thống kê Delivered / Delivering
    const allInboundOrderLookup = new Map();
    const uniqueAssignedOrders = new Map();

    rawOrderRows.forEach(r => {
      if (!r || !r[0]) return;
      const shipmentId = cleanZeroVal(r[0]);
      if (!shipmentId) return;

      const zoneId = cleanZeroVal(r[1]);
      let driverId = cleanZeroVal(r[4]);
      let driverName = cleanZeroVal(r[5]);
      const receivedTime = cleanZeroVal(r[6]);
      const onHoldTime = cleanZeroVal(r[7]);
      const onHoldReason = cleanZeroVal(r[8]) || cleanZeroVal(r[17]);
      const whsId = cleanZeroVal(r[9]);
      const loaiHang = whsId ? 'WH' : 'MP';
      const rawStatus = cleanZeroVal(r[10]);
      const deliveringTime = cleanZeroVal(r[11]);
      const isHv = cleanZeroVal(r[12]);
      const quan = chuanHoaQuanPerf(r[13]);
      const phuong = cleanZeroVal(r[14]);
      const cotRd = cleanZeroVal(r[15] || r[20] || r[16]).toUpperCase();

      const ordBase = {
        shipmentId, zoneId, driverId, driverName, receivedTime,
        onHoldTime, onHoldReason, loaiHang, rawStatus, deliveringTime,
        isHv, quan, phuong, cotRd
      };
      allInboundOrderLookup.set(shipmentId, ordBase);

      // Bỏ qua hoàn toàn các đơn chưa gán Rider (trống hoặc bằng '0')
      if (!driverId && !driverName) return;
      if (!driverId && driverName && riderNameMap[driverName.toLowerCase()]) {
        driverId = riderNameMap[driverName.toLowerCase()].id;
      }

      const stLower = rawStatus.toLowerCase();
      let statusBucket = 'OTHER';
      if (stLower.includes('delivered') && !stLower.includes('undelivered')) statusBucket = 'DELIVERED';
      else if (stLower.includes('delivering')) statusBucket = 'DELIVERING';
      else if (stLower.includes('onhold') || stLower.includes('on_hold') || onHoldTime || onHoldReason) statusBucket = 'ON_HOLD_RAW';

      uniqueAssignedOrders.set(shipmentId, {
        ...ordBase,
        driverId: driverId || driverName,
        driverName: driverName || riderDirectory[driverId]?.name || driverId,
        statusBucket
      });
    });

    // 4. ĐỌC SHEET "LỊCH SỬ ONHOLD" (GID=296426696) - CHỈ DÙNG CHO THẺ KPI ON-HOLD TRONG NGÀY
    const todayOhOrdersMap = new Map();
    if (ohHistoryRows.length > 1) {
      let ohHeaderIdx = 0;
      for (let r = 0; r < Math.min(5, ohHistoryRows.length); r++) {
        const rowLower = (ohHistoryRows[r] || []).map(c => (c || '').toString().toLowerCase().trim()).join(' ');
        if (rowLower.includes('shipment') || rowLower.includes('mã đơn') || rowLower.includes('onhold') || rowLower.includes('lý do') || rowLower.includes('zone')) {
          ohHeaderIdx = r;
          break;
        }
      }

      const hOh = (ohHistoryRows[ohHeaderIdx] || []).map(c => (c || '').toString().toLowerCase().trim());
      const findCol = (keywords) => hOh.findIndex(h => keywords.some(k => h.includes(k)));

      const cShip = findCol(['shipment', 'mã đơn', 'ma don', 'tracking', 'mã vận đơn']);
      const cZone = findCol(['zone']);
      const cDrvId = findCol(['driver_id', 'id rd', 'mã rd', 'mã rider', 'rider_id', 'id tài xế']);
      const cDrvName = findCol(['driver_name', 'tên rd', 'tên rider', 'họ tên', 'họ và tên', 'tên tài xế', 'rider_name']);
      const cHoldTime = findCol(['on_hold_time', 'onhold_time', 'thời gian onhold', 'thời gian hold', 'giờ hold', 'ngày onhold', 'thời gian', 'time']);
      const cReason = findCol(['reason', 'lý do', 'ly do']);
      const cQuan = findCol(['quận', 'quan']);
      const cPhuong = findCol(['phường', 'phuong']);

      for (let r = ohHeaderIdx + 1; r < ohHistoryRows.length; r++) {
        const row = ohHistoryRows[r] || [];
        if (!row || row.length === 0) continue;

        let sId = cShip !== -1 ? cleanZeroVal(row[cShip]) : '';
        if (!sId) {
          const foundCell = row.find(cell => /^VN[0-9A-Z]{8,20}$/i.test(cleanZeroVal(cell)));
          if (foundCell) sId = cleanZeroVal(foundCell);
        }
        if (!sId) continue;

        // Xác định cột Thời gian On-Hold (mặc định cột E = row[4] nếu không có tiêu đề khớp)
        let holdTimeStr = cHoldTime !== -1 ? cleanZeroVal(row[cHoldTime]) : cleanZeroVal(row[4]);
        let isTodayRow = holdTimeStr ? laNgayHomNayVN(holdTimeStr, todayParts) : false;

        if (!isTodayRow) {
          for (let c = 0; c < row.length; c++) {
            if (c === cShip) continue;
            const cellVal = cleanZeroVal(row[c]);
            if (cellVal && laNgayHomNayVN(cellVal, todayParts)) {
              holdTimeStr = cellVal;
              isTodayRow = true;
              break;
            }
          }
        }

        // Chỉ lấy đơn On-Hold trong ngày hôm nay
        if (!isTodayRow) continue;

        const inboundRef = allInboundOrderLookup.get(sId) || {};

        // Chỉ lấy ID Rider nếu thực sự là mã số Rider hợp lệ (4-10 chữ số), tuyệt đối không lấy nhầm cột Thời gian row[4]
        let rawDrvId = (cDrvId !== -1 ? cleanZeroVal(row[cDrvId]) : '') || inboundRef.driverId || '';
        const validDrvId = /^\d{4,10}$/.test(rawDrvId) ? rawDrvId : '';
        let validDrvName = (cDrvName !== -1 ? cleanZeroVal(row[cDrvName]) : '') || inboundRef.driverName || (validDrvId && riderDirectory[validDrvId]?.name) || '—';

        const reasonStr = (cReason !== -1 ? cleanZeroVal(row[cReason]) : cleanZeroVal(row[5])) || inboundRef.onHoldReason || '—';
        const zoneStr = (cZone !== -1 ? cleanZeroVal(row[cZone]) : cleanZeroVal(row[1])) || inboundRef.zoneId || '—';
        const quanStr = chuanHoaQuanPerf((cQuan !== -1 ? cleanZeroVal(row[cQuan]) : cleanZeroVal(row[2])) || inboundRef.quan || '');
        const phuongStr = (cPhuong !== -1 ? cleanZeroVal(row[cPhuong]) : cleanZeroVal(row[3])) || inboundRef.phuong || '';

        todayOhOrdersMap.set(sId, {
          shipmentId: sId,
          zoneId: zoneStr,
          driverId: validDrvId || '—',
          driverName: validDrvName,
          receivedTime: inboundRef.receivedTime || '',
          onHoldTime: holdTimeStr,
          onHoldReason: reasonStr,
          loaiHang: inboundRef.loaiHang || 'MP',
          rawStatus: 'On-Hold',
          statusBucket: 'ON_HOLD',
          deliveringTime: inboundRef.deliveringTime || '',
          isHv: inboundRef.isHv || 'No',
          quan: quanStr,
          phuong: phuongStr,
          cotRd: inboundRef.cotRd || (validDrvId && riderDirectory[validDrvId]?.ca) || 'COT 1'
        });
      }
    }

    cachedTodayOnHoldOrders = Array.from(todayOhOrdersMap.values());

    // 5. CHỈ LẤY ID & HỌ TÊN CỦA RIDER HỢP LỆ VÀO BẢNG (KHÔNG ĐẨY CÁC ĐƠN ON-HOLD VÀO BẢNG RIDER)
    const riderStatsMap = {};
    const newOrdersByRiderCache = {};

    const ensureRiderStat = (rId, rName, fallbackCa, fallbackQuan) => {
      const cleanId = (rId || '').toString().trim();
      // Chỉ chấp nhận Mã Rider là dãy số ID hợp lệ (VD: 141965, 132373...), loại bỏ hoàn toàn ngày giờ / lý do onhold
      if (!/^\d{4,10}$/.test(cleanId)) return null;

      if (!riderStatsMap[cleanId]) {
        const dirInfo = riderDirectory[cleanId] || sheetPerfFallback[cleanId] || {};
        const caResolved = dirInfo.ca || (fallbackCa && fallbackCa.includes('2') ? 'COT 2' : 'COT 1');
        riderStatsMap[cleanId] = {
          id: cleanId,
          name: dirInfo.name || rName || cleanId,
          ca: caResolved,
          quanGiao: dirInfo.quanGiao || fallbackQuan || 'Chưa phân tuyến',
          assigned: 0,
          delivered: 0,
          delivering: 0,
          onHold: 0,
          hvCount: 0,
          quanOrderCounts: {},
          orderInSheet: sheetPerfFallback[cleanId]?.orderInSheet ?? 9999
        };
      }
      if (!newOrdersByRiderCache[cleanId]) newOrdersByRiderCache[cleanId] = [];
      return riderStatsMap[cleanId];
    };

    // Chỉ nạp các đơn của Rider hợp lệ (Delivered & Delivering) vào bảng
    uniqueAssignedOrders.forEach(ord => {
      if (ord.statusBucket !== 'DELIVERED' && ord.statusBucket !== 'DELIVERING') return;

      const rId = ord.driverId;
      const stObj = ensureRiderStat(rId, ord.driverName, ord.cotRd, ord.quan);
      if (!stObj) return;

      stObj.assigned++;
      if (ord.statusBucket === 'DELIVERED') stObj.delivered++;
      else if (ord.statusBucket === 'DELIVERING') stObj.delivering++;

      if ((ord.isHv || '').toLowerCase() === 'yes') stObj.hvCount++;
      if (ord.quan && ord.quan !== 'Chưa phân tuyến') {
        stObj.quanOrderCounts[ord.quan] = (stObj.quanOrderCounts[ord.quan] || 0) + 1;
      }
      newOrdersByRiderCache[stObj.id].push(ord);
    });

    cachedPerfOrdersByRider = newOrdersByRiderCache;

    const districtOrderPriority = ['Quận 2', 'Quận 4', 'Quận 7', 'Quận 9', 'Bình Thạnh', 'Backup (BK)', 'Chưa phân tuyến'];

    const allRiderStats = Object.values(riderStatsMap)
      .filter(r => r.assigned > 0)
      .map(r => {
        let finalQuan = r.quanGiao;
        const topOrderQuan = Object.keys(r.quanOrderCounts || {}).sort((a, b) => r.quanOrderCounts[b] - r.quanOrderCounts[a])[0];

        if ((!finalQuan || finalQuan === 'Chưa phân tuyến' || finalQuan === 'Backup (BK)') && topOrderQuan) {
          finalQuan = finalQuan === 'Backup (BK)' ? `${topOrderQuan} (BK)` : topOrderQuan;
        }
        const baseQuan = chuanHoaQuanPerf(finalQuan);
        const rateNum = r.assigned > 0 ? Number(((r.delivered / r.assigned) * 100).toFixed(1)) : 0;

        return {
          id: r.id,
          name: r.name,
          ca: r.ca.includes('2') ? 'COT 2' : 'COT 1',
          quanGiao: finalQuan || 'Chưa phân tuyến',
          baseQuan: baseQuan,
          assigned: r.assigned,
          delivered: r.delivered,
          delivering: r.delivering,
          onHold: r.onHold,
          hvCount: r.hvCount || 0,
          rate: rateNum,
          rateStr: `${rateNum.toFixed(1)}%`,
          orderInSheet: r.orderInSheet
        };
      });

    const sortRiders = (arr) => arr.sort((a, b) => {
      const idxA = districtOrderPriority.indexOf(a.baseQuan);
      const idxB = districtOrderPriority.indexOf(b.baseQuan);
      const pA = idxA === -1 ? 99 : idxA;
      const pB = idxB === -1 ? 99 : idxB;
      if (pA !== pB) return pA - pB;
      if (b.assigned !== a.assigned) return b.assigned - a.assigned;
      return a.name.localeCompare(b.name, 'vi');
    });

    const caSangList = sortRiders(allRiderStats.filter(r => r.ca === 'COT 1'));
    const caChieuList = sortRiders(allRiderStats.filter(r => r.ca === 'COT 2'));

    const calcSum = (list, overrideOnHoldCount = null) => {
      const assigned = list.reduce((s, i) => s + i.assigned, 0);
      const delivered = list.reduce((s, i) => s + i.delivered, 0);
      const delivering = list.reduce((s, i) => s + i.delivering, 0);
      const onHold = overrideOnHoldCount !== null ? overrideOnHoldCount : list.reduce((s, i) => s + i.onHold, 0);
      const hvCount = list.reduce((s, i) => s + (i.hvCount || 0), 0);
      const rate = assigned > 0 ? Number(((delivered / assigned) * 100).toFixed(1)) : 0;
      return { riderCount: list.length, assigned, delivered, delivering, onHold, hvCount, rate, rateStr: `${rate.toFixed(1)}%` };
    };

    const payload = {
      success: true,
      lastUpdate: new Date().toLocaleTimeString('vi-VN'),
      sourceSheet: rawSheetTitle,
      templateSheet: viewSheetTitle,
      onHoldSheet: ohSheetTitle,
      // Thẻ KPI On-Hold lấy đúng tổng số đơn OH trong ngày từ sheet LỊCH SỬ ONHOLD (gid=296426696)
      tongToanTram: calcSum(allRiderStats, cachedTodayOnHoldOrders.length),
      tongCaSang: calcSum(caSangList),
      tongCaChieu: calcSum(caChieuList),
      caSangList,
      caChieuList
    };

    if (allRiderStats.length > 0 || cachedTodayOnHoldOrders.length > 0) {
      lastValidPerformanceResponse = payload;
    }

    res.json(payload);
  } catch (error) {
    console.warn('Lỗi đọc Performance:', error.message);
    if (lastValidPerformanceResponse) {
      return res.json({ ...lastValidPerformanceResponse, restoredFromCache: true });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

// 2.1 API: XEM CHI TIẾT MÃ ĐƠN CỦA TỪNG RIDER (KHI XEM TẤT CẢ ON-HOLD SẼ TRẢ VỀ ĐÚNG DANH SÁCH TỪ LỊCH SỬ ONHOLD HÔM NAY)
app.get('/api/performance-rider-orders', async (req, res) => {
  try {
    const { riderId, ca, quan } = req.query;
    let orders = [];

    if (riderId && riderId !== 'ALL') {
      orders = cachedPerfOrdersByRider[riderId] || [];
    } else {
      // Gộp các đơn Delivered / Delivering của Rider + toàn bộ đơn On-Hold trong ngày từ LỊCH SỬ ONHOLD
      const seenShipIds = new Set();
      cachedTodayOnHoldOrders.forEach(oh => {
        seenShipIds.add(oh.shipmentId);
        orders.push(oh);
      });
      Object.keys(cachedPerfOrdersByRider).forEach(rId => {
        (cachedPerfOrdersByRider[rId] || []).forEach(o => {
          if (!seenShipIds.has(o.shipmentId)) {
            seenShipIds.add(o.shipmentId);
            orders.push(o);
          }
        });
      });

      if (ca && ca !== 'ALL') {
        const isCot2 = ca.toUpperCase().includes('2');
        orders = orders.filter(o => isCot2 ? (o.cotRd || '').includes('2') : !(o.cotRd || '').includes('2'));
      }
      if (quan && quan !== 'ALL') {
        const qNorm = chuanHoaQuanPerf(quan);
        orders = orders.filter(o => o.quan === qNorm);
      }
    }

    res.json({ success: true, orders });
  } catch (e) {
    res.status(500).json({ success: false, orders: [], error: e.message });
  }
});

// Bộ nhớ lưu ngầm dữ liệu Hàng Hóa hợp lệ gần nhất (Chống lỗi nhảy về 0 khi Sheet đang cập nhật/trống tạm thời)
let lastValidHangHoaResponse = null;

// Hàm chuẩn hóa trạng thái đơn HV theo đúng quy tắc vận hành
function chuanHoaTrangThaiBanGiaoHv(rawStatus, idRd, tenRd) {
  const st = (rawStatus || '').toString().trim().toLowerCase();
  const hasRd = Boolean(idRd && idRd !== '0' && idRd !== '—' && idRd !== '-') ||
                Boolean(tenRd && tenRd !== '0' && tenRd !== '—' && tenRd !== '-');

  if (st.includes('delivered') && !st.includes('undelivered')) return 'Giao thành công';
  if (st.includes('giao thành công') || st.includes('thanh cong')) return 'Giao thành công';

  if (st.includes('onhold') || st.includes('on_hold') || st.includes('on-hold') || st.includes('chờ kho xử lý')) {
    return 'Chờ kho xử lý';
  }

  if (st.includes('delivering') || st.includes('đang đi giao')) {
    return 'Đang đi giao';
  }

  if (st.includes('lmhub_received') || st.includes('chờ bàn giao') || !hasRd) {
    return 'Chờ bàn giao';
  }

  return rawStatus || 'Chờ bàn giao';
}

// 3. API: HÀNG HÓA - ĐỌC ĐỒNG THỜI "DATA INBOUND" & BẢNG "BÀN GIAO HV" TRÊN "PENDING ATTEMPT"
app.get('/api/hang-hoa-data', async (req, res) => {
  try {
    const batchRes = await sheets.spreadsheets.values.batchGet({
      spreadsheetId: SPREADSHEET_TONG_QUAN_ID,
      ranges: [
        "'DATA INBOUND'!A2:V",
        "'PENDING ATTEMPT'!A1:Z500"
      ]
    });

    const valueRanges = batchRes.data.valueRanges || [];
    const allRows = valueRanges[0]?.values || [];
    const pendingAttemptRows = valueRanges[1]?.values || [];
    const nowTimeStr = new Date().toLocaleTimeString('vi-VN');

    // Lập từ điển tra cứu nhanh từ DATA INBOUND (kiểm tra whs_id = VNWL và trạng thái gốc)
    const inboundLookupMap = new Map();
    allRows.forEach(r => {
      const sId = (r[0] || '').toString().trim();
      if (!sId) return;
      inboundLookupMap.set(sId, {
        zoneId: (r[1] || '').toString().trim(),
        idRd: (r[4] || '').toString().trim(),
        tenRd: (r[5] || '').toString().trim(),
        onHoldReason: ((r[8] || r[17]) || '').toString().trim(),
        whsId: (r[9] || '').toString().trim(),
        rawStatus: (r[10] || '').toString().trim(),
        deliveringTime: (r[11] || '').toString().trim(),
        isHv: (r[12] || '').toString().trim(),
        quan: (r[13] || '').toString().trim(),
        phuong: (r[14] || '').toString().trim(),
        cotRd: ((r[15] || r[20]) || '').toString().trim()
      });
    });

    // 1. Trích xuất thời gian "Last update" và bảng "BÀN GIAO TRẠNG THÁI ĐƠN HÀNG HV" từ tab PENDING ATTEMPT
    let sheetUpdateStr = '';
    let banGiaoHv = [];
    let hvHeaderRowIdx = -1;
    let hvStartColIdx = -1;

    for (let r = 0; r < pendingAttemptRows.length; r++) {
      const row = pendingAttemptRows[r] || [];
      for (let c = 0; c < row.length; c++) {
        const cellText = (row[c] || '').toString().trim();
        if (cellText.toLowerCase().startsWith('last update:')) {
          sheetUpdateStr = cellText.replace(/^last update:\s*/i, '').trim();
        }
        if (
          hvHeaderRowIdx === -1 &&
          cellText.toLowerCase() === 'mã đơn' &&
          (row[c + 1] || '').toString().trim().toLowerCase().includes('zone')
        ) {
          hvHeaderRowIdx = r;
          hvStartColIdx = c;
        }
      }
    }

    if (hvHeaderRowIdx !== -1 && hvStartColIdx !== -1) {
      for (let r = hvHeaderRowIdx + 1; r < pendingAttemptRows.length; r++) {
        const row = pendingAttemptRows[r] || [];
        let rawMaDon = (row[hvStartColIdx] || '').toString().trim();
        if (!rawMaDon) continue;

        const baseShipId = rawMaDon.split(/\s*-\s*/)[0].trim();
        const inbInfo = inboundLookupMap.get(baseShipId) || {};

        const whsIdUpper = (inbInfo.whsId || '').toUpperCase();
        const isIpOrder = whsIdUpper.includes('VNWL') || rawMaDon.toLowerCase().includes('đơn ip');
        const finalMaDon = isIpOrder ? `${baseShipId} - đơn IP` : baseShipId;

        const idRdVal = (row[hvStartColIdx + 3] || inbInfo.idRd || '').toString().trim();
        const tenRdVal = (row[hvStartColIdx + 4] || inbInfo.tenRd || '').toString().trim();
        const rawTt = (row[hvStartColIdx + 7] || inbInfo.rawStatus || '').toString().trim();
        const trangThaiChuan = chuanHoaTrangThaiBanGiaoHv(rawTt, idRdVal, tenRdVal);

        banGiaoHv.push({
          maDon: finalMaDon,
          isIp: isIpOrder,
          whsId: inbInfo.whsId || '',
          zoneId: (row[hvStartColIdx + 1] || inbInfo.zoneId || '').toString().trim(),
          quanPhuong: (row[hvStartColIdx + 2] || `${inbInfo.quan || ''} - ${inbInfo.phuong || ''}`).toString().trim(),
          idRd: idRdVal,
          tenRd: tenRdVal,
          cotRd: (row[hvStartColIdx + 5] || inbInfo.cotRd || '').toString().trim(),
          thoiGianQuet: (row[hvStartColIdx + 6] || inbInfo.deliveringTime || '').toString().trim(),
          trangThai: trangThaiChuan,
          lyDoOnhold: (row[hvStartColIdx + 8] || inbInfo.onHoldReason || '').toString().trim()
        });
      }
    }

    // NẾU SHEET "DATA INBOUND" ĐANG TRỐNG TẠM THỜI DO ĐANG CHẠY ĐỒNG BỘ -> TRẢ VỀ BẢN LƯU NGẦM GẦN NHẤT ĐỂ KHÔNG BỊ HIỆN 0
    if (allRows.length === 0 && lastValidHangHoaResponse) {
      return res.json({
        ...lastValidHangHoaResponse,
        banGiaoHv: banGiaoHv.length > 0 ? banGiaoHv : (lastValidHangHoaResponse.banGiaoHv || []),
        restoredFromCache: true
      });
    }

    // 2. Chỉ lấy đơn pending chưa gán Rider (LMHub_Received & trống cột F - Driver Name)
    const rows = allRows.filter(r => (r[10] || '').toString().trim() === 'LMHub_Received' && !(r[5] || '').toString().trim());

    let pendingMP = 0, pendingWH = 0, pendingHV = 0;
    const groupMap = {};
    rows.forEach(r => {
      const whsId = (r[9] || '').toString().trim();
      if (whsId && whsId !== '0' && whsId.toLowerCase() !== 'trong' && whsId.toLowerCase() !== 'trống') {
        pendingWH++;
      } else {
        pendingMP++;
      }
      if ((r[12] || '').toString().trim().toLowerCase() === 'yes') pendingHV++;

      const quan = (r[13] || '').toString().trim();
      const phuong = (r[14] || '').toString().trim();
      const key = `${quan}||${phuong}`;
      if (!groupMap[key]) groupMap[key] = { quan, phuong, soLuong: 0 };
      groupMap[key].soLuong++;
    });

    const groups = Object.values(groupMap);

    const orderQ2 = ['an khánh', 'an lợi đông', 'an phú', 'thảo điền', 'thủ thiêm', 'bình trưng đông', 'bình trưng tây', 'thạnh mỹ lợi', 'cát lái'];
    const orderQ7 = ['phú thuận', 'tân hưng', 'tân kiểng', 'tân phong', 'tân quy', 'tân phú', 'tân thuận đông', 'tân thuận tây', 'bình thuận', 'phú mỹ'];
    const orderQ9 = ['phước bình', 'phước long a', 'phước long b'];

    function groupsByDistrict(keyword) {
      return groups
        .filter(g => (g.quan || '').toLowerCase().includes(keyword.toLowerCase()))
        .map(g => ({ quan: g.quan, phuong: g.phuong, soLuong: g.soLuong }))
        .sort((a, b) => {
          const kw = keyword.toLowerCase();
          const pA = (a.phuong || '').toLowerCase();
          const pB = (b.phuong || '').toLowerCase();

          let idxA = 999, idxB = 999;
          if (kw.includes('quận 2')) {
            idxA = orderQ2.findIndex(item => pA.includes(item));
            idxB = orderQ2.findIndex(item => pB.includes(item));
          } else if (kw.includes('quận 7')) {
            idxA = orderQ7.findIndex(item => pA.includes(item));
            idxB = orderQ7.findIndex(item => pB.includes(item));
          } else if (kw.includes('quận 9')) {
            idxA = orderQ9.findIndex(item => pA.includes(item));
            idxB = orderQ9.findIndex(item => pB.includes(item));
          }

          if (idxA === -1) idxA = 999;
          if (idxB === -1) idxB = 999;
          if (idxA !== 999 || idxB !== 999) {
            if (idxA !== idxB) return idxA - idxB;
          }

          const numA = parseInt((pA.match(/\d+/) || [])[0], 10);
          const numB = parseInt((pB.match(/\d+/) || [])[0], 10);
          if (!isNaN(numA) && !isNaN(numB) && numA !== numB) return numA - numB;

          return pA.localeCompare(pB, 'vi');
        });
    }

    const phuongQuan2 = groupsByDistrict('quận 2');
    const phuongQuan4 = groupsByDistrict('quận 4');
    const phuongQuan7 = groupsByDistrict('quận 7');
    const phuongQuan9 = groupsByDistrict('quận 9');
    const phuongBinhThanh = groupsByDistrict('bình thạnh');

    const countDistrict = (keyword) => groups.filter(g => (g.quan || '').toLowerCase().includes(keyword.toLowerCase())).reduce((s, g) => s + g.soLuong, 0);

    const kpi = {
      tongDon: rows.length,
      q2: countDistrict('quận 2'),
      q4: countDistrict('quận 4'),
      q7: countDistrict('quận 7'),
      q9: countDistrict('quận 9'),
      bt: countDistrict('bình thạnh'),
      donMp: pendingMP,
      donWh: pendingWH,
      donHv: pendingHV,
      lastUpdate: sheetUpdateStr || nowTimeStr,
    };

    const sortedGroups = [...groups].sort((a, b) => b.soLuong - a.soLuong);
    const top5Phuong = sortedGroups.slice(0, 5).map((g, idx) => ({
      hang: `#${idx + 1}`,
      ten: g.phuong,
      quan: g.quan,
      soLuong: g.soLuong,
    }));

    const mapped = rows.map(r => ({
      shipmentId: (r[0] || '').toString().trim(),
      zoneId: (r[1] || '').toString().trim(),
      receivedTime: (r[6] || '').toString().trim(),
      quan: (r[13] || '').toString().trim(),
      phuong: (r[14] || '').toString().trim(),
      loaiHang: (r[9] && r[9].toString().trim() !== '' && r[9].toString().trim() !== '0' && r[9].toString().toLowerCase() !== 'trong' && r[9].toString().toLowerCase() !== 'trống') ? 'WH' : 'MP',
      isHv: (r[12] || '').toString().trim()
    }));

    const responsePayload = {
      headers: ['Tracking', 'Zone', 'Status'],
      rows: rows.map(r => [r[0] || '', r[1] || '', r[10] || '']),
      kpi,
      top5Phuong,
      phuongQuan2,
      phuongQuan4,
      phuongQuan7,
      phuongQuan9,
      phuongBinhThanh,
      banGiaoHv,
      allRowsCount: allRows.length,
      cachedInboundOrders: mapped,
      inboundOrdersCache: mapped
    };

    // Lưu ngầm vào bộ nhớ Server khi Sheet có dữ liệu hợp lệ
    if (allRows.length > 0 && (rows.length > 0 || !lastValidHangHoaResponse)) {
      lastValidHangHoaResponse = responsePayload;
    } else if (rows.length > 0) {
      lastValidHangHoaResponse = responsePayload;
    } else if (lastValidHangHoaResponse && banGiaoHv.length > 0) {
      lastValidHangHoaResponse.banGiaoHv = banGiaoHv;
    }

    res.json(responsePayload);
  } catch (error) {
    console.warn('Lỗi đọc DATA PENDING, trả về dữ liệu lưu ngầm:', error.message);
    if (lastValidHangHoaResponse) {
      return res.json({ ...lastValidHangHoaResponse, restoredFromCache: true });
    }
    res.json({
      headers: ['Thông báo'],
      rows: [['Đang cập nhật dữ liệu...']],
      kpi: { tongDon: 0, q2: 0, q4: 0, q7: 0, q9: 0, bt: 0, donMp: 0, donWh: 0, donHv: 0, lastUpdate: new Date().toLocaleTimeString('vi-VN') },
      top5Phuong: [],
      phuongQuan2: [],
      phuongQuan4: [],
      phuongQuan7: [],
      phuongQuan9: [],
      phuongBinhThanh: [],
      banGiaoHv: [],
      allRowsCount: 0
    });
  }
});

// 3.5 API: ĐỌC DỮ LIỆU HÀNG HÓA INBOUND (TỪNG NGÀY TỪ GID=744743139 & HÔM NAY TỪ GID=909229938)
const SPREADSHEET_BAO_CAO_INBOUND_ID = '15zUl_3k3AEYL1Otl0pjSCAxoZiK-ND-sQU2MqsfGfAY';
const GID_INBOUND_LUU_DAILY = 744743139;
const GID_INBOUND_HOM_NAY = 909229938;
let lastValidInboundResponse = null;

// Hàm chuẩn hóa tên Quận về 5 quận KV2
function chuanHoaQuanKV2(rawQ) {
  const s = (rawQ || '').toString().toLowerCase().trim();
  if (s.includes('quận 2') || s === 'q2') return 'Quận 2';
  if (s.includes('quận 4') || s === 'q4') return 'Quận 4';
  if (s.includes('quận 7') || s === 'q7') return 'Quận 7';
  if (s.includes('quận 9') || s === 'q9') return 'Quận 9';
  if (s.includes('bình thạnh') || s === 'bt') return 'Bình Thạnh';
  return (rawQ || '').toString().trim();
}

// Hàm sắp xếp Phường từ nhỏ tới lớn theo chuẩn KV2
function sapXepPhuongKV2(listPhuong, quanKeyword) {
  const orderQ2 = ['an khánh', 'an lợi đông', 'an phú', 'thảo điền', 'thủ thiêm', 'bình trưng đông', 'bình trưng tây', 'thạnh mỹ lợi', 'cát lái'];
  const orderQ7 = ['phú thuận', 'tân hưng', 'tân kiểng', 'tân phong', 'tân quy', 'tân phú', 'tân thuận đông', 'tân thuận tây', 'bình thuận', 'phú mỹ'];
  const orderQ9 = ['phước bình', 'phước long a', 'phước long b'];
  const kw = (quanKeyword || '').toLowerCase();

  return [...(listPhuong || [])].sort((a, b) => {
    const pA = (a.phuong || '').toLowerCase();
    const pB = (b.phuong || '').toLowerCase();
    let idxA = 999, idxB = 999;

    if (kw.includes('quận 2')) {
      idxA = orderQ2.findIndex(item => pA.includes(item));
      idxB = orderQ2.findIndex(item => pB.includes(item));
    } else if (kw.includes('quận 7')) {
      idxA = orderQ7.findIndex(item => pA.includes(item));
      idxB = orderQ7.findIndex(item => pB.includes(item));
    } else if (kw.includes('quận 9')) {
      idxA = orderQ9.findIndex(item => pA.includes(item));
      idxB = orderQ9.findIndex(item => pB.includes(item));
    }

    if (idxA === -1) idxA = 999;
    if (idxB === -1) idxB = 999;
    if (idxA !== 999 || idxB !== 999) {
      if (idxA !== idxB) return idxA - idxB;
    }

    const numA = parseInt((pA.match(/\d+/) || [])[0], 10);
    const numB = parseInt((pB.match(/\d+/) || [])[0], 10);
    if (!isNaN(numA) && !isNaN(numB) && numA !== numB) return numA - numB;

    return pA.localeCompare(pB, 'vi');
  });
}

// Hàm bóc tách 1 khối Pivot (4 cột: Quận cũ | COT RC | Phường cũ | COUNTA of shipment_id)
function parseKhoiPivotInbound(rows, headerRowIdx, startCol, rawTitle = '') {
  let currentQuan = '';
  let currentCot = 'COT 1';
  let sumCot1 = 0, sumCot2 = 0;
  const wardMap = {}; // key: quan||phuong -> { quan, phuong, cot1, cot2, soLuong }
  const mapCot1 = {};
  const mapCot2 = {};

  for (let r = headerRowIdx + 1; r < rows.length; r++) {
    const row = rows[r] || [];
    const qRaw = (row[startCol] || '').toString().trim();
    const cotRaw = (row[startCol + 1] || '').toString().trim();
    const phuongRaw = (row[startCol + 2] || '').toString().trim();
    const countRaw = (row[startCol + 3] || '').toString().trim();
    const soLuong = parseInt(countRaw.replace(/[^\d]/g, ''), 10) || 0;

    if (!qRaw && !cotRaw && !phuongRaw && !countRaw) continue;

    const qLower = qRaw.toLowerCase();
    const cotLower = cotRaw.toLowerCase();
    const pLower = phuongRaw.toLowerCase();

    if (qLower.includes('grand total') || qLower.includes('tổng cộng')) break;
    if (qLower.includes('total') || qLower.includes('tổng')) continue;

    if (qRaw !== '' && !qLower.includes('quận cũ')) {
      currentQuan = chuanHoaQuanKV2(qRaw);
    }

    if (cotLower.includes('total') || cotLower.includes('tổng')) continue;
    if (cotRaw !== '' && !cotLower.includes('cot rc')) {
      currentCot = cotRaw.toUpperCase().includes('2') ? 'COT 2' : 'COT 1';
    }

    if (phuongRaw !== '' && !pLower.includes('phường cũ') && !pLower.includes('total') && soLuong > 0 && currentQuan) {
      const key = `${currentQuan}||${phuongRaw}`;
      if (!wardMap[key]) {
        wardMap[key] = { quan: currentQuan, phuong: phuongRaw, cot1: 0, cot2: 0, soLuong: 0 };
      }
      if (currentCot === 'COT 2') {
        wardMap[key].cot2 += soLuong;
        sumCot2 += soLuong;
        mapCot2[key] = (mapCot2[key] || 0) + soLuong;
      } else {
        wardMap[key].cot1 += soLuong;
        sumCot1 += soLuong;
        mapCot1[key] = (mapCot1[key] || 0) + soLuong;
      }
      wardMap[key].soLuong += soLuong;
    }
  }

  return buildInboundDayObject(rawTitle, wardMap, mapCot1, mapCot2, sumCot1, sumCot2);
}

// Hàm đóng gói dữ liệu 1 ngày Inbound chuẩn cho Frontend
function buildInboundDayObject(rawTitle, wardMap, mapCot1, mapCot2, sumCot1, sumCot2, extra = {}) {
  const allWards = Object.values(wardMap);
  const byQuan = (qName) => {
    const list = sapXepPhuongKV2(allWards.filter(w => w.quan === qName), qName);
    const cot1 = list.reduce((s, i) => s + i.cot1, 0);
    const cot2 = list.reduce((s, i) => s + i.cot2, 0);
    return { list, cot1, cot2, tong: cot1 + cot2 };
  };

  const dQ2 = byQuan('Quận 2');
  const dQ4 = byQuan('Quận 4');
  const dQ7 = byQuan('Quận 7');
  const dQ9 = byQuan('Quận 9');
  const dBT = byQuan('Bình Thạnh');

  const tongDon = sumCot1 + sumCot2;

  const formatCotList = (mObj) => Object.keys(mObj).map(k => {
    const [quan, phuong] = k.split('||');
    return { quan, phuong, soLuong: mObj[k] };
  });

  // Trích xuất ngày DD/MM/YYYY từ tiêu đề "--- DỮ LIỆU LƯU NGÀY: Thứ Năm - 05/11/2026 18:01:40 ---"
  const cleanTitle = (rawTitle || '').replace(/^-+\s*|\s*-+$/g, '').replace(/^DỮ LIỆU LƯU NGÀY:\s*/i, '').trim();
  const dateMatch = cleanTitle.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/);
  const ngayStr = dateMatch ? dateMatch[1] : (cleanTitle || 'Hôm nay');
  const shortNgay = dateMatch ? dateMatch[1].substring(0, 5) : ngayStr;

  return {
    rawTitle: cleanTitle || 'Hôm nay',
    ngay: ngayStr,
    shortNgay: shortNgay,
    tongDonKhuVuc: tongDon,
    tongCot1: sumCot1,
    tongCot2: sumCot2,
    tongMP: extra.tongMP || 0,
    tongWH: extra.tongWH || 0,
    tongHV: extra.tongHV || 0,
    q2: dQ2.tong, q2Cot1: dQ2.cot1, q2Cot2: dQ2.cot2, phuongQ2: dQ2.list,
    q4: dQ4.tong, q4Cot1: dQ4.cot1, q4Cot2: dQ4.cot2, phuongQ4: dQ4.list,
    q7: dQ7.tong, q7Cot1: dQ7.cot1, q7Cot2: dQ7.cot2, phuongQ7: dQ7.list,
    q9: dQ9.tong, q9Cot1: dQ9.cot1, q9Cot2: dQ9.cot2, phuongQ9: dQ9.list,
    bt: dBT.tong, btCot1: dBT.cot1, btCot2: dBT.cot2, phuongBT: dBT.list,
    tongPhuong: dQ2.list.length + dQ4.list.length + dQ7.list.length + dQ9.list.length + dBT.list.length,
    chiTietCot1: formatCotList(mapCot1),
    chiTietCot2: formatCotList(mapCot2)
  };
}

// Hàm tự động nhận diện và đọc dữ liệu từ 1 Sheet (Hỗ trợ cả LƯU DAILY nhiều cột, Pivot Table 1 khối, hoặc Bảng Raw Shipment_ID)
function parseInboundSheetUniversal(rows, defaultTitle = 'Hôm nay') {
  if (!rows || rows.length === 0) return [];

  // 1. Kiểm tra nếu là bảng Raw Orders (Cột A là shipment_id)
  const firstRowStr = (rows[0] || []).map(c => (c || '').toString().toLowerCase().trim());
  if (firstRowStr.includes('shipment_id')) {
    const idxShip = firstRowStr.indexOf('shipment_id');
    const idxWhs = firstRowStr.findIndex(h => h.includes('whs_id'));
    const idxHv = firstRowStr.findIndex(h => h === 'hv' || h.includes('is_hv'));
    const idxCot = firstRowStr.findIndex(h => h.includes('cot'));
    const idxQuan = firstRowStr.findIndex(h => h.includes('quận'));
    const idxPhuong = firstRowStr.findIndex(h => h.includes('phường'));

    const seenIds = new Set();
    const wardMap = {};
    const mapCot1 = {}, mapCot2 = {};
    let sumCot1 = 0, sumCot2 = 0, tongMP = 0, tongWH = 0, tongHV = 0;

    for (let r = 1; r < rows.length; r++) {
      const row = rows[r] || [];
      const sId = (row[idxShip] || '').toString().trim();
      if (!sId || seenIds.has(sId)) continue;
      seenIds.add(sId);

      const qName = chuanHoaQuanKV2(idxQuan !== -1 ? row[idxQuan] : row[14]);
      const pName = ((idxPhuong !== -1 ? row[idxPhuong] : row[15]) || 'Chưa rõ').toString().trim();
      const cotVal = ((idxCot !== -1 ? row[idxCot] : row[13]) || '').toString().toUpperCase();
      const whsVal = ((idxWhs !== -1 ? row[idxWhs] : row[9]) || '').toString().trim();
      const hvVal = ((idxHv !== -1 ? row[idxHv] : row[12]) || '').toString().trim().toLowerCase();

      if (!qName) continue;
      if (whsVal && whsVal !== '0' && whsVal.toLowerCase() !== 'nan') tongWH++; else tongMP++;
      if (hvVal === 'yes') tongHV++;

      const key = `${qName}||${pName}`;
      if (!wardMap[key]) wardMap[key] = { quan: qName, phuong: pName, cot1: 0, cot2: 0, soLuong: 0 };

      if (cotVal.includes('2')) {
        wardMap[key].cot2++;
        sumCot2++;
        mapCot2[key] = (mapCot2[key] || 0) + 1;
      } else {
        wardMap[key].cot1++;
        sumCot1++;
        mapCot1[key] = (mapCot1[key] || 0) + 1;
      }
      wardMap[key].soLuong++;
    }

    return [buildInboundDayObject(defaultTitle, wardMap, mapCot1, mapCot2, sumCot1, sumCot2, { tongMP, tongWH, tongHV })];
  }

  // 2. Quét ngang tìm tất cả các khối Pivot (LƯU DAILY có nhiều khối ngày hoặc Pivot Table INBOUND có 1 khối)
  const blocks = [];
  const maxScanRow = Math.min(5, rows.length);
  for (let r = 0; r < maxScanRow; r++) {
    const rowArr = rows[r] || [];
    for (let c = 0; c < rowArr.length; c++) {
      const cell = (rowArr[c] || '').toString().trim().toLowerCase();
      const nextCell1 = (rowArr[c + 1] || '').toString().trim().toLowerCase();
      const nextCell2 = (rowArr[c + 2] || '').toString().trim().toLowerCase();
      if (
        (cell === 'quận cũ' || cell === 'quận') &&
        (nextCell1.includes('cot') || nextCell2.includes('phường'))
      ) {
        let blockTitle = defaultTitle;
        if (r > 0 && rows[r - 1] && rows[r - 1][c]) {
          blockTitle = rows[r - 1][c].toString().trim();
        }
        blocks.push({ headerRowIdx: r, startCol: c, title: blockTitle });
      }
    }
    if (blocks.length > 0) break;
  }

  const parsedDays = blocks
    .map(b => parseKhoiPivotInbound(rows, b.headerRowIdx, b.startCol, b.title))
    .filter(d => d.tongDonKhuVuc > 0);

  return parsedDays;
}

app.get('/api/hang-hoa-inbound', async (req, res) => {
  try {
    const meta = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_BAO_CAO_INBOUND_ID,
      fields: 'sheets.properties(title,sheetId)'
    });
    const allSheets = meta.data.sheets || [];
    const sheetDailyObj = allSheets.find(s => s.properties.sheetId === GID_INBOUND_LUU_DAILY);
    const sheetTodayObj = allSheets.find(s => s.properties.sheetId === GID_INBOUND_HOM_NAY);

    const titleDaily = sheetDailyObj ? sheetDailyObj.properties.title : 'LƯU DAILY';
    const titleToday = sheetTodayObj ? sheetTodayObj.properties.title : 'Pivot Table INBOUND';

    const batchRes = await sheets.spreadsheets.values.batchGet({
      spreadsheetId: SPREADSHEET_BAO_CAO_INBOUND_ID,
      ranges: [
        `'${titleDaily}'!A1:ZZ200`,
        `'${titleToday}'!A1:Z99000`
      ]
    });

    const valueRanges = batchRes.data.valueRanges || [];
    const rowsDaily = valueRanges[0]?.values || [];
    const rowsToday = valueRanges[1]?.values || [];

    // 1. Đọc lịch sử từng ngày từ gid=744743139 (LƯU DAILY)
    const lichSuNgay = parseInboundSheetUniversal(rowsDaily, 'Lịch sử ngày');

    // 2. Đọc dữ liệu Inbound hôm nay từ gid=909229938
    const todayParsedList = parseInboundSheetUniversal(rowsToday, `Hôm nay (${new Date().toLocaleDateString('vi-VN')})`);
    let homNayData = todayParsedList.length > 0 ? todayParsedList[todayParsedList.length - 1] : null;

    // Nếu tab hôm nay đang trống tạm thời lúc đầu ngày -> Lấy ngày mới nhất trong LƯU DAILY làm dự phòng nhưng vẫn giữ nhãn rõ ràng
    if (!homNayData || homNayData.tongDonKhuVuc === 0) {
      if (lichSuNgay.length > 0) {
        const latestSaved = lichSuNgay[lichSuNgay.length - 1];
        homNayData = {
          ...latestSaved,
          rawTitle: `Hôm nay (Chưa phát sinh đơn mới - Hiển thị kỳ gần nhất: ${latestSaved.ngay})`,
          isFallbackFromDaily: true
        };
      } else {
        homNayData = buildInboundDayObject(`Hôm nay (${new Date().toLocaleDateString('vi-VN')})`, {}, {}, {}, 0, 0);
      }
    } else {
      homNayData.rawTitle = `Hôm nay - ${new Date().toLocaleDateString('vi-VN')} (Trích xuất từ ${titleToday})`;
    }

    const responsePayload = {
      success: true,
      data: {
        ...homNayData,
        titleTodaySheet: titleToday,
        titleDailySheet: titleDaily,
        homNay: homNayData,
        lichSuNgay: [...lichSuNgay].reverse() // Xếp ngày mới nhất lên đầu
      }
    };

    if (homNayData.tongDonKhuVuc > 0 || lichSuNgay.length > 0) {
      lastValidInboundResponse = responsePayload;
    }

    res.json(responsePayload);
  } catch (error) {
    console.error('Lỗi API Hàng Hóa INBOUND:', error.message);
    if (lastValidInboundResponse) {
      return res.json({ ...lastValidInboundResponse, restoredFromCache: true });
    }
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
  for (let r = 0; r < Math.min(30, rows.length); r++) {
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

// TỌA ĐỘ KHO XÁC ĐỊNH & NGƯỠNG BÁN KÍNH HỢP LỆ (75 MÉT)
const TARGET_LAT = 10.819452810093942;
const TARGET_LNG = 106.67217349075761;
const MAX_KHO_DISTANCE_MET = 75;

function tinhKhoangCachMetTuToaDo(viDo, kinhDo) {
  if (viDo === undefined || kinhDo === undefined || viDo === null || kinhDo === null || viDo === '' || kinhDo === '') {
    return null;
  }
  const latNum = parseFloat(String(viDo).trim().replace(',', '.'));
  const lngNum = parseFloat(String(kinhDo).trim().replace(',', '.'));
  if (isNaN(latNum) || isNaN(lngNum)) return null;

  const R = 6371000;
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(latNum - TARGET_LAT);
  const dLng = toRad(lngNum - TARGET_LNG);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(TARGET_LAT)) * Math.cos(toRad(latNum)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

// Hàm tính số phút trễ so với giờ đóng cổng quy định của Ca
function tinhSoPhutTre(gioDiemDanhStr, gioDongStr) {
  if (!gioDiemDanhStr || !gioDongStr) return 0;
  const pGio = gioDiemDanhStr.toString().trim().split(':').map(Number);
  const pDong = gioDongStr.toString().trim().split(':').map(Number);
  if (pGio.length < 2 || pDong.length < 2 || isNaN(pGio[0]) || isNaN(pGio[1]) || isNaN(pDong[0]) || isNaN(pDong[1])) {
    return 0;
  }
  const secCheckIn = pGio[0] * 3600 + pGio[1] * 60 + (pGio[2] || 0);
  const secDong = pDong[0] * 3600 + pDong[1] * 60;
  if (secCheckIn <= secDong) return 0;
  return Math.max(1, Math.ceil((secCheckIn - secDong) / 60));
}

// Tự động đảm bảo Sheet "LƯU ĐIỂM DANH" có đủ 12 cột (tới Cột L) để không bao giờ bị lỗi vượt lưới cột
let daDamBaoCotLDiemDanh = false;
async function damBaoSheetLuuDiemDanhCoCotL() {
  if (daDamBaoCotLDiemDanh) return;
  try {
    const meta = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_TONG_QUAN_ID,
      fields: 'sheets.properties(title,sheetId,gridProperties.columnCount)'
    });
    const sheetDD = (meta.data.sheets || []).find(s => s.properties.title === 'LƯU ĐIỂM DANH');
    if (sheetDD) {
      const colCount = sheetDD.properties.gridProperties?.columnCount || 11;
      if (colCount < 12) {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: SPREADSHEET_TONG_QUAN_ID,
          requestBody: {
            requests: [{
              appendDimension: {
                sheetId: sheetDD.properties.sheetId,
                dimension: 'COLUMNS',
                length: 12 - colCount
              }
            }]
          }
        });
      }
      daDamBaoCotLDiemDanh = true;
    }
  } catch (e) {
    console.warn('Không thể mở rộng cột L cho LƯU ĐIỂM DANH:', e.message);
  }
}

// HÀM TỰ ĐỘNG RECHECK CỘT K (TRONG/NGOÀI KHO THEO MỐC 75M) & CỘT L (SỐ MÉT)
let isRecheckingDD = false;
async function recheckKhoangCachDiemDanhSheet() {
  if (isRecheckingDD) return;
  isRecheckingDD = true;
  try {
    await damBaoSheetLuuDiemDanhCoCotL();

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_TONG_QUAN_ID,
      range: "'LƯU ĐIỂM DANH'",
    });
    const rows = res.data.values || [];
    if (rows.length === 0) return;

    const updates = [];
    const headerRow = rows[0] || [];
    if (!headerRow[11] || !headerRow[11].toString().trim()) {
      updates.push({
        range: "'LƯU ĐIỂM DANH'!L1",
        values: [['Recheck Khoảng Cách (m)']]
      });
    }

    for (let i = 1; i < rows.length; i++) {
      const r = rows[i] || [];
      const viDo = r[8];   // Cột I
      const kinhDo = r[9]; // Cột J
      const cotK = (r[10] || '').toString().trim(); // Cột K
      const cotL = (r[11] || '').toString().trim(); // Cột L

      if (viDo && kinhDo) {
        const soMet = tinhKhoangCachMetTuToaDo(viDo, kinhDo);
        if (soMet !== null) {
          const viTriChuan75m = soMet <= MAX_KHO_DISTANCE_MET ? 'Trong kho' : 'Ngoài kho';
          const kcChuan = `${soMet}m`;

          if (cotK !== viTriChuan75m || cotL !== kcChuan) {
            updates.push({
              range: `'LƯU ĐIỂM DANH'!K${i + 1}:L${i + 1}`,
              values: [[viTriChuan75m, kcChuan]]
            });
          }
        }
      }
    }

    if (updates.length > 0) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: SPREADSHEET_TONG_QUAN_ID,
        requestBody: {
          valueInputOption: 'USER_ENTERED',
          data: updates
        }
      });
      console.log(`Đã đồng bộ chuẩn 75m (Cột K & L) cho ${updates.length} dòng trên LƯU ĐIỂM DANH!`);
    }
  } catch (e) {
    console.warn('Lỗi recheck khoảng cách điểm danh:', e.message);
  } finally {
    isRecheckingDD = false;
  }
}

setTimeout(() => { recheckKhoangCachDiemDanhSheet(); }, 5000);

// 6. API: Điểm danh Rider (Áp dụng mốc 75m & tính số phút trễ)
app.post('/api/diem-danh', async (req, res) => {
  try {
    const { riderId, riderName, caDiemDanh, caThucTe, anhBase64, ghiChu, coLichLam, viDo, kinhDo } = req.body;
    if (!riderId) return res.status(400).json({ success: false, message: 'Thiếu mã Rider' });

    const caCheckKey = (caDiemDanh || '').toUpperCase().includes('2') ? 'COT2' : 'COT1';
    const checkCong = kiemTraCaDangMo(caCheckKey);
    if (!checkCong.dangMo) return res.status(403).json({ success: false, message: checkCong.lyDo });

    if (coLichLam === false) {
      return res.status(400).json({ success: false, message: 'Hôm nay bạn không có lịch làm, vui lòng check lại với FTE khu vực!' });
    }

    let viTri = 'Không xác định';
    let khoangCachStr = 'Không xác định';
    const distanceMet = tinhKhoangCachMetTuToaDo(viDo, kinhDo);
    if (distanceMet !== null) {
      viTri = distanceMet <= MAX_KHO_DISTANCE_MET ? 'Trong kho' : 'Ngoài kho';
      khoangCachStr = `${distanceMet}m`;
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
    const cfgCa = cauHinhHaiCa[caTag] || { gioDong: '12:15' };

    const phutTre = tinhSoPhutTre(gioDiemDanh, cfgCa.gioDong);
    const trangThaiDiemDanh = phutTre > 0 ? `Trễ ${phutTre} phút` : 'Đã điểm danh';

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

    await damBaoSheetLuuDiemDanhCoCotL();
    const newRow = [
      timestamp,
      ngayDiemDanh,
      gioDiemDanh,
      riderId,
      riderName,
      caChuan,
      trangThaiDiemDanh,
      ghiChuFinal,
      viDo || '',
      kinhDo || '',
      viTri,
      khoangCachStr
    ];
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_TONG_QUAN_ID,
      range: "'LƯU ĐIỂM DANH'!A:L",
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [newRow] },
    });

    return res.status(200).json({
      success: true,
      message: `Đã điểm danh thành công lúc ${gioDiemDanh}! (Cách trạm: ${khoangCachStr})`,
      trangThai: trangThaiDiemDanh,
      khoangCach: khoangCachStr
    });
  } catch (error) {
    console.error('Lỗi điểm danh:', error.message);
    return res.status(500).json({ success: false, message: 'Lỗi ghi nhận điểm danh: ' + error.message });
  }
});

// 7. API: Lịch sử điểm danh hôm nay (Đọc toàn bộ tab không lo lỗi giới hạn cột & trả về Vĩ độ, Kinh độ, Số phút trễ)
app.get('/api/lich-su-diem-danh', async (req, res) => {
  try {
    recheckKhoangCachDiemDanhSheet();

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_TONG_QUAN_ID,
      range: "'LƯU ĐIỂM DANH'",
    });
    const allRows = response.data.values || [];
    const rows = allRows.slice(1); // Bỏ dòng tiêu đề đầu tiên

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
    const homNayIso = `${p.year}-${p.month}-${p.day}`;

    let list = rows
      .filter(r => {
        if (!r || r.length === 0) return false;
        const valA = (r[0] || '').toString().trim();
        const valB = (r[1] || '').toString().trim();
        return valB === homNayChuan ||
               valB === homNayKhongSo0 ||
               chuanHoaNgayIso(valB) === homNayIso ||
               valA.includes(homNayChuan) ||
               valA.includes(homNayKhongSo0);
      })
      .map((r, idx) => {
        const rawViDo = (r[8] || '').toString().trim();
        const rawKinhDo = (r[9] || '').toString().trim();
        const m = tinhKhoangCachMetTuToaDo(rawViDo, rawKinhDo);
        const kc = m !== null ? `${m}m` : ((r[11] || '').toString().trim() || '—');
        const viTriChuan = m !== null ? (m <= MAX_KHO_DISTANCE_MET ? 'Trong kho' : 'Ngoài kho') : (r[10] || '');

        const caRow = (r[5] || '').toString().toUpperCase();
        const gioRow = (r[2] || '').toString().trim();
        const gioDongQuyDinh = caRow.includes('2') ? cauHinhHaiCa.COT2.gioDong : cauHinhHaiCa.COT1.gioDong;
        let phutTre = tinhSoPhutTre(gioRow, gioDongQuyDinh);

        let trangThaiRow = (r[6] || 'Đã điểm danh').toString().trim();
        if (phutTre === 0 && trangThaiRow.toLowerCase().includes('trễ')) {
          const matchPhut = trangThaiRow.match(/(\d+)/);
          phutTre = matchPhut ? parseInt(matchPhut[1], 10) : 1;
        }
        if (phutTre > 0) {
          trangThaiRow = `Trễ ${phutTre} phút`;
        }

        return {
          stt: idx + 1,
          thoiGian: r[0] || '',
          ngay: r[1] || '',
          gio: gioRow,
          id: r[3] || '',
          name: r[4] || '',
          ca: r[5] || '',
          trangThai: trangThaiRow,
          soPhutTre: phutTre,
          ghiChu: r[7] || '',
          viDo: rawViDo || '—',
          kinhDo: rawKinhDo || '—',
          viTri: viTriChuan,
          khoangCach: kc
        };
      })
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
        "'HUB TO HUB'!B6:H1000",
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
        { ten: "GROUP THÔNG BÁO KHU VỰC 2", link: "https://zalo.me/g/zpaqsalq3rsp2ujhnupq" },
        { ten: "RIDER SDD KV 2 ( QUẬN 2 - QUẬN 4 - QUẬN 7 - QUẬN 9 - BÌNH THẠNH )", link: "https://zalo.me/g/vwcnkfxkzsipkisurqc4" },
        { ten: "RIDER BACKUP FT KV1+2", link: "https://zalo.me/g/aavbzd404" },
        { ten: "KHU VỰC 2 NEW COT1", link: "https://zalo.me/g/nnuxoghprlgkac0ubtt4" },
        { ten: "KHU VỰC 2 NEW COT2", link: "https://zalo.me/g/8u97hmugwv7tk9asf3i5" }
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