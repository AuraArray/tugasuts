/* ==========================================================================
   1. SYSTEM DATABASE STRUCTURE (START FROM CLEAN SLATE)
   ========================================================================== */
const EMPTY_DATABASE = {
    currentOrderSeq: 101,
    products: [],      // Kosong murni, diisi manual oleh Owner
    bundles: [],       // Kosong murni, diisi manual oleh Owner
    vouchers: [],      // Kosong murni, diisi manual oleh Owner
    topings: [],       // Fitur Baru: Kosong murni, diisi manual oleh Owner
    members: [
        { id: "M1", name: "Rizky Tanjung", phone: "085298765432", points: 85 }
    ],
    rekening: [
        { id: "R1", bank: "BANK JAGO", number: "105842982647", name: "APRIL YAMAN ZAI" }
    ],
    transactions: []
};

let sysDatabase = JSON.parse(localStorage.getItem('pakchill_pos_db')) || EMPTY_DATABASE;

// Migrasi jika struktur database lama belum mendukung array topings atau bundles
if (!sysDatabase.topings) sysDatabase.topings = [];
if (!sysDatabase.bundles) sysDatabase.bundles = [];

let activeCart = [];
let selectedTopings = {}; // Format: { cartUid: [topingId1, topingId2] }
let activeMemberObj = null;
let activeRole = 'staff'; 
let chartInstance = null;

function saveToStorage() {
    localStorage.setItem('pakchill_pos_db', JSON.stringify(sysDatabase));
}

/* ==========================================================================
   2. AUTHENTICATION & LAYER INTERFACE ROUTERS
   ========================================================================== */
function executeAuthentication() {
    const pinInput = document.getElementById('sys-pin-access').value.trim();
    const roleLabel = document.getElementById('txt-nav-role-label');
    const badgeRole = document.getElementById('badge-status-role');
    const ownerSection = document.getElementById('view-segment-owner');

    if (pinInput === '1234') {
        activeRole = 'staff';
        if(roleLabel) roleLabel.innerText = 'STAFF MODE';
        if(badgeRole) { badgeRole.innerText = 'Staff'; badgeRole.style.background = '#8e8e93'; }
        if(ownerSection) ownerSection.style.display = 'none';
        unlockInterface();
    } else if (pinInput === '9999') {
        activeRole = 'owner';
        if(roleLabel) roleLabel.innerText = 'OWNER HUB';
        if(badgeRole) { badgeRole.innerText = 'Executive Owner'; badgeRole.style.background = '#1e3f1b'; }
        if(ownerSection) ownerSection.style.display = 'block';
        unlockInterface();
        renderOwnerDashboardMetrics();
    } else {
        alert('PIN Otentikasi Salah! Akses Ditolak.');
    }
}

function unlockInterface() {
    const loginOverlay = document.getElementById('login-screen-overlay');
    const mainLayer = document.getElementById('main-app-layer');
    if(loginOverlay) loginOverlay.style.display = 'none';
    if(mainLayer) mainLayer.style.display = 'block';
    
    document.getElementById('sys-pin-access').value = '';
    document.getElementById('txt-live-order-number').innerText = `Order #: ${sysDatabase.currentOrderSeq}`;
    
    syncRekeningDropdownOptions();
    renderKatalogKasir();
    renderTopingKasir();
    renderCartUI();
    renderVoucherSakuKasir();
    calculateLiveClosingDashboard();
}

function triggerSystemLogout() {
    activeCart = [];
    activeMemberObj = null;
    selectedTopings = {};
    document.getElementById('main-app-layer').style.display = 'none';
    document.getElementById('login-screen-overlay').style.display = 'flex';
}

/* ==========================================================================
   3. CASHIER OPERATIONS & DYNAMIC TOPING INTEGRATION
   ========================================================================== */
function renderKatalogKasir() {
    const target = document.getElementById('katalog-render-target');
    if (!target) return;
    target.innerHTML = '';

    if (sysDatabase.products.length === 0 && sysDatabase.bundles.length === 0) {
        target.innerHTML = '<div style="grid-column: 1/-1; text-align:center; color:#999; padding:20px; font-size:13px; font-style:italic;">Katalog kosong. Sila masukkan item menu di Dashboard Owner terlebih dahulu.</div>';
        return;
    }

    // Render Menu Utama
    sysDatabase.products.forEach(prod => {
        target.innerHTML += `
            <div class="product-item-card" onclick="addItemToCart('${prod.id}', false)">
                <div style="font-weight:800; font-size:12px; margin-bottom:5px; min-height:32px; display:flex; align-items:center; justify-content:center; color:var(--pakchill-green-dark); text-transform:uppercase;">
                    ${prod.name}
                </div>
                <div style="font-size:11px; font-weight:bold; color:#ff9500;">Rp ${prod.price.toLocaleString('id-ID')}</div>
            </div>
        `;
    });

    // Render Paket Bundling
    sysDatabase.bundles.forEach(bndl => {
        target.innerHTML += `
            <div class="product-item-card" style="border: 1px dashed #ff9500;" onclick="addItemToCart('${bndl.id}', true)">
                <div style="position:absolute; top:2px; right:2px; background:#ff9500; color:white; font-size:9px; padding:2px 4px; border-radius:4px; font-weight:bold;">Bndl</div>
                <div style="font-weight:800; font-size:12px; margin-bottom:5px; min-height:32px; display:flex; align-items:center; justify-content:center; color:#b05d00; text-transform:uppercase;">
                    ${bndl.name}
                </div>
                <div style="font-size:11px; font-weight:bold; color:#34c759;">Rp ${bndl.price.toLocaleString('id-ID')}</div>
            </div>
        `;
    });
}

function renderTopingKasir() {
    const target = document.getElementById('toping-render-target');
    if (!target) return;
    target.innerHTML = '';

    if (sysDatabase.topings.length === 0) {
        target.innerHTML = '<span style="font-size:11px; color:#999; font-style:italic;">Tidak ada ekstra toping tersedia.</span>';
        return;
    }

    sysDatabase.topings.forEach(tp => {
        target.innerHTML += `
            <label style="display:inline-flex; align-items:center; background:white; padding:6px 10px; border-radius:8px; border:1px solid #e5e5ea; font-size:11px; font-weight:bold; cursor:pointer; gap:4px; box-shadow:0 1px 3px rgba(0,0,0,0.05); margin-bottom:5px;">
                <input type="checkbox" value="${tp.id}" onchange="toggleTopingGlobal(this, '${tp.id}')" style="margin:0; width:auto;">
                <span>${tp.name} (+Rp ${tp.price.toLocaleString('id-ID')})</span>
            </label>
        `;
    });
}

