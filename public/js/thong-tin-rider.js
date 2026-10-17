// ================= MODULE THÔNG TIN CHUNG CHO RIDER (ĐỘC LẬP) =================

if (typeof API_BASE === 'undefined') {
  window.API_BASE = '/api';
}

let cachedThongTinChung = null;
let currentSubTabThongTin = 'hubToHub';

// Hàm nạp dữ liệu từ Backend
async function loadThongTinChungData() {
  const container = document.getElementById('vungDuLieuThongTin');
  if (container && !cachedThongTinChung) {
    container.innerHTML = '<div class="text-center py-5 text-primary"><div class="spinner-border spinner-border-sm me-2"></div>Đang kết nối dữ liệu Thông Tin Chung...</div>';
  }

  try {
    const res = await fetch(`${API_BASE}/thong-tin-chung-rider`);
    const data = await res.json();
    cachedThongTinChung = data;
    chuyenSubTabThongTin(currentSubTabThongTin);
  } catch (err) {
    console.error("Lỗi tải thông tin chung:", err);
    if (container) {
      container.innerHTML = `<div class="alert alert-danger m-3">Lỗi tải dữ liệu: ${err.message}. Vui lòng thử lại!</div>`;
    }
  }
}

// Chuyển đổi giữa 3 tiểu mục con
function chuyenSubTabThongTin(subTab) {
  currentSubTabThongTin = subTab;

  // Cập nhật trạng thái nút
  document.querySelectorAll('.sub-tab-tt-btn').forEach(btn => btn.classList.remove('active', 'btn-primary'));
  document.querySelectorAll('.sub-tab-tt-btn').forEach(btn => btn.classList.add('btn-outline-primary'));

  const btnActive = document.getElementById(`btn-sub-${subTab}`);
  if (btnActive) {
    btnActive.classList.remove('btn-outline-primary');
    btnActive.classList.add('active', 'btn-primary');
  }

  if (!cachedThongTinChung) {
    loadThongTinChungData();
    return;
  }

  if (subTab === 'hubToHub') renderHubToHub(cachedThongTinChung.hubToHub || []);
  else if (subTab === 'groupZalo') renderGroupZalo(cachedThongTinChung.groupZalo || []);
  else if (subTab === 'quyDinh') renderQuyDinh(cachedThongTinChung.quyDinh || []);
}

// 1. RENDER TIỂU MỤC HUB TO HUB
function renderHubToHub(list) {
  const container = document.getElementById('vungDuLieuThongTin');
  if (!container) return;

  container.innerHTML = `
    <div class="card border-0 shadow-sm p-3 mb-2 rounded-3 bg-white">
      <div class="d-flex flex-wrap justify-content-between align-items-center gap-2">
        <div class="d-flex align-items-center gap-2">
          <h6 class="fw-bold text-primary mb-0"><i class="bi bi-diagram-3-fill me-1"></i>DANH SÁCH ZONE VÀ HUB TRẢ HÀNG</h6>
          <span class="badge bg-primary-subtle text-primary border" id="hubCountBadge">${list.length} Zone ID</span>
        </div>
        <div class="input-group input-group-sm" style="max-width: 320px;">
          <span class="input-group-text bg-light"><i class="bi bi-search"></i></span>
          <input type="text" id="searchHubInput" class="form-control" placeholder="Tìm theo Zone, Phường, Trạm, Địa chỉ..." oninput="filterHubToHub()">
        </div>
      </div>
    </div>

    <div class="card border-0 shadow-sm rounded-3 overflow-hidden bg-white">
      <div class="table-responsive" style="max-height: calc(100vh - 250px); overflow-y: auto;">
        <table class="table table-hover table-bordered table-sm align-middle mb-0" style="font-size: 12.5px;">
          <thead class="table-primary sticky-top text-center" style="z-index: 5;">
            <tr>
              <th style="width: 45px;">STT</th>
              <th style="width: 120px;">Zone ID</th>
              <th style="width: 100px;">Quận Cũ</th>
              <th style="width: 140px;">Phường Mới</th>
              <th style="width: 130px;">Phường Cũ</th>
              <th style="min-width: 180px;">Hub Trả Hàng</th>
              <th style="width: 95px;">Mã Trạm</th>
              <th style="min-width: 250px;" class="text-start">Địa Chỉ Trạm</th>
            </tr>
          </thead>
          <tbody id="tbodyHubToHub"></tbody>
        </table>
      </div>
    </div>
  `;

  filterHubToHub();
}

function filterHubToHub() {
  if (!cachedThongTinChung) return;
  const kw = (document.getElementById('searchHubInput')?.value || '').trim().toLowerCase();
  const list = cachedThongTinChung.hubToHub || [];
  const tbody = document.getElementById('tbodyHubToHub');
  if (!tbody) return;

  const filtered = list.filter(h => {
    if (!kw) return true;
    return h.zoneId.toLowerCase().includes(kw) ||
           h.phuongMoi.toLowerCase().includes(kw) ||
           h.phuongCu.toLowerCase().includes(kw) ||
           h.hubTraHang.toLowerCase().includes(kw) ||
           h.maTram.toLowerCase().includes(kw) ||
           h.diaChiTram.toLowerCase().includes(kw);
  });

  const badge = document.getElementById('hubCountBadge');
  if (badge) badge.innerText = `${filtered.length} / ${list.length} Zone ID`;

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="text-center py-4 text-muted">Không tìm thấy trạm/zone nào phù hợp!</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map((h, idx) => `
    <tr>
      <td class="text-center text-muted small">${idx + 1}</td>
      <td class="text-center fw-bold font-monospace text-primary">${h.zoneId}</td>
      <td class="text-center">${h.quanCu}</td>
      <td class="fw-semibold text-dark">${h.phuongMoi}</td>
      <td class="text-secondary">${h.phuongCu}</td>
      <td class="fw-bold text-success">${h.hubTraHang}</td>
      <td class="text-center font-monospace">${h.maTram || '—'}</td>
      <td class="text-start small">${h.diaChiTram || '—'}</td>
    </tr>
  `).join('');
}

