const API = "http://localhost:5000/api";

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
  try {
    const res = await fetch(API + path, {
      headers: { "content-type": "application/json", ...options.headers },
      ...options,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || " lỗi không xác định");
    else return data;
  } catch (err) {
    throw err;
  }
}

function formatPrice(price) {
  if (price == null || price === 0) return "0 đ";
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(price);
}

function saveSession(email, role) {
  sessionStorage.setItem("bookdb_user", JSON.stringify({ email, role }));
}
function getSession() {
  const s = sessionStorage.getItem("bookdb_user");
  return s ? JSON.parse(s) : null;
}
function clearSession() {
  sessionStorage.removeItem("bookdb_user");
}

// =============================================
//  LOGIN / REGISTER
// =============================================
if (document.getElementById("loginForm")) {
  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");

  document.getElementById("showRegister")?.addEventListener("click", (e) => {
    e.preventDefault();
    loginForm.classList.add("hidden");
    registerForm.classList.remove("hidden");
  });
  document.getElementById("showLogin")?.addEventListener("click", (e) => {
    e.preventDefault();
    loginForm.classList.remove("hidden");
    registerForm.classList.add("hidden");
  });

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("loginBtn");
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang đăng nhập...';
    try {
      const data = await apiFetch("/login", {
        method: "POST",
        body: JSON.stringify({
          email: document.getElementById("loginEmail").value,
          password: document.getElementById("loginPassword").value,
        }),
      });
      saveSession(document.getElementById("loginEmail").value, data.role);
      showToast("Đăng nhập thành công! Đang chuyển trang...", "success");
      setTimeout(() => {
        if (data.role === "admin") {
          window.location.href = "dashboard.html";
        } else {
          window.location.href = "user.html";
        }
      }, 1000);
    } catch (err) {
      showToast(err.message, "error");
      btn.disabled = false;
      btn.innerHTML =
        '<span>Đăng Nhập</span><i class="fas fa-arrow-right"></i>';
    }
  });

  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await apiFetch("/register", {
        method: "POST",
        body: JSON.stringify({
          username: document.getElementById("regUsername").value,
          email: document.getElementById("regEmail").value,
          password: document.getElementById("regPassword").value,
        }),
      });
      showToast("Đăng ký thành công! Hãy đăng nhập.", "success");
      registerForm.classList.add("hidden");
      loginForm.classList.remove("hidden");
      registerForm.reset();
    } catch (err) {
      showToast(err.message, "error");
    }
  });
}

