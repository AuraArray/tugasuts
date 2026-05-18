// ==========================================================================
// 1. ENGINE DATABASE CORE (LOCALSTORAGE RECONCILIATION)
// ==========================================================================
let sysDatabase = JSON.parse(localStorage.getItem('pakchill_enterprise_db_v5.2')) || {
    menu: [
        { id: 'm1', name: 'PACHOY', price: 15000 },
        { id: 'm2', name: 'NANAS', price: 12000 }
    ],
    bundles: [],
    vouchers: [
        { code: 'PAKCHILLSEHAT', nominal: 5000, type: 'Voucher' }
    ],
    rekening: [
        { bank: 'BCA', nomor: '8410923121 a/n PT PAKCHILL' },
        { bank: 'GoPay', nomor: '081234567890 a/n PAKCHILL INDO' }
    ],
    members: [
        { name: 'APRIL', wa: '0812', poin: 10 }
    ],
    transactions: [],
    lastOrderDate: new Date().toDateString(),
    currentOrderSeq: 101
};

// Auto Reset Nomor Orderan jika mendeteksi Hari Berganti
const todayStr = new Date().toDateString();
if (sysDatabase.lastOrderDate !== todayStr) {
    sysDatabase.currentOrderSeq = 101;
    sysDatabase.lastOrderDate = todayStr;
    localStorage.setItem('pakchill_enterprise_db_v5.2', JSON.stringify(sysDatabase));
}

let activeRole = null;
let activeCart = [];
let activeMemberObj = null;
let chartInstanceGlobal = null;

function saveToStorage() {
    localStorage.setItem('pakchill_enterprise_db_v5.2', JSON.stringify(sysDatabase));
}

// ==========================================================================
// 2. OTENTIKASI SISTEM (KASIR: 123 | OWNER: 000)
// ==========================================================================
function executeAuthentication() {
    const pinInput = document.getElementById('sys-pin-access');
    if (!pinInput) return;
    const pin = pinInput.value.trim();
    
    if (pin === '123') {
        activeRole = 'kasir';
        if(document.getElementById('txt-nav-role-label')) document.getElementById('txt-nav-role-label').innerText = 'STAFF KASIR';
        if(document.getElementById('badge-status-role')) {
            document.getElementById('badge-status-role').innerText = 'Staff Kasir';
            document.getElementById('badge-status-role').style.background = '#2d5a27';
        }
        if(document.getElementById('view-segment-kasir')) document.getElementById('view-segment-kasir').style.display = 'grid';
        if(document.getElementById('view-segment-owner')) document.getElementById('view-segment-owner').style.display = 'none';
        unlockInterface();
    } else if (pin === '000') {
        activeRole = 'owner';
        if(document.getElementById('txt-nav-role-label')) document.getElementById('txt-nav-role-label').innerText = 'OWNER HUB';
        if(document.getElementById('badge-status-role')) {
            document.getElementById('badge-status-role').innerText = 'Owner Control';
            document.getElementById('badge-status-role').style.background = '#5856d6';
        }
        if(document.getElementById('view-segment-kasir')) document.getElementById('view-segment-kasir').style.display = 'grid';
        if(document.getElementById('view-segment-owner')) document.getElementById('view-segment-owner').style.display = 'block';
        unlockInterface();
        renderOwnerDashboardMetrics();
    } else {
        alert('PIN Otentikasi Salah! Akses Sistem Terkunci.');
    }
}

function unlockInterface() {
    if(document.getElementById('login-screen-overlay')) document.getElementById('login-screen-overlay').style.display = 'none';
    if(document.getElementById('main-app-layer')) document.getElementById('main-app-layer').style.display = 'block';
    if(document.getElementById('sys-pin-access')) document.getElementById('sys-pin-access').value = '';
    if(document.getElementById('txt-live-order-number')) document.getElementById('txt-live-order-number').innerText = `Order #: ${sysDatabase.currentOrderSeq}`;
    
    // Sinkronisasi data awal dropdown target transfer bank dari owner
    const subTargetTransfer = document.getElementById('sub-target-transfer');
    if(subTargetTransfer) {
        subTargetTransfer.innerHTML = '';
        sysDatabase.rekening.forEach(rek => {
            subTargetTransfer.innerHTML += `<option value="${rek.bank}">${rek.bank}</option>`;
        });
    }

    try { renderKatalogKasir(); } catch(e) { console.error(e); }
    try { renderCartUI(); } catch(e) { console.error(e); }
    try { renderHistoryTable(); } catch(e) { console.error(e); }
    try { renderMemberTable(); } catch(e) { console.error(e); }
    try { calculateLiveClosingDashboard(); } catch(e) { console.error(e); }
}

