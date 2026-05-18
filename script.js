/* ==========================================================================
   1. CORE SYSTEM STATE & DATABASE INITIALIZATION
   ========================================================================== */
const DEFAULT_DATABASE = {
    currentOrderSeq: 101,
    products: [
        { id: "P1", name: "PAKCHILL ORIGINAL", price: 15000, isBundle: false },
        { id: "P2", name: "PAKCHILL NENAS", price: 18000, isBundle: false },
        { id: "P3", name: "PAKCHILL PAKCOY", price: 18000, isBundle: false },
        { id: "B1", name: "COMBO DOUBLE CHILL", price: 30000, isBundle: true }
    ],
    vouchers: [
        { code: "CHILLNEW", nominal: 5000, type: "Diskon" },
        { code: "VCHPAKCHILL", nominal: 10000, type: "Voucher" }
    ],
    members: [
        { id: "M1", name: "April Yaman", phone: "081234567890", points: 150 },
        { id: "M2", name: "Rizky Tanjung", phone: "085298765432", points: 85 }
    ],
    rekening: [
        { id: "R1", bank: "BCA", number: "1234567890", name: "PAKCHILL OFFICIAL" },
        { id: "R2", bank: "MANDIRI", number: "0987654321", name: "PT PAKCHILL UTAMA" }
    ],
    transactions: []
};

let sysDatabase = JSON.parse(localStorage.getItem('pakchill_pos_db')) || DEFAULT_DATABASE;
let activeCart = [];
let activeMemberObj = null;
let activeRole = 'staff'; // 'staff' atau 'owner'
let chartInstance = null;

function saveToStorage() {
    localStorage.setItem('pakchill_pos_db', JSON.stringify(sysDatabase));
}

/* ==========================================================================
   2. AUTHENTICATION & ROLE MANAGEMENT
   ========================================================================== */
function executeAuthentication() {
    const pinInput = document.getElementById('sys-pin-access').value.trim();
    const roleLabel = document.getElementById('txt-nav-role-label');
    const badgeRole = document.getElementById('badge-status-role');
    const ownerSection = document.getElementById('view-segment-owner');

    if (pinInput === '1234') {
        activeRole = 'staff';
        roleLabel.innerText = 'STAFF MODE';
        badgeRole.innerText = 'Staff';
        badgeRole.style.background = '#8e8e93';
        ownerSection.style.display = 'none';
        unlockInterface();
    } else if (pinInput === '9999') {
        activeRole = 'owner';
        roleLabel.innerText = 'OWNER HUB';
        badgeRole.innerText = 'Executive Owner';
        badgeRole.style.background = '#1e3f1b';
        ownerSection.style.display = 'block';
        unlockInterface();
        renderOwnerDashboardMetrics();
    } else {
        alert('PIN Otentikasi Salah! Akses Ditolak.');
    }
}

function unlockInterface() {
    document.getElementById('login-screen-overlay').style.display = 'none';
    document.getElementById('main-app-layer').style.display = 'block';
    document.getElementById('sys-pin-access').value = '';
    document.getElementById('txt-live-order-number').innerText = `Order #: ${sysDatabase.currentOrderSeq}`;
    
    syncRekeningDropdownOptions();
    renderKatalogKasir();
    renderCartUI();
    renderVoucherSakuKasir();
    calculateLiveClosingDashboard();
}

function triggerSystemLogout() {
    activeCart = [];
    activeMemberObj = null;
    document.getElementById('main-app-layer').style.display = 'none';
    document.getElementById('login-screen-overlay').style.display = 'flex';
}

/* ==========================================================================
   3. CASHIER OPERATIONS (CATALOG & CART LOGIC)
   ========================================================================== */
function renderKatalogKasir() {
    const target = document.getElementById('katalog-render-target');
    if (!target) return;
    target.innerHTML = '';

    sysDatabase.products.forEach(prod => {
        const bundleBadge = prod.isBundle ? `<div class="badge-bundling-tag">Bndl</div>` : '';
        target.innerHTML += `
            <div class="product-item-card" onclick="addItemToCart('${prod.id}')">
                ${bundleBadge}
                <div style="font-weight:800; font-size:12px; margin-bottom:5px; min-height:32px; display:flex; align-items:center; justify-content:center; color:var(--pakchill-green-dark);">
                    ${prod.name}
                </div>
                <div style="font-size:11px; font-weight:bold; color:#ff9500;">Rp ${prod.price.toLocaleString('id-ID')}</div>
            </div>
        `;
    });
}

