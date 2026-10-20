// ================= MODULE LỊCH OFF & BẢNG ĐĂNG KÝ =================
if (typeof API_BASE === 'undefined') {
  window.API_BASE = '/api';
}

// CÁC BIẾN TOÀN CỤC CHO BẢNG ĐIỀN OFF MỚI
let sessionDraftMap = {};
let cachedPayloadNewOff = null;
const backupOptions = ['Quận 2', 'Quận 4', 'Quận 7', 'Quận 9', 'BÌNH THẠNH'];

// HÀM KIỂM TRA NGÀY ĐẶC BIỆT
function kiemTraNgayDacBiet(dateStr, thuStr) {
  const parts = (dateStr || '').split(/[-/]/);
  let dayOfMonth = 0, month = 0;
  if (parts.length >= 2) {
    if (parts[0].length === 4) {
      dayOfMonth = parseInt(parts[2], 10);
      month = parseInt(parts[1], 10);
    } else {
      dayOfMonth = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10);
    }
  }

  const isThu2 = (thuStr && (thuStr.includes('Thứ 2') || thuStr.includes('T2')));
  const isSalaryDay = [1, 15, 25].includes(dayOfMonth);
  const isDoubleDay = (dayOfMonth === month && dayOfMonth > 0);

  if (isDoubleDay) return { loai: 'double', label: '🔥 Siêu Sale (Ngày đôi)', bgClass: 'special-day-double', borderClass: 'border-danger' };
  if (isSalaryDay) return { loai: 'salary', label: '⚡ Mini Sale', bgClass: 'special-day-sal', borderClass: 'border-warning' };
  if (isThu2) return { loai: 'thu2', label: '⚠️ Thứ 2 (Hạn chế)', bgClass: 'special-day-thu2', borderClass: 'border-warning' };

  return null;
}

// HÀM CHUYỂN ĐỔI NGÀY SANG ISO (YYYY-MM-DD)
function parseDateToISO(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('/');
  if (parts.length >= 2) {
     let d = parts[0].padStart(2, '0');
     let m = parts[1].padStart(2, '0');
     let y = parts.length === 3 ? (parts[2].length === 2 ? '20' + parts[2] : parts[2]) : new Date().getFullYear();
     return `${y}-${m}-${d}`;
  }
  return dateStr;
}

// 1. TẠO DROPDOWN CHỌN TUẦN VÀ NGÀY TỔNG QUAN (AUTO SET TODAY)
function taoDropdownTuanOff(dateHeaders) {
  const selectMain = document.getElementById('selectTuanOff');
  const selectNgay = document.getElementById('selectNgayTongQuanOff');
  
  if (!selectMain) return;
  selectMain.innerHTML = '';
  if (selectNgay) selectNgay.innerHTML = '';

  if (!dateHeaders || dateHeaders.length === 0) return;

  let startIdx = dateHeaders.findIndex(d => (d.thu || '').includes('Thứ 2') || (d.thu || '').includes('T2'));
  if (startIdx === -1) startIdx = 0;

  // Lấy ngày hôm nay định dạng DD/MM
  let today = new Date();
  let todayStr = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}`;
  let selectedWeekIdx = startIdx;
  let todayFullDateStr = '';

  let weekCount = 1;
  let optionsTuanHtml = '';
  for (let i = startIdx; i < dateHeaders.length; i += 7) {
    const start = dateHeaders[i];
    const end = dateHeaders[Math.min(i + 6, dateHeaders.length - 1)];
    
    // Kiểm tra tuần này có chứa ngày hôm nay không
    const weekSlice = dateHeaders.slice(i, i + 7);
    const todayObj = weekSlice.find(d => d.date.includes(todayStr));
    if (todayObj) {
       selectedWeekIdx = i;
       todayFullDateStr = todayObj.date; // Lưu lại để set dropdown Ngày
    }

    optionsTuanHtml += `<option value="${i}">Tuần ${weekCount}: ${start.date} (${start.thu || 'T2'}) ➔ ${end.date} (${end.thu || 'CN'})</option>`;
    weekCount++;
  }
  selectMain.innerHTML = optionsTuanHtml;
  selectMain.value = selectedWeekIdx; // Set tuần chứa ngày hôm nay

  if (selectNgay) {
    let optionsNgayHtml = '';
    dateHeaders.forEach((dh) => {
      const dacBiet = kiemTraNgayDacBiet(dh.date, dh.thu);
      const icon = dacBiet ? (dacBiet.loai === 'double' ? '🔥 ' : (dacBiet.loai === 'salary' ? '⚡ ' : '⚠️ ')) : '';
      optionsNgayHtml += `<option value="${dh.date}" data-thu="${dh.thu || ''}">${icon}${dh.thu || ''} (${dh.date})</option>`;
    });
    selectNgay.innerHTML = optionsNgayHtml;
    // Set ngày hôm nay nếu có, không có thì lấy ngày đầu tiên
    selectNgay.value = todayFullDateStr || dateHeaders[0].date;
  }
}

function dongBoTuanOff(source) {
  if (source === 'main') {
    renderMaTranOff();
  }
}

let matrixCollapsed = false;
function toggleMatrixColumns() {
  matrixCollapsed = !matrixCollapsed;
  renderMaTranOff();
}

// ================= HÀM XEM TỔNG HỢP ĐIỀU PHỐI (CHIA 2 CỘT OFF VÀ BK) =================
function xemTongHopCa(ngay, caFilter, title) {
      if (!ngay || !ridersData) return;

      let listOff = ridersData.filter(rd => {
        const isBK = (rd.quanDeli || '').toUpperCase().includes('BK');
        if (isBK) return false; 
        const c = (rd.ca || '').toLowerCase();
        const sched = (rd.dailySchedule && rd.dailySchedule[ngay]) ? rd.dailySchedule[ngay].toLowerCase().trim() : '';
        const matchCa = caFilter === '' || c.includes(caFilter.toLowerCase());
        return matchCa && sched.includes('off');
      });

      let listBk = ridersData.filter(rd => {
        const isBK = (rd.quanDeli || '').toUpperCase().includes('BK');
        const c = (rd.ca || '').toLowerCase();
        const sched = (rd.dailySchedule && rd.dailySchedule[ngay]) ? rd.dailySchedule[ngay].toLowerCase().trim() : '';
        const matchCa = caFilter === '' || c.includes(caFilter.toLowerCase());
        return isBK && matchCa && !sched.includes('off');
      });

      // Tự động đếm chi tiết số người OFF theo Quận
      let countQ2 = 0, countQ4 = 0, countQ7 = 0, countQ9 = 0, countBT = 0;
      listOff.forEach(rd => {
         const q = (rd.quanDeli || '').toLowerCase();
         if (q.includes('quận 2')) countQ2++;
         else if (q.includes('quận 4')) countQ4++;
         else if (q.includes('quận 7')) countQ7++;
         else if (q.includes('quận 9')) countQ9++;
         else if (q.includes('bình thạnh')) countBT++;
      });
      
      const titleEl = document.getElementById('titleModalTongHopCa');
      if (titleEl) {
        titleEl.innerHTML = `<i class="bi bi-layout-split me-1"></i>${title} (Q2: [${countQ2}] | Q4: [${countQ4}] | Q7: [${countQ7}] | Q9: [${countQ9}] | BT: [${countBT}])`;
        //Đ: [${countTD}])`;
      }
      
      document.getElementById('countOffCa').innerText = listOff.length;
      document.getElementById('countBkCa').innerText = listBk.length;

      const tbodyOff = document.getElementById('tbodyTongHopOff');
      if (listOff.length === 0) {
        tbodyOff.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-muted">Không có Rider nào OFF</td></tr>`;
      } else {
        let htmlOff = '';
        listOff.forEach((rd, idx) => {
          const deliDisplay = rd.quanDeli ? `${rd.quanDeli} (P.${rd.phuongDeli || '-'})` : '—';
          const ghiChu = (rd.dailySchedule && rd.dailySchedule[ngay]) ? rd.dailySchedule[ngay] : '';
          const caBadge = `<span class="badge ${rd.ca.includes('1')?'bg-primary':'bg-warning text-dark'} ms-2" style="font-size:10px;">${rd.ca}</span>`;
          htmlOff += `
            <tr>
              <td class="text-muted small">${idx + 1}</td>
              <td class="fw-bold font-monospace text-primary">${rd.id}</td>
              <td class="fw-bold text-start text-dark">${rd.name}${caBadge}</td>
              <td class="text-start text-secondary fw-semibold small">${deliDisplay}</td>
              <td class="text-start text-danger small">${ghiChu}</td>
            </tr>`;
        });
        tbodyOff.innerHTML = htmlOff;
      }

      const tbodyBk = document.getElementById('tbodyTongHopBk');
      if (listBk.length === 0) {
        tbodyBk.innerHTML = `<tr><td colspan="3" class="text-center py-4 text-muted">Không có Backup khả dụng</td></tr>`;
      } else {
        let htmlBk = '';
        listBk.forEach((rd, idx) => {
          const caBadge = `<span class="badge ${rd.ca.includes('1')?'bg-primary':'bg-warning text-dark'} ms-2" style="font-size:10px;">${rd.ca}</span>`;
          htmlBk += `
            <tr>
              <td class="text-muted small">${idx + 1}</td>
              <td class="fw-bold font-monospace text-success">${rd.id}</td>
              <td class="fw-bold text-start text-dark">${rd.name}${caBadge} <span class="badge bg-success ms-1">BK</span></td>
            </tr>`;
        });
        tbodyBk.innerHTML = htmlBk;
      }

      bootstrap.Modal.getOrCreateInstance(document.getElementById('modalTongHopCa')).show();
    }