function toggleTopingGlobal(checkbox, topingId) {
    if (activeCart.length === 0) {
        alert("Pilih menu utamanya di katalog terlebih dahulu sebelum menambah toping!");
        checkbox.checked = false;
        return;
    }
    
    // Pasang toping ke item paling terakhir yang dimasukkan ke keranjang
    const lastItem = activeCart[activeCart.length - 1];
    if (!selectedTopings[lastItem.cartUid]) {
        selectedTopings[lastItem.cartUid] = [];
    }

    if (checkbox.checked) {
        selectedTopings[lastItem.cartUid].push(topingId);
    } else {
        selectedTopings[lastItem.cartUid] = selectedTopings[lastItem.cartUid].filter(id => id !== topingId);
    }
    renderCartUI();
}

function addItemToCart(id, isBundle) {
    let lookup = isBundle ? sysDatabase.bundles.find(b => b.id === id) : sysDatabase.products.find(p => p.id === id);
    if (!lookup) return;

    const cartUid = 'CART-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4);
    activeCart.push({
        cartUid: cartUid,
        id: lookup.id,
        name: lookup.name,
        price: lookup.price,
        isBundle: isBundle,
        qty: 1
    });

    // Reset check toping di tampilan kasir agar tidak otomatis tercentang ke item baru berikutnya
    const checkboxes = document.querySelectorAll('#toping-render-target input[type="checkbox"]');
    checkboxes.forEach(cb => cb.checked = false);

    renderCartUI();
}

function changeCartQty(cartUid, delta) {
    const item = activeCart.find(i => i.cartUid === cartUid);
    if (!item) return;

    item.qty += delta;
    if (item.qty <= 0) {
        activeCart = activeCart.filter(i => i.cartUid !== cartUid);
        delete selectedTopings[cartUid];
    }
    renderCartUI();
}

function removeCartItemInstantly(cartUid) {
    activeCart = activeCart.filter(i => i.cartUid !== cartUid);
    delete selectedTopings[cartUid];
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
        let topingSummaryText = [];
        let totalTopingPrice = 0;
        
        const itemTopings = selectedTopings[item.cartUid] || [];
        itemTopings.forEach(tId => {
            const tLookup = sysDatabase.topings.find(t => t.id === tId);
            if (tLookup) {
                topingSummaryText.push(tLookup.name);
                totalTopingPrice += tLookup.price;
            }
        });

        const hargaSatuanNet = item.price + totalTopingPrice;
        const totalHargaBaris = hargaSatuanNet * item.qty;

        let topingHtmlString = topingSummaryText.length > 0 
            ? `<div style="font-size:10px; color:#555; font-style:italic; margin-top:2px;">+ Toping: ${topingSummaryText.join(', ')}</div>` 
            : '';

        wrapper.innerHTML += `
            <div class="cart-item-row" style="padding: 8px 0; border-bottom: 1px solid #f2f2f7;">
                <div style="width: 45%;">
                    <div style="font-size:12px; font-weight:bold; color:var(--pakchill-green-dark); text-transform:uppercase;">${item.name}</div>
                    <div style="font-size:10px; color:#8e8e93;">Rp ${item.price.toLocaleString('id-ID')}</div>
                    ${topingHtmlString}
                </div>
                <div style="width: 30%; display:flex; justify-content:center; align-items:center; gap:6px;">
                    <button onclick="changeCartQty('${item.cartUid}', -1)" style="width:22px; height:22px; border-radius:5px; background:#ff3b30; color:white; font-weight:bold; border:none; cursor:pointer;">-</button>
                    <span style="font-size:12px; font-weight:bold; min-width:16px; text-align:center;">${item.qty}</span>
                    <button onclick="changeCartQty('${item.cartUid}', 1)" style="width:22px; height:22px; border-radius:5px; background:#34c759; color:white; font-weight:bold; border:none; cursor:pointer;">+</button>
                </div>
                <div style="width: 20%; text-align:right; font-size:12px; font-weight:bold; color:#1c1c1e;">
                    Rp ${totalHargaBaris.toLocaleString('id-ID')}
                </div>
                <div style="width: 5%; text-align:right;">
                    <span onclick="removeCartItemInstantly('${item.cartUid}')" style="color:#ff3b30; font-weight:bold; cursor:pointer; font-size:14px; padding-left:4px;">&times;</span>
                </div>
            </div>
        `;
    });

    recalculateCartTotals();
}

/* ==========================================================================
   4. ENGINE PERHITUNGAN DISKON, VOUCHER, & FITUR KLAIM POIN
   ========================================================================== */
function renderVoucherSakuKasir() {
    const target = document.getElementById('vouchers-render-target');
    if (!target) return;
    target.innerHTML = '';
    
    if (sysDatabase.vouchers.length === 0) {
        target.innerHTML = '<span style="font-size:11px; color:#999; font-style:italic;">Belum ada kupon aktif.</span>';
        return;
    }
    
    sysDatabase.vouchers.forEach(vch => {
        let badgeBg = vch.type.includes('Kupon') ? '#007aff' : '#5856d6';
        target.innerHTML += `
            <button onclick="applyVoucherToInput('${vch.code}', '${vch.type}')" type="button" style="width:auto; margin:0; padding:5px 10px; font-size:11px; background:${badgeBg}; color:white; border:none; border-radius:8px; font-weight:bold; cursor:pointer; box-shadow: 0 2px 6px rgba(0,0,0,0.08);">
                % ${vch.code} (-Rp ${vch.nominal.toLocaleString('id-ID')})
            </button>
        `;
    });
}

function applyVoucherToInput(code, type) {
    if (type.includes('Kupon')) {
        const inputD = document.getElementById('kasir-input-diskon');
        if (inputD) inputD.value = code;
    } else {
        const inputV = document.getElementById('kasir-input-voucher');
        if (inputV) inputV.value = code;
    }
    recalculateCartTotals();
}

