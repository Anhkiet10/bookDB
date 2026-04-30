const API = "http://localhost:5000/api"; //gán biến hằng api là đường link của

function showToast(msg, type = "success") {
  // đây là hàm showtost với type này là truyền tham số vào , nếu ko truyền thì mặc định là "success"
  const icons = {
    success: "fa-circle-check",
    error: "fa-circle-xmark",
    info: "fa-circle-info",
  };
  // icon đây là  tạo hằng biến với các loại mã font awesome icon để khi truyền vào tham số thì <i class="fas ${icons[type]}"></i> ${msg}`; ví dụ success thì sẽ truyền mã của success vào html
  const t = document.getElementById("toast");
  if (!t) return; // nếu khai báo nhỏ này ko tồn tại thì sẽ return dừng luôn hàm
  t.className = `toast ${type}`; // đây là gán class (là thay đổi class hiện tại ) vào div của toast để khi gọi ở dưới thì nó sẽ xuất ra như toast success,...
  t.innerHTML = `<i class="fas ${icons[type]}"></i> ${msg}`; // hiện lên màn hình với icon và msg khi truyền vào
  t.classList.remove("hidden"); //xóa hidden để nó hiện lên
  //clearTimeout giúp hủy bỏ việc ẩn của lần bấm trước đó để bắt đầu đếm lại từ đầu.
  // vd như ấn đăng nhập nhiều lần thì lệnh này hiện thông báo với 3 giây và khi ấn nhiều lần thì nhiều thông báo hiện lên với 3 giây và bắt đầu khác nhau lúc này gây khó chiệu
  // nên cái này giúp xóa đi lệnh cũ chỉ để thông báo mới nhất đc cập nhật chạy đủ 3 giây là hết
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.add("hidden"), 3000);
  //Thiết lập một "Lịch hẹn mới". Sau đúng 3000ms (3 giây), nó sẽ tự động thêm lại class hidden để thông báo biến mất một cách nhẹ nhàng.
}
//--
function openModal(id) {
  // khi gọi hàm và truyền biến vào có thể gọi nhiều lần
  document.getElementById(id).classList.remove("hidden"); //dùng để xóa ẩn đi
}
function closeModal(id) {
  document.getElementById(id).classList.add("hidden"); //dùng để ẩn đi
}

async function apiFetch(path, options = {}) {
  // path là đuôi đc cộng vào như /login
  //Nếu khi gọi hàm apiFetch, người dùng không truyền vào tham số thứ hai, thì hãy coi biến options là một cái hộp rỗng {}."
  try {
    const res = await fetch(API + path, {
      headers: { "content-type": "application/json", ...options.headers },
      ...options, // options này là để như ghi đè lên
    });
    const data = await res.json(); //Việc chuyển đổi từ một chuỗi văn bản thô (JSON string) sang một đối tượng JavaScript (Object)
    if (!res.ok)
      //Nó chỉ trả về true nếu mã trạng thái (Status Code) nằm trong khoảng 200-299 (Thành công).
      //Khi nhập sai mật khẩu, Python trả về lỗi 401. Lúc này fetch vẫn nhận được dữ liệu, nhưng res.ok sẽ là false.
      throw new Error(data.error || " lỗi không xác định"); //Nó sẽ kiểm tra xem trong cái hộp data mà Python gửi về có chữ error không (ví dụ: "Tài khoản bị khóa"). Nếu không có, nó sẽ dùng câu thông báo dự phòng phía sau.
    //lệnh này chủ động "ném" ra một ngoại lệ. Nó ngắt ngang mạch chạy bình thường và ép chương trình phải nhảy xuống khối catch
    else return data; //ệnh throw err: Nó lại ném tiếp cái lỗi đó ra ngoài cửa sổ của hàm apiFetch.
    //Tại hàm Login (nơi gọi API): Vì hàm này đang dùng try...catch bao quanh lệnh gọi apiFetch, nó sẽ "hứng" được cái lỗi đó vào biến err của riêng nó.
  } catch (err) {
    //catch (err), bạn đang nói với JavaScript: "Nếu có lỗi, hãy tóm lấy nó và đặt tên cho nó là err để tôi còn biết đường mà xử lý."
    throw err;
  }
}

