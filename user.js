const API = "http://localhost:5000/api";

// ===== UTILS =====
function showToast(msg, type = "success") {
  const icons = {
    success: "fa-circle-check",
    error: "fa-circle-xmark",
    info: "fa-circle-info",
  };
  const t = document.getElementById("toast");
  if (!t) return;
  t.className = `toast ${type}`;
  t.innerHTML = `<i class="fas ${icons[type]}"></i> ${msg}`;
  t.classList.remove("hidden");
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.add("hidden"), 3000);
}

function openModal(id) {
  document.getElementById(id).classList.remove("hidden");
}
function closeModal(id) {
  document.getElementById(id).classList.add("hidden");
}

async function apiFetch(path, options = {}) {
  const res = await fetch(API + path, {
    headers: { "content-type": "application/json", ...options.headers },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Lỗi không xác định");
  return data;
}

// ===== AUTH CHECK =====
const session = JSON.parse(sessionStorage.getItem("bookdb_user") || "null");
if (!session) {
  window.location.href = "index.html";
} else if (session.role === "admin") {
  window.location.href = "dashboard.html"; // admin đi về dashboard
} else {
  document.getElementById("heroUsername").textContent = session.email;
}

document.getElementById("logoutBtn").addEventListener("click", () => {
  sessionStorage.removeItem("bookdb_user");
  window.location.href = "index.html";
});

// ===== STATE =====
let allBooks = [];
let currentCat = "all";
let searchQuery = "";

// ===== LOAD DATA =====
async function loadBooks() {
  try {
    const data = await apiFetch("/books");
    allBooks = data;
    renderStats(data);
    renderBooks();
  } catch (err) {
    document.getElementById("booksGrid").innerHTML = `
            <div class="empty-state">
              <i class="fas fa-circle-exclamation" style="color:#e74c3c;"></i>
              <p>Không thể tải dữ liệu: ${err.message}</p>
            </div>`;
  }
}

async function loadCategories() {
  try {
    const cats = await apiFetch("/categories");
    document.getElementById("statCats").textContent = cats.length;
    const wrap = document.getElementById("catBtns");
    wrap.innerHTML = cats
      .map(
        (c) => `<button class="cat-btn" data-cat="${c.id}">${c.name}</button>`,
      )
      .join("");
    wrap.querySelectorAll(".cat-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        document
          .querySelectorAll(".cat-btn")
          .forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        currentCat = btn.dataset.cat;
        updateFilterStatus(currentCat === "all" ? null : btn.textContent);
        renderBooks();
      });
    });
  } catch (_) {}
}

// ===== RENDER =====
function renderStats(books) {
  document.getElementById("statTotal").textContent = books.length;
  const authors = new Set(books.map((b) => b.author).filter(Boolean));
  document.getElementById("statAuthors").textContent = authors.size;
}

function renderBooks() {
  const grid = document.getElementById("booksGrid");
  let filtered = allBooks;

  if (currentCat !== "all") {
    filtered = filtered.filter(
      (b) => String(b.category_id) === String(currentCat),
    );
  }
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(
      (b) =>
        (b.title || "").toLowerCase().includes(q) ||
        (b.author || "").toLowerCase().includes(q),
    );
  }

  if (filtered.length === 0) {
    grid.innerHTML = `
            <div class="empty-state">
              <i class="fas fa-magnifying-glass"></i>
              <p>Không tìm thấy sách phù hợp</p>
            </div>`;
    return;
  }

  grid.innerHTML = filtered
    .map(
      (b, i) => `
          <div class="book-card" onclick="openDetail(${b.id})">
            <div class="book-cover" style="background: ${coverGradient(i)}">
              <i class="fas fa-book-open"></i>
              ${b.publish_year ? `<div class="book-cover-num">${b.publish_year}</div>` : ""}
            </div>
            <div class="book-info">
              <div class="book-title">${b.title}</div>
              <div class="book-author">
                <i class="fas fa-feather-alt"></i>
                ${b.author || "Chưa có tác giả"}
              </div>
              <div class="book-meta">
                <span class="book-category">${b.category || "Chưa phân loại"}</span>
                ${b.quantity != null ? `<span class="book-year"><i class="fas fa-cubes"></i> ${b.quantity} quyển</span>` : ""}
              </div>
            </div>
          </div>
        `,
    )
    .join("");
}