function triggerSystemLogout() {
    activeRole = null;
    activeCart = [];
    activeMemberObj = null;
    if(document.getElementById('main-app-layer')) document.getElementById('main-app-layer').style.display = 'none';
    if(document.getElementById('login-screen-overlay')) document.getElementById('login-screen-overlay').style.display = 'flex';
}

// ==========================================================================
// 3. ENGINE UTAMA KATALOG & OPERASIONAL KASIR
// ==========================================================================
function renderKatalogKasir() {
    const target = document.getElementById('katalog-render-target');
    if (!target) return;
    target.innerHTML = '';
    
    sysDatabase.menu.forEach(item => {
        target.innerHTML += `
            <div class="product-item-card" onclick="pushItemToCart('${item.name}', ${item.price})">
                <div style="font-weight:900; font-size:15px; color:var(--pakchill-green-dark);">${item.name}</div>
                <div style="color:var(--pakchill-green-soft); font-weight:700; margin-top:5px;">Rp ${item.price.toLocaleString('id-ID')}</div>
            </div>
        `;
    });
    
    sysDatabase.bundles.forEach(bundle => {
        target.innerHTML += `
            <div class="product-item-card" onclick="pushItemToCart('${bundle.name}', ${bundle.price})">
                <span class="badge-bundling-tag">Paket</span>
                <div style="font-weight:900; font-size:14px; color:#ff9500; margin-top:10px;">${bundle.name}</div>
                <div style="color:var(--pakchill-green-soft); font-weight:700; margin-top:5px;">Rp ${bundle.price.toLocaleString('id-ID')}</div>
            </div>
        `;
    });
}

function pushItemToCart(name, price) {
    activeCart.push({ name, price, uid: Date.now() + Math.random() });
    renderCartUI();
}

function removeItemFromCart(uid) {
    activeCart = activeCart.filter(item => item.uid !== uid);
    renderCartUI();
}

function renderCartUI() {
    const container = document.getElementById('cart-items-wrapper');
    if (!container) return;
    container.innerHTML = '';
    
    if (activeCart.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:#999; font-size:13px; padding:20px;">Keranjang belanja kosong.</p>';
        if(document.getElementById('txt-subtotal-val')) document.getElementById('txt-subtotal-val').innerText = 'Rp 0';
        if(document.getElementById('txt-grand-total-display')) document.getElementById('txt-grand-total-display').innerText = 'Rp 0';
        return;
    }
    
    activeCart.forEach(item => {
        container.innerHTML += `
            <div class="cart-item-row">
                <div style="width: 45%; font-weight:bold; font-size:13px;">${item.name}</div>
                <div style="width: 35%; text-align: right; font-size:13px; color:#333;">Rp ${item.price.toLocaleString('id-ID')}</div>
                <div style="width: 20%; text-align: right;">
                    <button onclick="removeItemFromCart(${item.uid})" style="width:auto; margin:0; padding:3px 8px; background:#ff3b30; color:white; border:none; border-radius:6px; font-weight:bold; cursor:pointer; font-size:11px;">
                        ✕
                    </button>
                </div>
            </div>
        `;
    });
    recalculateCartTotals();
}

function recalculateCartTotals() {
    let subtotal = activeCart.reduce((sum, item) => sum + item.price, 0);
    if(document.getElementById('txt-subtotal-val')) {
        document.getElementById('txt-subtotal-val').innerText = 'Rp ' + subtotal.toLocaleString('id-ID');
    }
    
    let diskonRaw = document.getElementById('kasir-input-diskon') ? document.getElementById('kasir-input-diskon').value.trim() : '0';
    let voucherRaw = document.getElementById('kasir-input-voucher') ? document.getElementById('kasir-input-voucher').value.trim() : '0';
    
    let nilaiDiskon = 0;
    let nilaiVoucher = 0;
    
    if (diskonRaw !== '' && diskonRaw !== '0') {
        let match = sysDatabase.vouchers.find(v => v.code.toUpperCase() === diskonRaw.toUpperCase() && v.type === 'Diskon');
        if (match) nilaiDiskon = match.nominal;
        else nilaiDiskon = parseInt(diskonRaw) || 0;
    }
    
    if (voucherRaw !== '' && voucherRaw !== '0') {
        let match = sysDatabase.vouchers.find(v => v.code.toUpperCase() === voucherRaw.toUpperCase() && v.type === 'Voucher');
        if (match) nilaiVoucher = match.nominal;
        else nilaiVoucher = parseInt(voucherRaw) || 0;
    }
    
    let grandTotal = subtotal - nilaiDiskon - nilaiVoucher;
    if (grandTotal < 0) grandTotal = 0;
    
    if(document.getElementById('txt-grand-total-display')) {
        document.getElementById('txt-grand-total-display').innerText = 'Rp ' + grandTotal.toLocaleString('id-ID');
    }
    
    return { subtotal, nilaiDiskon, nilaiVoucher, grandTotal };
}