function addItemToCart(id) {
    const pLookup = sysDatabase.products.find(p => p.id === id);
    if (!pLookup) return;

    const existing = activeCart.find(item => item.id === id);
    if (existing) {
        existing.qty++;
    } else {
        activeCart.push({ ...pLookup, qty: 1 });
    }
    renderCartUI();
}

function changeCartQty(id, delta) {
    const item = activeCart.find(i => i.id === id);
    if (!item) return;

    item.qty += delta;
    if (item.qty <= 0) {
        activeCart = activeCart.filter(i => i.id !== id);
    }
    renderCartUI();
}

function renderCartUI() {
    const wrapper = document.getElementById('cart-items-wrapper');
    if (!wrapper) return;
    wrapper.innerHTML = '';

    if (activeCart.length === 0) {
        wrapper.innerHTML = '<div style="text-align:center; color:#999; padding:20px; font-size:12px; font-style:italic;">Keranjang belanja kosong</div>';
        recalculateCartTotals();
        return;
    }

    activeCart.forEach(item => {
        const totalHargaItem = item.price * item.qty;
        wrapper.innerHTML += `
            <div class="cart-item-row">
                <div style="width: 40%; font-size:12px; font-weight:bold; color:var(--pakchill-green-dark);">${item.name}</div>
                <div style="width: 35%; display:flex; justify-content:center; align-items:center; gap:6px;">
                    <button onclick="changeCartQty('${item.id}', -1)" style="width:24px; height:24px; padding:0; margin:0; border-radius:5px; background:#ff3b30; color:white; font-weight:bold; border:none; cursor:pointer;">-</button>
                    <span style="font-size:13px; font-weight:bold; min-width:18px; text-align:center;">${item.qty}</span>
                    <button onclick="changeCartQty('${item.id}', 1)" style="width:24px; height:24px; padding:0; margin:0; border-radius:5px; background:#34c759; color:white; font-weight:bold; border:none; cursor:pointer;">+</button>
                </div>
                <div style="width: 25%; text-align:right; font-size:12px; font-weight:bold;">Rp ${totalHargaItem.toLocaleString('id-ID')}</div>
            </div>
        `;
    });

    recalculateCartTotals();
}

/* ==========================================================================
   4. DYNAMIC VOUCHER FAST INTEGRATION & CALCULATION ENGINE
   ========================================================================== */
function renderVoucherSakuKasir() {
    const target = document.getElementById('vouchers-render-target');
    if (!target) return;
    target.innerHTML = '';
    
    if (sysDatabase.vouchers.length === 0) {
        target.innerHTML = '<span style="font-size:11px; color:#999; font-style:italic;">Tidak ada kupon/voucher aktif.</span>';
        return;
    }
    
    sysDatabase.vouchers.forEach(vch => {
        let badgeColor = vch.type === 'Diskon' ? '#007aff' : '#5856d6';
        target.innerHTML += `
            <button onclick="applyVoucherToInput('${vch.code}', '${vch.type}')" type="button" style="width:auto; margin:0; padding:5px 10px; font-size:11px; background:${badgeColor}; color:white; border:none; border-radius:8px; font-weight:bold; cursor:pointer; box-shadow: 0 2px 6px rgba(0,0,0,0.08);">
                % ${vch.code} (-Rp ${vch.nominal.toLocaleString('id-ID')})
            </button>
        `;
    });
}

function applyVoucherToInput(code, type) {
    if (type === 'Diskon') {
        const inputDiskon = document.getElementById('kasir-input-diskon');
        if (inputDiskon) inputDiskon.value = code;
    } else if (type === 'Voucher') {
        const inputVoucher = document.getElementById('kasir-input-voucher');
        if (inputVoucher) inputVoucher.value = code;
    }
    recalculateCartTotals();
}