// --- THÊM HÀM XỬ LÝ XIN OFF VÀ DUYỆT OFF XUỐNG DƯỚI CÙNG ---
    function moBangXinOff() {
        let user = window.currentUser;
        if (!user) { const saved = localStorage.getItem('KV2_LOGGED_USER'); if (saved) user = JSON.parse(saved); }
        if (!user || user.role !== 'RIDER') { alert("Chỉ Rider mới có thể sử dụng chức năng này!"); return; }

        const modalEl = document.getElementById('modalRiderXinOff');
        if (!modalEl) return;

        window.editingOffRowIndex = null; // Xóa trạng thái Edit để hệ thống hiểu đây là Tạo mới

        document.getElementById('nghi1Ngay').checked = true;
        if (typeof window.toggleKieuNghi === 'function') window.toggleKieuNghi();
        document.getElementById('txtNgayXinOff').value = '';
        document.getElementById('txtLyDoXinOff').value = '';
        document.getElementById('khungTaiAnhMinhChung').classList.add('d-none');
        document.getElementById('fileAnhMinhChung').value = '';
        
        bootstrap.Modal.getOrCreateInstance(modalEl).show();
    }

    // ẨN / HIỆN NGÀY KẾT THÚC
    window.toggleKieuNghi = function() {
        const isNhieuNgay = document.getElementById('nghiNhieuNgay').checked;
        const colStart = document.getElementById('colNgayBatDau');
        const colEnd = document.getElementById('colNgayKetThuc');
        const lblStart = document.getElementById('lblNgayXinOff');
        const boxTong = document.getElementById('tongSoNgayNghiBox');

        if (isNhieuNgay) {
            if(colStart) colStart.className = 'col-6';
            if(colEnd) colEnd.classList.remove('d-none');
            if(lblStart) lblStart.innerText = 'Từ ngày:';
            if(boxTong) boxTong.classList.remove('d-none');
        } else {
            if(colStart) colStart.className = 'col-12';
            if(colEnd) colEnd.classList.add('d-none');
            if(lblStart) lblStart.innerText = 'Ngày Xin OFF:';
            if(boxTong) boxTong.classList.add('d-none');
            const endInput = document.getElementById('txtNgayKetThuc');
            if(endInput) endInput.value = '';
        }
        kiemTraNgayXinOff();
    }

    function kiemTraNgayXinOff() {
        const startDateVal = document.getElementById('txtNgayXinOff').value;
        const endDateVal = document.getElementById('txtNgayKetThuc').value;
        const isNhieuNgay = document.getElementById('nghiNhieuNgay').checked;
        
        const khungAnh = document.getElementById('khungTaiAnhMinhChung');
        const tongSoNgayEl = document.getElementById('tongSoNgayNghiVal');
        
        if (!startDateVal) {
            khungAnh.classList.add('d-none');
            if(tongSoNgayEl) tongSoNgayEl.innerText = '0';
            return;
        }

        const today = new Date(); today.setHours(0, 0, 0, 0);
        const startDate = new Date(startDateVal); startDate.setHours(0, 0, 0, 0);
        const diffDaysStart = Math.ceil((startDate - today) / (1000 * 60 * 60 * 24));
        
        if (diffDaysStart <= 0) khungAnh.classList.remove('d-none');
        else khungAnh.classList.add('d-none');

        let totalDays = 1;
        if (isNhieuNgay && endDateVal) {
            const endDate = new Date(endDateVal); endDate.setHours(0, 0, 0, 0);
            if (endDate >= startDate) {
                totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
            } else {
                totalDays = 0; 
            }
        }
        if(tongSoNgayEl) tongSoNgayEl.innerText = totalDays;
    }

    async function guiDonXinOff() {
        let user = window.currentUser;
        if (!user) { const saved = localStorage.getItem('KV2_LOGGED_USER'); if (saved) user = JSON.parse(saved); }
        if (!user) return alert("Lỗi: Không tìm thấy thông tin tài khoản!");

        const ngayBatDau = document.getElementById('txtNgayXinOff').value;
        const ngayKetThuc = document.getElementById('txtNgayKetThuc').value;
        const isNhieuNgay = document.getElementById('nghiNhieuNgay').checked;
        let lydo = document.getElementById('txtLyDoXinOff').value;
        const loaiOffRider = document.getElementById('selLoaiNghiOffRider')?.value || 'OFF';
        const tongSoNgayEl = document.getElementById('tongSoNgayNghiVal');
        const totalDays = tongSoNgayEl ? parseInt(tongSoNgayEl.innerText) : 0;

        if (!ngayBatDau || !lydo) { alert("Vui lòng nhập Ngày và Lý do!"); return; }
        
        if (isNhieuNgay) {
            if (!ngayKetThuc) { alert("Vui lòng chọn ngày kết thúc!"); return; }
            if (totalDays <= 0) { alert("Ngày kết thúc phải bằng hoặc sau ngày bắt đầu!"); return; }
        }
        
       const khungAnh = document.getElementById('khungTaiAnhMinhChung');
        let base64Img = '';
        if (!khungAnh.classList.contains('d-none')) {
            const file = document.getElementById('fileAnhMinhChung').files[0];
            // Yêu cầu ảnh nếu xin gấp VÀ là đơn tạo mới
            if (!file && !window.editingOffRowIndex) { alert("Bạn xin OFF gấp, bắt buộc phải chọn tải lên Ảnh minh chứng!"); return; }
            if (file) {
                // TỰ ĐỘNG NÉN ẢNH CHỐNG LỖI 50.000 KÝ TỰ CỦA GOOGLE SHEET
                base64Img = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onload = function(e) {
                        const img = new Image();
                        img.onload = function() {
                            const canvas = document.createElement('canvas');
                            let width = img.width, height = img.height;
                            const MAX_SIZE = 400; // Ép ảnh về kích thước nhỏ để chuỗi cực ngắn
                            if (width > height) {
                                if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; }
                            } else {
                                if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; }
                            }
                            canvas.width = width; canvas.height = height;
                            const ctx = canvas.getContext('2d');
                            ctx.drawImage(img, 0, 0, width, height);
                            // Nén sang định dạng JPEG với chất lượng 40%
                            resolve(canvas.toDataURL('image/jpeg', 0.4)); 
                        };
                        img.src = e.target.result;
                    };
                    reader.readAsDataURL(file);
                });
            }
        }
        
        const btnGui = document.getElementById('btnGuiDonXinOff');
        btnGui.disabled = true;
        btnGui.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Đang gửi...';

        // TỰ ĐỘNG PHÂN LUỒNG: CÓ ID DÒNG THÌ GỌI API UPDATE, KHÔNG CÓ THÌ GỌI API CREATE
        const endpoint = window.editingOffRowIndex ? `${window.API_BASE}/xin-off/update` : `${window.API_BASE}/xin-off/create`;
        const bodyData = {
            riderId: user.id, riderName: user.name,
            ngayBatDau: ngayBatDau, ngayKetThuc: isNhieuNgay ? ngayKetThuc : '',
            tongNgay: isNhieuNgay ? totalDays : 1, lyDo: "[" + loaiOffRider + "] " + lydo, hinhAnhBase64: base64Img
        };
        if (window.editingOffRowIndex) bodyData.rowIndex = window.editingOffRowIndex;

        try {
            const res = await fetch(endpoint, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bodyData)
            });
            const data = await res.json();
            if (data.success) {
                alert("✅ " + data.message);
                bootstrap.Modal.getInstance(document.getElementById('modalRiderXinOff')).hide();
                window.editingOffRowIndex = null;
                // Cập nhật lại lịch sử Profile nếu có
                if (typeof loadLichSuCuaRider === 'function') {
                    loadLichSuCuaRider(user.id);
                }
            } else alert("❌ Lỗi: " + data.message);
        } catch (e) { alert("Lỗi mạng! Không thể kết nối tới máy chủ."); }
        
        btnGui.disabled = false;
        btnGui.innerHTML = '<i class="bi bi-send-fill me-1"></i> Gửi Đơn';
    }

    async function moBangDuyetOff() {
        const modalEl = document.getElementById('modalDuyetOff');
        if (!modalEl) return;
        bootstrap.Modal.getOrCreateInstance(modalEl).show();
        
        const tbody = document.getElementById('tbodyDanhSachXinOff');
        if (!tbody) return;
        tbody.innerHTML = '<tr><td colspan="9" class="text-center py-4 text-muted"><div class="spinner-border spinner-border-sm text-warning me-1"></div> Đang tải danh sách...</td></tr>';
        
        try {
            const res = await fetch(`${API_BASE}/xin-off/list`);
            const data = await res.json();
            if (data.success && data.data.length > 0) {
                let html = '';
                let pendingCount = data.data.length; // Vì server đã lọc sẵn, tất cả đều là chờ duyệt
                
                data.data.forEach(item => {
                    const anhHtml = item.hinhAnh ? `<button type="button" class="btn btn-xs btn-primary py-0 px-2 fw-bold" onclick="window.xemAnhMinhChung('${item.hinhAnh}')">Xem Ảnh</button>` : '<span class="text-muted small">Không</span>';
                    const hopLeBadge = item.hopLe.includes('Hợp lệ') ? 'bg-success' : (item.hopLe.includes('Gấp') ? 'bg-danger' : 'bg-warning text-dark');
                    
                    // Giao diện: Luôn luôn hiện nút Bấm Xanh / Đỏ
                    let statusHtml = `
                      <div class="btn-group w-100 shadow-sm">
                        <button class="btn btn-sm btn-success py-0 px-2 fw-bold" onclick="chotDuyetOff(${item.rowIndex}, 'Đã duyệt')" title="Duyệt đơn"><i class="bi bi-check-lg"></i></button>
                        <button class="btn btn-sm btn-danger py-0 px-2 fw-bold" onclick="chotDuyetOff(${item.rowIndex}, 'Từ chối')" title="Từ chối đơn"><i class="bi bi-x-lg"></i></button>
                      </div>
                    `;
                    
                    html += `<tr><td class="small text-muted">${item.timestamp}</td><td class="fw-bold font-monospace">${item.riderId}</td><td class="text-start fw-bold text-dark">${item.riderName}</td><td class="fw-bold text-danger">${item.ngayNghi}</td><td class="fw-bold text-primary">${item.tongNgay}</td><td class="text-start small">${item.lyDo}</td><td><span class="badge ${hopLeBadge}">${item.hopLe}</span></td><td>${statusHtml}</td><td>${anhHtml}</td></tr>`;
                });
                tbody.innerHTML = html;
                
                // Cập nhật thẻ đếm số lượng đỏ ở ngoài nút
                const badge = document.getElementById('badgePendingOff');
                if (badge) {
                    badge.innerText = pendingCount;
                    badge.style.display = pendingCount > 0 ? 'inline-block' : 'none';
                }
            } else {
                tbody.innerHTML = '<tr><td colspan="9" class="text-center py-4 text-muted">Tuyệt vời! Không còn đơn nào chờ duyệt.</td></tr>';
                const badge = document.getElementById('badgePendingOff');
                if (badge) badge.style.display = 'none';
            }
        } catch (e) { tbody.innerHTML = '<tr><td colspan="9" class="text-danger py-4">Lỗi kết nối máy chủ!</td></tr>'; }
    }

    // HÀM PUSH TRẠNG THÁI LÊN SHEET & TỰ ĐỘNG ĐIỀN VÀO TỔNG QUAN + OPS 1-2 + GHI LOG
    async function chotDuyetOff(rowIndex, trangThaiMoi) {
        const msgConfirm = trangThaiMoi === 'Đã duyệt' 
            ? `Xác nhận [DUYỆT] đơn này?\n(Hệ thống sẽ tự động điền vào TỔNG QUAN RD, Lịch Ops 1-2 và lưu Log)`
            : `Bạn chắc chắn muốn [${trangThaiMoi.toUpperCase()}] đơn này?`;
        if (!confirm(msgConfirm)) return;
        try {
            const nguoiDuyet = typeof layTenNguoiThaoTac === 'function' ? layTenNguoiThaoTac() : 'FTE / Admin';
            const res = await fetch(`${API_BASE}/xin-off/update-status`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rowIndex: rowIndex, newStatus: trangThaiMoi, nguoiDuyet: nguoiDuyet })
            });
            const data = await res.json();
            if (data.success) {
                if (data.message) alert("✅ " + data.message);
                moBangDuyetOff(); 
                if (typeof loadRiderData === 'function') loadRiderData();
            } else alert("Lỗi: " + data.message);
        } catch(e) { alert("Lỗi kết nối mạng!"); }
    }

function xemDanhSachOffTuan(quanFilter, caFilter, title) {
  const selWeek = document.getElementById("selectTuanOff");
  const startIdx = parseInt(selWeek ? selWeek.value : 0, 10);
  const weekDates = dateHeadersGlobal.slice(startIdx, startIdx + 7);
  const _today = new Date();
  const todayStr = String(_today.getDate()).padStart(2,'0') + '/' + String(_today.getMonth()+1).padStart(2,'0');
  
  let filteredList = [];
  
  ridersData.forEach(rd => {
    const isBK = (rd.quanDeli || '').toUpperCase().includes('BK');
    if (isBK) return; // Không lấy BK vào danh sách OFF thường
    
    const q = (rd.quanDeli || '').toLowerCase();
    const c = (rd.ca || '').toLowerCase();
    
    const matchQuan = q.includes(quanFilter.toLowerCase());
    const matchCa = caFilter === '' || c.includes(caFilter.toLowerCase());
    
    if (matchQuan && matchCa) {
       let offDays = [];
       weekDates.forEach(dh => {
         const sched = (rd.dailySchedule && rd.dailySchedule[dh.date]) ? rd.dailySchedule[dh.date].toLowerCase().trim() : '';
         if (sched.includes('off')) offDays.push(dh.date);
       });
       
       if (offDays.length > 0) {
          filteredList.push({ ...rd, offDaysStr: offDays.join(', ') });
       }
    }
  });

  const theadTitle = document.getElementById('titleModalChiTietOff');
  const tbody = document.getElementById('tbodyChiTietOff');
  
  if (theadTitle) {
    theadTitle.innerHTML = `<i class="bi bi-calendar-week-fill me-1"></i>TỔNG KẾT OFF TUẦN - ${title}`;
  }

  if (filteredList.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted">Không có Rider nào OFF trong tuần này</td></tr>`;
  } else {
    let html = '';
    filteredList.forEach((rd, idx) => {
      const caBadge = rd.ca.includes('1') ? 'badge-cot1' : 'badge-cot2';
      const deliDisplay = rd.quanDeli ? `${rd.quanDeli} (P.${rd.phuongDeli || '-'})` : '—';
      
      html += `
        <tr>
          <td class="text-muted small">${idx + 1}</td>
          <td class="fw-bold font-monospace">${rd.id}</td>
          <td class="fw-bold text-start text-dark">${rd.name}</td>
          <td><span class="badge ${caBadge}">${rd.ca}</span></td>
          <td class="text-start text-primary fw-semibold small">${deliDisplay}</td>
          <td class="text-start text-danger small fw-bold">Nghỉ: ${rd.offDaysStr}</td>
        </tr>
      `;
    });
    tbody.innerHTML = html;
  }

  bootstrap.Modal.getOrCreateInstance(document.getElementById('modalChiTietRiderOff')).show();
}

// 2. VẼ MA TRẬN OFF (CÓ TÍNH NĂNG THU / MỞ VÀ XEM CHI TIẾT)
function renderMaTranOff() {
  if (!dateHeadersGlobal || dateHeadersGlobal.length === 0) return;
  const startIdx = parseInt(document.getElementById('selectTuanOff')?.value || 0, 10);
  const weekDates = dateHeadersGlobal.slice(startIdx, startIdx + 7);
  const _today = new Date();
  const todayStr = String(_today.getDate()).padStart(2,'0') + '/' + String(_today.getMonth()+1).padStart(2,'0');

  const thead = document.getElementById('theadMaTranOff');
  const tbody = document.getElementById('tbodyMaTranOff');
  if (!thead || !tbody) return;

  // Render Header
  let thHtml = `<tr>
    <th style="min-width: 170px;" class="align-middle">
      Địa Bàn / Ca 
      <button class="btn btn-xs btn-outline-secondary ms-1 py-0 px-1 shadow-sm bg-white" onclick="toggleMatrixColumns()" title="Thu / Mở chi tiết ngày tuần">
        <i class="bi ${matrixCollapsed ? 'bi-arrows-expand' : 'bi-arrows-collapse'}"></i>
      </button>
    </th>`;

  if (matrixCollapsed) {
    thHtml += `<th class="align-middle text-danger">TỔNG OFF TUẦN</th>`;
  } else {
    weekDates.forEach(dh => {
      const dacBiet = kiemTraNgayDacBiet(dh.date, dh.thu);
      let specialClass = dacBiet ? dacBiet.bgClass : '';
      let todayClass = (dh.date === todayStr) ? 'bg-primary bg-opacity-25' : '';
      let specialBadge = dacBiet ? `<br><span style="font-size:0.65rem;">${dacBiet.label}</span>` : '';
      thHtml += `<th class="${specialClass} ${todayClass}"><div>${dh.thu || ''}</div><div class="fw-bold">${dh.date}</div>${specialBadge}</th>`;
    });
  }
  thHtml += `</tr>`;
  thead.innerHTML = thHtml;

  const categoriesOff = [
    { label: 'Quận 2 - COT 1', quan: 'quận 2', ca: 'cot 1' },
    { label: 'Quận 2 - COT 2', quan: 'quận 2', ca: 'cot 2' },
    { label: 'Quận 4 - COT 1', quan: 'quận 4', ca: 'cot 1' },
    { label: 'Quận 4 - COT 2', quan: 'quận 4', ca: 'cot 2' },
    { label: 'Quận 7 - COT 1', quan: 'quận 7', ca: 'cot 1' },
    { label: 'Quận 7 - COT 2', quan: 'quận 7', ca: 'cot 2' },
    { label: 'Quận 9 - COT 1', quan: 'quận 9', ca: 'cot 1' },
    { label: 'Quận 9 - COT 2', quan: 'quận 9', ca: 'cot 2' },
    { label: 'BÌNH THẠNH - COT 1', quan: 'bình thạnh', ca: 'cot 1' },
    { label: 'BÌNH THẠNH - COT 2', quan: 'bình thạnh', ca: 'cot 2' }
  ];

  let tbHtml = '';
  
  // Render Rows Từng COT
  categoriesOff.forEach(cat => {
    tbHtml += `<tr>
      <td class="text-start fw-bold" style="cursor:pointer; transition: 0.2s;" onmouseover="this.style.backgroundColor='#f1f5f9'" onmouseout="this.style.backgroundColor=''" onclick="xemDanhSachOffTuan('${cat.quan}', '${cat.ca}', '${cat.label}')" title="Xem chi tiết tổng OFF tuần">
        ${cat.label} 
      </td>`;
    
    let sumTuan = 0;
    let colsHtml = '';

    weekDates.forEach(dh => {
      const countOff = ridersData.filter(rd => {
        const q = (rd.quanDeli || '').toLowerCase();
        const c = (rd.ca || '').toLowerCase();
        const sched = (rd.dailySchedule && rd.dailySchedule[dh.date]) ? rd.dailySchedule[dh.date].toLowerCase() : '';
        const isBK = (rd.quanDeli || '').toUpperCase().includes('BK');
        return !isBK && q.includes(cat.quan) && c.includes(cat.ca) && sched.includes('off');
      }).length;
      
      sumTuan += countOff;
      const isTodayCol = (dh.date === todayStr);
      const todayCellStyle = isTodayCol ? 'background-color:#cfe2ff;' : '';
      if (countOff > 0) {
         colsHtml += `<td style="cursor:pointer; transition: 0.2s; ${todayCellStyle}" onmouseover="this.style.backgroundColor='#ffe4e6'" onmouseout="this.style.backgroundColor='${isTodayCol ? '#cfe2ff' : ''}'" onclick="xemDanhSachOff('${dh.date}', '${cat.quan}', '${cat.ca}', '${cat.label}')"><span class="badge bg-danger shadow-sm">${countOff}</span></td>`;
      } else {
         colsHtml += `<td style="${todayCellStyle}"><span class="text-muted">0</span></td>`;
      }
    });

    if (matrixCollapsed) {
       tbHtml += `<td><span class="badge bg-danger fs-6">${sumTuan}</span></td>`;
    } else {
       tbHtml += colsHtml;
    }
    tbHtml += `</tr>`;
  });

  // Render Row TỔNG KV2
  tbHtml += `<tr class="table-light fw-bold"><td class="text-start text-danger">TỔNG KHU VỰC 2 OFF</td>`;
  
  if (matrixCollapsed) {
    let globalSum = 0;
    weekDates.forEach(dh => {
      globalSum += ridersData.filter(rd => {
        const isBK = (rd.quanDeli || '').toUpperCase().includes('BK');
        const sched = (rd.dailySchedule && rd.dailySchedule[dh.date]) ? rd.dailySchedule[dh.date].toLowerCase() : '';
        return !isBK && sched.includes('off');
      }).length;
    });
    // Hàng thu gọn chưa cần click
    tbHtml += `<td class="text-danger fw-bold fs-6 font-monospace">${globalSum}</td>`;
  } else {
    weekDates.forEach(dh => {
      const totalOffDay = ridersData.filter(rd => {
        const isBK = (rd.quanDeli || '').toUpperCase().includes('BK');
        const sched = (rd.dailySchedule && rd.dailySchedule[dh.date]) ? rd.dailySchedule[dh.date].toLowerCase() : '';
        return !isBK && sched.includes('off');
      }).length;
      
      // Thêm sự kiện onclick và đổi màu rê chuột cho Hàng TỔNG KV 2 OFF
      const isTodayTotal = (dh.date === todayStr);
    const todayTotalStyle = isTodayTotal ? 'background-color:#cfe2ff;' : '';
    if (totalOffDay > 0) {
         tbHtml += `<td class="text-danger fw-bold fs-6 font-monospace" style="cursor:pointer; transition: 0.2s; ${todayTotalStyle}" onmouseover="this.style.backgroundColor='#ffe4e6'" onmouseout="this.style.backgroundColor='${isTodayTotal ? '#cfe2ff' : ''}'" onclick="xemDanhSachOff('${dh.date}', '', '', 'TỔNG KHU VỰC 2')">${totalOffDay}</td>`;
      } else {
         tbHtml += `<td class="text-danger fw-bold fs-6 font-monospace" style="${todayTotalStyle}">0</td>`;
      }
    });
  }
  tbHtml += `</tr>`;

  tbody.innerHTML = tbHtml;

  const selectNgay = document.getElementById('selectNgayTongQuanOff');
  if (selectNgay && selectNgay.options.length > 0 && weekDates[0]) {
    const opt = selectNgay.options[selectNgay.selectedIndex];
    const thu = opt ? opt.getAttribute('data-thu') : '';
    capNhatTongQuanOffTheoQuan(selectNgay.value, thu);
  }
}

