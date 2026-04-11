// Data Array of Objects (Soal 5)
let stock = [
    { id: 1, name: "Paracetamol", price: 12000 },
    { id: 2, name: "Cefadroxil", price: 45000 },
    { id: 3, name: "Vitamin D3", price: 32000 },
    { id: 4, name: "Antasida Syrup", price: 18500 }
];

const productGrid = document.getElementById('productGrid');

// Render Function
function renderUI() {
    productGrid.innerHTML = "";
    stock.forEach(item => {
        const div = document.createElement('div');
        div.className = 'card';
        div.innerHTML = `
            <h3>${item.name}</h3>
            <p>Rp ${item.price.toLocaleString('id-ID')}</p>
            <button class="btn-del" onclick="deleteItem(${item.id})">Hapus Produk</button>
        `;
        productGrid.appendChild(div);
    });
}

// Add Item
document.getElementById('addBtn').onclick = () => {
    const name = document.getElementById('itemName');
    const price = document.getElementById('itemPrice');
    
    if(name.value && price.value) {
        stock.push({ id: Date.now(), name: name.value, price: parseInt(price.value) });
        name.value = ""; price.value = "";
        renderUI();
    }
};

// Delete Item
function deleteItem(id) {
    stock = stock.filter(item => item.id !== id);
    renderUI();
}

// Form Validation (Soal 4)
document.getElementById('orderForm').onsubmit = function(e) {
    e.preventDefault();
    let isSuccess = true;

    // Reset errors
    document.querySelectorAll('.error').forEach(e => e.innerText = "");

    const name = document.getElementById('custName').value;
    const email = document.getElementById('custEmail').value;
    const phone = document.getElementById('custPhone').value;

    if(name === "") {
        document.getElementById('err-custName').innerText = "Nama wajib diisi!";
        isSuccess = false;
    }
    if(!email.includes('@')) {
        document.getElementById('err-custEmail').innerText = "Format email salah!";
        isSuccess = false;
    }
    if(phone <= 0 || phone === "") {
        document.getElementById('err-custPhone').innerText = "Nomor telepon harus angka positif!";
        isSuccess = false;
    }

    if(isSuccess) {
        alert("Terima kasih Rizky! Pesanan diproses.");
        this.reset();
    }
};

renderUI();
