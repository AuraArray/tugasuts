let products = [
    { id: 1, name: "Amoxicillin 500mg", price: 25000 },
    { id: 2, name: "Sanmol Tablet", price: 15000 },
    { id: 3, name: "Vitamin B Complex", price: 12000 },
    { id: 4, name: "Antasida Doen", price: 8000 }
];

const grid = document.getElementById('productGrid');

function render() {
    grid.innerHTML = "";
    products.forEach(p => {
        const card = document.createElement('div');
        card.className = 'product-card';
        card.innerHTML = `
            <h3>${p.name}</h3>
            <p>Harga: <strong>Rp ${p.price.toLocaleString()}</strong></p>
            <button class="btn-delete" onclick="remove(${p.id})">[ Hapus Item ]</button>
        `;
        grid.appendChild(card);
    });
}

document.getElementById('addBtn').addEventListener('click', () => {
    const n = document.getElementById('itemName');
    const p = document.getElementById('itemPrice');
    if(n.value && p.value) {
        products.push({ id: Date.now(), name: n.value, price: parseInt(p.value) });
        n.value = ""; p.value = "";
        render();
    }
});

function remove(id) {
    products = products.filter(x => x.id !== id);
    render();
}

document.getElementById('orderForm').addEventListener('submit', function(e) {
    e.preventDefault();
    let valid = true;
    
    // Validasi Sederhana
    const name = document.getElementById('custName');
    const email = document.getElementById('custEmail');
    const qty = document.getElementById('custQty');

    if(name.value.length < 3) {
        document.getElementById('err-custName').innerText = "Nama terlalu pendek!";
        valid = false;
    }
    if(!email.value.includes('@')) {
        document.getElementById('err-custEmail').innerText = "Email tidak valid!";
        valid = false;
    }
    if(qty.value <= 0) {
        document.getElementById('err-custQty').innerText = "Jumlah harus positif!";
        valid = false;
    }

    if(valid) alert("Pesanan Berhasil!");
});

render();