function handlePaymentDropdownBranching() {
    const pm = document.getElementById('kasir-select-paymethod').value;
    document.getElementById('wrapper-sub-cash').style.display = (pm === 'Cash') ? 'block' : 'none';
    document.getElementById('wrapper-sub-qris').style.display = (pm === 'QRIS') ? 'block' : 'none';
    document.getElementById('wrapper-sub-transfer').style.display = (pm === 'Transfer') ? 'block' : 'none';
    if(pm === 'Transfer') updateLiveRekeningInfo();
}

function executeLiveSearchMember() {
    const s = document.getElementById('kasir-search-member').value.toUpperCase().trim();
    const box = document.getElementById('kasir-member-status-box');
    if(!s) { activeMemberObj = null; box.innerText = ''; return; }
    
    let m = sysDatabase.members.find(mem => mem.name.toUpperCase().includes(s) || mem.wa.includes(s));
    if(m) {
        activeMemberObj = m;
        box.innerHTML = `<span style="color:#2d5a27;">✓ Member Terdeteksi: <b>${m.name}</b> (${m.poin} Poin)</span>`;
    } else {
        activeMemberObj = null;
        box.innerHTML = `<span style="color:#ff3b30;">✗ Member Tidak Ditemukan</span>`;
    }
}

function registerFastMemberFromKasir() {
    const name = document.getElementById('kasir-fast-name').value.trim().toUpperCase();
    const wa = document.getElementById('kasir-fast-wa').value.trim();
    if(!name || !wa) return alert('Lengkapi data member baru!');
    
    sysDatabase.members.push({ name, wa, poin: 0 });
    saveToStorage();
    document.getElementById('kasir-search-member').value = name;
    executeLiveSearchMember();
    document.getElementById('kasir-fast-name').value = '';
    document.getElementById('kasir-fast-wa').value = '';
    try { renderMemberTable(); } catch(e){}
    alert('Member Berhasil Didaftarkan!');
}

function updateLiveRekeningInfo() {
    const sel = document.getElementById('sub-target-transfer');
    const box = document.getElementById('live-rekening-info-box');
    if(!sel || !box) return;
    if(sysDatabase.rekening.length === 0) { box.innerText = 'Belum ada rekening diatur owner.'; return; }
    
    let match = sysDatabase.rekening[sel.selectedIndex];
    if(match) box.innerText = `${match.bank}: ${match.nomor}`;
}

function calculateCashReturn() {
    let totals = recalculateCartTotals();
    let cash = parseInt(document.getElementById('kasir-cash-input-uang').value) || 0;
    let kembalian = cash - totals.grandTotal;
    if (kembalian < 0) kembalian = 0;
    document.getElementById('cash-return-info').innerText = `Kembalian: Rp ${kembalian.toLocaleString('id-ID')}`;
}