function recalculateCartTotals() {
    let subtotal = 0;
    activeCart.forEach(item => {
        let totalTopingPrice = 0;
        const itemTopings = selectedTopings[item.cartUid] || [];
        itemTopings.forEach(tId => {
            const tLookup = sysDatabase.topings.find(t => t.id === tId);
            if (tLookup) totalTopingPrice += tLookup.price;
        });
        subtotal += (item.price + totalTopingPrice) * item.qty;
    });

    document.getElementById('txt-subtotal-val').innerText = `Rp ${subtotal.toLocaleString('id-ID')}`;

    // Ambil Potongan Voucher / Diskon
    const diskonRaw = document.getElementById('kasir-input-diskon')?.value.trim().toUpperCase() || '0';
    let nilaiDiskon = 0;
    if (!isNaN(diskonRaw)) {
        nilaiDiskon = parseInt(diskonRaw) || 0;
    } else {
        const vchMatch = sysDatabase.vouchers.find(v => v.code === diskonRaw);
        if (vchMatch) nilaiDiskon = vchMatch.nominal;
    }

    const voucherRaw = document.getElementById('kasir-input-voucher')?.value.trim().toUpperCase() || '0';
    let nilaiVoucher = 0;
    if (!isNaN(voucherRaw)) {
        nilaiVoucher = parseInt(voucherRaw) || 0;
    } else {
        const vchMatch = sysDatabase.vouchers.find(v => v.code === voucherRaw);
        if (vchMatch) nilaiVoucher = vchMatch.nominal;
    }

    // Hitung Sistem Klaim/Rembes Poin Member (1 Poin = Rp 100)
    let nilaiRembesPoin = 0;
    const inputPoinRedeem = document.getElementById('kasir-claim-poin-input');
    if (inputPoinRedeem && activeMemberObj) {
        let requestedPoin = parseInt(inputPoinRedeem.value) || 0;
        if (requestedPoin > activeMemberObj.points) {
            requestedPoin = activeMemberObj.points;
            inputPoinRedeem.value = requestedPoin;
        }
        nilaiRembesPoin = requestedPoin * 100;
        document.getElementById('live-info-potongan-poin').innerText = `-Rp ${nilaiRembesPoin.toLocaleString('id-ID')}`;
    } else {
        if(document.getElementById('live-info-potongan-poin')) {
            document.getElementById('live-info-potongan-poin').innerText = '';
        }
    }

    let grandTotal = subtotal - nilaiDiskon - nilaiVoucher - nilaiRembesPoin;
    if (grandTotal < 0) grandTotal = 0;

    document.getElementById('txt-grand-total-display').innerText = `Rp ${grandTotal.toLocaleString('id-ID')}`;
    calculateCashReturn();
}

/* ==========================================================================
   5. MEMBERSHIP SYSTEM
   ========================================================================== */
function executeLiveSearchMember() {
    const rawQuery = document.getElementById('kasir-search-member').value.trim().toLowerCase();
    const box = document.getElementById('kasir-member-status-box');
    const claimWrapper = document.getElementById('wrapper-claim-poin-kasir');
    
    if (!rawQuery) {
        activeMemberObj = null;
        box.innerText = '';
        if(claimWrapper) claimWrapper.style.display = 'none';
        if(document.getElementById('kasir-claim-poin-input')) document.getElementById('kasir-claim-poin-input').value = '';
        recalculateCartTotals();
        return;
    }

    const match = sysDatabase.members.find(m => m.name.toLowerCase().includes(rawQuery) || m.phone.includes(rawQuery));
    if (match) {
        activeMemberObj = match;
        box.innerHTML = `<span style="color:#34c759; font-size:11px; font-weight:bold;">✔ Member: ${match.name} (${match.points} Pts)</span>`;
        if(claimWrapper) {
            claimWrapper.style.display = 'block';
            document.getElementById('txt-max-claim-points').innerText = `${match.points} Pts`;
        }
    } else {
        activeMemberObj = null;
        box.innerHTML = `<span style="color:#ff3b30; font-size:11px; font-weight:bold;">❌ Member Tidak Ditemukan</span>`;
        if(claimWrapper) claimWrapper.style.display = 'none';
    }
    recalculateCartTotals();
}

function registerFastMemberFromKasir() {
    const name = document.getElementById('kasir-fast-name').value.trim();
    const phone = document.getElementById('kasir-fast-wa').value.trim();

    if (!name || !phone) return alert('Lengkapi data registrasi member baru!');
    if (sysDatabase.members.some(m => m.phone === phone)) return alert('WhatsApp sudah terdaftar!');

    const newM = { id: 'M' + Date.now(), name, phone, points: 0 };
    sysDatabase.members.push(newM);
    saveToStorage();

    document.getElementById('kasir-fast-name').value = '';
    document.getElementById('kasir-fast-wa').value = '';
    document.getElementById('kasir-search-member').value = phone;
    
    executeLiveSearchMember();
    if (activeRole === 'owner') renderOwnerDashboardMembersTable();
    alert(`Sukses Daftar Member Baru: ${name}!`);
}

function handlePaymentDropdownBranching() {
    const method = document.getElementById('kasir-select-paymethod').value;
    document.getElementById('wrapper-sub-cash').style.display = method.includes('Cash') || method.includes('Tunai') ? 'block' : 'none';
    document.getElementById('wrapper-sub-transfer').style.display = method.includes('Transfer') || method.includes('QRIS') ? 'block' : 'none';
    updateLiveRekeningInfo();
}

function syncRekeningDropdownOptions() {
    const selectNode = document.getElementById('sub-target-transfer');
    if (!selectNode) return;
    selectNode.innerHTML = '';
    
    if (sysDatabase.rekening.length === 0) {
        selectNode.innerHTML = '<option value="">-- Belum ada Rekening Aktif --</option>';
        return;
    }
    
    sysDatabase.rekening.forEach(rk => {
        selectNode.innerHTML += `<option value="${rk.bank} - ${rk.number}">${rk.bank} (${rk.name})</option>`;
    });
    updateLiveRekeningInfo();
}