function recalculateCartTotals() {
    let subtotal = 0;
    activeCart.forEach(item => { subtotal += item.price * item.qty; });

    document.getElementById('txt-subtotal-val').innerText = `Rp ${subtotal.toLocaleString('id-ID')}`;

    // Perhitungan Diskon
    const diskonRaw = document.getElementById('kasir-input-diskon')?.value.trim().toUpperCase() || '0';
    let nilaiDiskon = 0;
    if (!isNaN(diskonRaw)) {
        nilaiDiskon = parseInt(diskonRaw) || 0;
    } else {
        const vchMatch = sysDatabase.vouchers.find(v => v.code === diskonRaw && v.type === 'Diskon');
        if (vchMatch) nilaiDiskon = vchMatch.nominal;
    }

    // Perhitungan Voucher
    const voucherRaw = document.getElementById('kasir-input-voucher')?.value.trim().toUpperCase() || '0';
    let nilaiVoucher = 0;
    if (!isNaN(voucherRaw)) {
        nilaiVoucher = parseInt(voucherRaw) || 0;
    } else {
        const vchMatch = sysDatabase.vouchers.find(v => v.code === voucherRaw && v.type === 'Voucher');
        if (vchMatch) nilaiVoucher = vchMatch.nominal;
    }

    let grandTotal = subtotal - nilaiDiskon - nilaiVoucher;
    if (grandTotal < 0) grandTotal = 0;

    document.getElementById('txt-grand-total-display').innerText = `Rp ${grandTotal.toLocaleString('id-ID')}`;
    calculateCashReturn();
}

/* ==========================================================================
   5. MEMBERSHIP & DYNAMIC PAYMENT PROCESSING
   ========================================================================== */
function executeLiveSearchMember() {
    const rawQuery = document.getElementById('kasir-search-member').value.trim().toLowerCase();
    const box = document.getElementById('kasir-member-status-box');
    
    if (!rawQuery) {
        activeMemberObj = null;
        box.innerText = '';
        return;
    }

    const match = sysDatabase.members.find(m => m.name.toLowerCase().includes(rawQuery) || m.phone.includes(rawQuery));
    if (match) {
        activeMemberObj = match;
        box.innerHTML = `<span style="color:#34c759; font-size:11px; font-weight:bold;">✔ Member Terverifikasi: ${match.name} (Poin: ${match.points})</span>`;
    } else {
        activeMemberObj = null;
        box.innerHTML = `<span style="color:#ff3b30; font-size:11px; font-weight:bold;">❌ Member Tidak Ditemukan</span>`;
    }
}

function registerFastMemberFromKasir() {
    const name = document.getElementById('kasir-fast-name').value.trim();
    const phone = document.getElementById('kasir-fast-wa').value.trim();

    if (!name || !phone) return alert('Lengkapi data registrasi member baru!');

    const isDuplicate = sysDatabase.members.some(m => m.phone === phone);
    if (isDuplicate) return alert('Nomor WhatsApp sudah terdaftar sebagai member!');

    const newM = { id: 'M' + (sysDatabase.members.length + 1), name, phone, points: 10 };
    sysDatabase.members.push(newM);
    saveToStorage();

    document.getElementById('kasir-fast-name').value = '';
    document.getElementById('kasir-fast-wa').value = '';
    document.getElementById('kasir-search-member').value = phone;
    
    executeLiveSearchMember();
    if (activeRole === 'owner') renderOwnerDashboardMetrics();
    alert(`Sukses Mendaftarkan Member Resmi: ${name}!`);
}

function handlePaymentDropdownBranching() {
    const method = document.getElementById('kasir-select-paymethod').value;
    document.getElementById('wrapper-sub-cash').style.display = method === 'Cash' ? 'block' : 'none';
    document.getElementById('wrapper-sub-qris').style.display = method === 'QRIS' ? 'block' : 'none';
    document.getElementById('wrapper-sub-transfer').style.display = method === 'Transfer' ? 'block' : 'none';
}

function calculateCashReturn() {
    const gtText = document.getElementById('txt-grand-total-display').innerText.replace(/[^0-9]/g, '');
    const grandTotal = parseInt(gtText) || 0;
    const cashInput = parseInt(document.getElementById('kasir-cash-input-uang').value) || 0;
    
    const returnBox = document.getElementById('cash-return-info');
    if (!returnBox) return;

    if (cashInput < grandTotal) {
        returnBox.innerText = `Uang Kurang: Rp ${(grandTotal - cashInput).toLocaleString('id-ID')}`;
        returnBox.style.color = '#ff3b30';
    } else {
        returnBox.innerText = `Kembalian: Rp ${(cashInput - grandTotal).toLocaleString('id-ID')}`;
        returnBox.style.color = '#ff9500';
    }
}