// ==========================================================================
// 4. ENGINE FINALISASI TRANSAKSI & CETAK NOTA THERMAL 58MM
// ==========================================================================
function finalizeTransactionReceipt(type) {
    if (activeCart.length === 0) return alert('Keranjang belanja kosong!');
    
    let totals = recalculateCartTotals();
    const pm = document.getElementById('kasir-select-paymethod').value;
    
    if (pm === 'Cash') {
        let cashInput = parseInt(document.getElementById('kasir-cash-input-uang').value) || 0;
        if (cashInput < totals.grandTotal) return alert('Uang tunai pembayaran tidak cukup!');
    }
    
    const trxId = 'TRX-' + Date.now().toString().slice(-6) + Math.floor(Math.random() * 10);
    const orderNum = sysDatabase.currentOrderSeq;
    const customerName = activeMemberObj ? activeMemberObj.name : 'UMUM';
    
    // Tambah Poin ke Member jika terdeteksi (1 item = 1 poin)
    if (activeMemberObj) {
        let memberIdx = sysDatabase.members.findIndex(m => m.name === activeMemberObj.name);
        if (memberIdx !== -1) sysDatabase.members[memberIdx].poin += activeCart.length;
    }
    
    // Catat objek transaksi baru
    let newTransaction = {
        id: trxId,
        orderNumber: orderNum,
        timestamp: new Date().toISOString(),
        customer: customerName,
        items: [...activeCart],
        itemCount: activeCart.length,
        subtotal: totals.subtotal,
        discount: totals.nilaiDiskon + totals.nilaiVoucher,
        total: totals.grandTotal,
        payment: pm,
        status: 'Sukses'
    };
    
    sysDatabase.transactions.push(newTransaction);
    sysDatabase.currentOrderSeq++;
    saveToStorage();
    
    // Render Output Nota Thermal 58mm untuk Printer / Kertas Gulung
    let receiptTarget = document.getElementById('thermal-receipt-output');
    if (receiptTarget) {
        let itemsHtml = '';
        activeCart.forEach(it => {
            itemsHtml += `<div>${it.name.padEnd(16)} Rp${it.price.toLocaleString('id-ID').padStart(9)}</div>`;
        });
        
        receiptTarget.innerHTML = `
            <div style="text-align:center; font-family:monospace; font-size:11px;">
                <b>PAKCHILL ENTERPRISE</b><br>
                Healthy Fresh Beverage<br>
                --------------------------------<br>
                No Order: #${orderNum}<br>
                ID Nota : ${trxId}<br>
                Waktu   : ${new Date().toLocaleTimeString('id-ID')}<br>
                Pelanggan: ${customerName}<br>
                --------------------------------<br>
                <div style="text-align:left;">${itemsHtml}</div>
                --------------------------------<br>
                Subtotal: Rp ${totals.subtotal.toLocaleString('id-ID')}<br>
                Potongan: Rp ${(totals.nilaiDiskon + totals.nilaiVoucher).toLocaleString('id-ID')}<br>
                <b>TOTAL   : Rp ${totals.grandTotal.toLocaleString('id-ID')}</b><br>
                Metode  : ${pm}<br>
                --------------------------------<br>
                Terima Kasih Atas Kunjungan Anda<br>
                Stay Healthy, Stay Fresh!<br>
            </div>
        `;
    }
    
    if (type === 'Print') {
        window.print();
    } else if (type === 'Email') {
        alert(`Notifikasi Transaksi ${trxId} Berhasil Dikirim via Simulasi API Node Mailer!`);
    }
    
    // Reset status Aplikasi setelah sukses transaksi
    activeCart = [];
    activeMemberObj = null;
    if(document.getElementById('kasir-search-member')) document.getElementById('kasir-search-member').value = '';
    if(document.getElementById('kasir-member-status-box')) document.getElementById('kasir-member-status-box').innerText = '';
    if(document.getElementById('kasir-cash-input-uang')) document.getElementById('kasir-cash-input-uang').value = '';
    if(document.getElementById('cash-return-info')) document.getElementById('cash-return-info').innerText = 'Kembalian: Rp 0';
    if(document.getElementById('txt-live-order-number')) document.getElementById('txt-live-order-number').innerText = `Order #: ${sysDatabase.currentOrderSeq}`;
    
    renderCartUI();
    calculateLiveClosingDashboard();
    if (activeRole === 'owner') renderOwnerDashboardMetrics();
}