function coverGradient(i) {
  const gradients = [
    "linear-gradient(135deg, #1a1a2e, #0f3460)",
    "linear-gradient(135deg, #2d1b69, #11998e)",
    "linear-gradient(135deg, #373b44, #4286f4)",
    "linear-gradient(135deg, #4a1942, #c0392b)",
    "linear-gradient(135deg, #134e5e, #71b280)",
    "linear-gradient(135deg, #3a1c71, #d76d77)",
  ];
  return gradients[i % gradients.length];
}

function updateFilterStatus(catName) {
  const wrap = document.getElementById("filterStatus");
  const txt = document.getElementById("filterStatusText");
  if (catName) {
    wrap.style.display = "flex";
    txt.innerHTML = `Đang lọc: <strong style="color:var(--gold)">${catName}</strong>`;
  } else {
    wrap.style.display = "none";
  }
}

// ===== DETAIL MODAL =====
function openDetail(id) {
  const book = allBooks.find((b) => b.id === id);
  if (!book) return;
  console.log("Book object:", book); // ← xem id có đúng không
  console.log("Book ID:", book.id);
  document.getElementById("detailTitle").textContent = book.title;
  document.getElementById("detailAuthor").textContent = book.author || "—";
  document.getElementById("detailCategory").textContent = book.category || "—";
  document.getElementById("detailYear").textContent =
    book.published_year || "—";
  document.getElementById("detailQty").textContent =
    book.quantity != null ? `${book.quantity} quyển` : "—";

  // ✅ Dùng id thay vì class
  // Tìm nút đọc ngay
  const readBtn = document.getElementById("btnReadNow");

  if (readBtn) {
    // readBtn.style.display = "inline-block";
    // Xóa bỏ onclick cũ để tránh bị lặp hoặc xung đột
    readBtn.onclick = () => {
      const url = `reader.html?id=${book.id}&title=${encodeURIComponent(book.title)}`;
      window.location.href = url; // ← mở trong tab hiện tại, không bị block
    };
  }
  // khi ấn mượn ngay thì sẽ chuyển sang form có thông tin liên hệ
  // Thay đoạn btnborrow hiện tại:
  const borrowBtn = document.getElementById("btnborrow");
  if (borrowBtn) {
    borrowBtn.onclick = () => {
      openModal("link_borrow");
    };
  }
  const descWrap = document.getElementById("detailDescWrap");
  if (book.description) {
    descWrap.style.display = "block";
    document.getElementById("detailDesc").textContent = book.description;
  } else {
    descWrap.style.display = "none";
  }

  openModal("modalDetail");
}

// ===== SEARCH =====
document.getElementById("searchBooks").addEventListener("input", (e) => {
  searchQuery = e.target.value;
  renderBooks();
});

// ===== ALL TAB FILTER BTN =====
document
  .querySelector(".cat-btn[data-cat='all']")
  .addEventListener("click", function () {
    document
      .querySelectorAll(".cat-btn")
      .forEach((b) => b.classList.remove("active"));
    this.classList.add("active");
    currentCat = "all";
    updateFilterStatus(null);
    renderBooks();
  });

// ===== CLOSE MODALS =====
document.querySelectorAll("[data-close]").forEach((btn) => {
  btn.addEventListener("click", () => closeModal(btn.dataset.close));
});
document.querySelectorAll(".modal-overlay").forEach((overlay) => {
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeModal(overlay.id);
  });
});

//

// ===== INIT =====
loadBooks();
loadCategories();