/* ==========================================================================
   6. TRANSACTION COMPLETION & THERMAL RECEIPT GENERATOR
   ========================================================================== */
function finalizeTransactionReceipt(printType) {
    if (activeCart.length === 0) return alert('Keranjang belanja masih kosong!');

    const subtotal = parseInt(document.getElementById('txt-subtotal-val').innerText.replace(/[^0-9]/g, '')) || 0;
    const grandTotal = parseInt(document.getElementById('txt-grand-total-display').innerText.replace(/[^0-9]/g, '')) || 0;
    const payMethod = document.getElementById('kasir-select-paymethod').value;
    const serviceType = document.querySelector('input[name="service_type"]:checked').value;

    let payDetails = payMethod;
    if (payMethod === 'Cash') {
        const inputCash = parseInt(document.getElementById('kasir-cash-input-uang').value) || 0;
        if (inputCash < grandTotal) return alert('Pembayaran tunai belum mencukupi nominal tagihan!');
        payDetails += ` (Tunai: Rp ${inputCash.toLocaleString('id-ID')})`;
    } else if (payMethod === 'QRIS') {
        payDetails += ` (${document.getElementById('sub-vendor-qris').value})`;
    } else if (payMethod === 'Transfer') {
        payDetails += ` (${document.getElementById('sub-target-transfer').value})`;
    }

    // Tambah Poin Member jika terdaftar
    if (activeMemberObj) {
        const matchedMember = sysDatabase.members.find(m => m.id === activeMemberObj.id);
        if (matchedMember) {
            const addedPoints = Math.floor(grandTotal / 10000);
            matchedMember.points += addedPoints;
        }
    }

    // Rekam Invoice Transaksi Ke Database
    const trxId = 'TRX-' + Date.now();
    const newTrx = {
        orderSeq: sysDatabase.currentOrderSeq,
        id: trxId,
        date: new Date().toISOString(),
        customer: activeMemberObj ? activeMemberObj.name : 'Umum (Non-Member)',
        serviceType: serviceType,
        items: JSON.parse(JSON.stringify(activeCart)),
        subtotal: subtotal,
        grandTotal: grandTotal,
        paymentMethod: payDetails,
        status: 'SUKSES'
    };

    sysDatabase.transactions.push(newTrx);
    sysDatabase.currentOrderSeq++;
    saveToStorage();

    // CETAK THERMAL PRINTER MANAGEMENT
    if (printType === 'Print') {
        let itemsHtml = '';
        activeCart.forEach(i => {
            itemsHtml += `
                <div style="display:flex; justify-content:space-between; font-size:11px;">
                    <span>${i.name} x${i.qty}</span>
                    <span>Rp ${(i.price * i.qty).toLocaleString('id-ID')}</span>
                </div>`;
        });

        const receiptArea = document.getElementById('thermal-receipt-output');
        receiptArea.innerHTML = `
            <div style="font-family:monospace; width:58mm; padding:5px; background:white; color:black;">
                <div style="text-align:center; font-weight:bold; font-size:14px;">PAKCHILL JUICE</div>
                <div style="text-align:center; font-size:10px; margin-bottom:5px;">Healthy Beverages Hub</div>
                <hr style="border:0; border-top:1px dashed black; margin:4px 0;">
                <div style="font-size:10px;">
                    Order #: ${newTrx.orderSeq}<br>
                    ID: ${newTrx.id}<br>
                    Waktu: ${new Date(newTrx.date).toLocaleString('id-ID')}<br>
                    Tipe: ${newTrx.serviceType}<br>
                    Pelanggan: ${newTrx.customer}
                </div>
                <hr style="border:0; border-top:1px dashed black; margin:4px 0;">
                ${itemsHtml}
                <hr style="border:0; border-top:1px dashed black; margin:4px 0;">
                <div style="display:flex; justify-content:space-between; font-size:11px;"><span>Subtotal:</span><span>Rp ${subtotal.toLocaleString('id-ID')}</span></div>
                <div style="display:flex; justify-content:space-between; font-size:11px; font-weight:bold;"><span>GRAND TOTAL:</span><span>Rp ${grandTotal.toLocaleString('id-ID')}</span></div>
                <hr style="border:0; border-top:1px dashed black; margin:4px 0;">
                <div style="font-size:10px;">Metode: ${payDetails}</div>
                <div style="text-align:center; font-size:10px; margin-top:10px; font-weight:bold;">Terima Kasih Atas Kunjungan Anda!</div>
            </div>
        `;
        window.print();
    } else {
        alert(`Transaksi Berhasil Ditransfer Berbentuk Email Digital/Notifikasi Ke Pelanggan! ID: ${trxId}`);
    }

    // Reset State Kasir Ke Kondisi Semula
    activeCart = [];
    activeMemberObj = null;
    document.getElementById('kasir-search-member').value = '';
    document.getElementById('kasir-member-status-box').innerText = '';
    if (document.getElementById('kasir-cash-input-uang')) document.getElementById('kasir-cash-input-uang').value = '';
    if (document.getElementById('kasir-input-diskon')) document.getElementById('kasir-input-diskon').value = '0';
    if (document.getElementById('kasir-input-voucher')) document.getElementById('kasir-input-voucher').value = '0';
    
    document.getElementById('cash-return-info').innerText = 'Kembalian: Rp 0';
    document.getElementById('txt-live-order-number').innerText = `Order #: ${sysDatabase.currentOrderSeq}`;

    renderCartUI();
    calculateLiveClosingDashboard();
    if (activeRole === 'owner') renderOwnerDashboardMetrics();
}