function calculateLiveClosingDashboard() {
    let today = new Date().toDateString();
    let todayTrx = sysDatabase.transactions.filter(t => new Date(t.timestamp).toDateString() === today && t.status === 'Sukses');
    
    let totalOmzet = todayTrx.reduce((sum, t) => sum + t.total, 0);
    let totalQty = todayTrx.reduce((sum, t) => sum + t.itemCount, 0);
    
    if(document.getElementById('txt-closing-total-omzet')) document.getElementById('txt-closing-total-omzet').innerText = 'Rp ' + totalOmzet.toLocaleString('id-ID');
    if(document.getElementById('txt-closing-total-qty')) document.getElementById('txt-closing-total-qty').innerText = totalQty + ' Item';
    
    // Hitung rincian kuantitas per nama item menu
    let menuCountMap = {};
    todayTrx.forEach(t => {
        t.items.forEach(it => {
            menuCountMap[it.name] = (menuCountMap[it.name] || 0) + 1;
        });
    });
    
    let listTarget = document.getElementById('closing-menu-list-render');
    if (listTarget) {
        listTarget.innerHTML = '';
        Object.keys(menuCountMap).forEach(key => {
            listTarget.innerHTML += `
                <div style="display:flex; justify-content:space-between;">
                    <span>• ${key}</span>
                    <span>x${menuCountMap[key]}</span>
                </div>
            `;
        });
        if(Object.keys(menuCountMap).length === 0) listTarget.innerHTML = '<span style="color:#aaa;">Belum ada menu terjual hari ini.</span>';
    }
}

// ==========================================================================
// 5. ENGINE SUB-DASHBOARD MANAGEMENT CONTROL (OWNER HUB)
// ==========================================================================
function saveNewMenuFromOwner() {
    const name = document.getElementById('own-add-menu-name').value.trim().toUpperCase();
    const price = parseInt(document.getElementById('own-add-menu-price').value) || 0;
    if(!name || price <= 0) return alert('Data Menu Tidak Valid!');
    
    sysDatabase.menu.push({ id: 'm' + (sysDatabase.menu.length + 1), name, price });
    saveToStorage();
    document.getElementById('own-add-menu-name').value = '';
    document.getElementById('own-add-menu-price').value = '';
    renderKatalogKasir();
    alert('Menu baru berhasil ditambahkan!');
}

function saveNewBundleFromOwner() {
    const name = document.getElementById('own-add-bundle-name').value.trim().toUpperCase();
    const price = parseInt(document.getElementById('own-add-bundle-price').value) || 0;
    if(!name || price <= 0) return alert('Data Paket Tidak Valid!');
    
    sysDatabase.bundles.push({ id: 'b' + (sysDatabase.bundles.length + 1), name, price });
    saveToStorage();
    document.getElementById('own-add-bundle-name').value = '';
    document.getElementById('own-add-bundle-price').value = '';
    renderKatalogKasir();
    alert('Paket Hemat diaktifkan!');
}

function saveNewVoucherFromOwner() {
    const code = document.getElementById('own-vch-code').value.trim().toUpperCase();
    const nominal = parseInt(document.getElementById('own-vch-nominal').value) || 0;
    const type = document.getElementById('own-vch-type').value;
    if(!code || nominal <= 0) return alert('Data Voucher/Diskon Tidak Valid!');
    
    sysDatabase.vouchers.push({ code, nominal, type });
    saveToStorage();
    document.getElementById('own-vch-code').value = '';
    document.getElementById('own-vch-nominal').value = '';
    alert('Aturan Diskon / Voucher berhasil didaftarkan!');
}

function saveNewRekeningFromOwner() {
    const bank = document.getElementById('own-rek-bankname').value;
    const nomor = document.getElementById('own-rek-number').value.trim();
    if(!nomor) return alert('Masukkan nomor rekening / HP!');
    
    sysDatabase.rekening.push({ bank, nomor });
    saveToStorage();
    document.getElementById('own-rek-number').value = '';
    
    // Perbarui dropdown kasir langsung
    const subTargetTransfer = document.getElementById('sub-target-transfer');
    if(subTargetTransfer) {
        subTargetTransfer.innerHTML = '';
        sysDatabase.rekening.forEach(rek => {
            subTargetTransfer.innerHTML += `<option value="${rek.bank}">${rek.bank}</option>`;
        });
    }
    alert('Data Rekening Transfer Manual berhasil disimpan!');
}