// 3. XỬ LÝ CHỌN NGÀY TỔNG QUAN QUẬN
function thayDoiNgayTongQuanOff() {
  const selectNgay = document.getElementById('selectNgayTongQuanOff');
  if (!selectNgay) return;
  const ngayChon = selectNgay.value;
  const optSelected = selectNgay.options[selectNgay.selectedIndex];
  const thuChon = optSelected ? optSelected.getAttribute('data-thu') : '';
  capNhatTongQuanOffTheoQuan(ngayChon, thuChon);
}

function capNhatTongQuanOffTheoQuan(ngayXem, thuXem) {
  // Fix lỗi undefined 'getAttribute' khi tải trang
  if (!ridersData) return;
  if (!ngayXem) {
    const selectEl = document.getElementById('selectNgayTongQuanOff');
    if (selectEl && selectEl.options.length > 0) {
      ngayXem = selectEl.value;
      thuXem = selectEl.options[selectEl.selectedIndex].getAttribute('data-thu') || '';
    } else {
      return; 
    }
  }
  
  if (!thuXem && typeof dateHeadersGlobal !== 'undefined') {
    const dayObj = dateHeadersGlobal.find(d => d.date === ngayXem);
    if (dayObj) thuXem = dayObj.thu;
  }
  const cardBox = document.getElementById('cardTongQuanQuanBox');
  const badgeDacBiet = document.getElementById('badgeNgayDacBietTongQuan');
  
  const dacBiet = kiemTraNgayDacBiet(ngayXem, thuXem);
  if (dacBiet) {
    if (badgeDacBiet) {
      badgeDacBiet.style.display = 'inline-block';
      badgeDacBiet.className = `badge ${dacBiet.bgClass} border ${dacBiet.borderClass} fs-6 py-1 px-2`;
      badgeDacBiet.innerText = dacBiet.label;
    }
    if (cardBox) {
      cardBox.style.backgroundColor = dacBiet.loai === 'double' ? '#fff1f2' : (dacBiet.loai === 'salary' ? '#fff7ed' : '#fefce8');
      cardBox.style.border = `2px solid ${dacBiet.loai === 'double' ? '#f43f5e' : (dacBiet.loai === 'salary' ? '#f97316' : '#eab308')}`;
    }
  } else {
    if (badgeDacBiet) badgeDacBiet.style.display = 'none';
    if (cardBox) {
      cardBox.style.backgroundColor = '#ffffff';
      cardBox.style.border = 'none';
    }
  }

  const demOff = (quanKeyword, caKeyword) => {
    return ridersData.filter(rd => {
      const isBK = (rd.quanDeli || '').toUpperCase().includes('BK');
      if (isBK) return false;
      const q = (rd.quanDeli || '').toLowerCase();
      const c = (rd.ca || '').toLowerCase();
      const sched = (rd.dailySchedule && rd.dailySchedule[ngayXem]) ? rd.dailySchedule[ngayXem].toLowerCase() : '';
      return q.includes(quanKeyword) && (!caKeyword || c.includes(caKeyword)) && sched.includes('off');
    }).length;
  };

    const q2_1 = demOff('quận 2', 'cot 1'), q2_2 = demOff('quận 2', 'cot 2');
  const q4_1 = demOff('quận 4', 'cot 1'), q4_2 = demOff('quận 4', 'cot 2');
  const q7_1 = demOff('quận 7', 'cot 1'), q7_2 = demOff('quận 7', 'cot 2');
  const q9_1 = demOff('quận 9', 'cot 1'), q9_2 = demOff('quận 9', 'cot 2');
  const bt_1 = demOff('bình thạnh', 'cot 1'), bt_2 = demOff('bình thạnh', 'cot 2');

  const tongToanKV = q2_1 + q2_2 + q4_1 + q4_2 + q7_1 + q7_2 + q9_1 + q9_2 + bt_1 + bt_2;

  const pn1 = q2_1, pn2 = q2_2;
  const tb1 = q4_1, tb2 = q4_2;
  const td1 = q7_1, td2 = q7_2;

  const cot1 = demOff('', 'cot 1');
  const cot2 = demOff('', 'cot 2');

  const elBadge = document.getElementById('tongOffHomNayBadge');
  if (elBadge) elBadge.innerText = `${tongToanKV} Rider OFF`;
  
  if (document.getElementById('offCountQ2')) document.getElementById('offCountQ2').innerText = (pn1+pn2);
  if (document.getElementById('offCountQ4')) document.getElementById('offCountQ4').innerText = (tb1+tb2);
  if (document.getElementById('offCountQ7')) document.getElementById('offCountQ7').innerText = (td1+td2);
  if (document.getElementById('offCountQ9')) document.getElementById('offCountQ9').innerText = (q9_1+q9_2);
  if (document.getElementById('offCountBT')) document.getElementById('offCountBT').innerText = (bt_1+bt_2);
  
  // Update 3 thẻ mới
  if (document.getElementById('offCountCOT1')) document.getElementById('offCountCOT1').innerText = cot1;
  if (document.getElementById('offCountCOT2')) document.getElementById('offCountCOT2').innerText = cot2;
  if (document.getElementById('offCountKV2')) document.getElementById('offCountKV2').innerText = tongToanKV;

// ================= TỰ ĐỘNG LỌC DỮ LIỆU BACKUP ẨN & CẬP NHẬT SỐ ĐẾM NGOÀI THẺ =================
  if (typeof ridersData !== 'undefined' && ridersData.length > 0) {
    let pickC1 = 0, pickC2 = 0;
    let deliC1 = 0, deliC2 = 0;
    
    // Lưu tạm dữ liệu vào biến toàn cục để khi click mở modal sẽ xài tới
    window.dataBackupPickCot1 = []; window.dataBackupPickCot2 = [];
    window.dataBackupDeliCot1 = []; window.dataBackupDeliCot2 = [];

    ridersData.forEach(rd => {
      const isBK = (rd.quanDeli || '').toUpperCase().includes('BK');
      
      // SỬA LỖI PICK: Nhận diện Pick qua cả Tuyến Pick và Quận Pick
      const isPick = (rd.tuyenPick && rd.tuyenPick.trim() !== '') || 
                     (rd.quanPick && rd.quanPick.trim() !== '') || 
                     (rd.quanDeli || '').toLowerCase().includes('pick') || 
                     (rd.ca || '').toLowerCase().includes('pick');
                     
      const sched = (rd.dailySchedule && rd.dailySchedule[ngayXem]) ? rd.dailySchedule[ngayXem].toLowerCase() : '';
      const isOff = sched.includes('off');
      const isCot2 = rd.ca.includes('2');

      // BACKUP PICK: Người này có làm Pick và đang OFF
      if (isOff && isPick) {
        if (isCot2) { pickC2++; window.dataBackupPickCot2.push(rd); } 
        else { pickC1++; window.dataBackupPickCot1.push(rd); }
      }
      
      // BACKUP DELI: Người này làm Deli và đang OFF 
      // (Bao gồm cả người làm song song Pick & Deli, họ sẽ hiện ở CẢ 2 BẢNG)
      const isDeli = (rd.quanDeli && rd.quanDeli.trim() !== '' && !rd.quanDeli.toLowerCase().includes('pick')) || 
                     (rd.phuongDeli && rd.phuongDeli.trim() !== '') || 
                     (!isPick);
                     
      if (isOff && isDeli && !isBK) {
        if (isCot2) { deliC2++; window.dataBackupDeliCot2.push(rd); } 
        else { deliC1++; window.dataBackupDeliCot1.push(rd); }
      }
    });

    const badgePick = document.getElementById('badgeCountPick');
    const badgeDeli = document.getElementById('badgeCountDeli');
    if (badgePick) badgePick.innerText = pickC1 + pickC2;
    if (badgeDeli) badgeDeli.innerText = deliC1 + deliC2;
  }
} // <--- ĐÓNG HÀM capNhatTongQuanOffTheoQuan CHUẨN


// ================= CÁC BIẾN QUẢN LÝ GIỎ GÁN TUYẾN =================
window.cartGhepTuyen = window.cartGhepTuyen || {}; 
window.pendingLeftRoutes = []; 
window.activeBkId = null; 
window.isIsolationMode = false; 
window.loaiBackupHienTai = 'DELI'; 
window.danhSachTuyenDaGanGlobal = [];

// ================= HÀM LƯU / PHỤC HỒI SESSION GIỎ GÁN NGẦM =================
function luuSessionGioGanNgam() {
    if (!window.loaiBackupHienTai) return;
    const sessionKey = `KV2_DRAFT_BACKUP_${window.loaiBackupHienTai}`;
    if (Object.keys(window.cartGhepTuyen).length > 0 || window.pendingLeftRoutes.length > 0) {
        sessionStorage.setItem(sessionKey, JSON.stringify({
            cart: window.cartGhepTuyen,
            pendingLeft: window.pendingLeftRoutes
        }));
    } else {
        sessionStorage.removeItem(sessionKey);
    }
}

function phucHoiSessionGioGanNgam(loaiBackup) {
    const sessionKey = `KV2_DRAFT_BACKUP_${loaiBackup}`;
    const saved = sessionStorage.getItem(sessionKey);
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            window.cartGhepTuyen = parsed.cart || {};
            window.pendingLeftRoutes = parsed.pendingLeft || [];
        } catch (e) {
            window.cartGhepTuyen = {}; window.pendingLeftRoutes = [];
        }
    } else {
        window.cartGhepTuyen = {}; window.pendingLeftRoutes = [];
    }
}

// ================= CẢNH BÁO KHI TẮT TRANG NẾU CÓ DỮ LIỆU ĐANG XẾP =================
window.addEventListener('beforeunload', function (e) {
    const isCartActive = Object.keys(window.cartGhepTuyen).some(k => window.cartGhepTuyen[k].routes && window.cartGhepTuyen[k].routes.length > 0);
    if (isCartActive || window.pendingLeftRoutes.length > 0) {
        e.preventDefault();
        e.returnValue = 'Bạn có giỏ gán tuyến chưa được lưu lên Sheet! Bạn chắc chắn muốn thoát?';
        return e.returnValue;
    }
});

// Chặn tắt Modal khi bấm ra ngoài hoặc bấm nút X nếu đang xếp dở
document.addEventListener('DOMContentLoaded', () => {
    const modalEl = document.getElementById('modalChiTietBackup');
    if (modalEl) {
        modalEl.addEventListener('hide.bs.modal', function(e) {
            const isCartActive = Object.keys(window.cartGhepTuyen).some(k => window.cartGhepTuyen[k].routes && window.cartGhepTuyen[k].routes.length > 0);
            if (isCartActive || window.pendingLeftRoutes.length > 0) {
                if (!confirm("⚠️ CẢNH BÁO:\nBạn đang có tuyến chưa được xác nhận Lưu lên Sheet!\nNếu đóng bảng này, dữ liệu sẽ được lưu ngầm, bạn có thể mở lại để làm tiếp.\n\nBạn vẫn muốn đóng?")) {
                    e.preventDefault();
                }
            }
        });
    }
});

// ================= HÀM MỞ MODAL XẾP BACKUP (BẢNG TO & GIỎ HÀNG) =================
async function moModalBackup(loaiBackup) {
  const header = document.getElementById('modalHeaderBackup');
  const title = document.getElementById('titleModalBackup');
  const vungGhep = document.getElementById('vungGhepCapBackup');
  const ngayXem = document.getElementById('selectNgayTongQuanOff')?.value || '';
  
  window.loaiBackupHienTai = loaiBackup;
  // Phục hồi dữ liệu nếu vừa F5 hoặc tắt nhầm
  phucHoiSessionGioGanNgam(loaiBackup);
  
  window.activeBkId = null;
  window.isIsolationMode = false;
  window.danhSachBkDaGanGlobal = [];
  window.lichSuGanGlobal = [];
  window.danhSachTuyenDaGanGlobal = [];
  
  const dialog = document.querySelector('#modalChiTietBackup .modal-dialog');
  if (dialog) {
     dialog.classList.remove('modal-xl');
     dialog.style.width = '98vw';
     dialog.style.maxWidth = '1800px';
  }

  vungGhep.classList.remove('d-none');
  vungGhep.classList.add('d-flex');
  vungGhep.innerHTML = `<div class="text-muted small py-1"><span class="spinner-border spinner-border-sm me-2 text-primary"></span>Đang tải dữ liệu giỏ gán ${loaiBackup}...</div>`;

  // Ép Bootstrap Modal không tự động đóng khi click ra ngoài nền đen (phải bấm nút X)
  const myModal = new bootstrap.Modal(document.getElementById('modalChiTietBackup'), { backdrop: 'static', keyboard: false });
  myModal.show();

  let danhSachBkDaGan = [];
  let lichSuGanDaChot = [];
  let tuyenDaGanKhac = [];
  try {
    const res = await fetch(`${API_BASE}/danh-sach-bk-da-gan?ngay=${encodeURIComponent(ngayXem)}&loai=${loaiBackup}&_t=${Date.now()}`);
    const data = await res.json();
    if (data && data.bkDaGan) danhSachBkDaGan = data.bkDaGan;
    if (data && data.lichSuGan) lichSuGanDaChot = data.lichSuGan;
    if (data && data.tuyenDaGan) tuyenDaGanKhac = data.tuyenDaGan;
  } catch (e) {}
  
  window.danhSachBkDaGanGlobal = danhSachBkDaGan;
  window.lichSuGanGlobal = lichSuGanDaChot;
  window.danhSachTuyenDaGanGlobal = tuyenDaGanKhac;

  if (loaiBackup === 'PICK') {
    header.className = "modal-header py-2 bg-warning text-dark";
    title.innerHTML = `<i class="bi bi-box-seam me-1"></i>XẾP BACKUP PICK (GHÉP TUYẾN)`;
    renderNoiDungCaAccordion('vungBangCot1', window.dataBackupPickCot1 || [], loaiBackup, 'COT1');
    renderNoiDungCaAccordion('vungBangCot2', window.dataBackupPickCot2 || [], loaiBackup, 'COT2');
  } else {
    header.className = "modal-header py-2 bg-success text-white";
    title.innerHTML = `<i class="bi bi-motorcycle me-1"></i>XẾP BACKUP DELI (GHÉP TUYẾN)`;
    renderNoiDungCaAccordion('vungBangCot1', window.dataBackupDeliCot1 || [], loaiBackup, 'COT1');
    renderNoiDungCaAccordion('vungBangCot2', window.dataBackupDeliCot2 || [], loaiBackup, 'COT2');
  }

  capNhatGiaoDienGhepCap();

  setTimeout(() => {
      window.capNhatTrangThaiCotTrai('COT1');
      window.capNhatTrangThaiCotTrai('COT2');
      window.capNhatTrangThaiCotPhai('COT1');
      window.capNhatTrangThaiCotPhai('COT2');
  }, 100);
}