function updateLiveRekeningInfo() {
    const val = document.getElementById('sub-target-transfer')?.value;
    const box = document.getElementById('live-rekening-info-box');
    if(box) box.innerText = val ? `Tujuan Transfer: ${val}` : '';
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
   6. TRANSACTION COMPLETION & INVOICE PRINTER
   ========================================================================== */
function finalizeTransactionReceipt(printType) {
    if (activeCart.length === 0) return alert('Keranjang belanja masih kosong!');

    const subtotal = parseInt(document.getElementById('txt-subtotal-val').innerText.replace(/[^0-9]/g, '')) || 0;
    const grandTotal = parseInt(document.getElementById('txt-grand-total-display').innerText.replace(/[^0-9]/g, '')) || 0;
    const payMethod = document.getElementById('kasir-select-paymethod').value;
    
    const selectedServiceRadio = document.querySelector('input[name="service_type"]:checked');
    const serviceType = selectedServiceRadio ? selectedServiceRadio.value : 'Dine In';

    let payDetails = payMethod;
    if (payMethod.includes('Cash') || payMethod.includes('Tunai')) {
        const inputCash = parseInt(document.getElementById('kasir-cash-input-uang').value) || 0;
        if (inputCash < grandTotal) return alert('Uang tunai kurang!');
        payDetails += ` (Tunai: Rp ${inputCash.toLocaleString('id-ID')})`;
    } else {
        const targetTransferSelect = document.getElementById('sub-target-transfer');
        if (targetTransferSelect && targetTransferSelect.value) {
            payDetails += ` (${targetTransferSelect.value})`;
        }
    }

    // Eksekusi potong/tambah poin
    let poinDiklaim = 0;
    if (activeMemberObj) {
        const mIdx = sysDatabase.members.findIndex(m => m.id === activeMemberObj.id);
        if (mIdx !== -1) {
            const inputPoinRedeem = document.getElementById('kasir-claim-poin-input');
            poinDiklaim = inputPoinRedeem ? (parseInt(inputPoinRedeem.value) || 0) : 0;
            
            // Kurangi poin yang dirembes
            sysDatabase.members[mIdx].points -= poinDiklaim;
            
            // Berikan poin baru dari transaksi berjalan (tiap Rp 10.000 dapat 1 poin)
            const addedPoints = Math.floor(grandTotal / 10000);
            sysDatabase.members[mIdx].points += addedPoints;
        }
    }

    // Rekam Transaksi Lengkap ke Histori
    const itemsSnapshot = activeCart.map(item => {
        let itemTopingNames = [];
        const tIds = selectedTopings[item.cartUid] || [];
        tIds.forEach(id => {
            const matchT = sysDatabase.topings.find(t => t.id === id);
            if (matchT) itemTopingNames.push(matchT.name);
        });
        return {
            ...item,
            appliedTopings: itemTopingNames
        };
    });

    const trxId = 'TRX-' + Date.now();
    const newTrx = {
        orderSeq: sysDatabase.currentOrderSeq,
        id: trxId,
        date: new Date().toISOString(),
        customer: activeMemberObj ? activeMemberObj.name : 'Umum (Non-Member)',
        serviceType: serviceType,
        items: itemsSnapshot,
        subtotal: subtotal,
        grandTotal: grandTotal,
        paymentMethod: payDetails,
        poinRedeemed: poinDiklaim,
        status: 'SUKSES'
    };

    sysDatabase.transactions.push(newTrx);
    sysDatabase.currentOrderSeq++;
    saveToStorage();

    if (printType === 'Print') {
        let itemsHtml = '';
        newTrx.items.forEach(i => {
            let topStr = i.appliedTopings.length > 0 ? `<br><small style="color:#333;">+ Toping: ${i.appliedTopings.join(',')}</small>` : '';
            itemsHtml += `
                <div style="display:flex; justify-content:space-between; font-size:11px; margin-bottom:3px;">
                    <span>${i.name} x${i.qty} ${topStr}</span>
                    <span>Rp ${(i.price * i.qty).toLocaleString('id-ID')}</span>
                </div>`;
        });

        const receiptArea = document.getElementById('thermal-receipt-output');
        if(receiptArea) {
            receiptArea.innerHTML = `
                <div style="font-family:monospace; width:58mm; padding:5px; background:white; color:black;">
                    <div style="text-align:center; font-weight:bold; font-size:14px;">PAKCHILL JUICE</div>
                    <hr style="border:0; border-top:1px dashed black; margin:4px 0;">
                    <div style="font-size:10px;">
                        Order: ${newTrx.orderSeq} | Tipe: ${newTrx.serviceType}<br>
                        Pelanggan: ${newTrx.customer}<br>
                        Waktu: ${new Date(newTrx.date).toLocaleString('id-ID')}
                    </div>
                    <hr style="border:0; border-top:1px dashed black; margin:4px 0;">
                    ${itemsHtml}
                    <hr style="border:0; border-top:1px dashed black; margin:4px 0;">
                    <div style="display:flex; justify-content:space-between; font-size:11px; font-weight:bold;"><span>GRAND TOTAL:</span><span>Rp ${grandTotal.toLocaleString('id-ID')}</span></div>
                    <div style="font-size:10px; margin-top:4px;">Metode: ${payDetails}</div>
                </div>
            `;
            window.print();
        }
    } else {
        alert(`Notifikasi Struk Digital Berhasil Dikirim ke Pelanggan! ID: ${trxId}`);
    }

    // Reset Form Kasir
    activeCart = [];
    selectedTopings = {};
    activeMemberObj = null;
    document.getElementById('kasir-search-member').value = '';
    document.getElementById('kasir-member-status-box').innerText = '';
    if(document.getElementById('kasir-claim-poin-input')) document.getElementById('kasir-claim-poin-input').value = '';
    if(document.getElementById('kasir-cash-input-uang')) document.getElementById('kasir-cash-input-uang').value = '';
    if(document.getElementById('kasir-input-diskon')) document.getElementById('kasir-input-diskon').value = '0';
    if(document.getElementById('kasir-input-voucher')) document.getElementById('kasir-input-voucher').value = '0';
    if(document.getElementById('cash-return-info')) document.getElementById('cash-return-info').innerText = 'Kembalian: Rp 0';
    document.getElementById('txt-live-order-number').innerText = `Order #: ${sysDatabase.currentOrderSeq}`;

    // Uncheck toping global checkboxes
    document.querySelectorAll('#toping-render-target input[type="checkbox"]').forEach(cb => cb.checked = false);

    renderCartUI();
    calculateLiveClosingDashboard();
    if (activeRole === 'owner') renderOwnerDashboardMetrics();
}

function calculateLiveClosingDashboard() {
    const listTarget = document.getElementById('closing-menu-list-render');
    if (!listTarget) return;

    const targetTimeRange = Date.now() - (24 * 60 * 60 * 1000);
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
        listTarget.innerHTML = '<span style="color:#999; font-style:italic;">Belum ada menu terjual hari ini.</span>';
        return;
    }

    sortedMenus.forEach(([name, qty]) => {
        listTarget.innerHTML += `<div style="display:flex; justify-content:space-between; font-size:12px;"><span>• ${name}</span><span style="font-weight:bold;">${qty}x</span></div>`;
    });
}