/* ==========================================================================
   7. LIVE CLOSING MONITOR DASHBOARD (SHIFT 24h)
   ========================================================================== */
function calculateLiveClosingDashboard() {
    const listTarget = document.getElementById('closing-menu-list-render');
    if (!listTarget) return;

    const targetTimeRange = Date.now() - (24 * 60 * 60 * 1000); // 24 Jam Terakhir
    const liveTrx = sysDatabase.transactions.filter(t => new Date(t.date).getTime() >= targetTimeRange && t.status === 'SUKSES');

    let totalOmzet = 0;
    let totalQty = 0;
    let menuMap = {};

    liveTrx.forEach(t => {
        totalOmzet += t.grandTotal;
        t.items.forEach(item => {
            totalQty += item.qty;
            menuMap[item.name] = (menuMap[item.name] || 0) + item.qty;
        });
    });

    document.getElementById('txt-closing-total-omzet').innerText = `Rp ${totalOmzet.toLocaleString('id-ID')}`;
    document.getElementById('txt-closing-total-qty').innerText = `${totalQty} Item`;

    listTarget.innerHTML = '';
    const sortedMenus = Object.entries(menuMap);
    if (sortedMenus.length === 0) {
        listTarget.innerHTML = '<span style="color:#999; font-style:italic;">Belum ada menu terjual dalam 24 jam terakhir.</span>';
        return;
    }

    sortedMenus.forEach(([name, qty]) => {
        listTarget.innerHTML += `<div style="display:flex; justify-content:space-between;"><span>• ${name}</span><span style="font-weight:bold;">${qty}x</span></div>`;
    });
}

function exportKasirReportExcel() {
    const targetTimeRange = Date.now() - (24 * 60 * 60 * 1000);
    const dataRow = sysDatabase.transactions
        .filter(t => new Date(t.date).getTime() >= targetTimeRange)
        .map(t => ({
            "Order #": t.orderSeq,
            "ID Transaksi": t.id,
            "Waktu": new Date(t.date).toLocaleString('id-ID'),
            "Pelanggan": t.customer,
            "Layanan": t.serviceType,
            "Total Bayar": t.grandTotal,
            "Metode": t.paymentMethod,
            "Status": t.status
        }));

    const ws = XLSX.utils.json_to_sheet(dataRow);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Closing Shift Kasir");
    XLSX.writeFile(wb, "Laporan_Closing_Kasir_Pakchill.xlsx");
}

function exportKasirReportPDF() {
    const area = document.getElementById('closing-report-pdf-area');
    html2pdf().from(area).save('Laporan_Closing_Kasir_Pakchill.pdf');
}