window.timNguoiDangGanhTuyen = function(routeId) {
  for (const bkId of Object.keys(window.cartGhepTuyen)) {
    const cart = window.cartGhepTuyen[bkId];
    if (cart && cart.routes) {
      const found = cart.routes.find(r => String(r.id) === String(routeId));
      if (found) return cart;
    }
  }
  return null;
};

// ================= HÀM VẼ GIAO DIỆN BẢNG TRÁI (RD OFF/ĐI LÀM) & BẢNG PHẢI (BK SẴN SÀNG) =================
function renderNoiDungCaAccordion(containerId, listOff, loaiBackup, caFilter) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const ngayXem = document.getElementById('selectNgayTongQuanOff')?.value || '';

  const listDiLamDeli = ridersData.filter(rd => {
    const isBK = (rd.quanDeli || '').toUpperCase().includes('BK');
    const isPick = (rd.tuyenPick && rd.tuyenPick.trim() !== '') || 
                   (rd.quanPick && rd.quanPick.trim() !== '') || 
                   (rd.quanDeli || '').toLowerCase().includes('pick') || 
                   (rd.ca || '').toLowerCase().includes('pick');
    const isCa = rd.ca.includes(caFilter === 'COT1' ? '1' : '2');
    const sched = (rd.dailySchedule && rd.dailySchedule[ngayXem]) ? rd.dailySchedule[ngayXem].toLowerCase() : '';
    return !isBK && !isPick && isCa && !sched.includes('off');
  });

  const predefinedWards = {};

  const listBkDiLam = ridersData.filter(rd => {
    const isBK = (rd.quanDeli || '').toUpperCase().includes('BK');
    const isCa = rd.ca.includes(caFilter === 'COT1' ? '1' : '2');
    const sched = (rd.dailySchedule && rd.dailySchedule[ngayXem]) ? rd.dailySchedule[ngayXem].toLowerCase() : '';
    if (!isCa || sched.includes('off')) return false;
    if (loaiBackup === 'DELI' && !isBK) return false; 
    return true; 
  });

  let htmlOff = `
    <div class="col-12 col-lg-7">
      <div class="card border-0 shadow-sm border-danger h-100">
        <div class="card-header bg-danger-subtle text-danger py-1 fw-bold d-flex flex-wrap justify-content-between align-items-center gap-2" style="font-size:12px;">
          <span class="text-nowrap">🔴 ${loaiBackup === 'DELI' ? 'RIDER CẦN BACKUP' : 'RIDER PICK CẦN BACKUP (CHỌN TRÁI HOẶC PHẢI TRƯỚC ĐỀU ĐƯỢC)'}</span>`;
          
  if (loaiBackup === 'DELI') {
    htmlOff += `
          <div class="btn-group btn-group-sm shadow-sm" role="group">
            <input type="radio" class="btn-check" name="btnradio_${caFilter}" id="btnOff_${caFilter}" checked onchange="toggleLeftList('OFF', '${caFilter}')">
            <label class="btn btn-outline-danger py-0 px-2 fw-bold" for="btnOff_${caFilter}" style="font-size:11px;">RD OFF</label>
            <input type="radio" class="btn-check" name="btnradio_${caFilter}" id="btnWork_${caFilter}" onchange="toggleLeftList('WORK', '${caFilter}')">
            <label class="btn btn-outline-primary py-0 px-2 fw-bold" for="btnWork_${caFilter}" style="font-size:11px;">RD ĐI LÀM</label>
            <input type="radio" class="btn-check" name="btnradio_${caFilter}" id="btnWard_${caFilter}" onchange="toggleLeftList('WARD', '${caFilter}')">
            <label class="btn btn-outline-secondary py-0 px-2 fw-bold" for="btnWard_${caFilter}" style="font-size:11px;">QUẬN/PHƯỜNG</label>
          </div>
          <div class="w-100 mt-1">
             <input type="text" id="searchLeft_${caFilter}" class="form-control form-control-sm border-danger shadow-sm" placeholder="🔍 Tìm tên, ID, tuyến..." oninput="filterLeftList(this.value, '${caFilter}')" style="font-size:11px; height:26px;">
          </div>`;
  } else {
    htmlOff += `
          <div class="w-100 mt-1">
             <input type="text" id="searchLeft_${caFilter}" class="form-control form-control-sm border-danger shadow-sm" placeholder="🔍 Tìm tên, ID, tuyến Pick..." oninput="filterLeftList(this.value, '${caFilter}')" style="font-size:11px; height:26px;">
          </div>`;
  }
  
  htmlOff += `
        </div>
        <div class="table-responsive" style="max-height: 55vh;">
          <table class="table table-hover align-middle mb-0" style="font-size:12px;">
            <tbody id="tbody_${caFilter}_LEFT">`;

  if (listOff.length === 0) {
    htmlOff += `<tr class="tr-left-OFF-${caFilter} search-row"><td class="text-center py-3 text-muted">Không có người OFF</td></tr>`;
  } else {
    listOff.forEach(rd => {
      // 1. Label để hiển thị mượt mà trên giao diện (Vẫn giữ nguyên Quận - Tuyến)
      const labelHienThi = loaiBackup === 'DELI' ? `${rd.quanDeli} (P.${rd.phuongDeli || '-'})` : `${rd.quanPick || 'Chưa phân Quận'} - ${rd.tuyenPick || 'Chưa phân Tuyến'}`;
      const safeName = (rd.name || '').replace(/'/g, "\\'");
      
      // 2. TÁCH RIÊNG DỮ LIỆU ĐẨY LÊN SHEET: Nếu là PICK thì chỉ lấy đúng Tuyến, bỏ Quận
      const routeChuan = loaiBackup === 'DELI' ? labelHienThi : (rd.tuyenPick || 'Chưa phân Tuyến');
      const safeRoute = routeChuan.replace(/'/g, "\\'");
      
      const searchTxt = `${rd.name} ${rd.id} ${labelHienThi}`.toLowerCase();
      const isLocked = window.danhSachTuyenDaGanGlobal.includes(rd.id);
      const lockedClass = isLocked ? 'locked-route d-none' : '';

      htmlOff += `
        <tr id="tr_left_${rd.id}" class="tr-left-OFF-${caFilter} search-row ${lockedClass}" data-search="${searchTxt}" style="cursor:pointer;" onclick="chonRiderGhep('${rd.id}', '${safeName}', '${safeRoute}', 'OFF', '${caFilter}')">
          <td class="px-2 py-2 border-bottom">
            <div class="d-flex justify-content-between align-items-center">
              <div>
                <div class="fw-bold text-danger">${rd.name} <span class="text-muted font-monospace fw-normal ms-1">(${rd.id})</span></div>
                <div class="small text-danger opacity-75 fw-semibold"><i class="bi bi-geo-alt-fill me-1"></i>${labelHienThi}</div>
                <div class="assigned-to-label mt-1"></div>
              </div>
              <i class="bi bi-square text-muted fs-5 check-icon-left"></i>
            </div>
          </td>
        </tr>`;
    });
  }

  if (loaiBackup === 'DELI') {
    listDiLamDeli.forEach(rd => {
      const labelDeli = `${rd.quanDeli} (P.${rd.phuongDeli || '-'})`;
      const safeName = (rd.name || '').replace(/'/g, "\\'");
      const safeRoute = (labelDeli || '').replace(/'/g, "\\'");
      const searchTxt = `${rd.name} ${rd.id} ${labelDeli}`.toLowerCase();
      const isLocked = window.danhSachTuyenDaGanGlobal.includes(rd.id);
      const lockedClass = isLocked ? 'locked-route d-none' : 'd-none';

      htmlOff += `
        <tr id="tr_left_${rd.id}" class="tr-left-WORK-${caFilter} search-row ${lockedClass}" data-search="${searchTxt}" style="cursor:pointer;" onclick="chonRiderGhep('${rd.id}', '${safeName}', '${safeRoute}', 'WORK', '${caFilter}')">
          <td class="px-2 py-2 border-bottom">
            <div class="d-flex justify-content-between align-items-center">
              <div>
                <div class="fw-bold text-primary">${rd.name} <span class="text-muted font-monospace fw-normal ms-1">(${rd.id})</span></div>
                <div class="small text-primary opacity-75 fw-semibold"><i class="bi bi-geo-alt-fill me-1"></i>${labelDeli}</div>
                <div class="assigned-to-label mt-1"></div>
              </div>
              <i class="bi bi-square text-muted fs-5 check-icon-left"></i>
            </div>
          </td>
        </tr>`;
    });

    Object.keys(predefinedWards).forEach(quanName => {
      const wards = predefinedWards[quanName];
      const quanCode = quanName === 'Phú Nhuận' ? 'PN' : (quanName === 'Tân Bình' ? 'TB' : 'TD');
      const targetClass = `collapse-ward-${quanCode}-${caFilter}`;

      htmlOff += `
        <tr class="tr-left-WARD-${caFilter} bg-white border-bottom d-none" data-bs-toggle="collapse" data-bs-target=".${targetClass}" style="cursor:pointer;">
          <td class="px-2 py-2">
            <div class="fw-bold text-dark d-flex justify-content-between align-items-center" style="font-size:12px;">
              <span><i class="bi bi-map-fill text-secondary me-2"></i>QUẬN ${quanName.toUpperCase()} (${wards.length} phường)</span> 
              <i class="bi bi-chevron-expand text-muted"></i>
            </div>
          </td>
        </tr>`;

      wards.forEach((ward, idx) => {
        const wardFormat = quanName === 'Thủ Đức' ? ward : `${ward}`;
        const wardLabel = `${quanName} (P.${wardFormat})`;
        const idWard = `ward_${quanCode}_${caFilter}_${idx}`;
        const searchTxt = wardLabel.toLowerCase();
        
        htmlOff += `
          <tr id="tr_left_${idWard}" class="tr-left-WARD-${caFilter} collapse ${targetClass} search-row d-none" data-search="${searchTxt}" style="cursor:pointer;" onclick="chonRiderGhep('${idWard}', 'TUYẾN TỔNG', '${wardLabel}', 'WARD', '${caFilter}')">
            <td class="px-3 py-2 border-bottom bg-light">
              <div class="d-flex justify-content-between align-items-center">
                <div>
                  <div class="fw-bold text-secondary"><i class="bi bi-pin-map-fill me-1"></i>${wardLabel}</div>
                  <div class="small text-muted opacity-75" style="font-size:10px;">Chỉ gán tuyến</div>
                  <div class="assigned-to-label mt-1"></div>
                </div>
                <i class="bi bi-square text-muted fs-5 check-icon-left"></i>
              </div>
            </td>
          </tr>`;
      });
    });
  }
  htmlOff += `</tbody></table></div></div></div>`;

  // ================= CỘT PHẢI: HIỂN THỊ RÕ 1 NGƯỜI GÁNH BAO NHIÊU TUYẾN =================
  let htmlBk = `
      <div class="col-12 col-lg-5">
        <div class="card border-0 shadow-sm border-success h-100">
          <div class="card-header bg-success-subtle text-success py-1 fw-bold d-flex flex-wrap align-items-center gap-2" style="font-size:12px; min-height: 54px;">
            <span class="text-nowrap">🟢 ${loaiBackup === 'DELI' ? 'BACKUP SẴN SÀNG' : 'TẤT CẢ RIDER (ĐỂ GÁNH PICK)'}</span>
            <span class="badge bg-success ms-auto" id="countBkReady_${caFilter}">Khả dụng: ${listBkDiLam.length}</span>
            <div id="vungExitIsolation_${caFilter}"></div>
            <div class="w-100 mt-1">
               <input type="text" id="searchRight_${caFilter}" class="form-control form-control-sm border-success shadow-sm" placeholder="🔍 Tìm ID, Tên người đi gánh..." oninput="filterRightList(this.value, '${caFilter}')" style="font-size:11px; height:26px;">
            </div>
          </div>
          <div class="table-responsive" style="max-height: 55vh;">
            <table class="table table-hover align-middle mb-0" style="font-size:12px;">
              <tbody id="tbody_${caFilter}_BK">`;
    
  if (listBkDiLam.length === 0) {
    htmlBk += `<tr><td class="text-center py-3 text-muted">Không có người khả dụng!</td></tr>`;
  } else {
    listBkDiLam.forEach(rd => {
      const safeName = (rd.name || '').replace(/'/g, "\\'");
      const roleBadge = rd.isBackup ? '<span class="badge bg-success ms-1">BK</span>' : '';
      const tuyenHienTai = loaiBackup === 'DELI' ? rd.quanDeli : `${rd.quanPick || ''} ${rd.tuyenPick ? '(' + rd.tuyenPick + ')' : ''}`;
      const searchTxt = `${rd.name} ${rd.id} ${tuyenHienTai}`.toLowerCase();

      htmlBk += `
        <tr id="tr_bk_${rd.id}" class="tr-bk-item" data-search="${searchTxt}" style="cursor:pointer;" onclick="chonRiderGhep('${rd.id}', '${safeName}', '', 'BK', '${caFilter}')">
          <td class="px-2 py-2 border-bottom">
            <div class="d-flex justify-content-between align-items-center">
              <div>
                <div class="fw-bold text-success">${rd.name} ${roleBadge} <span class="bk-route-count-badge"></span></div>
                <div class="small text-muted font-monospace">${rd.id} - <span class="text-dark fw-semibold">${tuyenHienTai || ''}</span></div>
                <div class="bk-assigned-routes-detail small mt-1"></div>
              </div>
              <i class="bi bi-circle text-muted fs-5 check-icon-bk"></i>
            </div>
          </td>
        </tr>`;
    });
  }
  htmlBk += `</tbody></table></div></div></div>`;
  container.innerHTML = htmlOff + htmlBk;
}

window.filterRightList = function(val, caFilter) {
  const kw = val.toLowerCase().trim();
  document.querySelectorAll(`#tbody_${caFilter}_BK .tr-bk-item`).forEach(tr => {
      const rdId = tr.id.replace('tr_bk_', '');
      const isDangChon = String(rdId) === String(window.activeBkId);
      if (window.isIsolationMode && !isDangChon) return; 
      
      const txt = tr.getAttribute('data-search') || '';
      if (kw === '' || txt.includes(kw)) {
          tr.classList.remove('d-none');
      } else {
          tr.classList.add('d-none');
      }
  });
};

window.toggleLeftList = function(type, ca) {
  document.querySelectorAll(`.tr-left-OFF-${ca}, .tr-left-WORK-${ca}, .tr-left-WARD-${ca}`).forEach(el => {
    el.classList.add('d-none');
    if (type === 'WARD' && el.classList.contains(`tr-left-WARD-${ca}`) && !el.hasAttribute('data-bs-toggle')) el.classList.remove('show'); 
  });
  const searchInput = document.getElementById(`searchLeft_${ca}`);
  if(searchInput) searchInput.value = ''; 
  document.querySelectorAll(`.tr-left-${type}-${ca}:not(.locked-route):not(.temp-hidden)`).forEach(el => el.classList.remove('d-none'));
};

window.filterLeftList = function(val, ca) {
  const kw = val.toLowerCase().trim();
  let activeType = 'OFF';
  if (window.loaiBackupHienTai !== 'PICK') {
      if (document.getElementById(`btnWork_${ca}`)?.checked) activeType = 'WORK';
      else if (document.getElementById(`btnWard_${ca}`)?.checked) activeType = 'WARD';
  }

  if (kw === '') {
    document.querySelectorAll(`.tr-left-${activeType}-${ca}:not(.locked-route):not(.temp-hidden)`).forEach(tr => {
      tr.classList.remove('d-none');
      if (activeType === 'WARD' && !tr.hasAttribute('data-bs-toggle')) tr.classList.remove('show'); 
    });
    return;
  }
  document.querySelectorAll(`.tr-left-${activeType}-${ca}:not(.locked-route):not(.temp-hidden)`).forEach(tr => {
    if (tr.hasAttribute('data-bs-toggle')) { tr.classList.add('d-none'); return; }
    const txt = tr.getAttribute('data-search') || '';
    if (txt.includes(kw)) { tr.classList.remove('d-none'); if (activeType === 'WARD') tr.classList.add('show'); } 
    else tr.classList.add('d-none');
  });
};

// ================= HÀM CHỌN GHÉP TUYẾN (CẬP NHẬT LOGIC TICK XANH LIỀN TAY) =================
function chonRiderGhep(id, name, route, type, caFilter) {
  if (type === 'BK') {
    // KHI CHỌN NGƯỜI BACKUP BÊN PHẢI
    if (window.isIsolationMode && String(id) !== String(window.activeBkId)) return;

    if (window.pendingLeftRoutes && window.pendingLeftRoutes.length > 0) {
      if (!window.cartGhepTuyen[id]) {
        window.cartGhepTuyen[id] = { bkId: id, bkName: name, routes: [] };
      }
      window.pendingLeftRoutes.forEach(pRoute => {
        const exists = window.cartGhepTuyen[id].routes.some(r => String(r.id) === String(pRoute.id));
        if (!exists) {
          window.cartGhepTuyen[id].routes.push({
            id: pRoute.id, name: pRoute.name, route: pRoute.route, type: pRoute.type
          });
        }
      });
      window.pendingLeftRoutes = []; 
      window.activeBkId = null;     
    } else {
      const hasHistory = window.lichSuGanGlobal && window.lichSuGanGlobal.find(l => String(l.idBk) === String(id));
      if (hasHistory && !window.cartGhepTuyen[id]) {
          window.suaLichSuGhepTuyen(id);
          return;
      }
      if (String(window.activeBkId) === String(id) && !window.isIsolationMode) {
          window.activeBkId = null;
      } else {
          window.activeBkId = id; 
          if (!window.cartGhepTuyen[id]) window.cartGhepTuyen[id] = { bkId: id, bkName: name, routes: [] };
      }
    }
  } else {
    // KHI CLICK VÀO TUYẾN BÊN CỘT TRÁI
    const assignedCart = window.timNguoiDangGanhTuyen(id);

    if (assignedCart) {
      // Đã gán -> Gỡ ra
      const idx = assignedCart.routes.findIndex(r => String(r.id) === String(id));
      if (idx > -1) assignedCart.routes.splice(idx, 1);
      if (assignedCart.routes.length === 0 && String(window.activeBkId) !== String(assignedCart.bkId) && !window.isIsolationMode) {
        delete window.cartGhepTuyen[assignedCart.bkId];
      }
    } else {
      if (window.activeBkId) {
        // ĐANG CHỌN NGƯỜI -> BẤM 1 PHÁT VÀO GIỎ NGAY (TICK XANH)
        if (!window.cartGhepTuyen[window.activeBkId]) {
          window.cartGhepTuyen[window.activeBkId] = { bkId: window.activeBkId, bkName: '', routes: [] };
        }
        const activeCart = window.cartGhepTuyen[window.activeBkId];
        activeCart.routes.push({ id, name, route, type }); 
        
        // Hiệu ứng nháy xanh nhỏ báo thành công
        const btnThucHien = document.getElementById('btnThucHienGhep');
        if (btnThucHien) {
            btnThucHien.classList.add('bg-success', 'border-success', 'text-white');
            setTimeout(() => btnThucHien.classList.remove('bg-success', 'border-success', 'text-white'), 300);
        }
      } else {
        // CHƯA CHỌN NGƯỜI -> Đưa vào hàng chờ
        const pIdx = window.pendingLeftRoutes.findIndex(r => String(r.id) === String(id));
        if (pIdx > -1) window.pendingLeftRoutes.splice(pIdx, 1);
        else window.pendingLeftRoutes.push({ id, name, route, type, caFilter });
      }
    }
  }
  
  // Lưu ngầm trạng thái
  luuSessionGioGanNgam();

  ['COT1', 'COT2'].forEach(ca => {
    window.capNhatTrangThaiCotPhai(ca);
    window.capNhatTrangThaiCotTrai(ca);
  });
  capNhatGiaoDienGhepCap();
}

// CẬP NHẬT CỘT TRÁI: ẨN RD OFF KHI GÁN XONG, GIỮ LẠI RD ĐI LÀM & PHƯỜNG
// CẬP NHẬT CỘT PHẢI: HIỂN THỊ RÕ 1 NGƯỜI ĐANG GÁNH BAO NHIÊU TUYẾN & CHI TIẾT TUYẾN
window.capNhatTrangThaiCotPhai = function(caFilter) {
    let visibleCount = 0; 
    document.querySelectorAll(`#tbody_${caFilter}_BK .tr-bk-item`).forEach(tr => {
        const rdId = tr.id.replace('tr_bk_', '');
        tr.classList.remove('table-success', 'table-warning');
        const icon = tr.querySelector('.check-icon-bk');
        const countBadgeEl = tr.querySelector('.bk-route-count-badge');
        const detailEl = tr.querySelector('.bk-assigned-routes-detail');
        
        const isDangChon = String(rdId) === String(window.activeBkId);
        const cartObj = window.cartGhepTuyen[rdId];
        const routesInCart = (cartObj && cartObj.routes) ? cartObj.routes : [];
        const lsObj = (window.lichSuGanGlobal || []).find(l => String(l.idBk) === String(rdId));
        const routesInHistory = (lsObj && lsObj.routes) ? lsObj.routes : [];
        const totalGanh = routesInCart.length + routesInHistory.length;

        // Cập nhật huy hiệu số tuyến đang gánh ngay cạnh tên Rider
        if (countBadgeEl) {
            if (totalGanh > 0) {
                countBadgeEl.innerHTML = `<span class="badge bg-danger ms-1 shadow-sm">🔥 Gánh ${totalGanh} tuyến</span>`;
            } else if (window.pendingLeftRoutes && window.pendingLeftRoutes.length > 0) {
                countBadgeEl.innerHTML = `<span class="badge bg-warning text-dark ms-1">👈 Bấm để nhận ${window.pendingLeftRoutes.length} tuyến</span>`;
            } else {
                countBadgeEl.innerHTML = '';
            }
        }

        // Hiển thị chi tiết các tuyến người này đang gánh ngay dưới tên
        if (detailEl) {
            let detailHtml = '';
            if (routesInCart.length > 0) {
                const listStr = routesInCart.map(r => r.type === 'WARD' ? r.route : `${r.name} (${r.route})`).join('<br>• ');
                detailHtml += `<div class="text-primary fw-bold" style="font-size:11px;">📌 Đang chọn gánh:<br>• ${listStr}</div>`;
            }
            if (routesInHistory.length > 0) {
                detailHtml += `<div class="text-secondary fst-italic" style="font-size:11px;">🔒 Đã lưu: ${routesInHistory.join(', ')}</div>`;
            }
            detailEl.innerHTML = detailHtml;
        }

        if (window.isIsolationMode) {
            if (isDangChon) tr.classList.remove('d-none');
            else tr.classList.add('d-none');
        } else {
            // Ở chế độ DELI giữ nguyên ẩn nếu đã có trong giỏ, còn ở PICK luôn hiển thị để dễ gán thêm nhiều tuyến
            if (window.loaiBackupHienTai === 'DELI' && !isDangChon && routesInCart.length > 0 && (!window.pendingLeftRoutes || window.pendingLeftRoutes.length === 0)) {
                tr.classList.add('d-none');
            } else {
                tr.classList.remove('d-none');
                visibleCount++; 
            }
        }

        if (isDangChon) {
            tr.classList.add('table-success');
            if (icon) icon.className = 'bi bi-check-circle-fill text-success fs-5 check-icon-bk';
        } else if (routesInCart.length > 0) {
            if (icon) icon.className = 'bi bi-check2-all text-primary fs-5 check-icon-bk';
        } else {
            if (icon) icon.className = 'bi bi-circle text-muted fs-5 check-icon-bk';
        }
    });

    if (!window.isIsolationMode) {
        const countBadge = document.getElementById(`countBkReady_${caFilter}`);
        if (countBadge) countBadge.innerText = `Khả dụng: ${visibleCount}`;
    }
    const kw = document.getElementById(`searchRight_${caFilter}`)?.value || '';
    if (kw !== '') {
        if (typeof window.filterRightList === 'function') window.filterRightList(kw, caFilter);
    }
};

// CẬP NHẬT CỘT TRÁI: ẨN RD OFF KHI GÁN XONG, NHƯNG BẤM SỬA THÌ HIỆN LẠI ĐỂ GỠ TICK
window.capNhatTrangThaiCotTrai = function(caFilter) {
    const tuyenDaCoChu = [];
    Object.values(window.cartGhepTuyen).forEach(cart => {
        cart.routes.forEach(rt => tuyenDaCoChu.push(String(rt.id)));
    });

    let countCanBk = 0;

    // Hiệu ứng nhấp nháy cho CSS
    if (!document.getElementById('cssBlinkingTick')) {
        const style = document.createElement('style');
        style.id = 'cssBlinkingTick';
        style.innerHTML = `
          @keyframes flashGreen { 0% { background-color: #d1e7dd; } 100% { background-color: transparent; } }
          .flash-tick { animation: flashGreen 0.6s ease-out; }
          .icon-pulse { transform: scale(1.3); transition: 0.2s ease; }
        `;
        document.head.appendChild(style);
    }

    document.querySelectorAll(`#tbody_${caFilter}_LEFT tr`).forEach(tr => {
        if (tr.hasAttribute('data-bs-toggle')) return; 

        // Xóa class trạng thái cũ
        tr.classList.remove('table-danger', 'table-primary', 'table-secondary', 'table-warning', 'table-success', 'flash-tick');
        const icon = tr.querySelector('.check-icon-left');
        const assignedLbl = tr.querySelector('.assigned-to-label');
        if (assignedLbl) assignedLbl.innerHTML = '';
        if (icon) {
            icon.className = tr.classList.contains(`tr-left-WARD-${caFilter}`) ? 'bi bi-square text-muted fs-5 check-icon-left' : 'bi bi-circle text-muted fs-5 check-icon-left';
            icon.classList.remove('icon-pulse', 'text-success');
        }

        let rtId = tr.id.replace('tr_left_', '');

        if (tr.id && tr.id.startsWith('tr_left_') && tr.classList.contains(`tr-left-OFF-${caFilter}`)) {
            if (!window.danhSachTuyenDaGanGlobal.includes(rtId) && !tuyenDaCoChu.includes(rtId)) {
                countCanBk++;
            }
        }

        const isPendingLeft = (window.pendingLeftRoutes || []).some(r => String(r.id) === String(rtId));
        const ownerCart = window.timNguoiDangGanhTuyen(rtId);
        const typeRoute = tr.classList.contains(`tr-left-OFF-${caFilter}`) ? 'OFF' : (tr.classList.contains(`tr-left-WORK-${caFilter}`) ? 'WORK' : 'WARD');

        if (isPendingLeft) {
            tr.classList.remove('temp-hidden', 'd-none');
            tr.classList.add('table-warning');
            if (icon) icon.className = 'bi bi-check-square-fill text-warning fs-5 check-icon-left';
            if (assignedLbl) {
                assignedLbl.innerHTML = `<span class="badge bg-warning text-dark"><i class="bi bi-hand-index-thumb me-1"></i>Đang chọn chờ gán</span>`;
            }
        } else if (ownerCart) {
            // TUYẾN NÀY ĐÃ ĐƯỢC CHỐT VÀO GIỎ!
            const isOwnerActive = String(ownerCart.bkId) === String(window.activeBkId);
            
            if (typeRoute === 'OFF') {
                if (isOwnerActive) {
                    // ĐANG SỬA NGƯỜI GÁNH NÀY -> BẮT BUỘC HIỆN ĐỂ CÓ THỂ GỠ TICK
                    tr.classList.remove('temp-hidden', 'd-none');
                    tr.classList.add('table-success');
                    if (icon) icon.className = 'bi bi-check-circle-fill text-success fs-5 check-icon-left';
                    if (assignedLbl) assignedLbl.innerHTML = `<span class="badge bg-success shadow-sm mt-1"><i class="bi bi-person-check-fill me-1"></i>Đang gán cho: ${ownerCart.bkName} (Bấm để gỡ)</span>`;
                } else {
                    // GÁN XONG CHO NGƯỜI KHÁC RỒI THÌ ẨN LUÔN CHO NHẸ BẢNG
                    tr.classList.add('d-none', 'temp-hidden');
                }
            } else {
                // NẾU LÀ RD ĐI LÀM HOẶC PHƯỜNG -> LUÔN HIỆN TICK XANH CHỨ KHÔNG ẨN
                tr.classList.remove('temp-hidden', 'd-none');
                tr.classList.add('table-success', 'flash-tick');
                if (icon) icon.className = 'bi bi-check-circle-fill text-success fs-5 check-icon-left icon-pulse';
                if (assignedLbl) assignedLbl.innerHTML = `<span class="badge bg-success shadow-sm mt-1"><i class="bi bi-person-check-fill me-1"></i>Đã gán 1 ca cho: ${ownerCart.bkName}</span>`;
            }
        } else {
            tr.classList.remove('temp-hidden');
        }
    });

    const container = document.getElementById(`vungBang${caFilter === 'COT1' ? 'Cot1' : 'Cot2'}`);
    if (container) {
        const redBadge = container.closest('.accordion-item')?.querySelector('.accordion-button .badge');
        if (redBadge) {
            redBadge.innerText = `${countCanBk} Cần BK`;
            redBadge.className = countCanBk === 0 ? 'badge bg-secondary ms-auto me-3 px-3 shadow-sm rounded-pill' : 'badge bg-danger ms-auto me-3 px-3 shadow-sm rounded-pill';
        }
    }

    const searchInput = document.getElementById(`searchLeft_${caFilter}`);
    if (searchInput && searchInput.value.trim() !== '') {
        window.filterLeftList(searchInput.value, caFilter);
    } else {
        let activeType = 'OFF';
        if (window.loaiBackupHienTai !== 'PICK') {
            if (document.getElementById(`btnWork_${caFilter}`)?.checked) activeType = 'WORK';
            else if (document.getElementById(`btnWard_${caFilter}`)?.checked) activeType = 'WARD';
        }
        window.toggleLeftList(activeType, caFilter);
    }
};

window.xoaKhoiGioGhep = function(bkId, e) {
    if (e) e.stopPropagation();
    delete window.cartGhepTuyen[bkId];
    if (String(window.activeBkId) === String(bkId)) window.activeBkId = null;
    ['COT1', 'COT2'].forEach(ca => {
        window.capNhatTrangThaiCotPhai(ca);
        window.capNhatTrangThaiCotTrai(ca);
    });
    capNhatGiaoDienGhepCap();
};

window.suaLichSuGhepTuyen = function(bkId) {
    if (!window.lichSuGanGlobal) return;
    const lsIndex = window.lichSuGanGlobal.findIndex(l => String(l.idBk) === String(bkId));
    if (lsIndex === -1) return;
    const lsItem = window.lichSuGanGlobal[lsIndex];
    window.lichSuGanGlobal.splice(lsIndex, 1);
    
    if (lsItem.originalIds) {
        lsItem.originalIds.forEach(idGoc => {
            if (idGoc !== 'TUYẾN TỔNG') {
                window.danhSachTuyenDaGanGlobal = window.danhSachTuyenDaGanGlobal.filter(id => String(id) !== String(idGoc));
                const tr = document.getElementById(`tr_left_${idGoc}`);
                if (tr) tr.classList.remove('locked-route', 'd-none');
            }
        });
    }
    
    const restoredRoutes = lsItem.routes.map((rName, idx) => {
        let rType = 'OFF';
        if (window.loaiBackupHienTai === 'DELI') {
            if (rName.includes('Phú Nhuận') || rName.includes('Tân Bình') || rName.includes('Thủ Đức')) {
                if (rName.includes('P.')) rType = 'WARD'; 
            }
        }
        const idGoc = (lsItem.originalIds && lsItem.originalIds[idx]) ? lsItem.originalIds[idx] : rName;
        const foundRd = (typeof ridersData !== 'undefined') ? ridersData.find(r => String(r.id) === String(idGoc)) : null;
        return { 
            id: idGoc, 
            name: foundRd ? foundRd.name : rName, 
            route: rName, 
            type: rType 
        };
    });

    window.cartGhepTuyen[bkId] = { bkId: lsItem.idBk, bkName: lsItem.tenBk, routes: restoredRoutes };
    window.editCartItem(bkId);
};

window.editCartItem = function(bkId) {
    window.activeBkId = bkId;
    window.isIsolationMode = true; 
    ['COT1', 'COT2'].forEach(ca => {
        const vung = document.getElementById(`vungExitIsolation_${ca}`);
        if (vung) vung.innerHTML = `<button class="btn btn-sm btn-danger py-0 px-2 shadow-sm fw-bold" onclick="window.exitIsolationMode(event)"><i class="bi bi-check2-circle me-1"></i>Hoàn tất sửa</button>`;
    });
    window.capNhatTrangThaiCotPhai('COT1');
    window.capNhatTrangThaiCotPhai('COT2');
    window.capNhatTrangThaiCotTrai('COT1');
    window.capNhatTrangThaiCotTrai('COT2');
    capNhatGiaoDienGhepCap();
};

window.exitIsolationMode = async function(e) {
    if (e) e.stopPropagation();
    
    let nguoiThaoTac = typeof layTenNguoiThaoTac === 'function' ? layTenNguoiThaoTac() : 'FTE / Admin';
    const ngayXem = document.getElementById('selectNgayTongQuanOff')?.value || '';
    const bkIdsToDelete = [];
    const backupMatchesHuy = [];

    Object.keys(window.cartGhepTuyen).forEach(bkId => {
        if (window.cartGhepTuyen[bkId].routes.length === 0) {
            bkIdsToDelete.push(bkId);
            backupMatchesHuy.push({
                ngay: ngayXem, idGoc: 'HỦY GÁN', tenGoc: 'Đã xóa khỏi danh sách',
                tuyenGan: 'HỦY GÁN', idBk: bkId, tenBk: window.cartGhepTuyen[bkId].bkName, nguoiGan: nguoiThaoTac
            });
        }
    });

    if (backupMatchesHuy.length > 0) {
        try {
            await fetch(`${API_BASE}/luu-backup-ghep`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ backupMatches: backupMatchesHuy, loai: window.loaiBackupHienTai })
            });
        } catch(error) {}
    }

    bkIdsToDelete.forEach(id => delete window.cartGhepTuyen[id]);

    window.isIsolationMode = false;
    window.activeBkId = null; 
    
    ['COT1', 'COT2'].forEach(ca => {
        const vung = document.getElementById(`vungExitIsolation_${ca}`);
        if (vung) vung.innerHTML = '';
        
        let activeType = 'OFF';
        if (window.loaiBackupHienTai !== 'PICK') {
            if (document.getElementById(`btnWork_${ca}`)?.checked) activeType = 'WORK';
            else if (document.getElementById(`btnWard_${ca}`)?.checked) activeType = 'WARD';
        }
        window.toggleLeftList(activeType, ca);
    });
    
    window.capNhatTrangThaiCotPhai('COT1');
    window.capNhatTrangThaiCotPhai('COT2');
    window.capNhatTrangThaiCotTrai('COT1'); 
    window.capNhatTrangThaiCotTrai('COT2');
    capNhatGiaoDienGhepCap();
};

function capNhatGiaoDienGhepCap() {
    const vungGhep = document.getElementById('vungGhepCapBackup');
    if (!vungGhep) return;

    let hasMatches = false;
    let cartHtml = `<div class="d-flex flex-wrap gap-2 align-items-center" style="flex:1;">
       <span class="fw-bold text-dark me-1"><i class="bi bi-cart-check-fill text-warning me-1 fs-5"></i>Giỏ Gán (${window.loaiBackupHienTai}):</span>`;

    // Hiển thị các tuyến đang chọn tạm bên trái (nếu chọn trái trước)
    if (window.pendingLeftRoutes && window.pendingLeftRoutes.length > 0) {
        const pNames = window.pendingLeftRoutes.map(r => `${r.name} (${r.route})`).join(', ');
        cartHtml += `
          <div class="badge bg-warning text-dark border border-dark p-2 d-flex align-items-center gap-2 shadow-sm" style="font-size:12px;">
             <span><i class="bi bi-hand-index-thumb-fill me-1"></i>Đang chọn ${window.pendingLeftRoutes.length} tuyến: ${pNames} <i class="bi bi-arrow-right mx-1"></i> <b>Hãy bấm chọn 1 Rider bên phải để gán!</b></span>
          </div>`;
    }
    
    Object.values(window.cartGhepTuyen).forEach(cartItem => {
        if (cartItem.routes.length > 0) {
            hasMatches = true;
            const isActive = (String(cartItem.bkId) === String(window.activeBkId));
            const badgeBg = isActive ? 'bg-primary' : 'bg-success';
            const borderCls = isActive ? 'border border-2 border-dark shadow' : 'shadow-sm';
            
            const routeDetails = cartItem.routes.map(r => r.type === 'WARD' ? r.route : `${r.name} [${r.route}]`).join(' | ');
            const shortRoutes = routeDetails.length > 55 ? routeDetails.substring(0, 55) + '...' : routeDetails;

            cartHtml += `
              <div class="badge ${badgeBg} ${borderCls} p-2 d-flex align-items-center gap-2" style="font-size:12px; cursor:pointer; transition: 0.2s;" onclick="window.editCartItem('${cartItem.bkId}')" title="Người gánh: ${cartItem.bkName}\nSố tuyến: ${cartItem.routes.length}\nChi tiết: ${routeDetails}">
                 <span><b>${cartItem.bkName}</b> <span class="badge bg-warning text-dark mx-1">Gánh ${cartItem.routes.length} tuyến</span> (${shortRoutes})</span>
                 <i class="bi bi-pencil-square ms-1 fs-6 ${isActive ? 'text-warning' : 'text-white'}" title="Sửa ghép tuyến này"></i>
                 <i class="bi bi-x-circle-fill ms-1 fs-6 text-light" onclick="window.xoaKhoiGioGhep('${cartItem.bkId}', event)" title="Xóa khỏi giỏ"></i>
              </div>`;
        }
    });

    if (window.lichSuGanGlobal && window.lichSuGanGlobal.length > 0) {
        window.lichSuGanGlobal.forEach(ls => {
            const routeStr = ls.routes.join(', ');
            const shortRoutes = routeStr.length > 45 ? routeStr.substring(0, 45) + '...' : routeStr;
            cartHtml += `
              <div class="badge bg-secondary border border-secondary p-2 d-flex align-items-center gap-2 shadow-sm opacity-75" style="font-size:11px; cursor:pointer;" title="Đã lưu trên Sheet ${window.loaiBackupHienTai}\nTuyến gán: ${routeStr}\nThao tác bởi: ${ls.nguoiGan}" onclick="window.suaLichSuGhepTuyen('${ls.idBk}')">
                 <span><i class="bi bi-lock-fill text-warning me-1"></i>${ls.tenBk} <span class="badge bg-dark mx-1">${ls.routes.length} Tuyến</span> (${shortRoutes})</span>
                 <span class="ms-1 fst-italic fw-normal text-light border-start border-light ps-2">👤 ${ls.nguoiGan}</span>
                 <i class="bi bi-pencil-square ms-1 fs-6 text-light" title="Bấm để sửa hoặc gán thêm tuyến"></i>
              </div>`;
        });
    }

    if (!hasMatches && (!window.pendingLeftRoutes || window.pendingLeftRoutes.length === 0) && (!window.lichSuGanGlobal || window.lichSuGanGlobal.length === 0)) {
        cartHtml += `<span class="text-muted fst-italic ms-2">Chưa có tuyến nào được ghép... (Bạn có thể chọn bên trái hoặc bên phải trước đều được)</span>`;
    }
    
    cartHtml += `</div>
       <button class="btn btn-primary fw-bold px-4 py-2 shadow ms-3" id="btnThucHienGhep" onclick="thucHienGhepBackup()" ${hasMatches ? '' : 'disabled'}>
         <i class="bi bi-cloud-arrow-up-fill me-2"></i>XÁC NHẬN TẤT CẢ
       </button>`;
    
    vungGhep.innerHTML = cartHtml;
}

// KHI BẤM "XÁC NHẬN TẤT CẢ" -> HIỂN THỊ BẢNG XÁC NHẬN LẠI RÕ RÀNG TRƯỚC KHI LƯU
function thucHienGhepBackup() {
    const activeCarts = Object.values(window.cartGhepTuyen).filter(c => c.routes && c.routes.length > 0);
    if (activeCarts.length === 0) {
        alert("Chưa có tuyến nào trong giỏ để xác nhận!");
        return;
    }

    // Tự động tạo Modal Xác Nhận nếu chưa có trong DOM
    let modalEl = document.getElementById('modalConfirmGhepBackup');
    if (!modalEl) {
        const div = document.createElement('div');
        div.innerHTML = `
          <div class="modal fade" id="modalConfirmGhepBackup" tabindex="-1" style="z-index: 1080; background: rgba(0,0,0,0.5);">
            <div class="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
              <div class="modal-content border-0 shadow-lg">
                <div class="modal-header bg-primary text-white py-2">
                  <h6 class="modal-title fw-bold mb-0" id="titleConfirmGhepBackup">
                    <i class="bi bi-clipboard2-check-fill me-1"></i>XÁC NHẬN LẠI DANH SÁCH GÁN TUYẾN
                  </h6>
                  <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body p-3 bg-light" id="bodyConfirmGhepBackup"></div>
                <div class="modal-footer py-2 bg-white d-flex justify-content-between">
                  <button type="button" class="btn btn-secondary btn-sm px-3 fw-bold" data-bs-dismiss="modal">
                    <i class="bi bi-arrow-left me-1"></i>Quay lại chỉnh sửa
                  </button>
                  <button type="button" class="btn btn-success btn-sm px-4 fw-bold shadow-sm" id="btnChotLuuBackupSheet" onclick="window.chotLuuGhepBackupLenSheet()">
                    <i class="bi bi-check-circle-fill me-1"></i>Xác nhận & Đẩy lên Sheet
                  </button>
                </div>
              </div>
            </div>
          </div>`;
        document.body.appendChild(div.firstElementChild);
        modalEl = document.getElementById('modalConfirmGhepBackup');
    }

    const ngayXem = document.getElementById('selectNgayTongQuanOff')?.value || '';
    const loai = window.loaiBackupHienTai;
    let totalRoutes = 0;

    // Bảng 1: Thống kê 1 người gánh bao nhiêu tuyến
    let htmlBangNguoiGanh = `
      <div class="fw-bold text-primary mb-2" style="font-size:13px;">
        <i class="bi bi-person-badge-fill me-1"></i>1. TỔNG HỢP THEO NGƯỜI GÁNH (1 NGƯỜI GÁNH BAO NHIÊU TUYẾN):
      </div>
      <div class="table-responsive bg-white rounded shadow-sm border mb-3">
        <table class="table table-sm table-bordered align-middle mb-0" style="font-size:12.5px;">
          <thead class="table-primary text-center">
            <tr>
              <th style="width: 45px;">STT</th>
              <th style="min-width: 180px;">Người Đi Gánh (Backup)</th>
              <th style="width: 120px;">Số Tuyến Gánh</th>
              <th class="text-start">Chi Tiết Các Tuyến Đảm Nhận</th>
            </tr>
          </thead>
          <tbody>`;

    // Bảng 2: Chi tiết tuyến nào gán cho ai
    let htmlBangChiTietTuyen = `
      <div class="fw-bold text-danger mb-2" style="font-size:13px;">
        <i class="bi bi-signpost-split-fill me-1"></i>2. CHI TIẾT TUYẾN NÀO GÁN CHO AI:
      </div>
      <div class="table-responsive bg-white rounded shadow-sm border">
        <table class="table table-sm table-bordered align-middle mb-0" style="font-size:12.5px;">
          <thead class="table-danger text-center">
            <tr>
              <th style="width: 45px;">STT</th>
              <th>Rider Cần BK (OFF)</th>
              <th>Tuyến Cần Gánh (${loai})</th>
              <th><i class="bi bi-arrow-right"></i> Gán Cho Người Gánh</th>
            </tr>
          </thead>
          <tbody>`;

    let sttTuyen = 1;
    activeCarts.forEach((cart, idx) => {
        totalRoutes += cart.routes.length;
        const danhSachTuyenStr = cart.routes.map((rt, i) => {
            const label = rt.type === 'WARD' ? `<b>${rt.route}</b>` : `<b>${rt.name}</b> (${rt.id}) — <span class="text-danger">${rt.route}</span>`;
            return `${i + 1}. ${label}`;
        }).join('<br>');

        htmlBangNguoiGanh += `
          <tr>
            <td class="text-center text-muted">${idx + 1}</td>
            <td class="fw-bold text-success">${cart.bkName}<br><span class="small text-muted font-monospace">ID: ${cart.bkId}</span></td>
            <td class="text-center"><span class="badge bg-danger fs-6 px-3 py-1">${cart.routes.length} tuyến</span></td>
            <td class="text-start py-2">${danhSachTuyenStr}</td>
          </tr>`;

        cart.routes.forEach(rt => {
            htmlBangChiTietTuyen += `
              <tr>
                <td class="text-center text-muted">${sttTuyen++}</td>
                <td class="fw-bold text-dark">${rt.type === 'WARD' ? 'TUYẾN TỔNG' : `${rt.name} <span class="text-muted font-monospace">(${rt.id})</span>`}</td>
                <td class="fw-semibold text-danger">${rt.route}</td>
                <td class="fw-bold text-success"><i class="bi bi-arrow-right-circle-fill me-1"></i>${cart.bkName} (${cart.bkId})</td>
              </tr>`;
        });
    });

    htmlBangNguoiGanh += `</tbody></table></div>`;
    htmlBangChiTietTuyen += `</tbody></table></div>`;

    document.getElementById('titleConfirmGhepBackup').innerHTML = `
      <i class="bi bi-clipboard2-check-fill me-1"></i>XÁC NHẬN GÁN TUYẾN BACKUP ${loai} — NGÀY ${ngayXem}`;

    document.getElementById('bodyConfirmGhepBackup').innerHTML = `
      <div class="alert alert-info py-2 mb-3 border-info d-flex justify-content-between align-items-center" style="font-size:13px;">
        <span>📅 Ngày điều phối: <b>${ngayXem}</b> | Loại: <b>BACKUP ${loai}</b></span>
        <span>Tổng cộng: <b class="text-primary">${activeCarts.length} người gánh</b> / <b class="text-danger">${totalRoutes} tuyến</b></span>
      </div>
      ${htmlBangNguoiGanh}
      ${htmlBangChiTietTuyen}
    `;

    bootstrap.Modal.getOrCreateInstance(modalEl).show();
}

// HÀM THỰC SỰ ĐẨY DỮ LIỆU LÊN SHEET SAU KHI ĐÃ XÁC NHẬN Ở BẢNG POPUP
window.chotLuuGhepBackupLenSheet = async function() {
    const btnConfirm = document.getElementById('btnChotLuuBackupSheet');
    if (btnConfirm) {
        btnConfirm.disabled = true;
        btnConfirm.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Đang lưu lên Sheet...';
    }

    const ngayXem = document.getElementById('selectNgayTongQuanOff')?.value || '';
    const backupMatches = [];
    const nguoiThaoTac = typeof layTenNguoiThaoTac === 'function' ? layTenNguoiThaoTac() : 'FTE / Admin';

    Object.values(window.cartGhepTuyen).forEach(cartItem => {
        if (cartItem.routes.length === 0) return;

        let allRoutes = [];
        let tuyenGanMap = window.loaiBackupHienTai === 'PICK' ? 'PICK' : 'Tân Bình'; 

        cartItem.routes.forEach(rt => {
            backupMatches.push({
                ngay: ngayXem, idGoc: rt.type === 'WARD' ? 'TUYẾN TỔNG' : rt.id,
                tenGoc: rt.name, tuyenGan: rt.route, idBk: cartItem.bkId,
                tenBk: cartItem.bkName, nguoiGan: nguoiThaoTac 
            });

            allRoutes.push(rt.type === 'WARD' ? rt.route : `${rt.name} (${rt.route})`);
            
            if (window.loaiBackupHienTai === 'DELI') {
                if (rt.route.includes('Phú Nhuận')) tuyenGanMap = 'Phú Nhuận';
                if (rt.route.includes('Thủ Đức')) tuyenGanMap = 'Thủ Đức';

                if (rt.type === 'OFF') {
                    const oldNote = sessionDraftMap[rt.id]?.note ? `${sessionDraftMap[rt.id].note}, ` : 'Trực bù: ';
                    sessionDraftMap[rt.id] = { dates: [ngayXem], loaiOff: "OFF", tuyenBK: "", backup: cartItem.bkName, note: `${oldNote}${cartItem.bkName}` };
                } else if (rt.type === 'WORK') {
                    const oldNote = sessionDraftMap[rt.id]?.note ? `${sessionDraftMap[rt.id].note}, ` : 'Hỗ trợ bởi BK: ';
                    sessionDraftMap[rt.id] = { dates: [], loaiOff: "OFF", tuyenBK: "", backup: "", note: `${oldNote}${cartItem.bkName}` };
                }
            }
        });

        if (window.loaiBackupHienTai === 'DELI') {
            const noteChoBK = `Hỗ trợ: ${allRoutes.join('; ')}`;
            sessionDraftMap[cartItem.bkId] = { dates: [], loaiOff: "OFF", tuyenBK: tuyenGanMap, backup: "", note: noteChoBK };
        }
    });

    if (backupMatches.length === 0) {
        if (btnConfirm) { btnConfirm.disabled = false; btnConfirm.innerHTML = '<i class="bi bi-check-circle-fill me-1"></i>Xác nhận & Đẩy lên Sheet'; }
        return;
    }

    try {
        await fetch(`${API_BASE}/luu-backup-ghep`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ backupMatches, loai: window.loaiBackupHienTai })
        });
    } catch (error) {}

    // 1. Khóa các tuyến bên trái đã lưu xong
    backupMatches.forEach(m => {
        if (m.idGoc !== 'TUYẾN TỔNG' && !window.danhSachTuyenDaGanGlobal.includes(m.idGoc)) {
            window.danhSachTuyenDaGanGlobal.push(m.idGoc);
            const tr = document.getElementById(`tr_left_${m.idGoc}`);
            if (tr) {
                tr.classList.add('locked-route', 'd-none');
                tr.classList.remove('table-danger', 'table-primary', 'table-secondary', 'table-success', 'table-warning');
            }
        }
    });

    // 2. Đưa vào lịch sử đã chốt của đúng tab hiện tại
    Object.values(window.cartGhepTuyen).forEach(cartItem => {
        if (cartItem.routes.length === 0) return;
        window.lichSuGanGlobal.push({
            idBk: cartItem.bkId, tenBk: cartItem.bkName,
            routes: cartItem.routes.map(r => r.type === 'WARD' ? r.route : `${r.name} (${r.route})`),
            originalIds: cartItem.routes.map(r => r.type === 'WARD' ? 'TUYẾN TỔNG' : r.id),
            nguoiGan: nguoiThaoTac 
        });
        
        const trBk = document.getElementById(`tr_bk_${cartItem.bkId}`);
        if (trBk) trBk.classList.remove('table-success');
    });

    window.cartGhepTuyen = {};
    window.pendingLeftRoutes = [];
    sessionStorage.removeItem(`KV2_DRAFT_BACKUP_${window.loaiBackupHienTai}`); // XÓA LƯU NGẦM KHI ĐÃ ĐẨY SHEET THÀNH CÔNG
    window.activeBkId = null;
    window.isIsolationMode = false;
    
    ['COT1', 'COT2'].forEach(ca => {
        window.capNhatTrangThaiCotPhai(ca);
        window.capNhatTrangThaiCotTrai(ca);
    });
    capNhatGiaoDienGhepCap();

    if (btnConfirm) { 
        btnConfirm.disabled = false; 
        btnConfirm.innerHTML = '<i class="bi bi-check-circle-fill me-1"></i>Xác nhận & Đẩy lên Sheet'; 
    }

    const modalConfirmEl = document.getElementById('modalConfirmGhepBackup');
    if (modalConfirmEl) bootstrap.Modal.getInstance(modalConfirmEl)?.hide();

    if (window.loaiBackupHienTai === 'DELI') {
        renderTableNewOff(true);
    }
    
    const sheetTb = window.loaiBackupHienTai === 'PICK' ? 'KV2 PICK' : 'KV2 DELI';
    alert(`✅ Đã lưu thành công ${backupMatches.length} lượt gán tuyến lên Sheet ${sheetTb}!`);
}