function saveSession(email, role) {
  sessionStorage.setItem("bookdb_user", JSON.stringify({ email, role })); // bookdb_user là được tạo tạm thời để lưu trữ
  // Đây là một kho lưu trữ tạm thời của trình duyệt. Dữ liệu trong này sẽ tự động biến mất khi bạn đóng tab hoặc đóng trình duyệt.
  // JSON.stringify chỉ hiểu văn bản thuần túy (string). Vì vậy, chúng ta phải "đóng gói" đối tượng chứa tên người dùng và quyền hạn thành một chuỗi chữ mới lưu được.
}
function getSession() {
  const s = sessionStorage.getItem("bookdb_user"); //Lấy chuỗi văn bản đã lưu ra từ kho.
  //sessionStorage hoặc localStorage), trình duyệt chỉ cho phép lưu trữ kiểu dữ liệu String (văn bản).
  return s ? JSON.parse(s) : null; //Chuyển chuỗi văn bản đó ngược lại thành đối tượng (Object) để JavaScript có thể đọc được username và role.
  //getItem JSON.stringify(obj) để biến nó thành chuỗi "{"name":"Admin","role":1}".Nếu có dữ liệu thì trả về thông tin người dùng, nếu không có (chưa đăng nhập) thì trả về null.
  //Nếu s có giá trị (truthy) thì đi tiếp, nếu không trả về null.
}
function clearSession() {
  sessionStorage.removeItem("bookdb_user");
  // để xóa hế dữ liệu đã lưu trong session bao gồm tài khoản mật khẩu để khi nó kiểm tra session ko thấy dữ liệu thì sẽ chuyển sang trang đăng nhập
}

// =============================================
//  chuyển đổi khi nhấn vào đăng ký hoặc đăng nhập từ trang đăng ký
// =============================================
if (document.getElementById("loginForm")) {
  //kiểm tra xem trong file HTML hiện tại có cái ID nào tên là loginForm không
  const loginForm = document.getElementById("loginForm"); // tạo biến để dễ gọi
  const registerForm = document.getElementById("registerForm");

  // kiểm tra khi có click vào đăng ký
  document.getElementById("showRegister")?.addEventListener("click", (e) => {
    //(e) => {} → là function , chứa toàn bộ thông tin của lần click đó
    //e → là tham số của function
    //Giá trị của e → là event object do trình duyệt cung cấp

    e.preventDefault(); //chặn hành vi mặc định (ví dụ: link không chuyển trang)
    loginForm.classList.add("hidden"); // thêm class = "hidden" để chạy .hidden trong css chuyển sang ẩn đi
    registerForm.classList.remove("hidden"); // xóa class = "hidden" để hiện trang
  });
  document.getElementById("showLogin")?.addEventListener("click", (e) => {
    e.preventDefault();
    loginForm.classList.remove("hidden");
    registerForm.classList.add("hidden");
  });

  // đăng nhập
  loginForm.addEventListener("submit", async (e) => {
    //async là keyword của js để báo rằng vc này tốn tg và có thể làm vc khác , tránh bị đơ
    e.preventDefault();
    const btn = document.getElementById("loginBtn"); // lấy từ trang đăng nhập vào ứng dụng
    // khi ấn đăng nhập từ thao tác của .addEventListener thì để tránh ng dùng spam và nút đăng nhập liên tục thì
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang đăng nhập...'; // dòng đang đăng nhập chạy trên nút summit đăng nhập và có icon font  là  hình vòng tròn xoay
    try {
      const data = await apiFetch("/login", {
        //await:  lệnh này bảo JavaScript: "Hãy dừng lại ở dòng này, gửi yêu cầu sang Python và ĐỢI cho đến khi Python trả lời xong thì mới gán kết quả vào biến data".
        // /login là vì apiFetch đã gẵn sẵn tiền tố api trước
        method: "POST",
        body: JSON.stringify({
          //để biến nó thành một chuỗi văn bản (String) thì mới gửi đi qua đường dây mạng được.
          email: document.getElementById("loginEmail").value,
          password: document.getElementById("loginPassword").value,
        }), //Value (Giá trị): Nội dung thực sự nằm trong ngăn đó (những gì người dùng gõ vào).
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
    } catch (
      err // hứng err khi throw ném ra ở apiFetch
    ) {
      showToast(err.message, "error");
      btn.disabled = false; // chuyển sang dạng có thể tương tác để đăng nhập lại
      btn.innerHTML =
        '<span>Đăng Nhập</span><i class="fas fa-arrow-right"></i>';
    }
  });
  //đăng ký
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
      loginForm.classList.remove("hidden"); //vì ban đầu ấn đăng ký thì ẩn loginform nên giờ phải mở
      registerForm.reset();
    } catch (err) {
      showToast(err.message, "error");
    }
  });
}

