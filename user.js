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

function formatPrice(price) {
  if (price == null || price === 0) return "Miễn phí";
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(price);
}

// ===== AUTH CHECK =====
const session = JSON.parse(sessionStorage.getItem("bookdb_user") || "null");
if (!session) {
  window.location.href = "index.html";
} else if (session.role === "admin") {
  window.location.href = "dashboard.html";
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
let currentBookForOrder = null; // sách đang được chọn để đặt

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

async function loadOrders() {
  try {
    const data = await apiFetch("/orders"); // API của anh

    renderOrders(data);
  } catch (err) {
    document.getElementById("ordersBody").innerHTML = `
      <tr>
        <td colspan="5" style="text-align:center;color:red;">
          Lỗi tải đơn hàng: ${err.message}
        </td>
      </tr>
    `;
  }
}

function renderOrders(orders) {
  const tbody = document.getElementById("ordersBody");

  if (!orders || orders.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align:center;">
          Không có đơn hàng nào
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = orders
    .map(
      (o, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${o.book_title || "—"}</td>
        <td>${formatDate(o.created_at)}</td>
        <td>${formatPrice(o.price)}</td>
        <td>
          <span class="status ${o.status}">
            ${getStatusText(o.status)}
          </span>
        </td>
      </tr>
    `,
    )
    .join("");
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("vi-VN");
}

function formatPrice(p) {
  if (!p) return "—";
  return Number(p).toLocaleString("vi-VN") + " đ";
}

function getStatusText(status) {
  switch (status) {
    case "pending":
      return "Chờ xử lý";
    case "done":
      return "Hoàn thành";
    case "cancel":
      return "Đã hủy";
    default:
      return status;
  }
}

document
  .getElementById("btnRefreshOrders")
  .addEventListener("click", loadOrders);
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
    grid.innerHTML = `<div class="empty-state"><i class="fas fa-magnifying-glass"></i><p>Không tìm thấy sách phù hợp</p></div>`;
    return;
  }
  grid.innerHTML = filtered
    .map(
      (b, i) => `
      <div class="book-card" onclick="openDetail(${b.id})">
        <div class="book-cover" style="background:${coverGradient(i)}">
          <i class="fas fa-book-open"></i>
          ${b.published_year ? `<div class="book-cover-num">${b.published_year}</div>` : ""}
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
          <div class="book-price-tag">
            <i class="fas fa-tag"></i> ${formatPrice(b.price)}
          </div>
        </div>
      </div>`,
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

  currentBookForOrder = book; // lưu sách hiện tại để dùng khi đặt

  document.getElementById("detailTitle").textContent = book.title;
  document.getElementById("detailAuthor").textContent = book.author || "—";
  document.getElementById("detailCategory").textContent = book.category || "—";
  document.getElementById("detailYear").textContent =
    book.published_year || "—";
  document.getElementById("detailQty").textContent =
    book.quantity != null ? `${book.quantity} quyển` : "—";
  document.getElementById("detailPrice").textContent = formatPrice(book.price);

  // Trạng thái tồn kho
  const stockEl = document.getElementById("detailStockStatus");
  if (book.quantity > 0) {
    stockEl.innerHTML = `<span class="qty-ok"><i class="fas fa-circle-check"></i> Còn sách</span>`;
  } else {
    stockEl.innerHTML = `<span class="qty-out"><i class="fas fa-circle-xmark"></i> Hết sách</span>`;
  }

  // Nút đặt ngay
  const orderBtn = document.getElementById("btnOrderNow");
  orderBtn.disabled = book.quantity <= 0;
  if (book.quantity <= 0) {
    orderBtn.innerHTML = `<i class="fas fa-ban"></i> Hết sách`;
  } else {
    orderBtn.innerHTML = `<i class="fas fa-cart-shopping"></i> Đặt ngay`;
  }

  // Mô tả
  const descWrap = document.getElementById("detailDescWrap");
  if (book.description) {
    descWrap.style.display = "block";
    document.getElementById("detailDesc").textContent = book.description;
  } else {
    descWrap.style.display = "none";
  }

  openModal("modalDetail");
}

// ===== NÚT ĐẶT NGAY → mở modal xác nhận =====
document.getElementById("btnOrderNow").addEventListener("click", () => {
  if (!currentBookForOrder) return;
  const book = currentBookForOrder;

  document.getElementById("confirmBookTitle").textContent = book.title;
  document.getElementById("confirmEmail").textContent = session.email;
  document.getElementById("confirmPrice").textContent = formatPrice(book.price);

  closeModal("modalDetail");
  openModal("modalOrderConfirm");
});

// ===== XÁC NHẬN ĐẶT → gọi API =====
document
  .getElementById("confirmOrderBtn")
  .addEventListener("click", async () => {
    if (!currentBookForOrder) return;
    const btn = document.getElementById("confirmOrderBtn");
    btn.disabled = true;
    btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Đang đặt...`;

    try {
      const result = await apiFetch("/orders", {
        method: "POST",
        body: JSON.stringify({
          book_id: currentBookForOrder.id,
          user_email: session.email,
        }),
      });

      closeModal("modalOrderConfirm");

      // Hiện modal thành công
      const order = result.order || {};
      document.getElementById("successMsg").textContent =
        `Đơn hàng #${order.order_id || ""} đã được ghi nhận. Vui lòng đến thư viện để nhận sách.`;
      document.getElementById("successDetail").innerHTML = `
      <div class="order-confirm-row">
        <span class="label">Tên sách</span>
        <span class="value">${order.book_title || currentBookForOrder.title}</span>
      </div>
      <div class="order-confirm-row">
        <span class="label">Ngày đặt</span>
        <span class="value">${order.order_date ? new Date(order.order_date).toLocaleString("vi-VN") : new Date().toLocaleString("vi-VN")}</span>
      </div>
      <div class="order-confirm-row">
        <span class="label">Tổng tiền</span>
        <span class="value gold">${formatPrice(order.price ?? currentBookForOrder.price)}</span>
      </div>
      <div class="order-confirm-row">
        <span class="label">Trạng thái</span>
        <span class="value">${order.status || "Chờ xử lý"}</span>
      </div>`;
      openModal("modalOrderSuccess");

      // Cập nhật số lượng cục bộ (không cần reload)
      const bookInList = allBooks.find((b) => b.id === currentBookForOrder.id);
      if (bookInList && bookInList.quantity > 0) bookInList.quantity -= 1;
      renderBooks();
      currentBookForOrder = null;
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      btn.disabled = false;
      btn.innerHTML = `<i class="fas fa-check"></i> Xác nhận đặt`;
    }
  });

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

// ===== TAB SWITCH =====
const orderBtn = document.getElementById("orderBtn");
const tabOrders = document.getElementById("tab-orders");

orderBtn.addEventListener("click", () => {
  // Ẩn danh sách sách
  document.querySelector(".books-container").style.display = "none";

  // Hiện tab đơn hàng
  tabOrders.classList.remove("hidden");

  // Load dữ liệu đơn hàng
  loadOrders();
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

// ===== INIT =====
loadBooks();
loadCategories();