// ================= HÀM MỞ POPUP CHI TIẾT KHI CLICK =================
// ================= HÀM MỞ POPUP CHI TIẾT KHI CLICK =================
// ================= HÀM MỞ POPUP CHI TIẾT KHI CLICK =================
function xemDanhSachOff(ngay, quanFilter, caFilter, title, isBKDiLam = false) {
  if (!ngay || !ridersData) return;

  // Lấy thứ tương ứng
  let thuHienTai = '';
  if (typeof dateHeadersGlobal !== 'undefined') {
    const dayObj = dateHeadersGlobal.find(d => d.date === ngay);
    if (dayObj && dayObj.thu) thuHienTai = dayObj.thu + ' - ';
  }

  const normQ = (q) => (q || '').trim().toLowerCase();
  const normCa = (c) => (c || '').trim().toLowerCase();
  const normQuanF = normQ(quanFilter);
  const normCaF = normCa(caFilter);

  // Lọc danh sách đúng chuẩn
  const filteredList = ridersData.filter(rd => {
    const isBK = (rd.quanDeli || '').toUpperCase().includes('BK');
    const sched = (rd.dailySchedule && rd.dailySchedule[ngay]) ? rd.dailySchedule[ngay].toLowerCase().trim() : '';
    
    // Nếu lấy danh sách BK đi làm
    if (isBKDiLam) return isBK && !sched.includes('off');
    
    // Nếu xem OFF thường thì loại BK ra
    if (isBK) return false;

    const q = normQ(rd.quanDeli);
    const c = normCa(rd.ca);
    return (!normQuanF || q.includes(normQuanF)) && (!normCaF || c.includes(normCaF)) && sched.includes('off');
  });

  const theadTitle = document.getElementById('titleModalChiTietOff');
  const tbody = document.getElementById('tbodyChiTietOff');
  
  if (theadTitle) {
    theadTitle.innerHTML = `<i class="bi bi-person-lines-fill me-1"></i>DANH SÁCH CHI TIẾT - ${title} (${thuHienTai}${ngay})`;
  }

  if (filteredList.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted">Không có dữ liệu cho mục này</td></tr>`;
  } else {
    let html = '';
    filteredList.forEach((rd, idx) => {
      const caBadge = rd.ca.includes('1') ? 'badge-cot1' : 'badge-cot2';
      const deliDisplay = rd.quanDeli ? `${rd.quanDeli} (P.${rd.phuongDeli || '-'})` : '—';
      const ghiChu = (rd.dailySchedule && rd.dailySchedule[ngay]) ? rd.dailySchedule[ngay] : '';
      
      html += `
        <tr>
          <td class="text-muted small">${idx + 1}</td>
          <td class="fw-bold font-monospace">${rd.id}</td>
          <td class="fw-bold text-start text-dark">${rd.name} ${isBKDiLam ? '<span class="badge bg-success ms-1">BK</span>' : ''}</td>
          <td><span class="badge ${caBadge}">${rd.ca || '—'}</span></td>
          <td class="text-start text-primary fw-semibold small">${deliDisplay}</td>
          <td class="text-start text-danger small">${ghiChu}</td>
        </tr>
      `;
    });
    tbody.innerHTML = html;
  }
  bootstrap.Modal.getOrCreateInstance(document.getElementById('modalChiTietRiderOff')).show();
}
// =======================================================================
// ==================== HỆ THỐNG ĐIỀN OFF MỚI (7 NÚT) ====================
// =======================================================================

