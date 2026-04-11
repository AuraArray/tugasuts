// 1. Data Inventory Awal (Soal 5)
let inventory = [
    { id: 1, name: "Amoxicillin 500mg", price: "25000" },
    { id: 2, name: "Sanmol Tablet", price: "15000" },
    { id: 3, name: "Vitamin B Complex", price: "12000" },
    { id: 4, name: "Antasida Doen", price: "8000" }
];

const grid = document.getElementById('productGrid');

// Fungsi Render Item
function renderProducts() {
    grid.innerHTML = "";
    inventory.forEach(item => {
        const div = document.createElement('div');
        div.className = 'product-card';
        div.innerHTML = `
            <h3>${item.name}</h3>
            <p>Harga: Rp ${item.price}</p>
            <button onclick="deleteItem(${item.id})" style="background:none; border:none; color:red; cursor:pointer; margin-top:10px;">[ Hapus Item ]</button>
        `;
        grid.appendChild(div);
    });
}

// Tambah Item Baru
document.getElementById('addBtn').addEventListener('click', () => {
    const nameInput = document.getElementById('itemName');
    const priceInput = document.getElementById('itemPrice');

    if (nameInput.value && priceInput.value) {
        inventory.push({
            id: Date.now(),
            name: nameInput.value,
            price: priceInput.value
        });
        nameInput.value = "";
        priceInput.value = "";
        renderProducts();
    } else {
        alert("Mohon lengkapi data produk!");
    }
});

// Hapus Item
function deleteItem(id) {
    inventory = inventory.filter(obj => obj.id !== id);
    renderProducts();
}

// 2. Validasi Form (Soal 4)
document.getElementById('orderForm').addEventListener('submit', function(e) {
    e.preventDefault();
    let status = true;

    // Reset Pesan
    document.querySelectorAll('.error').forEach(s => s.innerText = "");

    const name = document.getElementById('custName').value;
    const email = document.getElementById('custEmail').value;
    const phone = document.getElementById('custPhone').value;

    // Validasi Kosong
    if (name.length < 3) {
        document.getElementById('err-custName').innerText = "Nama minimal 3 karakter";
        status = false;
    }

    // Validasi Email Regex
    const emailReg = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailReg.test(email)) {
        document.getElementById('err-custEmail').innerText = "Gunakan format email yang benar";
        status = false;
    }

    // Validasi Angka Positif
    if (phone === "" || parseInt(phone) <= 0) {
        document.getElementById('err-custPhone').innerText = "Nomor telepon harus angka positif";
        status = false;
    }

    if (status) {
        alert("Form Terkirim! Terima kasih Rizky Tanjung.");
        this.reset();
    }
});

// Inisialisasi Pertama
renderProducts();
