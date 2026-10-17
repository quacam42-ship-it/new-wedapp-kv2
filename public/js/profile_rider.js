// KIỂM TRA THÔNG BÁO CỦA RIDER
window.checkThongBaoRider = async function(riderId) {
    try {
        const res = await fetch(`${window.API_BASE}/xin-off/my-requests?riderId=${riderId}`);
        const data = await res.json();
        if (data.success && data.data) {
            // Chuông sẽ sáng lên nếu có bất kỳ đơn nào "Đã duyệt" hoặc "Từ chối"
            const hasUpdate = data.data.some(r => r.trangThai !== 'Chờ duyệt');
            const chuong = document.getElementById('badgeRiderNoti');
            if (chuong) chuong.style.display = hasUpdate ? 'inline-block' : 'none';
        }
    } catch(e){}
};

// KIỂM TRA SỐ ĐƠN CHỜ DUYỆT (CHO FTE) CHẠY NGẦM
window.checkDonChuaDuyet = async function() {
    try {
        const res = await fetch(`${window.API_BASE}/xin-off/list`);
        const data = await res.json();
        if (data.success && data.data) {
            // FTE chỉ nhận được danh sách "Chờ duyệt" từ server
            const pending = data.data.length;
            const badge = document.getElementById('badgePendingOff');
            if (badge) {
                badge.innerText = pending;
                badge.style.display = pending > 0 ? 'inline-block' : 'none';
            }
        }
    } catch(e){}
};

// THEO DÕI KHI RIDER BẤM VÀO TAB PROFILE ĐỂ LOAD LỊCH SỬ
document.addEventListener('DOMContentLoaded', () => {
    const originalChuyenTab = window.chuyenTab;
    window.chuyenTab = function(tabId) {
        if (typeof originalChuyenTab === 'function') {
            originalChuyenTab(tabId);
        }
        
        if (tabId === 'profile') {
            const chuong = document.getElementById('badgeRiderNoti');
            if (chuong) chuong.style.display = 'none'; // Tắt chuông khi đã vào xem
            
            // Ép đọc dữ liệu chuẩn từ LocalStorage để khắc phục lỗi không hiện Tên/ID
            let user = null;
            try {
                const saved = localStorage.getItem('KV2_LOGGED_USER');
                if (saved) user = JSON.parse(saved);
            } catch(e) {}
            
            if (user) {
                document.getElementById('profName').innerText = user.name;
                document.getElementById('profId').innerText = user.id;
                loadLichSuCuaRider(user.id);
            }
        }
    };
});

async function loadLichSuCuaRider(riderId) {
    const tbody = document.getElementById('tbodyRiderHistory');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="3" class="text-muted py-3"><div class="spinner-border spinner-border-sm text-primary me-1"></div>Đang nạp dữ liệu...</td></tr>';
    
    try {
        const res = await fetch(`${window.API_BASE}/xin-off/my-requests?riderId=${riderId}`);
        const data = await res.json();
        
        if (data.success && data.data.length > 0) {
            let html = '';
            data.data.forEach(item => {
                let badgeClass = 'bg-secondary';
                let editBtn = '';
                
                if (item.trangThai === 'Đã duyệt') badgeClass = 'bg-success';
                else if (item.trangThai === 'Từ chối') badgeClass = 'bg-danger';
                else if (item.trangThai === 'Chờ duyệt') {
                    // Nếu đang chờ duyệt thì hiện nút Sửa
                    editBtn = `<button class="btn btn-xs btn-outline-primary mt-1 py-0 px-2 shadow-sm" style="font-size:10px;" onclick="window.suaDonXinOff(${item.rowIndex}, '${item.ngayNghi}', \`${item.lyDo}\`)"><i class="bi bi-pencil-square me-1"></i>Sửa đơn</button>`;
                }
                
                html += `<tr>
                    <td class="small text-muted">${item.timestamp}</td>
                    <td class="fw-bold text-dark">${item.ngayNghi} <br><span class="badge bg-primary mt-1" style="font-size:10px;">${item.tongNgay}</span></td>
                    <td>
                      <span class="badge ${badgeClass}">${item.trangThai}</span><br>
                      ${editBtn}
                    </td>
                </tr>`;
            });
            tbody.innerHTML = html;
        } else {
            tbody.innerHTML = '<tr><td colspan="3" class="text-muted py-3">Bạn chưa có đơn xin nghỉ nào.</td></tr>';
        }
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-danger py-3">Lỗi tải dữ liệu từ máy chủ.</td></tr>';
    }
}