/* ==========================================================================
   7. OWNER CORE HUB STRATEGIC MANAGEMENT ENGINE (CRUD TABLES)
   ========================================================================== */function renderOwnerDashboardMetrics() {
    renderOwnerProductsTable();
    renderOwnerBundlesTable();
    renderOwnerVouchersTable();
    renderOwnerTopingsTable();
    renderOwnerDashboardMembersTable();
    renderOwnerRekeningTable();
    renderAuditHistoryTable();

    // Kalkulasi Metrik Kartu Finansial
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

    if(document.getElementById('own-rekap-hari')) document.getElementById('own-rekap-hari').innerText = `Rp ${omzetHari.toLocaleString('id-ID')}`;
    if(document.getElementById('own-rekap-minggu')) document.getElementById('own-rekap-minggu').innerText = `Rp ${omzetMinggu.toLocaleString('id-ID')}`;
    if(document.getElementById('own-rekap-bulan')) document.getElementById('own-rekap-bulan').innerText = `Rp ${omzetBulan.toLocaleString('id-ID')}`;
    if(document.getElementById('own-rekap-tahun')) document.getElementById('own-rekap-tahun').innerText = `Rp ${omzetTahun.toLocaleString('id-ID')}`;

    // Render Update Chart.js 12 Bulan (Jan - Des) - PREMIUM DARK iOS STYLE
    const ctx = document.getElementById('canvasTrenOwner');
    if (!ctx) return;

    if (chartInstance) chartInstance.destroy();
    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'],
            datasets: [{
                label: 'Tren Omzet Bersih Pakchill (Rp)',
                data: bulananMap,
                borderColor: '#00ff66', /* Hijau neon premium menyala */
                backgroundColor: 'rgba(0, 255, 102, 0.08)', /* Efek glow transparan di bawah grafik */
                borderWidth: 3,
                tension: 0.28, /* Melengkung halus khas iOS */
                fill: true,
                pointBackgroundColor: '#00ff66',
                pointHoverRadius: 7
            }]
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false,
            plugins: {
                legend: { 
                    labels: { color: '#ffffff', font: { weight: 'bold' } } /* Teks legenda jadi putih */
                }
            },
            scales: {
                y: { 
                    beginAtZero: true,
                    grid: { color: 'rgba(255, 255, 255, 0.05)' }, /* Garis grid tipis transparan */
                    ticks: { color: '#a2bca0' } /* Angka sumbu Y warna sage soft */
                },
                x: {
                    grid: { display: false }, /* Bersih tanpa garis vertikal */
                    ticks: { color: '#a2bca0' } /* Nama bulan warna sage soft */
                }
            }
        }
    });
}
/* --- A. CRUD SUB-DASHBOARD: MENU UTAMA --- */
function renderOwnerProductsTable() {
    const tbody = document.getElementById('render-owner-products-target');
    if (!tbody) return; tbody.innerHTML = '';

    sysDatabase.products.forEach((p, idx) => {
        tbody.innerHTML += `
            <tr>
                <td><b>${p.name}</b></td>
                <td>Rp ${p.price.toLocaleString('id-ID')}</td>
                <td>
                    <button onclick="editProductForm(${idx})" style="padding:4px 8px; background:#ff9500; color:white; border:none; border-radius:4px; font-size:11px; cursor:pointer;">Edit</button>
                    <button onclick="deleteProductRow(${idx})" style="padding:4px 8px; background:#ff3b30; color:white; border:none; border-radius:4px; font-size:11px; cursor:pointer;">Hapus</button>
                </td>
            </tr>`;
    });
}

function saveNewMenuFromOwner() {
    const nameInput = document.getElementById('own-add-menu-name');
    const priceInput = document.getElementById('own-add-menu-price');
    const hiddenIdx = document.getElementById('own-add-menu-idx')?.value;

    const name = nameInput.value.trim().toUpperCase();
    const price = parseInt(priceInput.value) || 0;

    if (!name || price <= 0) return alert('Nama Menu / Harga tidak valid!');

    if (!hiddenIdx || hiddenIdx === "") {
        sysDatabase.products.push({ id: 'P' + Date.now(), name, price });
    } else {
        const idx = parseInt(hiddenIdx);
        sysDatabase.products[idx].name = name;
        sysDatabase.products[idx].price = price;
        document.getElementById('own-add-menu-idx').value = "";
    }

    saveToStorage();
    nameInput.value = ''; priceInput.value = '';
    renderOwnerProductsTable();
    renderKatalogKasir();
    alert('Database Menu Utama Berhasil Diperbarui!');
}

function editProductForm(idx) {
    const p = sysDatabase.products[idx];
    document.getElementById('own-add-menu-name').value = p.name;
    document.getElementById('own-add-menu-price').value = p.price;
    if(!document.getElementById('own-add-menu-idx')) {
        const input = document.createElement('input'); input.type = 'hidden'; input.id = 'own-add-menu-idx';
        document.getElementById('own-add-menu-name').parentNode.appendChild(input);
    }
    document.getElementById('own-add-menu-idx').value = idx;
}

function deleteProductRow(idx) {
    if(!confirm("Hapus menu ini?")) return;
    sysDatabase.products.splice(idx, 1);
    saveToStorage();
    renderOwnerProductsTable();
    renderKatalogKasir();
}

/* --- B. CRUD SUB-DASHBOARD: PAKET BUNDLING --- */
function renderOwnerBundlesTable() {
    const tbody = document.getElementById('render-owner-bundles-target');
    if (!tbody) return; tbody.innerHTML = '';

    sysDatabase.bundles.forEach((b, idx) => {
        tbody.innerHTML += `
            <tr>
                <td><b>${b.name}</b></td>
                <td>Rp ${b.price.toLocaleString('id-ID')}</td>
                <td>
                    <button onclick="editBundleForm(${idx})" style="padding:4px 8px; background:#ff9500; color:white; border:none; border-radius:4px; font-size:11px; cursor:pointer;">Edit</button>
                    <button onclick="deleteBundleRow(${idx})" style="padding:4px 8px; background:#ff3b30; color:white; border:none; border-radius:4px; font-size:11px; cursor:pointer;">Hapus</button>
                </td>
            </tr>`;
    });
}