/* ==========================================================================
   8. OWNER DASHBOARD STRATEGIC CONTROLS & MANAGEMENT METRICS
   ========================================================================== */
function renderOwnerDashboardMetrics() {
    renderHistoryTable();
    renderOwnerMembersTable();
    renderOwnerRekeningTable();

    const trxs = sysDatabase.transactions.filter(t => t.status === 'SUKSES');
    const now = new Date();

    let omzetHari = 0, omzetMinggu = 0, omzetBulan = 0, omzetTahun = 0;
    let bulananMap = Array(12).fill(0);

    trxs.forEach(t => {
        const tDate = new Date(t.date);
        const diffDays = (now - tDate) / (1000 * 60 * 60 * 24);

        if (tDate.toDateString() === now.toDateString()) omzetHari += t.grandTotal;
        if (diffDays <= 7) omzetMinggu += t.grandTotal;
        if (tDate.getMonth() === now.getMonth() && tDate.getFullYear() === now.getFullYear()) omzetBulan += t.grandTotal;
        if (tDate.getFullYear() === now.getFullYear()) omzetTahun += t.grandTotal;

        if (tDate.getFullYear() === now.getFullYear()) {
            bulananMap[tDate.getMonth()] += t.grandTotal;
        }
    });

    document.getElementById('own-rekap-hari').innerText = `Rp ${omzetHari.toLocaleString('id-ID')}`;
    document.getElementById('own-rekap-minggu').innerText = `Rp ${omzetMinggu.toLocaleString('id-ID')}`;
    document.getElementById('own-rekap-bulan').innerText = `Rp ${omzetBulan.toLocaleString('id-ID')}`;
    document.getElementById('own-rekap-tahun').innerText = `Rp ${omzetTahun.toLocaleString('id-ID')}`;

    // Grafik Chart.js
    const ctx = document.getElementById('canvasTrenOwner');
    if (!ctx) return;

    if (chartInstance) chartInstance.destroy();
    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'],
            datasets: [{
                label: 'Omzet Bulanan Pakchill (Rp)',
                data: bulananMap,
                borderColor: '#2d5a27',
                backgroundColor: 'rgba(45, 90, 39, 0.1)',
                borderWidth: 3,
                tension: 0.3,
                fill: true
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

function saveNewMenuFromOwner() {
    const name = document.getElementById('own-add-menu-name').value.trim().toUpperCase();
    const price = parseInt(document.getElementById('own-add-menu-price').value) || 0;

    if (!name || price <= 0) return alert('Data input menu tidak valid!');
    sysDatabase.products.push({ id: 'P' + (Date.now()), name, price, isBundle: false });
    saveToStorage();

    document.getElementById('own-add-menu-name').value = '';
    document.getElementById('own-add-menu-price').value = '';
    renderKatalogKasir();
    alert('Menu baru sukses ditambahkan ke katalog!');
}

function saveNewBundleFromOwner() {
    const name = document.getElementById('own-add-bundle-name').value.trim().toUpperCase();
    const price = parseInt(document.getElementById('own-add-bundle-price').value) || 0;

    if (!name || price <= 0) return alert('Data input bundling tidak valid!');
    sysDatabase.products.push({ id: 'B' + (Date.now()), name, price, isBundle: true });
    saveToStorage();

    document.getElementById('own-add-bundle-name').value = '';
    document.getElementById('own-add-bundle-price').value = '';
    renderKatalogKasir();
    alert('Paket bundling hemat baru diaktifkan!');
}

function saveNewVoucherFromOwner() {
    const code = document.getElementById('own-vch-code').value.trim().toUpperCase();
    const nominal = parseInt(document.getElementById('own-vch-nominal').value) || 0;
    const type = document.getElementById('own-vch-type').value;

    if (!code || nominal <= 0) return alert('Data pengisian kupon promosi salah!');
    sysDatabase.vouchers.push({ code, nominal, type });
    saveToStorage();

    document.getElementById('own-vch-code').value = '';
    document.getElementById('own-vch-nominal').value = '';
    
    renderVoucherSakuKasir();
    alert('Aturan Diskon / Voucher baru sukses terdaftar!');
}

/* ==========================================================================
   9. DATABASES CRUD OPERATIONS (MEMBER & PAYMENT GATEWAY REKENING)
   ========================================================================== */
function renderOwnerMembersTable() {
    const tbody = document.getElementById('render-owner-members-target');
    if (!tbody) return;
    tbody.innerHTML = '';

    sysDatabase.members.forEach((m, idx) => {
        tbody.innerHTML += `
            <tr>
                <td><b>${m.name}</b></td>
                <td>${m.phone}</td>
                <td><span style="background:#e4f0e2; padding:3px 8px; border-radius:6px; font-weight:bold;">${m.points} Pts</span></td>
                <td>
                    <button onclick="deleteMemberRow(${idx})" style="width:auto; margin:0; padding:4px 10px; background:#ff3b30; color:white; border:none; border-radius:6px; font-size:11px; cursor:pointer;">Hapus</button>
                </td>
            </tr>
        `;
    });
}

function deleteMemberRow(idx) {
    if (!confirm('Yakin ingin menghapus data member ini secara permanen?')) return;
    sysDatabase.members.splice(idx, 1);
    saveToStorage();
    renderOwnerMembersTable();
}

function renderOwnerRekeningTable() {
    const tbody = document.getElementById('render-owner-rekening-target');
    if (!tbody) return;
    tbody.innerHTML = '';

    sysDatabase.rekening.forEach((r, idx) => {
        tbody.innerHTML += `
            <tr>
                <td><span style="background:#007aff; color:white; font-weight:bold; padding:2px 8px; border-radius:6px; font-size:11px;">${r.bank}</span></td>
                <td><b>${r.number}</b></td>
                <td>${r.name}</td>
                <td>
                    <button onclick="editRekeningForm(${idx})" style="width:auto; margin:0; padding:4px 10px; background:#ff9500; color:white; border:none; border-radius:6px; font-size:11px; cursor:pointer;">Edit</button>
                    <button onclick="deleteRekeningRow(${idx})" style="width:auto; margin:0; padding:4px 10px; background:#ff3b30; color:white; border:none; border-radius:6px; font-size:11px; cursor:pointer;">Hapus</button>
                </td>
            </tr>
        `;
    });
}

function syncRekeningDropdownOptions() {
    const select = document.getElementById('sub-target-transfer');
    if (!select) return;
    select.innerHTML = '';

    if (sysDatabase.rekening.length === 0) {
        select.innerHTML = '<option value="">Tidak ada pilihan akun rekening</option>';
        document.getElementById('live-rekening-info-box').innerText = '';
        return;
    }

    sysDatabase.rekening.forEach(r => {
        select.innerHTML += `<option value="${r.bank} - ${r.number}">${r.bank} (${r.name})</option>`;
    });
    updateLiveRekeningInfo();
}

function updateLiveRekeningInfo() {
    const select = document.getElementById('sub-target-transfer');
    const infoBox = document.getElementById('live-rekening-info-box');
    if (select && infoBox) {
        infoBox.innerText = `Tujuan Transfer Kasir: ${select.value}`;
    }
}

function saveRekeningFormSubmit() {
    const indexStr = document.getElementById('form-rek-id-index').value;
    const bank = document.getElementById('form-rek-bank').value.trim().toUpperCase();
    const number = document.getElementById('form-rek-nomor').value.trim();
    const name = document.getElementById('form-rek-nama').value.trim().toUpperCase();

    if (!bank || !number || !name) return alert('Isi semua kolom form akun rekening!');

    if (indexStr === '') {
        // Tambah Baru
        sysDatabase.rekening.push({ id: 'R' + Date.now(), bank, number, name });
    } else {
        // Edit yang sudah ada
        const idx = parseInt(indexStr);
        sysDatabase.rekening[idx].bank = bank;
        sysDatabase.rekening[idx].number = number;
        sysDatabase.rekening[idx].name = name;
    }

    saveToStorage();
    clearRekeningForm();
    renderOwnerRekeningTable();
    syncRekeningDropdownOptions();
    alert('Informasi manajemen akun rekening sukses diperbarui!');
}

function editRekeningForm(idx) {
    const item = sysDatabase.rekening[idx];
    document.getElementById('title-crud-rekening').innerText = '✍ Edit Informasi Akun Rekening';
    document.getElementById('form-rek-id-index').value = idx;
    document.getElementById('form-rek-bank').value = item.bank;
    document.getElementById('form-rek-nomor').value = item.number;
    document.getElementById('form-rek-nama').value = item.name;
}

function deleteRekeningRow(idx) {
    if (!confirm('Yakin ingin menghapus akun rekening ini?')) return;
    sysDatabase.rekening.splice(idx, 1);
    saveToStorage();
    renderOwnerRekeningTable();
    syncRekeningDropdownOptions();
}

function clearRekeningForm() {
    document.getElementById('title-crud-rekening').innerText = '+ Tambah Akun Rekening Baru';
    document.getElementById('form-rek-id-index').value = '';
    document.getElementById('form-rek-bank').value = '';
    document.getElementById('form-rek-nomor').value = '';
    document.getElementById('form-rek-nama').value = '';
}

/* ==========================================================================
   10. AUDIT SYSTEM LOG & VOID REVERSAL CONTROLS
   ========================================================================== */
function renderHistoryTable() {
    const tbody = document.getElementById('render-owner-transactions-target');
    if (!tbody) return;
    tbody.innerHTML = '';

    const filterMonth = document.getElementById('own-filter-month-select').value;

    sysDatabase.transactions.forEach((t, index) => {
        const trxMonth = new Date(t.date).getMonth().toString();
        if (filterMonth !== 'all' && trxMonth !== filterMonth) return;

        let actionBtn = '';
        if (t.status === 'SUKSES') {
            actionBtn = `<button onclick="executeVoidTransaction(${index})" style="width:auto; margin:0; padding:4px 10px; background:#ff3b30; color:white; border:none; border-radius:6px; font-size:11px; font-weight:bold; cursor:pointer;">VOID</button>`;
        } else {
            actionBtn = `<span style="color:#8e8e93; font-style:italic; font-size:11px;">Batal Teraudit</span>`;
        }

        const statusStyle = t.status === 'SUKSES' ? 'color:#34c759; font-weight:bold;' : 'color:#ff3b30; font-weight:bold; text-decoration:line-through;';

        tbody.innerHTML += `
            <tr>
                <td><b>${t.orderSeq}</b></td>
                <td style="font-size:11px; font-family:monospace;">${t.id}</td>
                <td style="font-size:11px;">${new Date(t.date).toLocaleString('id-ID')}</td>
                <td>${t.customer}</td>
                <td><small>${t.serviceType}</small></td>
                <td><b>Rp ${t.grandTotal.toLocaleString('id-ID')}</b></td>
                <td><small>${t.paymentMethod}</small></td>
                <td><span style="${statusStyle}">${t.status}</span></td>
                <td>${actionBtn}</td>
            </tr>
        `;
    });
}

function executeVoidTransaction(index) {
    if (!confirm('PERINGATAN AUDIT: Apakah Anda yakin ingin membatalkan (VOID) transaksi ini? Omzet akan dikurangi dan poin member yang didapat akan hangus.')) return;
    
    sysDatabase.transactions[index].status = 'VOID';
    saveToStorage();
    
    renderOwnerDashboardMetrics();
    calculateLiveClosingDashboard();
    alert('Audit Log: Transaksi sukses di-VOID (Dibatalkan) dari pembukuan!');
}

function exportOwnerReportExcel() {
    const dataRow = sysDatabase.transactions.map(t => ({
        "Order #": t.orderSeq,
        "ID Invoice": t.id,
        "Waktu Transaksi": new Date(t.date).toLocaleString('id-ID'),
        "Pelanggan": t.customer,
        "Tipe Layanan": t.serviceType,
        "Subtotal": t.subtotal,
        "Grand Total (Net)": t.grandTotal,
        "Metode Pembayaran": t.paymentMethod,
        "Status Validasi": t.status
    }));

    const ws = XLSX.utils.json_to_sheet(dataRow);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Laporan Keuangan Global");
    XLSX.writeFile(wb, "Laporan_Eksekutif_Owner_Pakchill.xlsx");
}

function exportOwnerReportPDF() {
    const area = document.getElementById('owner-report-pdf-area');
    html2pdf().from(area).save('Laporan_Tren_Owner_Pakchill.pdf');
}