// HÀM MỞ BẢNG SỬA ĐƠN XIN OFF
window.suaDonXinOff = function(rowIndex, ngayNghiStr, lyDo) {
    window.editingOffRowIndex = rowIndex; // Lưu vị trí dòng để ghi đè
    
    // Phân tích ngày "DD/MM" hoặc "DD/MM đến DD/MM" trả về định dạng YYYY-MM-DD
    const parts = ngayNghiStr.split(' đến ');
    const currentYear = new Date().getFullYear();
    const parseToDateInput = (str) => {
        if (!str) return '';
        const [d, m] = str.split('/');
        if (!d || !m) return '';
        return `${currentYear}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    };

    const startStr = parts[0];
    const endStr = parts.length > 1 ? parts[1] : '';

    document.getElementById('txtNgayXinOff').value = parseToDateInput(startStr);
    
    if (endStr) {
        document.getElementById('nghiNhieuNgay').checked = true;
        window.toggleKieuNghi();
        document.getElementById('txtNgayKetThuc').value = parseToDateInput(endStr);
    } else {
        document.getElementById('nghi1Ngay').checked = true;
        window.toggleKieuNghi();
    }

    // Cắt bỏ chuỗi tự gộp "[Xin nghỉ x ngày: Từ ... đến ...] - " nếu có
    let cleanLyDo = lyDo;
    if (cleanLyDo.startsWith('[')) {
        const closeBracketIdx = cleanLyDo.indexOf('] - ');
        if (closeBracketIdx !== -1) cleanLyDo = cleanLyDo.substring(closeBracketIdx + 4);
    }
    
    document.getElementById('txtLyDoXinOff').value = cleanLyDo;
    document.getElementById('khungTaiAnhMinhChung').classList.add('d-none');
    document.getElementById('fileAnhMinhChung').value = '';
    
    if (typeof window.kiemTraNgayXinOff === 'function') window.kiemTraNgayXinOff();
    bootstrap.Modal.getOrCreateInstance(document.getElementById('modalRiderXinOff')).show();
};

// HÀM LƯU SỐ ĐIỆN THOẠI
window.capNhatSDTRider = async function() {
    let user = null;
    try {
        const saved = localStorage.getItem('KV2_LOGGED_USER');
        if (saved) user = JSON.parse(saved);
    } catch(e) {}
    
    if (!user) return alert("Vui lòng đăng nhập lại!");
    
    const phoneInput = document.getElementById('profPhone').value.trim();
    if (!phoneInput) return alert("Vui lòng nhập số điện thoại hợp lệ!");

    try {
        const res = await fetch(`${window.API_BASE}/auth/update-phone`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ riderId: user.id, phone: phoneInput })
        });
        const data = await res.json();
        if (data.success) {
            alert("✅ " + data.message);
            window.khoaSDTRiderLai(); // Cập nhật xong thì tự động khóa lại
            // Cập nhật Local Storage
            user.phone = phoneInput;
            localStorage.setItem('KV2_LOGGED_USER', JSON.stringify(user));
        } else alert("❌ Lỗi: " + data.message);
    } catch (e) {
        alert("Lỗi kết nối máy chủ!");
    }
};

// HÀM LẤY TRỰC TIẾP DỮ LIỆU TỪ SHEET TỔNG QUAN RD CHO RIDER
window.hienThiLichOffThucTe = function(riderId) {
    const boxOff = document.getElementById('profLichOffTuan');
    const boxPick = document.getElementById('profPickInfo');
    const boxDeli = document.getElementById('profDeliInfo');
    const badgeCa = document.getElementById('profCaBadge');
    
    if (!boxOff) return;

    if (typeof ridersData === 'undefined' || ridersData.length === 0) {
        fetch(`${window.API_BASE}/rider-data`).then(res => res.json()).then(data => {
            window.ridersData = data.riders || []; window.dateHeadersGlobal = data.dateHeaders || [];
            window.hienThiLichOffThucTe(riderId);
        }).catch(err => { boxOff.innerText = "Lỗi tải dữ liệu tuyến."; });
        return;
    }

    const rd = ridersData.find(r => String(r.id) === String(riderId));
    if (!rd) {
        boxOff.innerText = "Không tìm thấy thông tin nhân sự trên hệ thống.";
        if (boxPick) boxPick.innerText = "—"; if (boxDeli) boxDeli.innerText = "—";
        return;
    }

    // 1. DÒ LỊCH OFF DỰA THEO NGÀY HÔM NAY (TUẦN NÀY)
    let offDays = [];
    if (typeof dateHeadersGlobal !== 'undefined' && dateHeadersGlobal.length > 0) {
        const today = new Date();
        const todayStr = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}`;
        
        let startIdx = dateHeadersGlobal.findIndex(d => d.date.includes(todayStr));
        if (startIdx === -1) {
            startIdx = dateHeadersGlobal.findIndex(d => (d.thu || '').includes('Thứ 2') || (d.thu || '').includes('T2'));
            if (startIdx === -1) startIdx = 0;
        } else {
            while (startIdx > 0 && !((dateHeadersGlobal[startIdx].thu || '').includes('Thứ 2') || (dateHeadersGlobal[startIdx].thu || '').includes('T2'))) startIdx--;
        }

        const weekDates = dateHeadersGlobal.slice(startIdx, startIdx + 7);
        weekDates.forEach(dh => {
            const sched = (rd.dailySchedule && rd.dailySchedule[dh.date]) ? rd.dailySchedule[dh.date].toLowerCase().trim() : '';
            if (sched.includes('off')) {
                const thuGoc = (dh.thu || '').replace('Thứ ', 'T').replace('Chủ nhật', 'CN');
                offDays.push(`${thuGoc} (${dh.date.substring(0,5)})`);
            }
        });
    }

    if (offDays.length === 0) boxOff.innerHTML = `<span class="text-success"><i class="bi bi-check-circle-fill me-1"></i>Full (Không có OFF)</span>`;
    else boxOff.innerHTML = `<span class="text-danger fw-bold">${offDays.join(', ')}</span>`;

    // 2. HIỂN THỊ CA
    if (badgeCa) {
        badgeCa.innerText = rd.ca || 'Chưa phân ca';
        badgeCa.className = rd.ca.includes('1') ? 'badge badge-cot1 font-monospace' : (rd.ca.includes('2') ? 'badge badge-cot2 font-monospace' : 'badge bg-secondary font-monospace');
    }
    
    // 3. HIỂN THỊ QUẬN PICK, PHƯỜNG PICK, TUYẾN PICK (BỔ SUNG 7H/11H CHO BACKUP)
    if (boxPick) {
        let pickParts = [];
        if (rd.quanPick && rd.quanPick !== '-') pickParts.push(rd.quanPick);
        if (rd.phuongPick && rd.phuongPick !== '-') pickParts.push(`P.${rd.phuongPick}`);
        
        const isBK = (rd.quanDeli || '').toUpperCase().includes('BK');
        if (isBK) {
            const gioLay = rd.ca.includes('1') ? '7H' : (rd.ca.includes('2') ? '11H' : '');
            if (gioLay) pickParts.push(`Lấy hàng: <b class="text-danger">${gioLay}</b>`);
        } else if (rd.tuyenPick) {
            pickParts.push(`Tuyến: ${rd.tuyenPick}`);
        }
        
        boxPick.innerHTML = pickParts.length > 0 ? pickParts.join(' - ') : "—";
    }

    // 4. HIỂN THỊ QUẬN DELI, PHƯỜNG DELI
    if (boxDeli) {
        let deliParts = [];
        if (rd.quanDeli && rd.quanDeli !== '-') deliParts.push(rd.quanDeli);
        if (rd.phuongDeli && rd.phuongDeli !== '-') deliParts.push(`P.${rd.phuongDeli}`);
        boxDeli.innerText = deliParts.length > 0 ? deliParts.join(' - ') : "—";
    }
};