function saveNewBundleFromOwner() {
    const nameInput = document.getElementById('own-add-bundle-name');
    const priceInput = document.getElementById('own-add-bundle-price');
    const hiddenIdx = document.getElementById('own-add-bundle-idx')?.value;

    const name = nameInput.value.trim().toUpperCase();
    const price = parseInt(priceInput.value) || 0;

    if (!name || price <= 0) return alert('Nama Paket / Harga tidak valid!');

    if (!hiddenIdx || hiddenIdx === "") {
        sysDatabase.bundles.push({ id: 'B' + Date.now(), name, price });
    } else {
        const idx = parseInt(hiddenIdx);
        sysDatabase.bundles[idx].name = name;
        sysDatabase.bundles[idx].price = price;
        document.getElementById('own-add-bundle-idx').value = "";
    }

    saveToStorage();
    nameInput.value = ''; priceInput.value = '';
    renderOwnerBundlesTable();
    renderKatalogKasir();
    alert('Database Paket Bundling Berhasil Diperbarui!');
}

function editBundleForm(idx) {
    const b = sysDatabase.bundles[idx];
    document.getElementById('own-add-bundle-name').value = b.name;
    document.getElementById('own-add-bundle-price').value = b.price;
    if(!document.getElementById('own-add-bundle-idx')) {
        const input = document.createElement('input'); input.type = 'hidden'; input.id = 'own-add-bundle-idx';
        document.getElementById('own-add-bundle-name').parentNode.appendChild(input);
    }
    document.getElementById('own-add-bundle-idx').value = idx;
}

function deleteBundleRow(idx) {
    if(!confirm("Hapus paket hemat ini?")) return;
    sysDatabase.bundles.splice(idx, 1);
    saveToStorage();
    renderOwnerBundlesTable();
    renderKatalogKasir();
}

/* --- C. CRUD SUB-DASHBOARD: KUPON & VOUCHER --- */
function renderOwnerVouchersTable() {
    const tbody = document.getElementById('render-owner-vouchers-target');
    if (!tbody) return; tbody.innerHTML = '';

    sysDatabase.vouchers.forEach((v, idx) => {
        tbody.innerHTML += `
            <tr>
                <td><span style="font-family:monospace; background:#e5e5ea; padding:2px 6px; border-radius:4px;">${v.code}</span></td>
                <td>Rp ${v.nominal.toLocaleString('id-ID')}</td>
                <td><small>${v.type}</small></td>
                <td>
                    <button onclick="editVoucherForm(${idx})" style="padding:4px 8px; background:#ff9500; color:white; border:none; border-radius:4px; font-size:11px; cursor:pointer;">Edit</button>
                    <button onclick="deleteVoucherRow(${idx})" style="padding:4px 8px; background:#ff3b30; color:white; border:none; border-radius:4px; font-size:11px; cursor:pointer;">Hapus</button>
                </td>
            </tr>`;
    });
}

function saveNewVoucherFromOwner() {
    const codeInput = document.getElementById('own-vch-code');
    const nominalInput = document.getElementById('own-vch-nominal');
    const typeSelect = document.getElementById('own-vch-type');
    const hiddenIdx = document.getElementById('own-vch-idx')?.value;

    const code = codeInput.value.trim().toUpperCase();
    const nominal = parseInt(nominalInput.value) || 0;
    const type = typeSelect.value;

    if (!code || nominal <= 0) return alert('Data aturan promo tidak valid!');

    if (!hiddenIdx || hiddenIdx === "") {
        sysDatabase.vouchers.push({ id: 'V' + Date.now(), code, nominal, type });
    } else {
        const idx = parseInt(hiddenIdx);
        sysDatabase.vouchers[idx].code = code;
        sysDatabase.vouchers[idx].nominal = nominal;
        sysDatabase.vouchers[idx].type = type;
        document.getElementById('own-vch-idx').value = "";
    }

    saveToStorage();
    codeInput.value = ''; nominalInput.value = '';
    renderOwnerVouchersTable();
    renderVoucherSakuKasir();
    alert('Aturan Voucher Promo Sinkron ke Kasir!');
}

function editVoucherForm(idx) {
    const v = sysDatabase.vouchers[idx];
    document.getElementById('own-vch-code').value = v.code;
    document.getElementById('own-vch-nominal').value = v.nominal;
    document.getElementById('own-vch-type').value = v.type;
    if(!document.getElementById('own-vch-idx')) {
        const input = document.createElement('input'); input.type = 'hidden'; input.id = 'own-vch-idx';
        document.getElementById('own-vch-code').parentNode.appendChild(input);
    }
    document.getElementById('own-vch-idx').value = idx;
}

function deleteVoucherRow(idx) {
    if(!confirm("Hapus aturan voucher ini?")) return;
    sysDatabase.vouchers.splice(idx, 1);
    saveToStorage();
    renderOwnerVouchersTable();
    renderVoucherSakuKasir();
}

/* --- D. CRUD SUB-DASHBOARD: EKSTRA TOPING DINAMIS (Fitur Baru) --- */
function renderOwnerTopingsTable() {
    const tbody = document.getElementById('render-owner-topings-target');
    if (!tbody) return; tbody.innerHTML = '';

    sysDatabase.topings.forEach((t, idx) => {
        tbody.innerHTML += `
            <tr>
                <td><b>${t.name}</b></td>
                <td>Rp ${t.price.toLocaleString('id-ID')}</td>
                <td>
                    <button onclick="editTopingForm(${idx})" style="padding:4px 8px; background:#ff9500; color:white; border:none; border-radius:4px; font-size:11px; cursor:pointer;">Edit</button>
                    <button onclick="deleteTopingRow(${idx})" style="padding:4px 8px; background:#ff3b30; color:white; border:none; border-radius:4px; font-size:11px; cursor:pointer;">Hapus</button>
                </td>
            </tr>`;
    });
}

function saveNewTopingFromOwner() {
    const nameInput = document.getElementById('own-add-toping-name');
    const priceInput = document.getElementById('own-add-toping-price');
    const hiddenIdx = document.getElementById('own-add-toping-idx')?.value;

    const name = nameInput.value.trim().toUpperCase();
    const price = parseInt(priceInput.value) || 0;

    if (!name || price <= 0) return alert('Nama Toping / Harga Tambahan tidak valid!');

    if (!hiddenIdx || hiddenIdx === "") {
        sysDatabase.topings.push({ id: 'TP' + Date.now(), name, price });
    } else {
        const idx = parseInt(hiddenIdx);
        sysDatabase.topings[idx].name = name;
        sysDatabase.topings[idx].price = price;
        document.getElementById('own-add-toping-idx').value = "";
    }

    saveToStorage();
    nameInput.value = ''; priceInput.value = '';
    renderOwnerTopingsTable();
    renderTopingKasir();
    alert('Database Komponen Toping Berhasil Sinkron!');
}