// 2. RENDER TIỂU MỤC GROUP ZALO (CÓ NÚT PHÓNG TO TOÀN MÀN HÌNH Ở GÓC MÃ QR)
function renderGroupZalo(list) {
  const container = document.getElementById('vungDuLieuThongTin');
  if (!container) return;

  if (!list || list.length === 0) {
    container.innerHTML = '<div class="alert alert-warning text-center m-3">Chưa có liên kết nhóm Zalo nào.</div>';
    return;
  }

  let cardsHtml = '';
  list.forEach((g, idx) => {
    const linkZalo = g.link || '#';
    const qrSrc = g.qrImage || '';

    cardsHtml += `
      <div class="col-12 col-md-6 col-lg-4 mb-3">
        <div class="card h-100 border-0 shadow-sm rounded-3 p-3 bg-white text-center">
          <div class="d-flex align-items-center justify-content-between mb-2 pb-2 border-bottom">
            <span class="badge bg-primary px-2 py-1">Nhóm #${idx + 1}</span>
            <span class="badge bg-success-subtle text-success border fw-bold"><i class="bi bi-shield-check me-1"></i>Chính Thức</span>
          </div>
          
          <h6 class="fw-bold text-dark mb-1 text-truncate" title="${g.ten}" style="font-size: 0.95rem;">${g.ten}</h6>
          <div class="small text-muted mb-2" style="font-size: 0.72rem;">Quét camera / Zalo hoặc bấm phóng to để quét</div>

          <!-- KHUNG CHỨA MÃ QR CÓ NÚT PHÓNG TO Ở GÓC TRÊN BÊN PHẢI -->
          <div class="d-flex justify-content-center my-2">
            <div class="p-2 border rounded bg-white shadow-sm position-relative" style="display:inline-block; border-color: #cbd5e1 !important;">
              <!-- NÚT PHÓNG TO GÓC PHẢI -->
              <button type="button" 
                      class="btn btn-light btn-sm position-absolute top-0 end-0 m-1 border shadow-sm p-1 rounded-circle" 
                      style="width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; z-index: 2;"
                      title="Phóng to mã QR ra toàn màn hình"
                      onclick="phongToQR('${g.ten.replace(/'/g, "\\'")}', '${qrSrc}', '${linkZalo}')">
                <i class="bi bi-arrows-fullscreen text-primary" style="font-size: 0.75rem;"></i>
              </button>

              ${qrSrc ? `
                <img src="${qrSrc}" 
                     alt="Mã QR ${g.ten}" 
                     style="width: 170px; height: 170px; object-fit: contain; display: block; cursor: pointer;"
                     title="Bấm vào để phóng to"
                     onclick="phongToQR('${g.ten.replace(/'/g, "\\'")}', '${qrSrc}', '${linkZalo}')">
              ` : '<div class="text-muted p-4">Đang tạo mã...</div>'}
            </div>
          </div>

          <!-- NÚT MỞ LINK VÀ COPY -->
          <div class="mt-2 d-flex flex-column gap-1">
            <a href="${linkZalo}" target="_blank" class="btn btn-primary btn-sm fw-bold w-100 py-2 shadow-sm">
              <i class="bi bi-box-arrow-up-right me-1"></i> Tham Gia Nhóm Zalo
            </a>
            <button type="button" class="btn btn-outline-secondary btn-sm py-1 w-100" style="font-size: 0.75rem;" onclick="navigator.clipboard.writeText('${linkZalo}'); alert('Đã sao chép link Zalo: ${g.ten}!');">
              <i class="bi bi-clipboard me-1"></i> Sao chép liên kết
            </button>
          </div>
        </div>
      </div>
    `;
  });

  container.innerHTML = `
    <div class="card border-0 shadow-sm p-3 mb-3 rounded-3 bg-white">
      <h6 class="fw-bold text-primary mb-1"><i class="bi bi-chat-quote-fill me-1"></i>DANH SÁCH GROUP ZALO TRUYỀN THÔNG VẬN HÀNH</h6>
      <div class="text-muted small">Bấm vào biểu tượng phóng to ở góc mã QR để chiếu to ra màn hình cho Rider dễ quét</div>
    </div>
    <div class="row g-2">${cardsHtml}</div>
  `;
}

// HÀM MỞ PHÓNG TO QR RA GIỮA MÀN HÌNH
function phongToQR(tenNhom, qrSrc, linkUrl) {
  if (!qrSrc) return;
  const overlay = document.getElementById('modalZoomQR');
  if (!overlay) return;

  document.getElementById('zoomQrTitle').innerText = tenNhom;
  document.getElementById('zoomQrImg').src = qrSrc;
  document.getElementById('zoomQrLinkBtn').href = linkUrl || '#';

  overlay.style.display = 'flex';
}

function dongZoomQR() {
  const overlay = document.getElementById('modalZoomQR');
  if (overlay) overlay.style.display = 'none';
}

// Bắt phím Esc để tắt nhanh phóng to
window.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') dongZoomQR();
});