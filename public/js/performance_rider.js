// ================= MODULE PERFORMANCE & QUẢN LÝ TUYẾN LẤY HÀNG (PICK) =================

// Chạy hàm thống kê đếm số Rider ngay khi thẻ Performance được bấm vào
document.addEventListener('DOMContentLoaded', () => {
    const originalChuyenTab = window.chuyenTab;
    window.chuyenTab = function(tabId) {
        if (typeof originalChuyenTab === 'function') originalChuyenTab(tabId);
        if (tabId === 'performance') {
            // Đợi 0.5s để đảm bảo dữ liệu RidersData đã tải xong
            setTimeout(loadThongKeChuaCoPick, 500);
        }
    };
});

// HÀM ĐẾM & LỌC CÁC RIDER ĐI LÀM NHƯNG CHƯA CÓ TUYẾN LẤY HÀNG (TRỐNG TUYẾN HOẶC LÀ BACKUP)
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
        // 1. Kiểm tra xem Rider có OFF hôm nay không
        let isOff = false;
        if (typeof dateHeadersGlobal !== 'undefined') {
            const dh = dateHeadersGlobal.find(d => d.date.includes(todayStr));
            if (dh && rd.dailySchedule && rd.dailySchedule[dh.date]) {
                if (rd.dailySchedule[dh.date].toLowerCase().includes('off')) isOff = true;
            }
        }
        if (isOff) return; // Nếu OFF thì bỏ qua

        // 2. Định nghĩa "Chưa có Pick": Là Backup HOẶC ô Tuyến Pick bị bỏ trống
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

    // Nếu đang mở Modal thì vẽ luôn danh sách
    if (vungDanhSach) {
        if (riderChuaPick.length === 0) {
            vungDanhSach.innerHTML = '<div class="text-center py-5 text-muted"><i class="bi bi-check-circle-fill text-success fs-1 d-block mb-2"></i>Tuyệt vời! Tất cả Rider đi làm hôm nay đều đã có tuyến lấy hàng.</div>';
            return;
        }

        // Nhóm theo CA -> QUẬN
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

// HÀM MỞ BẢNG MODAL VÀ TẢI DỮ LIỆU TỪ TỔNG QUAN RD (DÒ THEO Ô NGÀY HÔM NAY CỦA BK NGOÀI)
window.moModalPhanPhuongPick = function() {
    bootstrap.Modal.getOrCreateInstance(document.getElementById('modalPhanPhuongPick')).show();
    
    // Gọi đếm Rider bên cột phải trước
    loadThongKeChuaCoPick();

    const thead = document.getElementById('theadPickData');
    const tbody = document.getElementById('tbodyPickData');
    
    // 1. Vẽ Tiêu đề
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

    // 2. Xác định ngày hôm nay để dò ô lịch
    const now = new Date();
    const todayStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}`;

    // 3. Lọc ra các Rider BK ngoài có ô ngày hôm nay ghi chữ Quận 2, Quận 4, Quận 7
    const listBKTuyen = ridersData.filter(rd => {
        // Chỉ lấy BK ngoài (Có chữ BK ở cột Quận Deli)
        const isBK = (rd.quanDeli || '').toUpperCase().includes('BK');
        if (!isBK) return false;

        // Dò trong ô lịch làm việc ngày hôm nay
        let sched = '';
        if (typeof dateHeadersGlobal !== 'undefined') {
            const dh = dateHeadersGlobal.find(d => d.date.includes(todayStr));
            if (dh && rd.dailySchedule && rd.dailySchedule[dh.date]) {
                sched = rd.dailySchedule[dh.date].toUpperCase();
            }
        } else if (rd.dailySchedule && rd.dailySchedule[todayStr]) {
            sched = rd.dailySchedule[todayStr].toUpperCase();
        }

        // Kiểm tra xem ô lịch có thả dropdown tên Quận không
        if (sched.includes('QUẬN 2') || sched.includes('PN')) rd.tempQuanGan = 'QUẬN 2';
        else if (sched.includes('QUẬN 4') || sched.includes('TB')) rd.tempQuanGan = 'QUẬN 4';
        else if (sched.includes('QUẬN 7') || sched.includes('TĐ') || sched.includes('TD')) rd.tempQuanGan = 'QUẬN 7';
        else return false; // Trống hoặc ghi OFF -> Loại bỏ

        return true;
    });

    if (listBKTuyen.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted">Hôm nay (${todayStr}) không có Rider BK ngoài nào được gán Quận (Quận 2, Quận 4, Quận 7).</td></tr>`;
        return;
    }

    // Sắp xếp theo Ca -> Quận đang gán
    listBKTuyen.sort((a, b) => {
        if (a.ca !== b.ca) return a.ca.localeCompare(b.ca);
        return (a.tempQuanGan || '').localeCompare(b.tempQuanGan || '');
    });

    // 4. Vẽ Dữ liệu lên bảng bên trái
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