function editTopingForm(idx) {
    const t = sysDatabase.topings[idx];
    document.getElementById('own-add-toping-name').value = t.name;
    document.getElementById('own-add-toping-price').value = t.price;
    if(!document.getElementById('own-add-toping-idx')) {
        const input = document.createElement('input'); input.type = 'hidden'; input.id = 'own-add-toping-idx';
        document.getElementById('own-add-toping-name').parentNode.appendChild(input);
    }
    document.getElementById('own-add-toping-idx').value = idx;
}

function deleteTopingRow(idx) {
    if(!confirm("Hapus komponen toping ini?")) return;
    sysDatabase.topings.splice(idx, 1);
    saveToStorage();
    renderOwnerTopingsTable();
    renderTopingKasir();
}

/* --- E. CRUD SUB-DASHBOARD: EDIT DATA MEMBER --- */
function renderOwnerDashboardMembersTable() {
    const tbody = document.getElementById('render-owner-members-target');
    if (!tbody) return; tbody.innerHTML = '';

    sysDatabase.members.forEach((m, idx) => {
        tbody.innerHTML += `
            <tr>
                <td>${m.name}</td>
                <td><small>${m.phone}</small></td>
                <td><b>${m.points} Pts</b></td>
                <td>
                    <button onclick="loadMemberToEditForm(${idx})" style="padding:4px 8px; background:#ff9500; color:white; border:none; border-radius:4px; font-size:11px; cursor:pointer;">Edit</button>
                    <button onclick="deleteMemberRow(${idx})" style="padding:4px 8px; background:#ff3b30; color:white; border:none; border-radius:4px; font-size:11px; cursor:pointer;">Hapus</button>
                </td>
            </tr>`;
    });
}

function loadMemberToEditForm(idx) {
    const m = sysDatabase.members[idx];
    document.getElementById('form-edit-member-name').value = m.name;
    document.getElementById('form-edit-member-phone').value = m.phone;
    document.getElementById('form-edit-member-points').value = m.points;
    
    if(!document.getElementById('form-edit-member-idx')) {
        const input = document.createElement('input'); input.type = 'hidden'; input.id = 'form-edit-member-idx';
        document.getElementById('form-edit-member-name').parentNode.appendChild(input);
    }
    document.getElementById('form-edit-member-idx').value = idx;
}

function submitUpdateMemberFormOwner() {
    const hiddenIdx = document.getElementById('form-edit-member-idx')?.value;
    if (!hiddenIdx || hiddenIdx === "") return alert("Pilih baris member pada tabel di bawah terlebih dahulu!");

    const idx = parseInt(hiddenIdx);
    sysDatabase.members[idx].name = document.getElementById('form-edit-member-name').value.trim();
    sysDatabase.members[idx].phone = document.getElementById('form-edit-member-phone').value.trim();
    sysDatabase.members[idx].points = parseInt(document.getElementById('form-edit-member-points').value) || 0;

    saveToStorage();
    document.getElementById('form-edit-member-name').value = '';
    document.getElementById('form-edit-member-phone').value = '';
    document.getElementById('form-edit-member-points').value = '';
    document.getElementById('form-edit-member-idx').value = '';

    renderOwnerDashboardMembersTable();
    executeLiveSearchMember();
    alert("Profil & Poin Terupdate!");
}

function deleteMemberRow(idx) {
    if(!confirm("Hapus keanggotaan member ini?")) return;
    sysDatabase.members.splice(idx, 1);
    saveToStorage();
    renderOwnerDashboardMembersTable();
    executeLiveSearchMember();
}

/* --- F. CRUD SUB-DASHBOARD: MANAJEMEN GATEWAY REKENING BANK --- */
function renderOwnerRekeningTable() {
    const tbody = document.getElementById('render-owner-rekening-target');
    if (!tbody) return; tbody.innerHTML = '';

    sysDatabase.rekening.forEach((rk, idx) => {
        tbody.innerHTML += `
            <tr>
                <td><b>${rk.bank}</b></td>
                <td>${rk.number}</td>
                <td><small>${rk.name}</small></td>
                <td>
                    <button onclick="loadRekeningToForm(${idx})" style="padding:2px 6px; background:#ff9500; color:white; border:none; border-radius:4px; font-size:10px; cursor:pointer;">Edit</button>
                    <button onclick="deleteRekeningRow(${idx})" style="padding:2px 6px; background:#ff3b30; color:white; border:none; border-radius:4px; font-size:10px; cursor:pointer;">Hapus</button>
                </td>
            </tr>`;
    });
}

function loadRekeningToForm(idx) {
    const r = sysDatabase.rekening[idx];
    document.getElementById('form-rek-bank').value = r.bank;
    document.getElementById('form-rek-nomor').value = r.number;
    document.getElementById('form-rek-nama').value = r.name;
    document.getElementById('form-rek-id-index').value = idx;
    document.getElementById('title-crud-rekening').innerText = `✏️ Edit Akun Rekening`;
}

function saveRekeningFormSubmit() {
    const bank = document.getElementById('form-rek-bank').value.trim().toUpperCase();
    const nomor = document.getElementById('form-rek-nomor').value.trim();
    const nama = document.getElementById('form-rek-nama').value.trim().toUpperCase();
    const hiddenIdx = document.getElementById('form-rek-id-index').value;

    if (!bank || !nomor || !nama) return alert('Lengkapi data isian rekening!');

    if (hiddenIdx === "") {
        sysDatabase.rekening.push({ id: 'R' + Date.now(), bank, number: nomor, name: nama });
    } else {
        const idx = parseInt(hiddenIdx);
        sysDatabase.rekening[idx].bank = bank;
        sysDatabase.rekening[idx].number = nomor;
        sysDatabase.rekening[idx].name = nama;
    }

    saveToStorage();
    clearRekeningForm();
    renderOwnerRekeningTable();
    syncRekeningDropdownOptions();
    alert('Rekening Diperbarui!');
}

function clearRekeningForm() {
    document.getElementById('form-rek-bank').value = '';
    document.getElementById('form-rek-nomor').value = '';
    document.getElementById('form-rek-nama').value = '';
    document.getElementById('form-rek-id-index').value = '';
    document.getElementById('title-crud-rekening').innerText = `+ Tambah Akun Rekening Baru`;
}

function deleteRekeningRow(idx) {
    if(!confirm("Hapus akun rekening ini?")) return;
    sysDatabase.rekening.splice(idx, 1);
    saveToStorage();
    renderOwnerRekeningTable();
    syncRekeningDropdownOptions();
}