// =============================================
//  DASHBOARD (logoutBtn guard)
// =============================================
if (document.getElementById("logoutBtn")) {
  const session = getSession();
  if (!session) {
    window.location.href = "index.html";
  }
  document.getElementById("sidebarUsername").textContent = session?.email || "";
  document.getElementById("sidebarRole").textContent = session?.role || "user";

  document.getElementById("logoutBtn")?.addEventListener("click", () => {
    clearSession();
    setTimeout(() => (window.location.href = "index.html"), 300);
  });

  // ── TAB NAVIGATION ──
  let currentTab = "books";
  document.querySelectorAll(".nav-item").forEach((item) => {
    item.addEventListener("click", (e) => {
      e.preventDefault();
      const tab = item.dataset.tab;
      currentTab = tab;
      document
        .querySelectorAll(".nav-item")
        .forEach((n) => n.classList.remove("active"));
      item.classList.add("active");
      document
        .querySelectorAll(".tab-section")
        .forEach((s) => s.classList.add("hidden"));
      document.getElementById(`tab-${tab}`).classList.remove("hidden");
      if (tab === "books") loadBooks();
      if (tab === "authors") loadAuthors();
      if (tab === "categories") loadCategories();
      if (tab === "orders") loadOrders();
      if (tab === "edit-logs") loadEditLogs();
      if (tab === "report") {
        loadReportHistory();
      }
    });
  });

  // ── CLOSE MODALS ──
  document.querySelectorAll("[data-close]").forEach((btn) => {
    btn.addEventListener("click", () => closeModal(btn.dataset.close));
  });
  document.querySelectorAll(".modal-overlay").forEach((overlay) => {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) overlay.classList.add("hidden");
    });
  });

  // ── SEARCH BOOKS ──
  document.getElementById("searchBooks")?.addEventListener("input", (e) => {
    const q = e.target.value.toLowerCase();
    document.querySelectorAll("#booksBody tr").forEach((row) => {
      row.style.display = row.textContent.toLowerCase().includes(q)
        ? ""
        : "none";
    });
  });

  // ===========================================
  //  BOOKS
  // ===========================================
  let editingBookId = null;

  async function loadBooks() {
    const tbody = document.getElementById("booksBody");
    tbody.innerHTML = `<tr><td colspan="8" class="loading-row"><i class="fas fa-spinner fa-spin"></i> Đang tải...</td></tr>`;
    try {
      const books = await apiFetch("/books");
      document.getElementById("statBooks").textContent = books.length;
      if (!books.length) {
        tbody.innerHTML = `<tr><td colspan="8" class="loading-row">Chưa có sách nào</td></tr>`;
        return;
      }
      tbody.innerHTML = books
        .map(
          (b, i) => `
        <tr>
          <td>${i + 1}</td>
          <td><strong>${b.title}</strong></td>
          <td>${b.author}</td>
          <td><span style="background:rgba(201,168,76,0.15);color:var(--gold);padding:2px 9px;border-radius:20px;font-size:0.78rem">${b.category}</span></td>
          <td>${b.published_year || "—"}</td>
          <td>${b.quantity || 0}</td>
          <td style="color:var(--gold);font-weight:600">${formatPrice(b.price)}</td>
          <td>
            <div class="action-btns">
              <button class="btn btn-outline btn-sm btn-icon" onclick="editBook(${b.id})" title="Sửa">
                <i class="fas fa-pen"></i>
              </button>
              <button class="btn btn-danger btn-sm btn-icon" onclick="confirmDelete('book', ${b.id}, '${b.title}')" title="Xóa">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </td>
        </tr>
      `,
        )
        .join("");
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="8" class="loading-row" style="color:var(--danger)">${err.message}</td></tr>`;
    }
  }

  async function openBookModal(book = null) {
    editingBookId = book?.id || null;
    document.getElementById("modalBookTitle").textContent = book
      ? "Chỉnh Sửa Sách"
      : "Thêm Sách";
    document.getElementById("bookId").value = book?.id || "";
    document.getElementById("bookRowVer").value = book?.row_ver || "";
    document.getElementById("bookTitle").value = book?.title || "";
    document.getElementById("bookYear").value = book?.published_year || "";
    document.getElementById("bookDesc").value = book?.description || "";
    document.getElementById("bookquantity").value = book?.quantity || "";
    document.getElementById("bookPrice").value = book?.price || "";
    const [authors, categories] = await Promise.all([
      apiFetch("/authors"),
      apiFetch("/categories"),
    ]);
    const aSelect = document.getElementById("bookAuthor");
    const cSelect = document.getElementById("bookCategory");
    aSelect.innerHTML =
      `<option value="">-- Chọn tác giả --</option>` +
      authors
        .map(
          (a) =>
            `<option value="${a.id}" ${book?.author_id == a.id ? "selected" : ""}>${a.full_name}</option>`,
        )
        .join("");
    cSelect.innerHTML =
      `<option value="">-- Chọn thể loại --</option>` +
      categories
        .map(
          (c) =>
            `<option value="${c.id}" ${book?.category_id == c.id ? "selected" : ""}>${c.name}</option>`,
        )
        .join("");
    openModal("modalBook");
  }

  document
    .getElementById("btnAddBook")
    ?.addEventListener("click", () => openBookModal());

  window.editBook = async (id) => {
    const book = await apiFetch(`/books/${id}`);
    openBookModal(book);
  };

  document.getElementById("bookForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      title: document.getElementById("bookTitle").value,
      author_id: parseInt(document.getElementById("bookAuthor").value),
      category_id: parseInt(document.getElementById("bookCategory").value),
      published_year:
        parseInt(document.getElementById("bookYear").value) || null,
      description: document.getElementById("bookDesc").value,
      quantity: parseInt(document.getElementById("bookquantity").value) || 0,
      price: parseFloat(document.getElementById("bookPrice").value) || 0,
      row_ver: document.getElementById("bookRowVer").value,
    };
    try {
      if (editingBookId) {
        await apiFetch(`/books/${editingBookId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        showToast("Cập nhật sách thành công!");
      } else {
        await apiFetch("/books", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        showToast("Thêm sách thành công!");
      }
      closeModal("modalBook");
      loadBooks();
    } catch (err) {
      showToast(err.message, "error");
    }
  });

  // ===========================================
  //  AUTHORS
  // ===========================================
  let editingAuthorId = null;

  async function loadAuthors() {
    const tbody = document.getElementById("authorsBody");
    tbody.innerHTML = `<tr><td colspan="5" class="loading-row"><i class="fas fa-spinner fa-spin"></i> Đang tải...</td></tr>`;
    try {
      const authors = await apiFetch("/authors");
      document.getElementById("statAuthors").textContent = authors.length;
      if (!authors.length) {
        tbody.innerHTML = `<tr><td colspan="5" class="loading-row">Chưa có tác giả nào</td></tr>`;
        return;
      }
      tbody.innerHTML = authors
        .map(
          (a, i) => `
        <tr>
          <td>${i + 1}</td>
          <td><strong>${a.full_name}</strong></td>
          <td style="color:var(--muted);font-size:0.85rem">${a.bio || "—"}</td>
          <td>${a.birthdate || "—"}</td>
          <td>
            <div class="action-btns">
              <button class="btn btn-outline btn-sm btn-icon" onclick="editAuthor(${a.id})" title="Sửa">
                <i class="fas fa-pen"></i>
              </button>
              <button class="btn btn-danger btn-sm btn-icon" onclick="confirmDelete('author', ${a.id}, '${a.full_name}')" title="Xóa">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </td>
        </tr>
      `,
        )
        .join("");
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="5" class="loading-row" style="color:var(--danger)">${err.message}</td></tr>`;
    }
  }

  document.getElementById("btnAddAuthor")?.addEventListener("click", () => {
    editingAuthorId = null;
    document.getElementById("modalAuthorTitle").textContent = "Thêm Tác Giả";
    document.getElementById("authorForm").reset();
    openModal("modalAuthor");
  });

  window.editAuthor = async (id) => {
    const authors = await apiFetch("/authors");
    const a = authors.find((x) => x.id === id);
    if (!a) return;
    editingAuthorId = id;
    document.getElementById("modalAuthorTitle").textContent =
      "Chỉnh Sửa Tác Giả";
    document.getElementById("authorId").value = a.id;
    document.getElementById("authorRowVer").value = a.row_ver || "";
    document.getElementById("authorName").value = a.full_name;
    document.getElementById("authorBirth").value = a.birthdate || "";
    document.getElementById("authorBio").value = a.bio || "";
    openModal("modalAuthor");
  };

  document
    .getElementById("authorForm")
    ?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const payload = {
        full_name: document.getElementById("authorName").value,
        birthdate: document.getElementById("authorBirth").value || null,
        bio: document.getElementById("authorBio").value,
      };
      if (editingAuthorId) {
        const rowVer = document.getElementById("authorRowVer").value;
        if (rowVer) payload.row_ver = rowVer;
      }
      try {
        if (editingAuthorId) {
          await apiFetch(`/authors/${editingAuthorId}`, {
            method: "PUT",
            body: JSON.stringify(payload),
          });
          showToast("Cập nhật tác giả thành công!");
        } else {
          await apiFetch("/authors", {
            method: "POST",
            body: JSON.stringify(payload),
          });
          showToast("Thêm tác giả thành công!");
        }
        closeModal("modalAuthor");
        loadAuthors();
      } catch (err) {
        showToast(err.message, "error");
      }
    });

  // ===========================================
  //  CATEGORIES
  // ===========================================
  let editingCategoryId = null;

  async function loadCategories() {
    const tbody = document.getElementById("categoriesBody");
    tbody.innerHTML = `<tr><td colspan="4" class="loading-row"><i class="fas fa-spinner fa-spin"></i> Đang tải...</td></tr>`;
    try {
      const cats = await apiFetch("/categories");
      document.getElementById("statCategories").textContent = cats.length;
      if (!cats.length) {
        tbody.innerHTML = `<tr><td colspan="4" class="loading-row">Chưa có thể loại nào</td></tr>`;
        return;
      }
      tbody.innerHTML = cats
        .map(
          (c, i) => `
        <tr>
          <td>${i + 1}</td>
          <td><strong>${c.name}</strong></td>
          <td style="color:var(--muted);font-size:0.85rem">${c.description || "—"}</td>
          <td>
            <div class="action-btns">
              <button class="btn btn-outline btn-sm btn-icon" onclick="editCategory(${c.id})" title="Sửa">
                <i class="fas fa-pen"></i>
              </button>
              <button class="btn btn-danger btn-sm btn-icon" onclick="confirmDelete('category', ${c.id}, '${c.name}')" title="Xóa">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </td>
        </tr>
      `,
        )
        .join("");
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="4" class="loading-row" style="color:var(--danger)">${err.message}</td></tr>`;
    }
  }

  document.getElementById("btnAddCategory")?.addEventListener("click", () => {
    editingCategoryId = null;
    document.getElementById("modalCategoryTitle").textContent = "Thêm Thể Loại";
    document.getElementById("categoryForm").reset();
    openModal("modalCategory");
  });

  window.editCategory = async (id) => {
    const cats = await apiFetch("/categories");
    const c = cats.find((x) => x.id === id);
    if (!c) return;
    editingCategoryId = id;
    document.getElementById("modalCategoryTitle").textContent =
      "Chỉnh Sửa Thể Loại";
    document.getElementById("categoryId").value = c.id;
    document.getElementById("categoryRowVer").value = c.row_ver || "";
    document.getElementById("categoryName").value = c.name;
    document.getElementById("categoryDesc").value = c.description || "";
    openModal("modalCategory");
  };

  document
    .getElementById("categoryForm")
    ?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const payload = {
        name: document.getElementById("categoryName").value,
        description: document.getElementById("categoryDesc").value,
      };
      if (editingCategoryId) {
        const rowVer = document.getElementById("categoryRowVer").value;
        if (rowVer) payload.row_ver = rowVer;
      }
      try {
        if (editingCategoryId) {
          await apiFetch(`/categories/${editingCategoryId}`, {
            method: "PUT",
            body: JSON.stringify(payload),
          });
          showToast("Cập nhật thể loại thành công!");
        } else {
          await apiFetch("/categories", {
            method: "POST",
            body: JSON.stringify(payload),
          });
          showToast("Thêm thể loại thành công!");
        }
        closeModal("modalCategory");
        loadCategories();
      } catch (err) {
        showToast(err.message, "error");
      }
    });

  // ===========================================
  //  ORDERS
  // ===========================================
  async function loadOrders() {
    const tbody = document.getElementById("ordersBody");
    tbody.innerHTML = `<tr><td colspan="7" class="loading-row"><i class="fas fa-spinner fa-spin"></i> Đang tải...</td></tr>`;

    const monthEl = document.getElementById("filterMonth");
    const month = monthEl ? monthEl.value : "";
    const ordersUrl = month ? `/orders?month=${month}` : `/orders`;
    const statsUrl = month ? `/orders/stats?month=${month}` : `/orders/stats`;

    const monthLabel = month
      ? `Tháng ${month}/${new Date().getFullYear()}`
      : "Tất cả tháng";
    const revLabelEl = document.querySelector(".revenue-label");
    if (revLabelEl) revLabelEl.textContent = `Tổng doanh thu — ${monthLabel}`;

    try {
      const [orders, stats] = await Promise.all([
        apiFetch(ordersUrl),
        apiFetch(statsUrl),
      ]);
      document.getElementById("totalRevenue").textContent = formatPrice(
        stats.total_revenue,
      );
      document.getElementById("totalOrders").textContent =
        stats.total_orders + " đơn";
      document.getElementById("totalCustomers").textContent =
        stats.total_customers + " khách";

      if (!orders.length) {
        tbody.innerHTML = `<tr><td colspan="7" class="loading-row">Không có đơn hàng nào${month ? " trong tháng " + month : ""}</td></tr>`;
        return;
      }
      tbody.innerHTML = orders
        .map((o, i) => {
          const statusClass =
            o.status === "Đã xử lý"
              ? "status-done"
              : o.status === "Đã hủy"
                ? "status-cancel"
                : "status-pending";
          return `
          <tr>
            <td>${i + 1}</td>
            <td><strong>${o.book_title}</strong></td>
            <td style="color:var(--muted)">${o.user_email}</td>
            <td>${new Date(o.order_date).toLocaleString("vi-VN")}</td>
            <td style="color:var(--gold);font-weight:600">${formatPrice(o.price)}</td>
            <td><span class="order-status ${statusClass}">${o.status}</span></td>
            <td>
              <button class="btn btn-outline btn-sm" onclick="openOrderStatus(${o.id}, '${o.status}')">
                <i class="fas fa-pen"></i> Cập nhật
              </button>
            </td>
          </tr>`;
        })
        .join("");
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="7" class="loading-row" style="color:var(--danger)">${err.message}</td></tr>`;
    }
  }

  document
    .getElementById("filterMonth")
    ?.addEventListener("change", loadOrders);
  document
    .getElementById("btnRefreshOrders")
    ?.addEventListener("click", loadOrders);

  window.openOrderStatus = (id, currentStatus) => {
    document.getElementById("orderStatusId").value = id;
    document.getElementById("orderStatusSelect").value = currentStatus;
    openModal("modalOrderStatus");
  };

  document
    .getElementById("saveOrderStatusBtn")
    ?.addEventListener("click", async () => {
      const id = document.getElementById("orderStatusId").value;
      const status = document.getElementById("orderStatusSelect").value;
      try {
        await apiFetch(`/orders/${id}`, {
          method: "PUT",
          body: JSON.stringify({ status }),
        });
        showToast("Cập nhật trạng thái thành công!");
        closeModal("modalOrderStatus");
        loadOrders();
      } catch (err) {
        showToast(err.message, "error");
      }
    });

  // ===========================================
  //  EDIT LOGS
  // ===========================================
  async function loadEditLogs() {
    const tbody = document.getElementById("editLogsBody");
    tbody.innerHTML = `<tr><td colspan="5" class="loading-row"><i class="fas fa-spinner fa-spin"></i> Đang tải...</td></tr>`;
    try {
      const logs = await apiFetch("/edit-logs");
      if (!logs.length) {
        tbody.innerHTML = `<tr><td colspan="5" class="loading-row">Chưa có nhật ký nào</td></tr>`;
        return;
      }
      tbody.innerHTML = logs
        .map(
          (log, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${log.table_name}</td>
          <td>${log.record_id}</td>
          <td>${log.action}</td>
          <td>${new Date(log.edit_time).toLocaleString()}</td>
        </tr>
      `,
        )
        .join("");
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="5" class="loading-row" style="color:var(--danger)">${err.message}</td></tr>`;
    }
  }

  // ===========================================
  //  BÁO CÁO DOANH THU — PHANTOM READ DEMO
  // ===========================================
  async function loadReportHistory() {
    const tbody = document.getElementById("reportHistoryBody");
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="7" class="loading-row"><i class="fas fa-spinner fa-spin"></i> Đang tải...</td></tr>`;
    try {
      const rows = await apiFetch("/report/history");
      if (!rows.length) {
        tbody.innerHTML = `<tr><td colspan="7" class="loading-row">Chưa có báo cáo nào được lưu</td></tr>`;
        return;
      }
      tbody.innerHTML = rows
        .map((r, i) => {
          const isSerial = r.isolation_mode === "SERIALIZABLE";
          const modeStyle = isSerial
            ? "background:rgba(39,174,96,0.12);color:#2ecc71"
            : "background:rgba(41,128,185,0.12);color:#5dade2";
          const conStyle = r.is_consistent
            ? "background:rgba(39,174,96,0.12);color:#2ecc71"
            : "background:rgba(192,57,43,0.12);color:#e74c3c";
          const conText = r.is_consistent
            ? '<i class="fas fa-circle-check"></i> Nhất quán'
            : '<i class="fas fa-triangle-exclamation"></i> Phantom!';
          const monthStr = r.report_month
            ? `Tháng ${r.report_month}`
            : "Tất cả";
          const dt = r.report_time
            ? new Date(r.report_time).toLocaleString("vi-VN")
            : "—";
          return `<tr>
          <td>${i + 1}</td>
          <td style="color:var(--muted);font-size:0.85rem">${dt}</td>
          <td style="text-align:center">${monthStr}</td>
          <td><span style="padding:3px 9px;border-radius:20px;font-size:0.76rem;font-weight:600;${modeStyle}">${r.isolation_mode}</span></td>
          <td style="color:var(--gold);font-weight:600">${formatPrice(r.total_revenue)}</td>
          <td style="text-align:center">${r.total_orders} đơn / ${r.total_customers} khách</td>
          <td><span style="padding:3px 9px;border-radius:20px;font-size:0.76rem;font-weight:600;${conStyle}">${conText}</span></td>
        </tr>`;
        })
        .join("");
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="7" class="loading-row" style="color:var(--danger)">${err.message}</td></tr>`;
    }
  }

  async function runRealtimeReport(safe = false) {
    const runningEl = document.getElementById("reportRunning");
    const resultEl = document.getElementById("reportLastResult");
    const modeEl = document.getElementById("reportRunningMode");
    const btnRC = document.getElementById("btnRunReport");
    const btnSE = document.getElementById("btnRunReportSafe");
    const month = document.getElementById("reportMonth")?.value || "";
    const modeName = safe
      ? "SERIALIZABLE (an toàn)"
      : "READ COMMITTED (có phantom)";

    runningEl.style.display = "block";
    resultEl.style.display = "none";
    modeEl.textContent = `Đang chạy báo cáo ${modeName}...`;
    if (btnRC) btnRC.disabled = true;
    if (btnSE) btnSE.disabled = true;

    try {
      const url = safe
        ? `/report/realtime/safe${month ? "?month=" + month : ""}`
        : `/report/realtime${month ? "?month=" + month : ""}`;
      const d = await apiFetch(url);

      runningEl.style.display = "none";
      resultEl.style.display = "block";

      const badge = document.getElementById("reportConsistencyBadge");
      const consistent = d.is_consistent;
      if (consistent) {
        badge.style.background = "rgba(39,174,96,0.12)";
        badge.style.color = "#27ae60";
        badge.innerHTML = `<i class="fas fa-circle-check"></i> Nhất quán — Không có Phantom Read &nbsp;·&nbsp; ${modeName}`;
      } else {
        badge.style.background = "rgba(231,76,60,0.12)";
        badge.style.color = "#e74c3c";
        badge.innerHTML = `<i class="fas fa-triangle-exclamation"></i> PHANTOM READ phát hiện! +${d.phantom_diff} đơn mới &nbsp;·&nbsp; ${modeName}`;
      }

      const ord2 = d.total_orders;
      const diff = d.phantom_diff || 0;
      const ord1 = ord2 - diff;

      document.getElementById("resRev1").textContent =
        diff > 0 ? "(thấp hơn)" : formatPrice(d.total_revenue);
      document.getElementById("resRev2").textContent = formatPrice(
        d.total_revenue,
      );
      document.getElementById("resDiffRev").textContent =
        diff > 0 ? `+${diff} đơn mới` : "Không đổi";
      document.getElementById("resOrd1").textContent = ord1 + " đơn";
      document.getElementById("resOrd2").textContent = ord2 + " đơn";
      document.getElementById("resDiffOrd").textContent =
        diff > 0 ? `+${diff}` : "0";
      document.getElementById("resCust").textContent =
        d.total_customers + " khách";

      await loadReportHistory();
      showToast(
        consistent
          ? "Báo cáo hoàn tất — Nhất quán!"
          : "Báo cáo hoàn tất — Phát hiện Phantom Read!",
        consistent ? "success" : "error",
      );
    } catch (err) {
      runningEl.style.display = "none";
      showToast("Lỗi báo cáo: " + err.message, "error");
    } finally {
      if (btnRC) btnRC.disabled = false;
      if (btnSE) btnSE.disabled = false;
    }
  }

  document
    .getElementById("btnRunReport")
    ?.addEventListener("click", () => runRealtimeReport(false));
  document
    .getElementById("btnRunReportSafe")
    ?.addEventListener("click", () => runRealtimeReport(true));
  document
    .getElementById("btnRefreshHistory")
    ?.addEventListener("click", loadReportHistory);

  // ===========================================
  //  DELETE CONFIRM
  // ===========================================
  let deleteTarget = { type: null, id: null };

  window.confirmDelete = (type, id, name) => {
    deleteTarget = { type, id };
    const labels = { book: "sách", author: "tác giả", category: "thể loại" };
    document.getElementById("confirmMsg").textContent =
      `Bạn có chắc muốn xóa ${labels[type]} "${name}"?`;
    openModal("modalConfirm");
  };

  document
    .getElementById("confirmDeleteBtn")
    ?.addEventListener("click", async () => {
      const { type, id } = deleteTarget;
      const paths = {
        book: `/books/${id}`,
        author: `/authors/${id}`,
        category: `/categories/${id}`,
      };
      try {
        await apiFetch(paths[type], { method: "DELETE" });
        showToast("Xóa thành công!");
        closeModal("modalConfirm");
        if (type === "book") loadBooks();
        if (type === "author") loadAuthors();
        if (type === "category") loadCategories();
      } catch (err) {
        showToast(err.message, "error");
      }
    });

  // ===========================================
  //  INIT
  // ===========================================
  loadBooks();
  apiFetch("/authors")
    .then(
      (d) => (document.getElementById("statAuthors").textContent = d.length),
    )
    .catch(() => {});
  apiFetch("/categories")
    .then(
      (d) => (document.getElementById("statCategories").textContent = d.length),
    )
    .catch(() => {});
}
