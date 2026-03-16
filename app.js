// =============================================
//  CONFIG
// =============================================
const API = "http://localhost:5000/api";

// =============================================
//  UTILITIES
// =============================================
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
      headers: { "Content-Type": "application/json", ...options.headers },
      ...options,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Lỗi không xác định");
    return data;
  } catch (err) {
    throw err;
  }
}

// =============================================
//  SESSION HELPERS
// =============================================
function saveSession(username, role) {
  sessionStorage.setItem("bookdb_user", JSON.stringify({ username, role }));
}
function getSession() {
  const s = sessionStorage.getItem("bookdb_user");
  return s ? JSON.parse(s) : null;
}
function clearSession() {
  sessionStorage.removeItem("bookdb_user");
}

// =============================================
//  LOGIN PAGE  (index.html)
// =============================================
if (document.getElementById("loginForm")) {
  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");

  // Toggle forms
  document.getElementById("showRegister")?.addEventListener("click", (e) => {
    e.preventDefault();
    loginForm.classList.add("hidden");
    registerForm.classList.remove("hidden");
  });
  document.getElementById("showLogin")?.addEventListener("click", (e) => {
    e.preventDefault();
    registerForm.classList.add("hidden");
    loginForm.classList.remove("hidden");
  });

  // LOGIN
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("loginBtn");
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang đăng nhập...';
    try {
      const data = await apiFetch("/login", {
        method: "POST",
        body: JSON.stringify({
          username: document.getElementById("loginUsername").value,
          password: document.getElementById("loginPassword").value,
        }),
      });
      saveSession(document.getElementById("loginUsername").value, data.role);
      showToast("Đăng nhập thành công! Đang chuyển trang...", "success");
      setTimeout(() => (window.location.href = "dashboard.html"), 1000);
    } catch (err) {
      showToast(err.message, "error");
      btn.disabled = false;
      btn.innerHTML =
        '<span>Đăng Nhập</span><i class="fas fa-arrow-right"></i>';
    }
  });

  // REGISTER
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
//  DASHBOARD PAGE  (dashboard.html)
// =============================================
if (document.getElementById("logoutBtn")) {
  // --- Auth guard ---
  const session = getSession();
  if (!session) {
    window.location.href = "index.html";
  }

  // Show username + role
  document.getElementById("sidebarUsername").textContent =
    session?.username || "";
  document.getElementById("sidebarRole").textContent = session?.role || "user";

  // Logout
  document.getElementById("logoutBtn").addEventListener("click", () => {
    clearSession();
    window.location.href = "index.html";
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
    tbody.innerHTML = `<tr><td colspan="6" class="loading-row"><i class="fas fa-spinner fa-spin"></i> Đang tải...</td></tr>`;
    try {
      const books = await apiFetch("/books");
      document.getElementById("statBooks").textContent = books.length;
      if (!books.length) {
        tbody.innerHTML = `<tr><td colspan="6" class="loading-row">Chưa có sách nào</td></tr>`;
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
      tbody.innerHTML = `<tr><td colspan="6" class="loading-row" style="color:var(--danger)">${err.message}</td></tr>`;
    }
  }

  async function openBookModal(book = null) {
    editingBookId = book?.id || null;
    document.getElementById("modalBookTitle").textContent = book
      ? "Chỉnh Sửa Sách"
      : "Thêm Sách";
    document.getElementById("bookId").value = book?.id || "";
    document.getElementById("bookTitle").value = book?.title || "";
    document.getElementById("bookYear").value = book?.published_year || "";
    document.getElementById("bookDesc").value = book?.description || "";

    // Load selects
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
  // Pre-load stats silently
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
