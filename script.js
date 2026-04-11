// DATA AWAL (Soal 5: Array of Objects)
let database = [
    { id: 1, name: "CYBER-OXIN 500", price: 85000 },
    { id: 2, name: "NANO-PARACETAMOL", price: 25000 },
    { id: 3, name: "NEURO-VITAMIN D", price: 125000 },
    { id: 4, name: "BIONIC-ANTASIDA", price: 45000 }
];

const productGrid = document.getElementById('productGrid');

// FUNGSI RENDER (Soal 5: Manipulasi DOM)
function renderProducts() {
    productGrid.innerHTML = "";
    database.forEach(item => {
        const div = document.createElement('div');
        div.className = 'card';
        div.innerHTML = `
            <h3>${item.name}</h3>
            <p class="price">IDR ${item.price.toLocaleString('id-ID')}</p>
            <button class="btn-del" onclick="removeItem(${item.id})">DEACTIVATE ITEM</button>
        `;
        productGrid.appendChild(div);
    });
}

// FUNGSI TAMBAH DATA (Soal 5)
document.getElementById('addBtn').onclick = () => {
    const inputName = document.getElementById('itemName');
    const inputPrice = document.getElementById('itemPrice');

    if(inputName.value && inputPrice.value) {
        database.push({
            id: Date.now(),
            name: inputName.value.toUpperCase(),
            price: parseInt(inputPrice.value)
        });
        inputName.value = "";
        inputPrice.value = "";
        renderProducts();
    } else {
        alert("Mohon isi semua data!");
    }
};

// FUNGSI HAPUS DATA
function removeItem(id) {
    database = database.filter(item => item.id !== id);
    renderProducts();
}

// VALIDASI FORM (Soal 4)
document.getElementById('orderForm').addEventListener('submit', function(e) {
    e.preventDefault();
    let valid = true;

    // Reset Pesan Error
    document.querySelectorAll('.error').forEach(e => e.innerText = "");

    const name = document.getElementById('custName').value;
    const email = document.getElementById('custEmail').value;
    const phone = document.getElementById('custPhone').value;

    // 1. Validasi Nama
    if(name.length < 3) {
        document.getElementById('err-custName').innerText = "IDENTITAS MINIMAL 3 KARAKTER!";
        valid = false;
    }

    // 2. Validasi Email (Regex)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if(!emailRegex.test(email)) {
        document.getElementById('err-custEmail').innerText = "FORMAT EMAIL TIDAK VALID!";
        valid = false;
    }

    // 3. Validasi Nomor Telepon (Angka Positif)
    if(phone === "" || parseInt(phone) <= 0) {
        document.getElementById('err-custPhone').innerText = "NOMOR WAJIB ANGKA POSITIF!";
        valid = false;
    }

    if(valid) {
        alert("DATA TERVERIFIKASI! Terima kasih Rizky Tanjung.");
        this.reset();
    }
});

// Render awal saat halaman dibuka
renderProducts();