/* ==========================================================================
   8. AUDIT DATA LOG HISTORI & OTORITAS PEMBATALAN TRANSAKSI (VOID)
   ========================================================================== */
function renderAuditHistoryTable() {
    const tbody = document.getElementById('render-owner-transactions-target');
    if (!tbody) return; tbody.innerHTML = '';

    const filterMonth = document.getElementById('own-filter-month-select').value;
    
    // Sort transaksi terbaru berada di atas (Descending)
    const reversedTrx = [...sysDatabase.transactions].reverse();

    reversedTrx.forEach((t) => {
        const tDate = new Date(t.date);
        
        // Filter Saring Berdasarkan Parameter Dropdown Bulan
        if (filterMonth !== 'all' && tDate.getMonth().toString() !== filterMonth) {
            return; 
        }

        let statusBadge = t.status === 'SUKSES' 
            ? `<span class="status-badge badge-sukses">SUKSES</span>` 
            : `<span class="status-badge badge-void">VOIDED</span>`;

        let actionButton = t.status === 'SUKSES'
            ? `<button onclick="authorizeVoidTransaction('${t.id}')" style="padding:4px 8px; background:#ff3b30; color:white; border:none; border-radius:6px; font-weight:bold; font-size:10px; cursor:pointer;">VOID</button>`
            : `<span style="font-size:11px; color:#8e8e93; font-style:italic;">No Action</span>`;

        let itemsSummaryArr = t.items.map(i => {
            let topStr = i.appliedTopings.length > 0 ? ` (+Toping: ${i.appliedTopings.join(',')})` : '';
            return `${i.name} (${i.qty}x)${topStr}`;
        });

        tbody.innerHTML += `
            <tr>
                <td><b>${t.orderSeq}</b></td>
                <td><small style="font-family:monospace;">${t.id}</small></td>
                <td><small>${tDate.toLocaleString('id-ID')}</small></td>
                <td>${t.customer}</td>
                <td><small>${t.serviceType}</small></td>
                <td><b>Rp ${t.grandTotal.toLocaleString('id-ID')}</b></td>
                <td><span style="font-size:10px; color:#555;">${t.paymentMethod}</span><br><small style="color:#777;">${itemsSummaryArr.join(' | ')}</small></td>
                <td>${statusBadge}</td>
                <td>${actionButton}</td>
            </tr>`;
    });
}

function authorizeVoidTransaction(trxId) {
    const pinConfirm = prompt("OTORISASI EKSEKUTIF: Masukkan PIN Owner (9999) untuk membatalkan transaksi ini:");
    if (pinConfirm !== '9999') return alert("Otorisasi Gagal! PIN Salah atau Tindakan Dibatalkan.");

    const tIdx = sysDatabase.transactions.findIndex(t => t.id === trxId);
    if (tIdx === -1) return;

    sysDatabase.transactions[tIdx].status = 'VOIDED';
    saveToStorage();
    
    renderOwnerDashboardMetrics();
    calculateLiveClosingDashboard();
    alert(`Sukses! Transaksi ${trxId} telah di-VOID dan dikeluarkan dari kalkulasi omzet.`);
}

/* ==========================================================================
   9. PREMIUM EXPORT AUTOMATION PLUGINS (EXCEL & PDF GENERATOR)
   ========================================================================== */
// Saring data berdasarkan bulan terpilih untuk dokumen Excel/PDF
function getFilteredTransactions() {
    const filterMonth = document.getElementById('own-filter-month-select').value;
    return sysDatabase.transactions.filter(t => {
        if (filterMonth === 'all') return true;
        return new Date(t.date).getMonth().toString() === filterMonth;
    });
}

/* --- EXPORT KASIR: CLOSING SHIFT --- */
function exportKasirReportExcel() {
    const targetTimeRange = Date.now() - (24 * 60 * 60 * 1000);
    const liveTrx = sysDatabase.transactions.filter(t => new Date(t.date).getTime() >= targetTimeRange && t.status === 'SUKSES');
    
    let rows = [["Order Seq", "ID Transaksi", "Waktu", "Pelanggan", "Tipe Layanan", "Grand Total", "Metode Bayar"]];
    liveTrx.forEach(t => {
        rows.push([t.orderSeq, t.id, new Date(t.date).toLocaleString('id-ID'), t.customer, t.serviceType, t.grandTotal, t.paymentMethod]);
    });

    let wb = XLSX.utils.book_new();
    let ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, "Closing Shift");
    XLSX.writeFile(wb, `Closing_Kasir_${Date.now()}.xlsx`);
}

function exportKasirReportPDF() {
    const element = document.getElementById('closing-report-pdf-area');
    html2pdf().from(element).save(`Laporan_Closing_Kasir_${Date.now()}.pdf`);
}

/* --- EXPORT OWNER: SMART MONTHLY FILTERED AUDIT --- */
function exportFilteredOwnerReportExcel() {
    const filtered = getFilteredTransactions();
    const dropdownText = document.getElementById('own-filter-month-select').options[document.getElementById('own-filter-month-select').selectedIndex].text;

    let rows = [["LALUAN AUDIT FINANSIAL PAKCHILL - PERIODE: " + dropdownText.toUpperCase()], [], ["Seq", "ID Transaksi", "Waktu", "Pelanggan", "Layanan", "Total Net", "Metode & Detail Item", "Status"]];
    
    filtered.forEach(t => {
        let itemsStr = t.items.map(i => `${i.name}(${i.qty}x)`).join(', ');
        rows.push([t.orderSeq, t.id, new Date(t.date).toLocaleString('id-ID'), t.customer, t.serviceType, t.grandTotal, `${t.paymentMethod} [Items: ${itemsStr}]`, t.status]);
    });

    let wb = XLSX.utils.book_new();
    let ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, "Audit Owner");
    XLSX.writeFile(wb, `Audit_Pakchill_${dropdownText.replace(' ', '_')}_2026.xlsx`);
}

function exportFilteredOwnerReportPDF() {
    const element = document.getElementById('owner-audit-table-pdf-target');
    const dropdownText = document.getElementById('own-filter-month-select').options[document.getElementById('own-filter-month-select').selectedIndex].text;
    
    const opt = {
        margin:       5,
        filename:     `Laporan_Audit_Pakchill_${dropdownText.replace(' ', '_')}_2026.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2 },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'landscape' }
    };
    html2pdf().set(opt).from(element).save();
}