// ================= HÀM MỞ POPUP CHI TIẾT LỊCH OFF THÁNG/TUẦN CHO RIDER =================
window.moChiTietLichOffProfile = function() {
    let user = null;
    try { const saved = localStorage.getItem('KV2_LOGGED_USER'); if (saved) user = JSON.parse(saved); } catch(e) {}
    if (!user || typeof ridersData === 'undefined') return;
    
    const rd = ridersData.find(r => String(r.id) === String(user.id));
    if (!rd || typeof dateHeadersGlobal === 'undefined' || dateHeadersGlobal.length === 0) return;

    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    
    let countCurrentMonth = 0;
    let countPrevMonth = 0;
    let tuanNayOffs = [];
    let tuanSauOffs = [];
    
    // Xác định Tuần này và Tuần sau
    const todayStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}`;
    let startIdxTuanNay = dateHeadersGlobal.findIndex(d => d.date.includes(todayStr));
    if (startIdxTuanNay === -1) {
        startIdxTuanNay = dateHeadersGlobal.findIndex(d => (d.thu || '').includes('Thứ 2') || (d.thu || '').includes('T2'));
        if (startIdxTuanNay === -1) startIdxTuanNay = 0;
    } else {
        while (startIdxTuanNay > 0 && !((dateHeadersGlobal[startIdxTuanNay].thu || '').includes('Thứ 2') || (dateHeadersGlobal[startIdxTuanNay].thu || '').includes('T2'))) {
            startIdxTuanNay--;
        }
    }
    
    const datesTuanNay = dateHeadersGlobal.slice(startIdxTuanNay, startIdxTuanNay + 7).map(d => d.date);
    const datesTuanSau = dateHeadersGlobal.slice(startIdxTuanNay + 7, startIdxTuanNay + 14).map(d => d.date);

    // Quét toàn bộ lịch trong Sheet TỔNG QUAN RD
    if (rd.dailySchedule) {
        Object.keys(rd.dailySchedule).forEach(dateStr => {
            const sched = rd.dailySchedule[dateStr].toLowerCase().trim();
            if (sched.includes('off')) {
                const parts = dateStr.split('/');
                if (parts.length >= 2) {
                    const m = parseInt(parts[1], 10);
                    if (m === currentMonth) countCurrentMonth++;
                    if (m === prevMonth) countPrevMonth++;
                }
                
                let dh = dateHeadersGlobal.find(x => x.date === dateStr);
                const thuGoc = dh ? dh.thu.replace('Thứ ', 'T').replace('Chủ nhật', 'CN') : '';
                const formatNghi = `<span class="badge bg-danger ms-1">${rd.dailySchedule[dateStr]}</span>`;

                if (datesTuanNay.includes(dateStr)) tuanNayOffs.push(`• ${thuGoc} (${dateStr}) ${formatNghi}`);
                if (datesTuanSau.includes(dateStr)) tuanSauOffs.push(`• ${thuGoc} (${dateStr}) ${formatNghi}`);
            }
        });
    }
    
    document.getElementById('lblThangNay').innerText = `Tháng ${currentMonth}`;
    document.getElementById('lblThangTruoc').innerText = `Tháng ${prevMonth}`;
    document.getElementById('offThangNay').innerText = countCurrentMonth;
    document.getElementById('offThangTruoc').innerText = countPrevMonth;
    
    document.getElementById('offTuanNayList').innerHTML = tuanNayOffs.length > 0 ? tuanNayOffs.join('<br>') : '<span class="text-success"><i class="bi bi-check-circle-fill me-1"></i>Full (Không có OFF)</span>';
    document.getElementById('offTuanSauList').innerHTML = tuanSauOffs.length > 0 ? tuanSauOffs.join('<br>') : '<span class="text-success"><i class="bi bi-check-circle-fill me-1"></i>Full (Không có OFF)</span>';

    bootstrap.Modal.getOrCreateInstance(document.getElementById('modalChiTietLichOffRider')).show();
};

// Chỉnh sửa lại sự kiện Chuyển Tab để nạp SĐT và Lịch OFF
document.addEventListener('DOMContentLoaded', () => {
    const originalChuyenTab = window.chuyenTab;
    window.chuyenTab = function(tabId) {
        if (typeof originalChuyenTab === 'function') originalChuyenTab(tabId);
        
        if (tabId === 'profile') {
            const chuong = document.getElementById('badgeRiderNoti');
            if (chuong) chuong.style.display = 'none'; 
            
            let user = null;
            try { const saved = localStorage.getItem('KV2_LOGGED_USER'); if (saved) user = JSON.parse(saved); } catch(e) {}
            
            if (user) {
                document.getElementById('profName').innerText = user.name;
                document.getElementById('profId').innerText = user.id;
                
                // Đổ SĐT nếu có
                const phoneInput = document.getElementById('profPhone');
                if (phoneInput) {
                    phoneInput.value = user.phone || '';
                    if (user.phone && user.phone.trim() !== '') {
                        window.khoaSDTRiderLai(); // SĐT đã lưu thì Khóa mờ ngay
                    } else {
                        window.moKhoaSDTRider(); // Chưa lưu thì mở ra cho nhập
                    }
                }

                loadLichSuCuaRider(user.id);
                // Kích hoạt tìm lịch OFF
                window.hienThiLichOffThucTe(user.id);
            }
        }
    };
});

// HÀM MỞ ẢNH VƯỢT TƯỜNG LỬA TRÌNH DUYỆT CHROME
window.xemAnhMinhChung = function(base64Str) {
    const win = window.open();
    if (win) {
        win.document.write(`
            <html><head><title>Ảnh Minh Chứng OFF</title></head>
            <body style="margin:0; display:flex; justify-content:center; align-items:center; background:#222; height:100vh;">
                <img src="${base64Str}" style="max-width:100%; max-height:100%; object-fit:contain;">
            </body></html>
        `);
        win.document.close();
    } else {
        alert("⚠️ Vui lòng cho phép trang web bật Popup để xem ảnh nhé!");
    }
};

// HÀM XỬ LÝ GIAO DIỆN KHÓA SĐT
window.moKhoaSDTRider = function() {
    const input = document.getElementById('profPhone');
    input.disabled = false;
    input.focus();
    document.getElementById('btnEditPhone').style.display = 'none';
    document.getElementById('btnSavePhone').style.display = 'inline-block';
};

window.khoaSDTRiderLai = function() {
    document.getElementById('profPhone').disabled = true;
    document.getElementById('btnEditPhone').style.display = 'inline-block';
    document.getElementById('btnSavePhone').style.display = 'none';
};