// ================= MODULE PERFORMANCE TODAY & QUẢN LÝ TUYẾN LẤY HÀNG (PICK) =================
if (typeof API_BASE === 'undefined') {
  window.API_BASE = '/api';
}

let globalPerformanceData = null;
let isPerfTwoColumnMode = true;
let currentPerfModalOrders = [];
let currentPerfModalStatusFilter = 'ALL';
let currentPerfShipmentIds = [];

// 1. TỰ ĐỘNG KHỞI TẠO GIAO DIỆN PERFORMANCE CHUẨN SHEET (GID=1561639417) TRONG #section-performance
function khoiTaoGiaoDienPerformanceDOM() {
  const sec = document.getElementById('section-performance');
  if (!sec || document.getElementById('rowHaiBangPerformance')) return;

  // Giữ lại thẻ Quản lý phường lấy hàng (BK) và Modal của nó
  const modalPick = document.getElementById('modalPhanPhuongPick');

  sec.innerHTML = `
    <style>
      .perf-sheet-header-cot1 {
        background: linear-gradient(135deg, #1b4965, #0d6efd);
        color: #ffffff;
        padding: 7px 12px;
        font-weight: 700;
        font-size: 0.84rem;
      }
      .perf-sheet-header-cot2 {
        background: linear-gradient(135deg, #9a3412, #fd7e14);
        color: #ffffff;
        padding: 7px 12px;
        font-weight: 700;
        font-size: 0.84rem;
      }
      .perf-sheet-table th {
        background-color: #1b4965 !important;
        color: #ffffff !important;
        font-size: 0.73rem;
        padding: 5px 6px !important;
        white-space: nowrap;
        text-align: center;
      }
      .perf-sheet-table td {
        font-size: 0.76rem;
        padding: 4px 6px !important;
        white-space: nowrap;
      }
      .perf-summary-row td {
        background-color: #fef9c3 !important;
        font-weight: 800 !important;
        color: #713f12 !important;
        border-bottom: 2px solid #eab308 !important;
      }
      .perf-rider-row {
        cursor: pointer;
        transition: background-color 0.12s ease;
      }
      .perf-rider-row:hover td {
        background-color: #e0f2fe !important;
      }
      .perf-num-btn {
        cursor: pointer;
        padding: 1px 6px;
        border-radius: 4px;
        display: inline-block;
        min-width: 28px;
        transition: transform 0.1s ease;
      }
      .perf-num-btn:hover {
        transform: scale(1.12);
        box-shadow: 0 2px 5px rgba(0,0,0,0.15);
      }
    </style>

    <!-- HÀNG TRÊN: QUẢN LÝ PHƯỜNG LẤY HÀNG (BK) + THANH CẬP NHẬT PERFORMANCE -->
    <div class="row g-2 mb-2 align-items-stretch">
      <div class="col-12 col-lg-5">
        <div class="card border-0 shadow-sm border-start border-warning border-4 h-100" style="cursor:pointer; transition: 0.2s;" onmouseover="this.style.backgroundColor='#fffbeb'" onmouseout="this.style.backgroundColor=''" onclick="moModalPhanPhuongPick()">
          <div class="card-body py-2 d-flex justify-content-between align-items-center bg-white rounded-end">
            <div>
              <h6 class="fw-bold text-dark mb-0" style="font-size:13.5px;"><i class="bi bi-box-seam-fill text-warning me-2 fs-5"></i>QUẢN LÝ PHƯỜNG LẤY HÀNG (BK)</h6>
              <div class="small mt-1 fw-semibold text-muted" id="lblCountChuaCoPick">Đang đếm dữ liệu Rider...</div>
            </div>
            <i class="bi bi-chevron-right fs-4 text-warning"></i>
          </div>
        </div>
      </div>
      <div class="col-12 col-lg-7">
        <div class="sync-bar shadow-sm h-100 d-flex flex-wrap justify-content-between align-items-center gap-2">
          <div class="d-flex align-items-center flex-wrap gap-2">
            <span class="badge bg-primary fs-6 py-1 px-2 shadow-sm"><i class="bi bi-speedometer2 me-1"></i>PERFORMANCE TODAY</span>
            <span class="text-muted small">Nạp lúc: <strong class="text-primary font-monospace" id="perfLastUpdateTime">—</strong></span>
            <span class="text-secondary small d-none d-sm-inline">(💡 Nhấn vào từng Rider hoặc số đơn để xem mã đơn)</span>
          </div>
          <button type="button" class="btn btn-sm btn-primary fw-bold py-1 px-3 shadow-sm" id="btnRefreshPerf" onclick="window.loadPerformanceData(true)">
            <i class="bi bi-arrow-repeat me-1"></i> Cập nhật ngay
          </button>
        </div>
      </div>
    </div>

    <!-- 5 THẺ KPI TỔNG QUAN PERFORMANCE TOÀN TRẠM -->
    <div class="row row-cols-2 row-cols-md-5 g-2 mb-2">
      <div class="col">
        <div class="sheet-kpi-card sheet-kpi-q2 shadow-sm" onclick="window.xemChiTietDonPerformance('ALL', 'TẤT CẢ RIDER KV2', 'ALL')">
          <div class="sheet-kpi-title"><span>TỔNG ASSIGNED</span> <i class="bi bi-search"></i></div>
          <div class="sheet-kpi-val" id="perfKpiAssigned">0</div>
          <div class="sheet-kpi-sub" id="perfSubAssigned">0 Rider chạy đơn</div>
        </div>
      </div>
      <div class="col">
        <div class="sheet-kpi-card sheet-kpi-mp shadow-sm" onclick="window.xemChiTietDonPerformance('ALL', 'TẤT CẢ ĐƠN ĐÃ GIAO (DELIVERED)', 'DELIVERED')">
          <div class="sheet-kpi-title"><span>DELIVERED (ĐÃ GIAO)</span> <i class="bi bi-search"></i></div>
          <div class="sheet-kpi-val text-success" id="perfKpiDelivered">0</div>
          <div class="sheet-kpi-sub" id="perfSubDelivered">Hoàn thành: 0.0%</div>
        </div>
      </div>
      <div class="col">
        <div class="sheet-kpi-card sheet-kpi-q4 shadow-sm" onclick="window.xemChiTietDonPerformance('ALL', 'TẤT CẢ ĐƠN ĐANG GIAO (DELIVERING)', 'DELIVERING')">
          <div class="sheet-kpi-title"><span>DELIVERING (ĐANG GIAO)</span> <i class="bi bi-search"></i></div>
          <div class="sheet-kpi-val" style="color:#b45309;" id="perfKpiDelivering">0</div>
          <div class="sheet-kpi-sub" id="perfSubDelivering">0.0% tổng đơn</div>
        </div>
      </div>
      <div class="col">
        <div class="sheet-kpi-card sheet-kpi-total shadow-sm" onclick="window.xemChiTietDonPerformance('ALL', 'TẤT CẢ ĐƠN ON-HOLD', 'ON_HOLD')">
          <div class="sheet-kpi-title"><span>ON-HOLD (GIỮ HÀNG)</span> <i class="bi bi-search"></i></div>
          <div class="sheet-kpi-val text-danger" id="perfKpiOnHold">0</div>
          <div class="sheet-kpi-sub" id="perfSubOnHold">0.0% tổng đơn</div>
        </div>
      </div>
      <div class="col-12 col-md">
        <div class="sheet-kpi-card sheet-kpi-hv" onclick="window.xemChiTietDonPerformance('ALL', 'ĐƠN HV ĐANG CHẠY', 'HV')">
          <div class="sheet-kpi-title"><span><i class="bi bi-shield-fill-exclamation text-warning me-1"></i>TỶ LỆ HOÀN THÀNH</span></div>
          <div class="sheet-kpi-val" id="perfKpiRate">0.0%</div>
          <div class="sheet-kpi-sub" id="perfSubRate">Sáng: 0.0% | Chiều: 0.0%</div>
        </div>
      </div>
    </div>

    <!-- THANH LỌC TÌM KIẾM RIDER & QUẬN -->
    <div class="card shadow-sm border-0 mb-2">
      <div class="card-body py-2 px-3">
        <div class="row g-2 align-items-center">
          <div class="col-12 col-md-4">
            <div class="input-group input-group-sm">
              <span class="input-group-text bg-white"><i class="bi bi-search text-primary"></i></span>
              <input type="text" id="perfSearch" class="form-control" placeholder="Tìm mã ID, họ tên Rider, quận..." oninput="window.renderBangPerformanceHaiCa()">
            </div>
          </div>
          <div class="col-6 col-md-3">
            <select id="perfFilterQuan" class="form-select form-select-sm fw-bold" onchange="window.renderBangPerformanceHaiCa()">
              <option value="ALL">📍 Tất cả Quận giao</option>
              <option value="Quận 2">Quận 2</option>
              <option value="Quận 4">Quận 4</option>
              <option value="Quận 7">Quận 7</option>
              <option value="Quận 9">Quận 9</option>
              <option value="Bình Thạnh">Bình Thạnh</option>
              <option value="Chưa phân tuyến">Chưa phân tuyến / BK</option>
            </select>
          </div>
          <div class="col-6 col-md-3">
            <select id="perfFilterStatus" class="form-select form-select-sm fw-bold" onchange="window.renderBangPerformanceHaiCa()">
              <option value="ALL">📦 Tất cả trạng thái</option>
              <option value="HAS_ONHOLD">⚠️ Có đơn On-Hold (> 0)</option>
              <option value="HAS_DELIVERING">🛵 Đang đi giao (Delivering > 0)</option>
              <option value="DONE_100">✅ Hoàn thành 100%</option>
            </select>
          </div>
          <div class="col-12 col-md-2 text-end">
            <button type="button" class="btn btn-sm btn-outline-secondary py-1 px-2 fw-bold w-100" onclick="window.toggleCheDoXemPerf()" id="btnToggleLayoutPerf">
              <i class="bi bi-layout-split me-1"></i><span id="txtToggleLayoutPerf">2 Bảng Song Song</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 2 BẢNG SONG SONG Y NHƯ GOOGLE SHEET (CA SÁNG COT 1 & CA CHIỀU COT 2) -->
    <div class="row g-2" id="rowHaiBangPerformance">
      <div class="col-12 col-xl-6" id="colPerfCot1">
        <div class="card shadow-sm border-0 h-100 overflow-hidden">
          <div class="perf-sheet-header-cot1 d-flex justify-content-between align-items-center">
            <span><i class="bi bi-sun-fill text-warning me-1"></i>CA SÁNG (COT 1)</span>
            <span class="badge bg-light text-primary fw-bold" id="badgeCountRdCot1">0 Rider</span>
          </div>
          <div class="table-responsive" style="max-height: 680px;">
            <table class="table table-bordered table-hover table-sm perf-sheet-table align-middle mb-0 text-center">
              <thead class="sticky-top">
                <tr>
                  <th style="width: 38px;">STT</th>
                  <th style="width: 72px;">Mã Rider</th>
                  <th class="text-start">Họ và tên Rider</th>
                  <th>Quận giao</th>
                  <th>Tổng Assigned</th>
                  <th>Delivered</th>
                  <th>Delivering</th>
                  <th>On-Hold</th>
                  <th>% Hoàn thành</th>
                </tr>
              </thead>
              <tbody id="tbodyPerfCot1">
                <tr><td colspan="9" class="text-center py-4 text-muted">Đang tải dữ liệu Ca Sáng...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="col-12 col-xl-6" id="colPerfCot2">
        <div class="card shadow-sm border-0 h-100 overflow-hidden">
          <div class="perf-sheet-header-cot2 d-flex justify-content-between align-items-center">
            <span><i class="bi bi-moon-stars-fill text-warning me-1"></i>CA CHIỀU (COT 2)</span>
            <span class="badge bg-light text-danger fw-bold" id="badgeCountRdCot2">0 Rider</span>
          </div>
          <div class="table-responsive" style="max-height: 680px;">
            <table class="table table-bordered table-hover table-sm perf-sheet-table align-middle mb-0 text-center">
              <thead class="sticky-top">
                <tr>
                  <th style="width: 38px;">STT</th>
                  <th style="width: 72px;">Mã Rider</th>
                  <th class="text-start">Họ và tên Rider</th>
                  <th>Quận giao</th>
                  <th>Tổng Assigned</th>
                  <th>Delivered</th>
                  <th>Delivering</th>
                  <th>On-Hold</th>
                  <th>% Hoàn thành</th>
                </tr>
              </thead>
              <tbody id="tbodyPerfCot2">
                <tr><td colspan="9" class="text-center py-4 text-muted">Đang tải dữ liệu Ca Chiều...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <!-- MODAL XEM CHI TIẾT MÃ ĐƠN CỦA TỪNG RIDER TRONG PERFORMANCE -->
    <div class="modal fade" id="modalChiTietDonPerformance" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
        <div class="modal-content">
          <div class="modal-header bg-primary text-white py-2">
            <h6 class="modal-title fw-bold mb-0" id="titleModalDonPerf">
              <i class="bi bi-box-seam-fill me-1"></i>CHI TIẾT MÃ ĐƠN CỦA RIDER
            </h6>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body p-2 bg-light">
            <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 bg-white p-2 rounded border shadow-sm mb-2">
              <div class="btn-group btn-group-sm" role="group" id="btnGroupFilterStatusPerf">
                <button type="button" class="btn btn-primary fw-bold" data-status="ALL" onclick="window.locTrangThaiDonTrongModalPerf('ALL')">
                  📦 Tất cả (<span id="cntPerfModalAll">0</span>)
                </button>
                <button type="button" class="btn btn-outline-success fw-bold" data-status="DELIVERED" onclick="window.locTrangThaiDonTrongModalPerf('DELIVERED')">
                  ✅ Delivered (<span id="cntPerfModalDeliv">0</span>)
                </button>
                <button type="button" class="btn btn-outline-warning text-dark fw-bold" data-status="DELIVERING" onclick="window.locTrangThaiDonTrongModalPerf('DELIVERING')">
                  🛵 Delivering (<span id="cntPerfModalIng">0</span>)
                </button>
                <button type="button" class="btn btn-outline-danger fw-bold" data-status="ON_HOLD" onclick="window.locTrangThaiDonTrongModalPerf('ON_HOLD')">
                  ⚠️ On-Hold (<span id="cntPerfModalHold">0</span>)
                </button>
              </div>
              <div class="d-flex align-items-center gap-2">
                <input type="text" id="txtSearchOrderPerfModal" class="form-control form-control-sm" style="width: 210px;" placeholder="🔍 Tìm mã đơn, phường, lý do..." oninput="window.veBangDonTrongModalPerf()">
                <button type="button" class="btn btn-sm btn-outline-primary fw-bold py-1 px-2" onclick="window.copyMaDonPerformanceModal()">
                  <i class="bi bi-clipboard-check me-1"></i>Sao chép mã đơn
                </button>
              </div>
            </div>
            <div class="table-responsive bg-white rounded border shadow-sm" style="max-height: 65vh;">
              <table class="table table-sm table-bordered table-hover align-middle mb-0 text-center" style="font-size: 0.78rem;">
                <thead class="table-light sticky-top">
                  <tr>
                    <th style="width: 42px;">STT</th>
                    <th>Mã Đơn (Shipment ID)</th>
                    <th>Trạng Thái</th>
                    <th>Loại Hàng</th>
                    <th>Zone ID</th>
                    <th class="text-start">Quận / Phường</th>
                    <th>Rider</th>
                    <th>Thời Gian Giao / Hold</th>
                    <th class="text-start">Lý Do On-Hold</th>
                  </tr>
                </thead>
                <tbody id="tbodyModalDonPerf">
                  <tr><td colspan="9" class="py-4 text-muted">Đang tải danh sách mã đơn...</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  if (modalPick) {
    sec.appendChild(modalPick);
  }
}

// 2. CÁC HÀM XỬ LÝ BẢNG PERFORMANCE TODAY (CA SÁNG & CA CHIỀU)
window.toggleCheDoXemPerf = function() {
  isPerfTwoColumnMode = !isPerfTwoColumnMode;
  const col1 = document.getElementById('colPerfCot1');
  const col2 = document.getElementById('colPerfCot2');
  const txt = document.getElementById('txtToggleLayoutPerf');
  if (col1 && col2) {
    col1.className = isPerfTwoColumnMode ? 'col-12 col-xl-6' : 'col-12 mb-2';
    col2.className = isPerfTwoColumnMode ? 'col-12 col-xl-6' : 'col-12';
  }
  if (txt) txt.innerText = isPerfTwoColumnMode ? '2 Bảng Song Song' : '1 Bảng Lớn';
};

window.loadPerformanceData = async function(isManual = false) {
  khoiTaoGiaoDienPerformanceDOM();

  const btn = document.getElementById('btnRefreshPerf');
  if (btn && isManual) {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Đang nạp...';
  }

  if (!globalPerformanceData) {
    try {
      const saved = localStorage.getItem('KV2_LAST_VALID_PERF_V2');
      if (saved) {
        globalPerformanceData = JSON.parse(saved);
        window.capNhatGiaoDienPerformance();
      }
    } catch (e) {}
  }

  try {
    const res = await fetch(`${window.API_BASE}/performance-data?_t=${Date.now()}`);
    const data = await res.json();
    if (data && data.success) {
      globalPerformanceData = data;
      if (typeof loadedTabs !== 'undefined') loadedTabs.performance = true;
      try {
        localStorage.setItem('KV2_LAST_VALID_PERF_V2', JSON.stringify(data));
      } catch (e) {}
      window.capNhatGiaoDienPerformance();
    }
  } catch (err) {
    console.error('Lỗi tải Performance:', err);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="bi bi-arrow-repeat me-1"></i> Cập nhật ngay';
    }
    if (typeof window.loadThongKeChuaCoPick === 'function') window.loadThongKeChuaCoPick();
  }
};

window.capNhatGiaoDienPerformance = function() {
  khoiTaoGiaoDienPerformanceDOM();
  if (!globalPerformanceData) return;

  const d = globalPerformanceData;
  const t = d.tongToanTram || { assigned: 0, delivered: 0, delivering: 0, onHold: 0, rate: 0, riderCount: 0, hvCount: 0 };
  const c1 = d.tongCaSang || { rateStr: '0.0%' };
  const c2 = d.tongCaChieu || { rateStr: '0.0%' };

  const elTime = document.getElementById('perfLastUpdateTime');
  if (elTime) elTime.innerText = d.lastUpdate || new Date().toLocaleTimeString('vi-VN');

  const pct = (val) => t.assigned > 0 ? `${((val / t.assigned) * 100).toFixed(1)}% tổng đơn` : '0.0% tổng đơn';

  if (document.getElementById('perfKpiAssigned')) document.getElementById('perfKpiAssigned').innerText = (t.assigned || 0).toLocaleString('vi-VN');
  if (document.getElementById('perfSubAssigned')) document.getElementById('perfSubAssigned').innerText = `${t.riderCount || 0} Rider chạy đơn hôm nay`;

  if (document.getElementById('perfKpiDelivered')) document.getElementById('perfKpiDelivered').innerText = (t.delivered || 0).toLocaleString('vi-VN');
  if (document.getElementById('perfSubDelivered')) document.getElementById('perfSubDelivered').innerText = `Hoàn thành: ${t.rateStr || '0.0%'}`;

  if (document.getElementById('perfKpiDelivering')) document.getElementById('perfKpiDelivering').innerText = (t.delivering || 0).toLocaleString('vi-VN');
  if (document.getElementById('perfSubDelivering')) document.getElementById('perfSubDelivering').innerText = pct(t.delivering || 0);

  if (document.getElementById('perfKpiOnHold')) document.getElementById('perfKpiOnHold').innerText = (t.onHold || 0).toLocaleString('vi-VN');
  if (document.getElementById('perfSubOnHold')) document.getElementById('perfSubOnHold').innerText = pct(t.onHold || 0);

  if (document.getElementById('perfKpiRate')) document.getElementById('perfKpiRate').innerText = t.rateStr || '0.0%';
  if (document.getElementById('perfSubRate')) document.getElementById('perfSubRate').innerText = `Sáng: ${c1.rateStr || '0.0%'} | Chiều: ${c2.rateStr || '0.0%'}`;

  window.renderBangPerformanceHaiCa();
};

function locDanhSachRiderPerf(list) {
  const kw = (document.getElementById('perfSearch')?.value || '').trim().toLowerCase();
  const quanFilter = document.getElementById('perfFilterQuan')?.value || 'ALL';
  const statusFilter = document.getElementById('perfFilterStatus')?.value || 'ALL';

  return (list || []).filter(r => {
    const matchKw = !kw || `${r.id} ${r.name} ${r.quanGiao}`.toLowerCase().includes(kw);
    let matchQuan = true;
    if (quanFilter !== 'ALL') {
      if (quanFilter === 'Chưa phân tuyến') {
        matchQuan = r.baseQuan === 'Chưa phân tuyến' || r.baseQuan === 'Backup (BK)' || (r.quanGiao || '').includes('BK');
      } else {
        matchQuan = r.baseQuan === quanFilter || (r.quanGiao || '').includes(quanFilter);
      }
    }
    let matchStatus = true;
    if (statusFilter === 'HAS_ONHOLD') matchStatus = r.onHold > 0;
    else if (statusFilter === 'HAS_DELIVERING') matchStatus = r.delivering > 0;
    else if (statusFilter === 'DONE_100') matchStatus = r.assigned > 0 && r.delivered === r.assigned;

    return matchKw && matchQuan && matchStatus;
  });
}

function veMotBangCaPerf(tbodyId, badgeId, rawList, labelTongCa, caCode) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;

  const filtered = locDanhSachRiderPerf(rawList);
  const badgeEl = document.getElementById(badgeId);
  if (badgeEl) badgeEl.innerText = `${filtered.length} Rider`;

  const sumAssigned = filtered.reduce((s, i) => s + i.assigned, 0);
  const sumDelivered = filtered.reduce((s, i) => s + i.delivered, 0);
  const sumDelivering = filtered.reduce((s, i) => s + i.delivering, 0);
  const sumOnHold = filtered.reduce((s, i) => s + i.onHold, 0);
  const sumRate = sumAssigned > 0 ? `${((sumDelivered / sumAssigned) * 100).toFixed(1)}%` : '0.0%';

  let html = `
    <tr class="perf-summary-row">
      <td colspan="3" class="text-start ps-2">${labelTongCa} (${filtered.length} RD)</td>
      <td>—</td>
      <td><span class="perf-num-btn bg-white text-dark border" onclick="window.xemChiTietDonPerformance('ALL', '${labelTongCa}', 'ALL', '${caCode}')">${sumAssigned.toLocaleString('vi-VN')}</span></td>
      <td><span class="perf-num-btn bg-success text-white" onclick="window.xemChiTietDonPerformance('ALL', '${labelTongCa} - DELIVERED', 'DELIVERED', '${caCode}')">${sumDelivered.toLocaleString('vi-VN')}</span></td>
      <td><span class="perf-num-btn bg-warning text-dark" onclick="window.xemChiTietDonPerformance('ALL', '${labelTongCa} - DELIVERING', 'DELIVERING', '${caCode}')">${sumDelivering.toLocaleString('vi-VN')}</span></td>
      <td><span class="perf-num-btn bg-danger text-white" onclick="window.xemChiTietDonPerformance('ALL', '${labelTongCa} - ON-HOLD', 'ON_HOLD', '${caCode}')">${sumOnHold.toLocaleString('vi-VN')}</span></td>
      <td class="font-monospace">${sumRate}</td>
    </tr>`;

  if (filtered.length === 0) {
    html += `<tr><td colspan="9" class="py-4 text-muted">Không có Rider phù hợp bộ lọc</td></tr>`;
    tbody.innerHTML = html;
    return;
  }

  filtered.forEach((r, idx) => {
    const safeTitle = `${r.id} - ${r.name} (${r.ca} • ${r.quanGiao})`.replace(/'/g, "\\'");
    const rateColor = r.rate >= 90 ? 'bg-success text-white' : (r.rate >= 70 ? 'bg-warning text-dark' : 'bg-danger-subtle text-danger border border-danger-subtle');
    const quanBadgeCls = r.baseQuan === 'Quận 2' ? 'text-primary' : (r.baseQuan === 'Quận 4' ? 'text-warning text-dark' : (r.baseQuan === 'Quận 7' ? 'text-info text-dark' : (r.baseQuan === 'Quận 9' ? 'text-success' : (r.baseQuan === 'Bình Thạnh' ? 'text-danger' : 'text-secondary'))));

    html += `
      <tr class="perf-rider-row" onclick="window.xemChiTietDonPerformance('${r.id}', '${safeTitle}', 'ALL')">
        <td class="text-muted small">${idx + 1}</td>
        <td class="font-monospace fw-bold text-primary">${r.id}</td>
        <td class="text-start fw-bold text-dark">${r.name}</td>
        <td class="fw-semibold ${quanBadgeCls}">${r.quanGiao}</td>
        <td class="font-monospace fw-bold">
          <span class="perf-num-btn bg-light border text-dark" onclick="event.stopPropagation(); window.xemChiTietDonPerformance('${r.id}', '${safeTitle}', 'ALL')">${r.assigned}</span>
        </td>
        <td class="font-monospace fw-bold">
          <span class="perf-num-btn ${r.delivered > 0 ? 'bg-success-subtle text-success border border-success-subtle' : 'text-muted'}" onclick="event.stopPropagation(); window.xemChiTietDonPerformance('${r.id}', '${safeTitle}', 'DELIVERED')">${r.delivered}</span>
        </td>
        <td class="font-monospace fw-bold">
          <span class="perf-num-btn ${r.delivering > 0 ? 'bg-warning-subtle text-dark border border-warning' : 'text-muted'}" onclick="event.stopPropagation(); window.xemChiTietDonPerformance('${r.id}', '${safeTitle}', 'DELIVERING')">${r.delivering}</span>
        </td>
        <td class="font-monospace fw-bold">
          <span class="perf-num-btn ${r.onHold > 0 ? 'bg-danger text-white shadow-sm' : 'text-muted'}" onclick="event.stopPropagation(); window.xemChiTietDonPerformance('${r.id}', '${safeTitle}', 'ON_HOLD')">${r.onHold}</span>
        </td>
        <td>
          <span class="badge ${rateColor} font-monospace" style="min-width: 52px;">${r.rateStr}</span>
        </td>
      </tr>`;
  });

  tbody.innerHTML = html;
}

window.renderBangPerformanceHaiCa = function() {
  if (!globalPerformanceData) return;
  veMotBangCaPerf('tbodyPerfCot1', 'badgeCountRdCot1', globalPerformanceData.caSangList || [], '📊 TỔNG CỘNG CA SÁNG', 'COT 1');
  veMotBangCaPerf('tbodyPerfCot2', 'badgeCountRdCot2', globalPerformanceData.caChieuList || [], '📊 TỔNG CỘNG CA CHIỀU', 'COT 2');
};

// 3. XEM CHI TIẾT MÃ ĐƠN CỦA TỪNG RIDER TRONG PERFORMANCE
window.xemChiTietDonPerformance = async function(riderId, titleLabel, defaultStatus = 'ALL', caFilter = 'ALL') {
  khoiTaoGiaoDienPerformanceDOM();
  const modalEl = document.getElementById('modalChiTietDonPerformance');
  if (!modalEl) return;

  document.getElementById('titleModalDonPerf').innerHTML = `<i class="bi bi-person-badge-fill me-1"></i>CHI TIẾT ĐƠN HÀNG: ${titleLabel}`;
  document.getElementById('tbodyModalDonPerf').innerHTML = '<tr><td colspan="9" class="py-4 text-muted"><span class="spinner-border spinner-border-sm text-primary me-2"></span>Đang tải danh sách mã đơn...</td></tr>';
  const searchInp = document.getElementById('txtSearchOrderPerfModal');
  if (searchInp) searchInp.value = '';

  bootstrap.Modal.getOrCreateInstance(modalEl).show();

  try {
    const res = await fetch(`${window.API_BASE}/performance-rider-orders?riderId=${encodeURIComponent(riderId)}&ca=${encodeURIComponent(caFilter)}&_t=${Date.now()}`);
    const data = await res.json();
    let orders = (data && Array.isArray(data.orders)) ? data.orders : [];
    if (defaultStatus === 'HV') {
      orders = orders.filter(o => (o.isHv || '').toLowerCase() === 'yes');
      defaultStatus = 'ALL';
    }
    currentPerfModalOrders = orders;

    document.getElementById('cntPerfModalAll').innerText = orders.length;
    document.getElementById('cntPerfModalDeliv').innerText = orders.filter(o => o.statusBucket === 'DELIVERED').length;
    document.getElementById('cntPerfModalIng').innerText = orders.filter(o => o.statusBucket === 'DELIVERING').length;
    document.getElementById('cntPerfModalHold').innerText = orders.filter(o => o.statusBucket === 'ON_HOLD').length;

    window.locTrangThaiDonTrongModalPerf(defaultStatus);
  } catch (e) {
    document.getElementById('tbodyModalDonPerf').innerHTML = `<tr><td colspan="9" class="py-4 text-danger">Lỗi tải đơn hàng: ${e.message}</td></tr>`;
  }
};

window.locTrangThaiDonTrongModalPerf = function(statusKey) {
  currentPerfModalStatusFilter = statusKey;
  document.querySelectorAll('#btnGroupFilterStatusPerf button').forEach(btn => {
    const st = btn.getAttribute('data-status');
    if (st === statusKey) {
      if (st === 'DELIVERED') btn.className = 'btn btn-success fw-bold';
      else if (st === 'DELIVERING') btn.className = 'btn btn-warning text-dark fw-bold';
      else if (st === 'ON_HOLD') btn.className = 'btn btn-danger fw-bold';
      else btn.className = 'btn btn-primary fw-bold';
    } else {
      if (st === 'DELIVERED') btn.className = 'btn btn-outline-success fw-bold';
      else if (st === 'DELIVERING') btn.className = 'btn btn-outline-warning text-dark fw-bold';
      else if (st === 'ON_HOLD') btn.className = 'btn btn-outline-danger fw-bold';
      else btn.className = 'btn btn-outline-primary fw-bold';
    }
  });
  window.veBangDonTrongModalPerf();
};

window.veBangDonTrongModalPerf = function() {
  const tbody = document.getElementById('tbodyModalDonPerf');
  if (!tbody) return;

  const kw = (document.getElementById('txtSearchOrderPerfModal')?.value || '').trim().toLowerCase();
  const filtered = (currentPerfModalOrders || []).filter(o => {
    const matchSt = currentPerfModalStatusFilter === 'ALL' || o.statusBucket === currentPerfModalStatusFilter;
    const matchKw = !kw || `${o.shipmentId} ${o.zoneId} ${o.quan} ${o.phuong} ${o.driverName} ${o.onHoldReason} ${o.rawStatus}`.toLowerCase().includes(kw);
    return matchSt && matchKw;
  });

  currentPerfShipmentIds = filtered.map(o => o.shipmentId).filter(Boolean);

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" class="py-4 text-muted">Không có mã đơn nào trong mục này</td></tr>';
    return;
  }

  let html = '';
  filtered.forEach((o, idx) => {
    const isHv = (o.isHv || '').toLowerCase() === 'yes';
    const stBadge = o.statusBucket === 'DELIVERED'
      ? '<span class="badge bg-success">Delivered</span>'
      : (o.statusBucket === 'DELIVERING' ? '<span class="badge bg-warning text-dark">Delivering</span>' : `<span class="badge bg-danger">${o.rawStatus || 'On-Hold'}</span>`);
    const loaiBadge = `<span class="badge ${o.loaiHang === 'MP' ? 'bg-success-subtle text-success border border-success-subtle' : 'bg-secondary-subtle text-secondary border'}">${o.loaiHang}</span>${isHv ? ' <span class="badge bg-danger text-white">HV</span>' : ''}`;
    const timeStr = o.statusBucket === 'ON_HOLD' ? (o.onHoldTime || o.deliveringTime || o.receivedTime) : (o.deliveringTime || o.receivedTime);

    html += `
      <tr class="${isHv ? 'table-warning' : ''}">
        <td class="text-muted small">${idx + 1}</td>
        <td class="font-monospace fw-bold ${o.statusBucket === 'ON_HOLD' ? 'text-danger' : 'text-primary'}">${o.shipmentId}</td>
        <td>${stBadge}</td>
        <td>${loaiBadge}</td>
        <td class="font-monospace small">${o.zoneId || '—'}</td>
        <td class="text-start small fw-semibold">${o.quan} ${o.phuong ? '• ' + o.phuong : ''}</td>
        <td class="text-start small">${o.driverName} <span class="text-muted font-monospace">(${o.driverId})</span></td>
        <td class="font-monospace small text-muted">${timeStr || '—'}</td>
        <td class="text-start small text-danger fw-semibold">${o.onHoldReason || ''}</td>
      </tr>`;
  });
  tbody.innerHTML = html;
};

window.copyMaDonPerformanceModal = function() {
  if (!currentPerfShipmentIds || currentPerfShipmentIds.length === 0) {
    alert('Không có mã đơn để sao chép!');
    return;
  }
  navigator.clipboard.writeText(currentPerfShipmentIds.join('\n'))
    .then(() => alert(`✅ Đã sao chép ${currentPerfShipmentIds.length} mã đơn vào bộ nhớ tạm!`))
    .catch(err => alert('Lỗi sao chép: ' + err));
};

// 4. QUẢN LÝ PHƯỜNG LẤY HÀNG (BK) TRONG TAB PERFORMANCE
window.loadThongKeChuaCoPick = function() {
  const lbl = document.getElementById('lblCountChuaCoPick');
  const vungDanhSach = document.getElementById('vungRiderChuaCoPick');

  if (typeof ridersData === 'undefined' || ridersData.length === 0) {
    if (lbl) lbl.innerText = "Đang chờ tải dữ liệu hệ thống...";
    return;
  }

  const now = new Date();
  const todayStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}`;

  let countCot1 = 0;
  let countCot2 = 0;
  let riderChuaPick = [];

  ridersData.forEach(rd => {
    let isOff = false;
    if (typeof dateHeadersGlobal !== 'undefined') {
      const dh = dateHeadersGlobal.find(d => d.date.includes(todayStr));
      if (dh && rd.dailySchedule && rd.dailySchedule[dh.date]) {
        if (rd.dailySchedule[dh.date].toLowerCase().includes('off')) isOff = true;
      }
    }
    if (isOff) return;

    const isBackup = (rd.quanDeli || '').toUpperCase().includes('BK') || rd.isBackup;
    const noPickRoute = !rd.tuyenPick || rd.tuyenPick.trim() === '' || rd.tuyenPick === '-';

    if (isBackup || noPickRoute) {
      if (rd.ca.includes('1')) countCot1++;
      if (rd.ca.includes('2')) countCot2++;
      riderChuaPick.push(rd);
    }
  });

  if (lbl) {
    lbl.innerHTML = `<span class="text-danger fw-bold">${riderChuaPick.length} Rider</span> đang chờ xếp phường (COT 1: <b>${countCot1}</b> | COT 2: <b>${countCot2}</b>)`;
  }

  if (vungDanhSach) {
    if (riderChuaPick.length === 0) {
      vungDanhSach.innerHTML = '<div class="text-center py-5 text-muted"><i class="bi bi-check-circle-fill text-success fs-1 d-block mb-2"></i>Tuyệt vời! Tất cả Rider đi làm hôm nay đều đã có tuyến lấy hàng.</div>';
      return;
    }

    const grouped = { 'COT 1': {}, 'COT 2': {} };
    riderChuaPick.forEach(rd => {
      const caKey = rd.ca.includes('1') ? 'COT 1' : (rd.ca.includes('2') ? 'COT 2' : 'KHÁC');
      if (!grouped[caKey]) grouped[caKey] = {};

      const quanGoc = (rd.quanDeli && !rd.quanDeli.toUpperCase().includes('BK')) ? rd.quanDeli : (rd.quanPick || 'KHU VỰC BACKUP');
      if (!grouped[caKey][quanGoc]) grouped[caKey][quanGoc] = [];
      grouped[caKey][quanGoc].push(rd);
    });

    let htmlList = '<div class="accordion" id="accChuaPick">';
    let accIdx = 0;

    ['COT 1', 'COT 2'].forEach(caKey => {
      const quanGroups = grouped[caKey];
      if (Object.keys(quanGroups).length === 0) return;

      const caBg = caKey === 'COT 1' ? 'bg-primary text-white' : 'bg-warning text-dark';
      htmlList += `<div class="fw-bold ${caBg} px-2 py-1 mb-2 rounded shadow-sm" style="font-size:13px;">${caKey}</div>`;

      Object.keys(quanGroups).forEach(quan => {
        const rds = quanGroups[quan];
        htmlList += `
          <div class="accordion-item border-0 shadow-sm mb-2 rounded overflow-hidden">
            <h2 class="accordion-header">
              <button class="accordion-button collapsed py-2 bg-light fw-bold text-dark" type="button" data-bs-toggle="collapse" data-bs-target="#collapsePick_${accIdx}" style="font-size: 12px;">
                <i class="bi bi-geo-alt-fill text-danger me-1"></i>${quan}
                <span class="badge bg-danger ms-auto rounded-pill">${rds.length} Rider</span>
              </button>
            </h2>
            <div id="collapsePick_${accIdx}" class="accordion-collapse collapse" data-bs-parent="#accChuaPick">
              <div class="accordion-body p-0">
                <table class="table table-hover table-sm align-middle mb-0" style="font-size:11.5px;">
                  <tbody>`;
        rds.forEach(rd => {
          const bkBadge = (rd.quanDeli || '').toUpperCase().includes('BK') || rd.isBackup ? '<span class="badge bg-success ms-1" style="font-size:9px;">BK</span>' : '';
          htmlList += `
            <tr>
              <td class="fw-bold text-primary font-monospace ps-2" style="width:65px;">${rd.id}</td>
              <td class="fw-bold text-dark">${rd.name} ${bkBadge}</td>
              <td class="text-end text-muted pe-2 fst-italic">P.${rd.phuongDeli || rd.phuongPick || '-'}</td>
            </tr>`;
        });
        htmlList += `</tbody></table></div></div></div>`;
        accIdx++;
      });
    });
    htmlList += '</div>';
    vungDanhSach.innerHTML = htmlList;
  }
};