function renderOwnerDashboardMetrics() {
    let now = new Date();
    let oneDay = 24 * 60 * 60 * 1000;
    
    let hariIni = sysDatabase.transactions.filter(t => new Date(t.timestamp).toDateString() === now.toDateString() && t.status === 'Sukses').reduce((s, t) => s + t.total, 0);
    let seminggu = sysDatabase.transactions.filter(t => (now - new Date(t.timestamp)) <= (7 * oneDay) && t.status === 'Sukses').reduce((s, t) => s + t.total, 0);
    let sebulan = sysDatabase.transactions.filter(t => new Date(t.timestamp).getMonth() === now.getMonth() && new Date(t.timestamp).getFullYear() === now.getFullYear() && t.status === 'Sukses').reduce((s, t) => s + t.total, 0);
    let setahun = sysDatabase.transactions.filter(t => new Date(t.timestamp).getFullYear() === now.getFullYear() && t.status === 'Sukses').reduce((s, t) => s + t.total, 0);
    
    if(document.getElementById('own-rekap-hari')) document.getElementById('own-rekap-hari').innerText = 'Rp ' + hariIni.toLocaleString('id-ID');
    if(document.getElementById('own-rekap-minggu')) document.getElementById('own-rekap-minggu').innerText = 'Rp ' + seminggu.toLocaleString('id-ID');
    if(document.getElementById('own-rekap-bulan')) document.getElementById('own-rekap-bulan').innerText = 'Rp ' + sebulan.toLocaleString('id-ID');
    if(document.getElementById('own-rekap-tahun')) document.getElementById('own-rekap-tahun').innerText = 'Rp ' + setahun.toLocaleString('id-ID');
    
    renderHistoryTable();
    renderMemberTable();
    initiateOwnerTrendChart();
}

function renderHistoryTable() {
    const tbody = document.getElementById('own-render-history-rows');
    if(!tbody) return;
    tbody.innerHTML = '';
    
    const filterMonth = document.getElementById('own-filter-month-select').value;
    
    let filteredList = sysDatabase.transactions;
    if(filterMonth !== 'all') {
        filteredList = sysDatabase.transactions.filter(t => new Date(t.timestamp).getMonth().toString() === filterMonth);
    }
    
    filteredList.forEach(t => {
        let styleRow = t.status === 'Void' ? 'style="background:#ffeef0; text-decoration:line-through; color:#999;"' : '';
        let actionButton = t.status === 'Sukses' ? `<button onclick="executeVoidTransaction('${t.id}')" style="background:#ff3b30; color:white; border:none; padding:4px 8px; font-size:11px; border-radius:6px; cursor:pointer; font-weight:bold;">VOID</button>` : '<span style="color:#aaa; font-style:italic;">N/A</span>';
        
        tbody.innerHTML += `
            <tr ${styleRow}>
                <td style="font-weight:bold; color:#ff9500;">#${t.orderNumber || '-'}</td>
                <td>${t.id}</td>
                <td>${new Date(t.timestamp).toLocaleString('id-ID')}</td>
                <td>${t.customer}</td>
                <td style="font-weight:bold;">Rp ${t.total.toLocaleString('id-ID')}</td>
                <td><mark style="background:#f0f0f0; padding:2px 6px; border-radius:4px;\">${t.payment}</mark></td>
                <td style="color:${t.status === 'Sukses' ? '#34c759' : '#ff3b30'}; font-weight:bold;">${t.status}</td>
                <td>${actionButton}</td>
            </tr>
        `;
    });
}

function renderMemberTable() {
    const tbody = document.getElementById('own-render-member-rows');
    if(!tbody) return;
    tbody.innerHTML = '';
    
    sysDatabase.members.forEach((m, idx) => {
        tbody.innerHTML += `
            <tr>
                <td><b>${m.name}</b></td>
                <td>${m.wa}</td>
                <td style="color:#2d5a27; font-weight:bold;">${m.poin} Poin</td>
                <td style="text-align:center;">
                    <button onclick="resetSingleMemberPoin(${idx})" style="background:#ff9500; color:white; border:none; padding:4px 8px; font-size:11px; border-radius:6px; cursor:pointer; font-weight:bold;">Tukar Poin</button>
                </td>
            </tr>
        `;
    });
}

function resetSingleMemberPoin(idx) {
    if(sysDatabase.members[idx]) {
        if(confirm(`Apakah member ${sysDatabase.members[idx].name} ingin menukarkan poinnya (Poin diset kembali ke 0)?`)) {
            sysDatabase.members[idx].poin = 0;
            saveToStorage();
            renderMemberTable();
            alert('Poin Berhasil Ditukarkan!');
        }
    }
}