// MỞ MODAL VÀ TỰ ĐỘNG CHỌN TUẦN HIỆN TẠI
function moBangDangKyAllRider() {
  if (!ridersData || ridersData.length === 0) {
    alert("Đang tải dữ liệu Rider từ hệ thống, vui lòng chờ!");
    return;
  }
  
  sessionDraftMap = {}; 

  const selWeek = document.getElementById("selWeekNewOff");
  if (selWeek && dateHeadersGlobal.length > 0) {
    let weekCount = 1;
    let optionsTuanHtml = '';
    let startIdx = dateHeadersGlobal.findIndex(d => (d.thu || '').includes('Thứ 2') || (d.thu || '').includes('T2'));
    if (startIdx === -1) startIdx = 0;
    
    let today = new Date();
    let todayStr = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}`;
    let selectedIndexToSet = startIdx;

    for (let i = startIdx; i < dateHeadersGlobal.length; i += 7) {
      const start = dateHeadersGlobal[i];
      const end = dateHeadersGlobal[Math.min(i + 6, dateHeadersGlobal.length - 1)];
      
      const weekSlice = dateHeadersGlobal.slice(i, i + 7);
      if (weekSlice.some(d => d.date.includes(todayStr))) {
         selectedIndexToSet = i;
      }

      optionsTuanHtml += `<option value="${i}" data-name="Tuần ${weekCount}: ${start.date} ➔ ${end.date}">Tuần ${weekCount}: ${start.date} ➔ ${end.date}</option>`;
      weekCount++;
    }
    selWeek.innerHTML = optionsTuanHtml;
    selWeek.value = selectedIndexToSet;
  }

  renderTableNewOff(true);
  bootstrap.Modal.getOrCreateInstance(document.getElementById('modalDangKyAllRider')).show();
}

// CHUYỂN TUẦN KHÁC THÌ RENDER LẠI VÀ XÓA BẢN NHÁP
function doiTuanNewOff() {
  sessionDraftMap = {};
  renderTableNewOff(true);
}

// RENDER BẢNG CHÍNH MƯỢT MÀ BẰNG CHUỖI HTML VÀ 7 NÚT BẤM
// RENDER BẢNG CHÍNH MƯỢT MÀ BẰNG CHUỖI HTML VÀ 7 NÚT BẤM
function renderTableNewOff(skipSaveCurrent) {
  if (!skipSaveCurrent) {
    const visibleRows = document.querySelectorAll("#riderTableBodyNewOff tr[id^='row_']");
    visibleRows.forEach(row => luuThongTinOff(row.id.replace("row_", ""), true));
    capNhatDemOFF(); 
  }

  const ca = document.getElementById("selCaNewOff").value;
  const quan = document.getElementById("selQuanNewOff").value;
  const searchKeyword = document.getElementById("txtSearchNewOff").value.trim().toLowerCase();
  const tbody = document.getElementById("riderTableBodyNewOff");

  const selWeek = document.getElementById("selWeekNewOff");
  const startIdx = parseInt(selWeek ? selWeek.value : 0, 10);
  const weekDates = dateHeadersGlobal.slice(startIdx, startIdx + 7);
  
  const filtered = ridersData.filter(r => {
    const matchCa = (ca === "Tất cả" || r.ca.includes(ca));
    let matchQuan = false;
    const qDeli = (r.quanDeli || "").toUpperCase().trim();

    if (quan === "Tất cả") {
        matchQuan = true;
    } else if (quan === "BK") {
        matchQuan = r.isBackup && !qDeli.includes("PHÚ NHUẬN") && !qDeli.includes("TÂN BÌNH") && !qDeli.includes("THỦ ĐỨC");
    } else {
        matchQuan = qDeli.includes(quan.toUpperCase());
    }

    const matchSearch = !searchKeyword || (r.id + " " + r.name + " " + r.quanPick + " " + r.ca).toLowerCase().includes(searchKeyword);
    return matchCa && matchQuan && matchSearch;
  });

  document.getElementById("txtCountNewOff").textContent = filtered.length;

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-muted">Không tìm thấy Rider nào thỏa điều kiện!</td></tr>';
    capNhatDemOFF();
    return;
  }

  let html = ''; 

  filtered.forEach(r => {
    let trClass = r.isBackup ? "bk-highlight" : "";
    const caBadgeClass = r.ca.includes("1") ? "badge-cot1" : "badge-cot2";
    if (!sessionDraftMap[r.id]) {
     const existingOff = weekDates.filter(dh => {
       const sched = (r.dailySchedule && r.dailySchedule[dh.date]) ? r.dailySchedule[dh.date].toLowerCase().trim() : '';
       return sched.includes('off');
     }).map(dh => dh.date);
     sessionDraftMap[r.id] = { dates: [...existingOff], loaiOff: "OFF", tuyenBK: "", backup: "", note: "", originalOff: [...existingOff], originalTuyenBK: "" };
   }
   const draft = sessionDraftMap[r.id];

    let hasOff = draft.dates && draft.dates.length > 0;
    if (hasOff) trClass += " has-off-highlight";

    let cotTuyens = "";
    if (r.isBackup) {
      cotTuyens = `
        <select id="tuyenBK_${r.id}" class="form-select form-select-sm border-success fw-bold text-success" onchange="luuThongTinOff('${r.id}')">
          <option value="" ${draft.tuyenBK === '' ? 'selected' : ''}>-- Chọn tuyến --</option>
          <option value="Tân Bình" ${draft.tuyenBK === 'Tân Bình' ? 'selected' : ''}>📍 Tân Bình</option>
          <option value="Phú Nhuận" ${draft.tuyenBK === 'Phú Nhuận' ? 'selected' : ''}>📍 Phú Nhuận</option>
          <option value="Thủ Đức" ${draft.tuyenBK === 'Thủ Đức' ? 'selected' : ''}>📍 Thủ Đức</option>
        </select>
      `;
    } else {
      cotTuyens = `
        <select id="bk_${r.id}" class="form-select form-select-sm" onchange="luuThongTinOff('${r.id}')">
          <option value="">-- Trực bù --</option>
          ${backupOptions.map(b => `<option value="${b}" ${draft.backup === b ? 'selected' : ''}>${b}</option>`).join("")}
        </select>
      `;
    }

    let dateTogglesHtml = '<div class="d-flex flex-wrap gap-1">';
    weekDates.forEach(dh => {
      const dateStr = String(dh && dh.date ? dh.date : dh);
      const thuVal = (dh && dh.thu) ? dh.thu : '';
      const isSelected = draft.dates && draft.dates.includes(dateStr);
      const btnClass = isSelected ? 'btn-danger text-white' : 'btn-outline-secondary bg-light text-dark';
      const thuGoc = (thuVal || '').replace('Th\u1ee9 ', 'T').replace('Ch\u1ee7 nh\u1eadt', 'CN');
      const ngayNgan = String(dateStr || '').substring(0, 5); 
      
      dateTogglesHtml += `
        <button type="button" class="btn ${btnClass} p-1 text-center border" 
                style="font-size: 11px; min-width: 38px; line-height: 1.2;" 
                onclick="toggleDayOffBtn('${r.id}', '${dateStr}', '${thuVal}', this)">
          ${thuGoc}<br><span class="fw-bold">${ngayNgan}</span>
        </button>`;
    });
    dateTogglesHtml += '</div>';

    html += `
    <tr id="row_${r.id}" class="${trClass}">
      <td class="fw-bold text-secondary font-monospace">${r.id}</td>
      <td class="fw-bold">${r.name}${r.isBackup ? '<span class="badge bg-success" style="font-size: 10px;">BK</span>' : ''}</td>
      <td class="text-center"><span class="badge ${caBadgeClass}">${r.ca}</span></td>
      <td class="small fw-semibold text-primary">${r.quanDeli} (P.${r.phuongDeli || '-'})</td>
      <td>${dateTogglesHtml}</td>
      <td>
        <select id="loai_${r.id}" class="form-select form-select-sm fw-bold" onchange="luuThongTinOff('${r.id}')">
          <option value="OFF" ${draft.loaiOff === 'OFF' ? 'selected' : ''}>OFF</option>
          <option value="OFF PICK" ${draft.loaiOff === 'OFF PICK' ? 'selected' : ''}>OFF PICK</option>
          <option value="OFF DELI" ${draft.loaiOff === 'OFF DELI' ? 'selected' : ''}>OFF DELI</option>
          <option value="OFF đột xuất" ${draft.loaiOff === 'OFF đột xuất' ? 'selected' : ''}>OFF đột xuất</option>
        </select>
      </td>
      <td><input type="text" id="note_${r.id}" value="${draft.note}" class="form-control form-control-sm" placeholder="Ghi chú..." oninput="luuThongTinOff('${r.id}', true)"></td>
    </tr>`;
  });

  tbody.innerHTML = html;
  capNhatDemOFF();
}
// CLICK ĐỔI MÀU NÚT CHỌN NGÀY VÀ CẢNH BÁO NGÀY ĐẶC BIỆT
function toggleDayOffBtn(id, dateStr, thuStr, btnEl) {
  if (!sessionDraftMap[id]) {
    sessionDraftMap[id] = { dates: [], loaiOff: "OFF", tuyenBK: "", backup: "", note: "" };
  }
  
  const draft = sessionDraftMap[id];
  const idx = draft.dates.indexOf(dateStr);
  
  if (idx > -1) {
    if (draft.originalOff && draft.originalOff.includes(dateStr)) {
      if (!confirm(`Ngày ${dateStr} đã có lịch OFF. Bạn có chắc muốn xóa lịch OFF ngày này?`)) return;
    }
    draft.dates.splice(idx, 1);
    btnEl.classList.remove('btn-danger', 'text-white');
    btnEl.classList.add('btn-outline-secondary', 'bg-light', 'text-dark');
  } else {
    // Kiểm tra xem có phải là ngày đặc biệt không
    const dacBiet = kiemTraNgayDacBiet(dateStr, thuStr);
    if (dacBiet) {
      alert(`⚠️ CẢNH BÁO HẠN CHẾ OFF:\nNgày ${dateStr} là ngày ${dacBiet.label}.\n\nYêu cầu: Bạn bắt buộc phải ghi rõ lý do vào cột "Ghi chú" trên bảng mới có thể Lưu và Đồng bộ!`);
    }

    draft.dates.push(dateStr);
    btnEl.classList.remove('btn-outline-secondary', 'bg-light', 'text-dark');
    btnEl.classList.add('btn-danger', 'text-white');
  }
  
  capNhatDemOFF();
}

// LƯU CÁC THÔNG TIN PHỤ TỪ SELECT VÀ INPUT VÀO NHÁP
function luuThongTinOff(id, skipUpdateUI = false) {
  if (!sessionDraftMap[id]) {
    sessionDraftMap[id] = { dates: [], loaiOff: "OFF", tuyenBK: "", backup: "", note: "" };
  }
  const draft = sessionDraftMap[id];
  
  draft.loaiOff = document.getElementById("loai_" + id)?.value || "OFF";
  draft.tuyenBK = document.getElementById("tuyenBK_" + id)?.value || "";
  draft.backup = document.getElementById("bk_" + id)?.value || "";
  draft.note = document.getElementById("note_" + id)?.value || "";
  
  if (!skipUpdateUI) capNhatDemOFF();
}

// ĐẾM SỐ LƯỢNG RIDER ĐÃ ĐƯỢC CHỌN VÀ HIỂN THỊ
function capNhatDemOFF() {
  let dem = 0;
  Object.keys(sessionDraftMap).forEach(id => {
    const d = sessionDraftMap[id];
    let hasOff = d.dates && d.dates.length > 0;
    if (hasOff) dem++;
    
    const row = document.getElementById("row_" + id);
    if (row) {
      if (hasOff) row.classList.add("has-off-highlight");
      else row.classList.remove("has-off-highlight");
    }
  });

  const txtOffCount = document.getElementById("txtOffCountNewOff");
  const btnOffCount = document.getElementById("btnOffCountFooter");
  if (txtOffCount) txtOffCount.textContent = dem;
  if (btnOffCount) btnOffCount.textContent = dem;
}

// HÀM LẤY TÊN FTE / ADMIN ĐANG ĐĂNG NHẬP (GIỐNG XẾP BACKUP PICK & DELI)
function layTenNguoiThaoTac() {
  let nguoiThaoTac = 'FTE / Admin';
  try {
    let foundUser = null;
    const keys = ['KV2_LOGGED_USER', 'user', 'currentUser', 'account'];
    for (let k of keys) {
      let raw = localStorage.getItem(k) || sessionStorage.getItem(k);
      if (raw) { try { foundUser = JSON.parse(raw); break; } catch(e){} }
    }
    if (!foundUser && window.currentUser) foundUser = window.currentUser;
    if (foundUser && (foundUser.name || foundUser.username)) {
      nguoiThaoTac = `${foundUser.role || 'FTE'}: ${foundUser.name || foundUser.username}`;
    } else {
      const badgeText = document.getElementById('userDisplayBadge')?.innerText || '';
      if (badgeText && !badgeText.includes('Chưa đăng nhập')) nguoiThaoTac = badgeText.trim();
    }
  } catch (e) {}
  return nguoiThaoTac;
}

// MỞ BẢNG XÁC NHẬN GỬI DỮ LIỆU & KIỂM TRA ĐIỀU KIỆN
function moPopupXacNhanNewOff() {
  const visibleRows = document.querySelectorAll("#riderTableBodyNewOff tr[id^='row_']");
  visibleRows.forEach(row => luuThongTinOff(row.id.replace("row_", ""), true));

  const selWeek = document.getElementById("selWeekNewOff");
  const weekName = selWeek.options[selWeek.selectedIndex]?.getAttribute('data-name') || "Tuần làm việc";
  const startIdx = parseInt(selWeek ? selWeek.value : 0, 10);
  const weekDates = dateHeadersGlobal.slice(startIdx, startIdx + 7).map(d => d.date);

  const danhSachGui = [];
  let html = '<ul class="list-group list-group-flush">';
  let hasValidationError = false;

  for (let i = 0; i < ridersData.length; i++) {
    const r = ridersData[i];
    const draft = sessionDraftMap[r.id];
    if (!draft) continue;
    
    let dates = [], moTa = "";

    if (draft.dates && draft.dates.length > 0) {
      let needNote = false;
      let specialLabel = "";
      
      for (let d of draft.dates) {
        let dh = dateHeadersGlobal.find(x => x.date === d);
        let dacBiet = kiemTraNgayDacBiet(d, dh ? dh.thu : '');
        if (dacBiet) {
          needNote = true;
          specialLabel = dacBiet.label;
          break;
        }
      }

      if (needNote && (!draft.note || draft.note.trim() === '')) {
        alert(`❌ LỖI THIẾU GHI CHÚ:\nRider ${r.id} - ${r.name} xin OFF vào ngày đặc biệt (${specialLabel}).\nVui lòng điền rõ lý do vào ô "Ghi chú" trên bảng trước khi Lưu!`);
        hasValidationError = true;
        break; 
      }

      dates = [...draft.dates];
      moTa = dates.map(d => {
        let dh = dateHeadersGlobal.find(x => x.date === d);
        let thuStr = dh && dh.thu ? dh.thu.replace('Thứ ', 'T').replace('Chủ nhật', 'CN') + ' ' : '';
        return `${thuStr}(${d.substring(0, 5)})`;
      }).join(", "); 
    }

    const newDates = (draft.dates || []).filter(d => !(draft.originalOff || []).includes(d));
    const removedDates = (draft.originalOff || []).filter(d => !(draft.dates || []).includes(d));
    const hasNewSelection = newDates.length > 0;
    const hasRemoval = removedDates.length > 0;
    const hasBackupChange = r.isBackup && draft.tuyenBK !== "" && draft.tuyenBK !== (draft.originalTuyenBK || "");
    if (!(hasNewSelection || hasRemoval || hasBackupChange)) continue;
    if (dates.length > 0 || (r.isBackup && draft.tuyenBK !== "")) {
      const diaBanTuyen = r.quanDeli ? `${r.quanDeli} (P.${r.phuongDeli || '-'})` : (r.quanPick || '—');

      danhSachGui.push({
        id: r.id, 
        ten: r.name, 
        ca: r.ca || '—',
        diaBan: diaBanTuyen,
        tuanLamViec: weekName,
        dates: dates,
        chiTietNgayOff: dates.length > 0 ? `${draft.loaiOff} (${dates.map(d => d.substring(0, 5)).join(', ')})` : `BK Tuyến: ${draft.tuyenBK}`,
        tongNgayOff: dates.length,
        weekDates: weekDates,
        loaiOff: draft.loaiOff, 
        ghiChu: draft.note || ''
      });


      const chiTietText = r.isBackup && dates.length === 0
        ? `BK Tuyến: <b>${draft.tuyenBK || 'Chưa xếp'}</b>` 
        : `Ngày chọn: <b class="text-danger">${moTa}</b> — Loại: <b>${draft.loaiOff}</b>`;

      html += `<li class="list-group-item d-flex justify-content-between align-items-center py-2 px-2">
                 <div>
                   <span class="fw-bold text-dark">${r.id} - ${r.name}</span>
                   <span class="badge ${r.ca.includes('1') ? 'bg-primary' : 'bg-warning text-dark'} ms-1" style="font-size:10px;">${r.ca}</span>
                   <div style="font-size: 12px; color: #1D4ED8;" class="mt-1">${chiTietText}</div>
                   ${draft.note ? `<div class="small text-muted fst-italic">Ghi chú: ${draft.note}</div>` : ''}
                 </div>
                 <span class="badge bg-danger rounded-pill">${dates.length} ngày</span>
               </li>`;
    }
  }
  html += '</ul>';

  if (hasValidationError) return;

  if (danhSachGui.length === 0) {
    alert("⚠️ Bạn chưa chọn ngày OFF hoặc xếp tuyến cho bất kỳ Rider nào!");
    return;
  }

  const promptEl = document.getElementById('modalPromptTextNewOff');
  if (promptEl) promptEl.innerText = `📋 Xác nhận cập nhật cho ${danhSachGui.length} Rider (${weekName}):`;
  const listEl = document.getElementById('modalRiderListNewOff');
  if (listEl) listEl.innerHTML = html;

  let hasRemoved = false;
  Object.keys(sessionDraftMap).forEach(function(id){
    var d = sessionDraftMap[id];
    if (d.originalOff && d.originalOff.length > 0) {
      var removed = d.originalOff.filter(function(x){ return (d.dates||[]).indexOf(x) === -1; });
      if (removed.length > 0) hasRemoved = true;
    }
  });
  var radReplace = document.getElementById('radThayThe');
  var radNew = document.getElementById('radLuuMoi');
  if (hasRemoved && radReplace) radReplace.checked = true;
  else if (radNew) radNew.checked = true;

  cachedPayloadNewOff = { 
    ridersData: danhSachGui, 
    userRole: window.currentUser?.role || 'FTE',
    nguoiGan: layTenNguoiThaoTac(),
    tuanLamViec: weekName,
    backupMatches: window.sessionBackupMatches || []
  };

  bootstrap.Modal.getOrCreateInstance(document.getElementById('modalConfirmNewOff')).show();
}

// BẤM GỬI LÊN SERVER
async function thucHienLuuDongBoNewOff() {
  if (!cachedPayloadNewOff) return;

  const isReplace = document.getElementById('radThayThe')?.checked || false;
  cachedPayloadNewOff.mode = isReplace ? 'REPLACE' : 'NEW';
  cachedPayloadNewOff.nguoiGan = layTenNguoiThaoTac();

  const btnConfirm = document.getElementById("btnConfirmActionNewOff");
  btnConfirm.disabled = true; 
  btnConfirm.innerHTML = "⏳ Đang đồng bộ 2 Sheet...";

  try {
    const res = await fetch(`${API_BASE}/dong-bo-hang-loat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cachedPayloadNewOff)
    });
    const data = await res.json();
    
    if (res.ok && data.success) {
      alert("✅ " + data.message);
      bootstrap.Modal.getInstance(document.getElementById('modalConfirmNewOff')).hide();
      bootstrap.Modal.getInstance(document.getElementById('modalDangKyAllRider')).hide();
      sessionDraftMap = {};
      lamMoiDuLieu();
    } else {
      alert("❌ Lỗi: " + (data.error || data.message));
    }
  } catch (e) {
    alert("❌ Lỗi hệ thống: " + e.message);
  } finally {
    btnConfirm.disabled = false;
    btnConfirm.innerHTML = "✅ Xác nhận & Lưu ngay";
  }
}