window.moModalPhanPhuongPick = function() {
  bootstrap.Modal.getOrCreateInstance(document.getElementById('modalPhanPhuongPick')).show();
  window.loadThongKeChuaCoPick();

  const thead = document.getElementById('theadPickData');
  const tbody = document.getElementById('tbodyPickData');
  if (!thead || !tbody) return;

  thead.innerHTML = `
    <tr>
      <th style="width: 70px;">COT</th>
      <th style="width: 90px;">ID</th>
      <th class="text-start">TÊN RIDER (BK)</th>
      <th style="width: 130px;">QUẬN ĐI LÀM (H.NAY)</th>
      <th style="width: 90px;">PHƯỜNG</th>
      <th class="text-start">NOTE (TUYẾN LẤY)</th>
    </tr>
  `;

  if (typeof ridersData === 'undefined' || ridersData.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-danger">Đang chờ tải dữ liệu hệ thống... Vui lòng thử lại.</td></tr>`;
    return;
  }

  const now = new Date();
  const todayStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}`;

  const listBKTuyen = ridersData.filter(rd => {
    const isBK = (rd.quanDeli || '').toUpperCase().includes('BK');
    if (!isBK) return false;

    let sched = '';
    if (typeof dateHeadersGlobal !== 'undefined') {
      const dh = dateHeadersGlobal.find(d => d.date.includes(todayStr));
      if (dh && rd.dailySchedule && rd.dailySchedule[dh.date]) {
        sched = rd.dailySchedule[dh.date].toUpperCase();
      }
    } else if (rd.dailySchedule && rd.dailySchedule[todayStr]) {
      sched = rd.dailySchedule[todayStr].toUpperCase();
    }

    if (sched.includes('QUẬN 2') || sched.includes('Q2')) rd.tempQuanGan = 'QUẬN 2';
    else if (sched.includes('QUẬN 4') || sched.includes('Q4')) rd.tempQuanGan = 'QUẬN 4';
    else if (sched.includes('QUẬN 7') || sched.includes('Q7')) rd.tempQuanGan = 'QUẬN 7';
    else if (sched.includes('QUẬN 9') || sched.includes('Q9')) rd.tempQuanGan = 'QUẬN 9';
    else if (sched.includes('BÌNH THẠNH') || sched.includes('BT')) rd.tempQuanGan = 'BÌNH THẠNH';
    else return false;

    return true;
  });

  if (listBKTuyen.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted">Hôm nay (${todayStr}) không có Rider BK ngoài nào được gán Quận.</td></tr>`;
    return;
  }

  listBKTuyen.sort((a, b) => {
    if (a.ca !== b.ca) return a.ca.localeCompare(b.ca);
    return (a.tempQuanGan || '').localeCompare(b.tempQuanGan || '');
  });

  let tbHtml = '';
  listBKTuyen.forEach(rd => {
    const quanStr = rd.tempQuanGan || '—';
    const phuongStr = rd.phuongPick && rd.phuongPick !== '-' ? `P.${rd.phuongPick}` : '—';
    const noteStr = rd.tuyenPick && rd.tuyenPick !== '-' ? rd.tuyenPick : '—';
    const caBadge = rd.ca.includes('1') ? 'badge-cot1' : (rd.ca.includes('2') ? 'badge-cot2' : 'bg-secondary');

    tbHtml += `
      <tr>
        <td class="text-center"><span class="badge ${caBadge}">${rd.ca || '—'}</span></td>
        <td class="fw-bold text-primary font-monospace">${rd.id}</td>
        <td class="fw-bold text-dark text-start">${rd.name} <span class="badge bg-success ms-1" style="font-size:9px;">BK</span></td>
        <td class="fw-bold text-danger">${quanStr}</td>
        <td class="text-muted fw-semibold text-center">${phuongStr}</td>
        <td class="text-start small text-secondary">${noteStr}</td>
      </tr>
    `;
  });

  tbody.innerHTML = tbHtml;
};

// Tự động gán hàm loadPerformanceData của file này làm hàm chính sau khi trang nạp xong
const _perfLoaderRef = window.loadPerformanceData;
document.addEventListener('DOMContentLoaded', () => {
  khoiTaoGiaoDienPerformanceDOM();
  window.loadPerformanceData = _perfLoaderRef;
  const originalChuyenTab = window.chuyenTab;
  window.chuyenTab = function(tabId) {
    window.loadPerformanceData = _perfLoaderRef;
    if (typeof originalChuyenTab === 'function') originalChuyenTab(tabId);
    if (tabId === 'performance') {
      setTimeout(window.loadThongKeChuaCoPick, 400);
    }
  };
});