function executeVoidTransaction(id) {
    if(!confirm(`Apakah Anda yakin ingin melakukan VOID pada transaksi ${id}?`)) return;
    
    let idx = sysDatabase.transactions.findIndex(t => t.id === id);
    if(idx !== -1) {
        let trxObj = sysDatabase.transactions[idx];
        let memberMatch = sysDatabase.members.findIndex(m => m.name === trxObj.customer);
        if(memberMatch !== -1) {
            sysDatabase.members[memberMatch].poin -= trxObj.itemCount;
            if(sysDatabase.members[memberMatch].poin < 0) sysDatabase.members[memberMatch].poin = 0;
        }
        sysDatabase.transactions[idx].total = 0;
        sysDatabase.transactions[idx].status = 'Void';
        saveToStorage();
        renderHistoryTable();
        renderMemberTable();
        renderOwnerDashboardMetrics();
        calculateLiveClosingDashboard();
        alert(`Transaksi ${id} Berhasil Di-VOID (Omzet dinolkan).`);
    }
}

// ==========================================================================
// 6. ENGINE VISUALISASI INTEGRATED CHART.JS GRAFIK TREN
// ==========================================================================
function initiateOwnerTrendChart() {
    const ctx = document.getElementById('canvasTrenOwner');
    if(!ctx) return;
    
    // Hitung akumulasi omzet per bulan sepanjang tahun ini
    let monthlyOmzetData = Array(12).fill(0);
    let currentYear = new Date().getFullYear();
    
    sysDatabase.transactions.forEach(t => {
        let tDate = new Date(t.timestamp);
        if(tDate.getFullYear() === currentYear && t.status === 'Sukses') {
            let month = tDate.getMonth();
            monthlyOmzetData[month] += t.total;
        }
    });
    
    if (chartInstanceGlobal) chartInstanceGlobal.destroy();
    
    chartInstanceGlobal = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'],
            datasets: [{
                label: `Tren Omzet Finansial ${currentYear} (Rp)`,
                data: monthlyOmzetData,
                borderColor: '#1e3f1b',
                backgroundGradientColor: 'rgba(45, 90, 39, 0.1)',
                borderWidth: 3,
                tension: 0.3,
                fill: true,
                backgroundColor: 'rgba(71, 130, 65, 0.1)'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true } }
        }
    });
}

// ==========================================================================
// 7. EXTERNAL SCRIPT LIBRARIES EXPORTER (EXCEL & PDF)
// ==========================================================================
function exportKasirReportExcel() {
    let tableData = [["Kategori Dashboard Closing Kasir (Hari Ini)"], [], ["Indikator", "Nilai Bersih / Kuantitas"]];
    tableData.push(["Total Omzet Penjualan", document.getElementById('txt-closing-total-omzet').innerText]);
    tableData.push(["Total Kuantitas Terjual", document.getElementById('txt-closing-total-qty').innerText]);
    
    let ws = XLSX.utils.aoa_to_sheet(tableData);
    let wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Closing Kasir");
    XLSX.writeFile(wb, `Closing_Kasir_${new Date().toLocaleDateString('id-ID')}.xlsx`);
}

function exportKasirReportPDF() {
    const element = document.getElementById('closing-report-pdf-area');
    if(!element) return;
    let opt = {
        margin: 10, filename: `Closing_Kasir_${new Date().toLocaleDateString('id-ID')}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(element).save();
}

function exportOwnerReportExcel() {
    let wb = XLSX.utils.book_new();
    
    // Lembar 1: Log Transaksi
    let trxRows = [["No Order", "ID Nota", "Waktu", "Pelanggan", "Total Bersih", "Metode", "Status"]];
    sysDatabase.transactions.forEach(t => {
        trxRows.push([t.orderNumber, t.id, new Date(t.timestamp).toLocaleString('id-ID'), t.customer, t.total, t.payment, t.status]);
    });
    let wsTrx = XLSX.utils.aoa_to_sheet(trxRows);
    XLSX.utils.book_append_sheet(wb, wsTrx, "Log Transaksi");
    
    // Lembar 2: Data Member Poin
    let memRows = [["Nama Member", "Nomor WhatsApp", "Total Akumulasi Poin"]];
    sysDatabase.members.forEach(m => {
        memRows.push([m.name, m.wa, m.poin]);
    });
    let wsMem = XLSX.utils.aoa_to_sheet(memRows);
    XLSX.utils.book_append_sheet(wb, wsMem, "Database Member");
    
    XLSX.writeFile(wb, `Laporan_Owner_Pakchill_${new Date().getFullYear()}.xlsx`);
}

function exportOwnerReportPDF() {
    const element = document.getElementById('owner-report-pdf-area');
    if(!element) return;
    let opt = {
        margin: 10, filename: `Laporan_Owner_Pakchill_${Date.now()}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
    };
    html2pdf().set(opt).from(element).save();
}