//đăng xuất
if (document.getElementById("logoutBtn")) {
  //kiểm tra xem nút "Đăng xuất" có tồn tại trên trang hiện tại không.
  const session = getSession(); //chạy hàm bạn đã viết ở trên để vào sessionStorage lấy thông tin người dùng ra.
  if (!session) {
    //Nếu KHÔNG có session" (tức là getSession() trả về null).
    window.location.href = "index.html"; //Nếu không tìm thấy bằng chứng đăng nhập, trình duyệt sẽ ngay lập tức chuyển về trang đăng nhập
  }
  //Đoạn code này là bước cuối cùng để "cá nhân hóa" giao diện: đưa tên và vai trò của người dùng vừa đăng nhập lên thanh menu (sidebar).
  document.getElementById("sidebarUsername").textContent = session?.email || "";
  document.getElementById("sidebarRole").textContent = session?.role || "user"; // mặc định là user

  document.getElementById("logoutBtn")?.addEventListener("click", () => {
    clearSession();
    setTimeout(() => (window.location.href = "index.html"), 300);
  });
  //các tag
  let currentTab = "books"; // cú pháp khai báo để books xuất hiện đầu tiên
  document.querySelectorAll(".nav-item").forEach((item) => {
    //forEach((item) => { ... }): Lặp qua từng nút một để gắn cho mỗi nút một "bộ cảm biến" (Event Listener). Thay vì viết code cho từng nút, ta dùng vòng lặp để làm một lần cho tất cả.
    item.addEventListener("click", (e) => {
      e.preventDefault();
      const tab = item.dataset.tab; // Lấy giá trị từ thuộc tính data-tab trong HTML. Ví dụ: Nếu bạn nhấn vào <div class="nav-item" data-tab="authors">, thì tab sẽ là "authors".
      currentTab = tab; // là "bộ nhớ" của chương trình.
      //JavaScript cung cấp thuộc tính .dataset để gom tất cả những gì bắt đầu bằng data- vào một chỗ.
      //Nút bấm hiển thị chữ "Sách", nhưng ẩn bên trong nó là data-tab="books". Khi bạn click, JavaScript không quan tâm chữ "Sách" (vì nó có thể thay đổi theo ngôn ngữ), nó chỉ quan tâm cái giá trị "books" nằm trong dataset để biết đường mà mở Tab.
      document
        .querySelectorAll(".nav-item")
        .forEach((n) => n.classList.remove("active")); //Tắt đèn" tất cả các nút.
      item.classList.add("active"); //để làm nổi bật nút đang chọn.
      document
        .querySelectorAll(".tab-section") // là các tab vụ bao gồm sách , tác giả , thể loại.
        .forEach((s) => s.classList.add("hidden")); // ẩn lại hết các tác để chờ thao tác thì mới remove ("hidden")
      document.getElementById(`tab-${tab}`).classList.remove("hidden"); //vì đang trong thao tác click nên dòng này là để hiện lên tab vừa click
      // bây giờ thì gọi hàm để lấy giữ liệu lên
      if (tab == "books") loadBooks();
      if (tab === "authors") loadAuthors();
      if (tab === "categories") loadCategories();
    });
  });
  //
  // ── CLOSE MODALS ──// để khi mở thẻ nào có thuộc tính đóng thì có thể ấn xung quanh để ẩn thẻ
  document.querySelectorAll("[data-close]").forEach((btn) => {
    //Tìm tất cả các phần tử (nút bấm) có thuộc tính HTML là data-close
    btn.addEventListener("click", () => closeModal(btn.dataset.close));
  }); //Cơ chế: Khi bạn click vào nút, hàm closeModal sẽ được gọi với cái tên (ID) tương ứng để ẩn cửa sổ đó đi.
  document.querySelectorAll(".modal-overlay").forEach((overlay) => {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) overlay.classList.add("hidden");
    });
  });

  // ── SEARCH BOOKS ──
  document.getElementById("searchBooks")?.addEventListener("input", (e) => {
    const q = e.target.value.toLowerCase(); //toLowerCase(): Chuyển toàn bộ chuỗi người dùng nhập sang chữ thường. Điều này giúp việc tìm kiếm không phân biệt chữ hoa, chữ thường (ví dụ: gõ "SÁCH" hay "sách" đều ra kết quả như nhau).
    document.querySelectorAll("#booksBody tr").forEach((row) => {
      // lấy tất cả những dòng <tr> đg hiển thị trong bảng booksbody
      row.style.display = row.textContent.toLowerCase().includes(q) //textContent sẽ lấy tất cả văn bản có trong dòng đó (bao gồm tên sách, tên tác giả, thể loại, năm...).//.includes(q): Kiểm tra xem trong nội dung của dòng đó có chứa từ khóa q mà người dùng đang nhập hay không.
        ? ""
        : "none";
    });
  });
  //Chỉ lọc được những gì đang hiển thị trên trang đó. Nếu bạn có hàng ngàn cuốn sách và dùng phân trang,
  // nó không thể tìm thấy các sách ở trang khác.

  // thực hiện tab

  // tab books
  let editingBookId = null; // đây là biến tự tạo để cho biết trạng thái chỉn sửa books
  // nếu editingBookID = null thì mặc định
  // nếu là truyền mã id vào thì nó là chỉnh sửa
  //Từ khóa let trong JavaScript có mục đích chính là khai báo một biến có thể thay đổi giá trị và giới hạn phạm vi hoạt động của biến đó để code an toàn hơn.
  async function loadBooks() {
    const tbody = document.getElementById("booksBody"); // đây là class của bảng hiện danh sách books
    tbody.innerHTML = `<tr><td colspan="7" class="loading-row"><i class="fas fa-spinner fa-spin"></i> Đang tải...</td></tr>`;
    // dòng này là để khi thực hiện thao tác thêm sửa xóa thì nó sẽ load lại trong tg chờ load thì hiện dòng này lên
    try {
      const books = await apiFetch("/books"); // gửi api để lấy dữ liệu vào books
      document.getElementById("statBooks").textContent = books.length;
      // textcontent là thay đổi dữ liệu trong thẻ có id statBooks thành books.length với length là đếm số lượng
      if (!books.length) {
        // nếu số lượng sách bằng 0
        tbody.innerHTML = `<tr><td colspan="7" class="loading-row">Chưa có sách nào</td></tr>`;
        return;
      }
      tbody.innerHTML = books // hiển thị bảng danh sách khi gọi api
        .map(
          (b, i) =>
            //Biến b: Đại diện cho dữ liệu của cuốn sách đó (id, title, author...).
            //Biến i: Là chỉ số (index), dùng để đánh số thứ tự (bắt đầu từ 0, nên bạn thấy i + 1).
            //i là chỉ số mảng (0, 1, 2...). Cộng thêm 1 để hiển thị số thứ tự đẹp mắt (1, 2, 3...) cho người dùng dễ nhìn.
            //<td><strong>${b.title}</strong></td>: Lấy tên sách (b.title) và bôi đậm nó bằng thẻ <strong>.
            //Thay vì hiện chữ thô, bạn dùng một thẻ <span> với CSS "xịn" (nền vàng mờ, chữ vàng kim, bo góc 20px) để biến tên thể loại thành một cái nhãn chuyên nghiệp.
            //Năm xuất bản (${b.published_year || "—"}):
            //Nếu cuốn sách không có năm (null hoặc undefined), nó sẽ hiện dấu gạch ngang "—" thay vì để trống
            `
        <tr>
          <td>${i + 1}</td>
          <td><strong>${b.title}</strong></td>
          <td>${b.author}</td>
          <td><span style="background:rgba(201,168,76,0.15);color:var(--gold);padding:2px 9px;border-radius:20px;font-size:0.78rem">${b.category}</span></td>
          <td>${b.published_year || "—"}</td>
          <td>${b.quantity || 0}</td>
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
          // mỗi lần có danh sách về sách thì 1 dòng sẽ tạo ra 1 nút sửa và xóa
        )
        .join(""); //Hàm .map() sau khi chạy xong sẽ trả về một Mảng các chuỗi HTML (như ["<tr>...</tr>", "<tr>...</tr>"]).
      //Sẽ dán tất cả các chuỗi đó lại với nhau thành một chuỗi văn bản khổng lồ duy nhất để gán vào tbody.innerHTML.
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="7" class="loading-row" style="color:var(--danger)">${err.message}</td></tr>`;
    }
  }
  //
  async function openBookModal(book = null) {
    editingBookId = book?.id || null; // khi ko truyền gì thì nó mặc định là null , còn truyền vào rồi thì nó sẽ biết là có chỉnh sửa
    document.getElementById("modalBookTitle").textContent = book
      ? "Chỉnh Sửa Sách"
      : "Thêm Sách";
    document.getElementById("bookId").value = book?.id || "";
    document.getElementById("bookTitle").value = book?.title || "";
    document.getElementById("bookYear").value = book?.published_year || "";
    document.getElementById("bookDesc").value = book?.description || "";
    document.getElementById("bookquantity").value = book?.quantity || "";
    // Load selects
    const [authors, categories] = await Promise.all([
      apiFetch("/authors"),
      apiFetch("/categories"),
    ]); //Sau khi cả hai tải xong, dữ liệu sẽ được "giải nén" vào hai biến authors và categories.

    const aSelect = document.getElementById("bookAuthor");
    const cSelect = document.getElementById("bookCategory");
    aSelect.innerHTML =
      `<option value="">-- Chọn tác giả --</option>` +
      authors //Dòng này đảm bảo mục đầu tiên của danh sách luôn là một hướng dẫn trống. Nếu người dùng không chọn gì, giá trị gửi đi sẽ là một chuỗi rỗng.
        .map(
          //Hàm .map() duyệt qua mảng authors (hoặc categories) và biến mỗi đối tượng dữ liệu thành một chuỗi HTML:
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

  // // ===========================================
  // //  INIT
  // // ===========================================
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
