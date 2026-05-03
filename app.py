from flask import Flask, jsonify, request , send_from_directory
from flask_cors import CORS
import pyodbc
from werkzeug.security import generate_password_hash, check_password_hash
# app = Flask(__name__)
# Sửa dòng này
app = Flask(__name__, static_folder='static')
CORS(app, resources={r"/*": {"origins": "*"}})


conn_str = (
    "DRIVER={ODBC Driver 17 for SQL Server};"
            "SERVER=127.0.0.1,1433;"
            "DATABASE=BOOKDB;"
            "UID=sa;"
            "PWD=123456;"
            "TrustServerCertificate=yes;"
        )

def get_db():
    return pyodbc.connect(conn_str)
## đăng nhập
@app.route('/api/login',methods = ['POST'])
def login():
    data=request.json # ấy dữ liệu mà người dùng gửi từ giao diện (Frontend) lên. như email , password
    conn=get_db() #Thiết lập một "đường dây kết nối" tới cơ sở dữ liệu.
    cursor=conn.cursor() #Tạo ra một "con trỏ" (Cursor) để làm việc với dữ liệu.
    try:
        #cursor (con trỏ) chính là người thủ thư (hoặc một cánh tay robot) đứng đợi lệnh của bạn.
        cursor.execute(
            "SELECT password_hash,role FROM Users Where email=?",
            data['email']
        )
        row=cursor.fetchone() # vì là tài khoản chỉ có 1 dòng nên dùng fetchone lấy theo mảng với lần lượt row[0],row[1] là SELECT password_hash,role FROM Users
        if row and check_password_hash( # kiểm tra nếu row có tài khoản thì sẽ kiểm tra thêm password
            row[0],data['password']): #Là mật mã đã bị mã hóa (hashed) lấy từ Database. Nó trông giống như một chuỗi ký tự rác: pbkdf2:sha256:260000$abc123.... và lấy password phần thô để thực hiện mã hóa trong thư viện để so sánh
            return jsonify({"message" : "đăng nhập thành công","role" : row[1]}) #jsonify: Biến Dictionary của Python thành chuỗi JSON để trình duyệt (JavaScript) có thể đọc được.
        return jsonify({"error": "sai tài khoản hoặc mật khẩu"}),401
    finally:
        conn.close()

#đăng ký
@app.route('/api/register',methods = ['POST'])
def register():
    data=request.json
    hashed=generate_password_hash(data['password'])
    conn=get_db()
    cursor = conn.cursor()
    try:
        cursor.execute( #đây là lệnh tạo admin 
            "INSERT INTO Users (username, email, password_hash,role) VALUES (?, ?, ?,?)",
            data['username'], data['email'], hashed,"admin"
        )
        # cursor.execute(
        #     "INSERT INTO Users (username, email, password_hash) VALUES (?, ?, ?)",
        #     data['username'], data['email'], hashed,
        # )
        conn.commit()
        return jsonify({"message": "Đăng ký thành công"}), 201
    except Exception as e:
        conn.rollback()
        return jsonify({"error": "Tên đăng nhập hoặc email đã tồn tại"}), 400
    finally:
        conn.close()

# trang danh sách books
@app.route('/api/books',methods = ['GET'])
def get_books():
    conn=get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("""select id,title
      ,author
      ,category
      ,published_year
      ,description
      ,quantity
    ,category_id
      ,author_id
    ,price
                    FROM vw_books""") # # biến cursor thực hiện hàm execute để truy vấn select ...
        books = [ # tạo mảng books để khi for i in cursor.fetchall() để lấy dữ liệu r cho vào mảng books -  for r in cursor.fetchall() thực hiện trước
            {
                "id": r[0], "title": r[1], 
                "author": r[2], "category": r[3],
                "published_year": r[4], "description": r[5],"quantity" : r[6],"category_id" : r[7],"author_id" : r[8],"price" : float(r[9]) if r[9] is not None else 0
            }
            for r in cursor.fetchall() #là method của cursor object trong thư viện pyodbc,Lấy toàn bộ dữ liệu còn lại từ kết quả query
            #r cx ko cần khai báo trước, chỉ cần for và cursor.fetchall()
        ]
        return jsonify(books)
    finally:
        conn.close()

@app.route('/api/books/<int:book_id>', methods=['GET'])#dùng để gọi hàm với id để chỉnh sửa sách trong quyền admin
def get_book(book_id):
    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            select b.id,title
          ,author_id
          ,category_id
          ,published_year
          ,description
          ,quantity
          ,row_ver
          ,price
            FROM vw_books b
            WHERE b.id = ?
        """, book_id)
        r = cursor.fetchone()
        if not r:
            return jsonify({"error": "Không tìm thấy sách"}), 404
        return jsonify({
            "id": r[0],
            "title": r[1],
            "author_id": r[2],
            "category_id": r[3],
            "published_year": r[4],
            "description": r[5],
            "quantity": r[6],
            "row_ver": r[7].hex() if r[7] is not None else None,
            "price": float(r[8]) if r[8] is not None else 0
        })
    finally:
        conn.close()


@app.route('/api/books', methods=['POST'])#taoh mới dùng cho insert
def add_book():
    data = request.json
    conn = get_db()
    cursor = conn.cursor()
    try:
        # Chèn trực tiếp vào bảng Books
        cursor.execute("""
            EXEC INSERTBOOOKS @title=? , @author_id =?, @category_id=? , 
            @published_year =?, @description=? , @quantity=?, @price=?
        """, 
        data['title'], 
        data['author_id'], 
        data['category_id'],
        data.get('published_year'), 
        data.get('description'), 
        data.get('quantity', 0), # Lấy quantity, nếu không có thì mặc định là 0
        data.get('price', 0) # Lấy price, nếu không có thì mặc định là 0
        )
        conn.commit()
        return jsonify({"message": "Thêm sách thành công"}), 201
    except Exception as e:
        conn.rollback()
        print(f"Lỗi: {e}") # In ra màn hình console để bạn dễ kiểm tra
        return jsonify({"error": "Không thể thêm sách"}), 500
    finally:
        conn.close()


@app.route('/api/books/<int:book_id>', methods=['PUT'])#ghi đè lên khi sửa dùng để update
def update_book(book_id):
    data = request.json
    conn = get_db()
    cursor = conn.cursor()
    try:
        row_ver = data.get('row_ver')
        if not row_ver:
            return jsonify({"error": "Lỗi mất sự đồng bộ"}), 400

        cursor.execute("""
            EXEC upbooks @id=?, @title=?, @author_id=?, @category_id=?, 
                         @published_year=?, @description=?, @quantity=?, @row_ver=? , @price=?
        """, 
        book_id,
        data['title'], 
        data['author_id'], 
        data['category_id'],
        data.get('published_year'), 
        data.get('description'), 
        data.get('quantity', 0), 
        bytes.fromhex(row_ver),
        data.get('price', 0)
        )
        row = cursor.fetchone()
        #cursor.execute("WAITFOR DELAY '00:00:30'") # Giả lập độ trễ 30 giây để test đồng bộ hóa
      
        conn.commit()
        response = {"message": "Cập nhật sách thành công"}
        if row:
            response["new_row_ver"] = row[0].hex() if row[0] is not None else None
        return jsonify(response)
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()

  

@app.route('/api/books/<int:book_id>', methods=['DELETE'])
def delete_book(book_id):
    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("EXEC deletebooks @id=?", book_id)
        conn.commit()
        return jsonify({"message": "Xóa sách thành công"})
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


# ============================================================
#  AUTHORS
# ============================================================

@app.route('/api/authors', methods=['GET'])
def get_authors():
    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT *  FROM vw_authors")
        authors = [
            {"id": r[0], "full_name": r[1], "bio": r[2], "birthdate": r[3], 
             "row_ver": r[4].hex() if r[4] is not None else None}
            for r in cursor.fetchall()
        ]
        return jsonify(authors)
    finally:
        conn.close()


@app.route('/api/authors', methods=['POST'])# insert dựa vào view
def add_author():
    data = request.json
    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "EXEC insertauthors @full_name=? , @bio=? , @birthdate=?",
            data['full_name'], data.get('bio'), data.get('birthdate')
        )
        conn.commit()
        return jsonify({"message": "Thêm tác giả thành công"}), 201
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


@app.route('/api/authors/<int:author_id>', methods=['PUT'])#ghi đè lên
def update_author(author_id):
    data = request.json
    conn = get_db()
    cursor = conn.cursor()
    try:
        row_ver = data.get('row_ver')
        if not row_ver:
            return jsonify({"error": "Lỗi mất sự đồng bộ"}), 400

        cursor.execute(
            "EXEC upauthors @id=?,@full_name=?, @bio=?, @birthdate=?,@row_ver=?",
            author_id, data['full_name'], data.get('bio'), data.get('birthdate'), bytes.fromhex(row_ver)
        )
        #conn.commit()
      #  return jsonify({"message": "Cập nhật tác giả thành công"})
        row = cursor.fetchone()
        conn.commit()
        response = {"message": "Cập nhật tác giả thành công"}
        if row:
            response["new_row_ver"] = row[0].hex() if row[0] is not None else None
        return jsonify(response)
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


@app.route('/api/authors/<int:author_id>', methods=['DELETE'])
def delete_author(author_id):
    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("EXEC deleteauthors @id=?", author_id)
        conn.commit()
        return jsonify({"message": "Xóa tác giả thành công"})
    except pyodbc.IntegrityError:
        conn.rollback()
        return jsonify({"error": "Không thể xóa tác giả vì vẫn còn sách tham chiếu"}), 400
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


# ============================================================
#  CATEGORIES
# ============================================================

@app.route('/api/categories', methods=['GET'])
def get_categories():
    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT * FROM vw_categories")
        cats = [
            {
                "id": r[0],
                "name": r[1],
                "description": r[2],
                "row_ver": r[3].hex() if len(r) > 3 and r[3] is not None else None,
            }
            for r in cursor.fetchall()
        ]
        return jsonify(cats)
    finally:
        conn.close()


@app.route('/api/categories', methods=['POST'])
def add_category():
    data = request.json
    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "EXEC insercategories @name =?, @description =?",
            data['name'], data.get('description')
        )
        conn.commit()
        return jsonify({"message": "Thêm thể loại thành công"}), 201
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


@app.route('/api/categories/<int:cat_id>', methods=['PUT'])
def update_category(cat_id):
    data = request.json
    conn = get_db()
    cursor = conn.cursor()
    try:
        row_ver = data.get('row_ver')
        if row_ver:
            cursor.execute(
                "EXEC upcategories @id=?,@name =?, @description=?, @row_ver=?",
                cat_id, data['name'], data.get('description'), bytes.fromhex(row_ver)
            )
        else:
            cursor.execute(
                "EXEC upcategories @id=?,@name =?, @description=?",
                cat_id, data['name'], data.get('description')
            )

        row = cursor.fetchone()
        conn.commit()
        response = {"message": "Cập nhật thể loại thành công"}
        if row:
            response["new_row_ver"] = row[0].hex() if row[0] is not None else None
        return jsonify(response)
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


@app.route('/api/categories/<int:cat_id>', methods=['DELETE'])
def delete_category(cat_id):
    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("EXEC deletecategories @id=?", cat_id)
        conn.commit()
        return jsonify({"message": "Xóa thể loại thành công"})
    except pyodbc.IntegrityError:
        conn.rollback()
        return jsonify({"error": "Không thể xóa thể loại vì vẫn còn sách tham chiếu"}), 400
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


#
@app.route('/pdf/<path:filename>')
def serve_pdf(filename):
    response = send_from_directory('static/contents', filename)
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET'
    return response


#=====

# Hàm này sẽ được gọi mỗi khi có một chỉnh sửa nào đó được thực hiện trên Books, Authors hoặc Categories

def log_edit(table_name, record_id, action):
    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "INSERT INTO EditLogs (table_name, record_id, action) VALUES (?, ?, ?)",
            table_name, record_id, action
        )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

# ============================================================
#  EDIT LOGS
# ============================================================

@app.route('/api/edit-logs', methods=['GET'])
def get_edit_logs():
    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            SELECT id, table_name, record_id, action, edit_time
            FROM EditLogs
            ORDER BY edit_time DESC
        """)
        logs = [
            {
                "id": r[0], "table_name": r[1], "record_id": r[2],
                "action": r[3],
                "edit_time": r[4].isoformat() if r[4] else None
            }
            for r in cursor.fetchall()
        ]
        return jsonify(logs)
    finally:
        conn.close()



# ============================================================
#  ORDERS — ĐẶT SÁCH
# ============================================================

@app.route('/api/orders', methods=['POST'])
def place_order():
    """Người dùng đặt sách: kiểm tra quantity, trừ kho, lưu đơn + cart."""
    data = request.json
    book_id    = data.get('book_id')
    user_email = data.get('user_email')

    if not book_id or not user_email:
        return jsonify({"error": "Thiếu thông tin đặt hàng"}), 400

    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "EXEC place_order @book_id=?, @user_email=?",
            book_id, user_email
        )
        row = cursor.fetchone()
        conn.commit()
        result = {}
        if row:
            result = {
                "order_id":   row[0],
                "book_title": row[1],
                "price":      float(row[2]) if row[2] is not None else 0,
                "order_date": row[3].isoformat() if row[3] else None,
                "status":     row[4]
            }
        return jsonify({"message": "Đặt sách thành công!", "order": result}), 201
    except Exception as e:
        conn.rollback()
        msg = str(e)
        # Trả thông báo thân thiện khi hết sách
        if "50011" in msg or "hết" in msg.lower():
            return jsonify({"error": "Sách đã hết, không thể đặt."}), 400
        return jsonify({"error": msg}), 500
    finally:
        conn.close()


# @app.route('/api/orders/safe', methods=['POST'])
# def place_order_safe():
#     """
#     Đặt sách có kiểm tra Non-repeatable Read.
#     Đọc giá 2 lần trong cùng transaction (REPEATABLE READ).
#     Nếu giá thay đổi giữa 2 lần đọc → trả lỗi 409 kèm giá mới.
#     """
#     data       = request.json
#     book_id    = data.get('book_id')
#     user_email = data.get('user_email')

#     if not book_id or not user_email:
#         return jsonify({"error": "Thiếu thông tin đặt hàng"}), 400

#     conn   = get_db()
#     cursor = conn.cursor()
#     try:
#         cursor.execute(
#             "EXEC place_order_safe @book_id=?, @user_email=?",
#             book_id, user_email
#         )
#         row = cursor.fetchone()
#         conn.commit()

#         result = {}
#         if row:
#             result = {
#                 "order_id":      row[0],
#                 "book_title":    row[1],
#                 "price":         float(row[2]) if row[2] is not None else 0,
#                 "order_date":    row[3].isoformat() if row[3] else None,
#                 "status":        row[4],
#             }
#         return jsonify({"message": "Đặt sách thành công!", "order": result}), 201

#     except Exception as e:
#         conn.rollback()
#         msg = str(e)
#         if "50011" in msg or "hết" in msg.lower():
#             return jsonify({"error": "Sách đã hết, không thể đặt."}), 400
#         if "50020" in msg or "thay đổi" in msg.lower():
#             # Giá vừa bị sửa trong lúc xử lý → trả 409 để frontend
#             # hỏi lại user có muốn đặt với giá mới không
#             return jsonify({
#                 "error": "price_changed",
#                 "message": "Giá sách vừa thay đổi. Vui lòng xác nhận lại."
#             }), 409
#         return jsonify({"error": msg}), 500
#     finally:
#         conn.close()

@app.route('/api/orders', methods=['GET'])
def get_orders():
    """Lay danh sach don dat.
    - ?email=  → lọc theo user
    - ?month=  → lọc theo tháng (1-12)
    Có thể kết hợp cả hai.
    """
    email = request.args.get('email')
    month = request.args.get('month')
    try:
        month_val = int(month) if month else None
    except ValueError:
        return jsonify({"error": "Tháng không hợp lệ"}), 400

    conn = get_db()
    cursor = conn.cursor()
    try:
        conditions = []
        params = []
        if email:
            conditions.append("user_email = ?")
            params.append(email)
        if month_val:
            conditions.append("MONTH(order_date) = ?")
            params.append(month_val)

        where_clause = ("WHERE " + " AND ".join(conditions)) if conditions else ""
        sql = f"""
            SELECT id, book_title, user_email, order_date, price, status, book_id
            FROM vw_orders
            {where_clause}
            ORDER BY order_date DESC
        """
        cursor.execute(sql, *params)
        orders = [
            {
                "id":         r[0],
                "book_title": r[1],
                "user_email": r[2],
                "order_date": r[3].isoformat() if r[3] else None,
                "price":      float(r[4]) if r[4] is not None else 0,
                "status":     r[5],
                "book_id":    r[6]
            }
            for r in cursor.fetchall()
        ]
        return jsonify(orders)
    finally:
        conn.close()


@app.route('/api/orders/stats', methods=['GET'])
def get_order_stats():
    """Thống kê tổng doanh thu, số đơn, số khách hàng."""
    month = request.args.get('month')

    try:
        month_val = int(month) if month else None
    except ValueError:
        return jsonify({"error": "Tháng không hợp lệ"}), 400
    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("EXEC get_order_stats @month=?", month_val)
        r = cursor.fetchone()
        if not r:
            return jsonify({"total_orders": 0, "total_revenue": 0, "total_customers": 0})
        return jsonify({
            "total_orders":    r[0],
            "total_revenue":   float(r[1]) if r[1] is not None else 0,
            "total_customers": r[2]
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


@app.route('/api/orders/<int:order_id>', methods=['PUT'])
def update_order_status(order_id):
    """Admin cập nhật trạng thái đơn hàng."""
    data = request.json
    new_status = data.get('status')
    if not new_status:
        return jsonify({"error": "Thiếu trạng thái"}), 400
    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "UPDATE Orders SET status=? WHERE id=?",
            new_status, order_id
        )
        conn.commit()
        return jsonify({"message": "Cập nhật trạng thái thành công"})
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


# ============================================================
#  CART — GIỎ HÀNG
# ============================================================

@app.route('/api/cart', methods=['GET'])
def get_cart():
    """Lấy giỏ hàng của một email cụ thể."""
    email = request.args.get('email')
    if not email:
        return jsonify({"error": "Thiếu email"}), 400
    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            SELECT id, book_id, name, price, added_at
            FROM Cart
            WHERE user_email = ?
            ORDER BY added_at DESC
        """, email)
        items = [
            {
                "id":       r[0],
                "book_id":  r[1],
                "name":     r[2],
                "price":    float(r[3]) if r[3] is not None else 0,
                "added_at": r[4].isoformat() if r[4] else None
            }
            for r in cursor.fetchall()
        ]
        # Tính tổng tiền giỏ hàng của user
        total = sum(i['price'] for i in items)
        return jsonify({"items": items, "total": total})
    finally:
        conn.close()


def _run_realtime_report(proc_name, month_val):
    """Helper dùng chung cho cả 2 route báo cáo realtime."""
    conn   = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute(f"EXEC {proc_name} @month=?", month_val)

        # Stored proc sinh ra nhiều resultset theo thứ tự:
        #   1) SELECT @total1 = ...  (lần đọc 1 — row rỗng)
        #   2) SELECT @total2 = ...  (lần đọc 2 — row rỗng)
        #   3) INSERT INTO RevenueReports  (nằm ngoài TRANSACTION)
        #   4) SELECT 5 cột trả về cho app  ← resultset cần lấy
        #
        # INSERT nằm ngoài BEGIN/COMMIT nên pyodbc (autocommit=False)
        # chưa commit nó — phải gọi conn.commit() để lưu vào DB.
        #
        # Dùng vòng lặp nextset() để tìm resultset có đúng 5 cột.
        row = None
        while True:
            row = cursor.fetchone()
            if row is not None and len(row) == 5:
                break                       # đúng resultset cần
            if not cursor.nextset():        # không còn resultset nào
                break

        # Commit để INSERT RevenueReports được lưu vào DB
        conn.commit()

        if not row:
            return jsonify({"error": "Không có dữ liệu"}), 404

        # row[0]=total_revenue, row[1]=total_orders, row[2]=total_customers
        # row[3]=is_consistent, row[4]=phantom_diff
        return jsonify({
            "total_revenue":   float(row[0]) if row[0] is not None else 0,
            "total_orders":    int(row[1])   if row[1] is not None else 0,
            "total_customers": int(row[2])   if row[2] is not None else 0,
            "is_consistent":   bool(row[3]),
            "phantom_diff":    int(row[4])   if row[4] is not None else 0
        })
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


@app.route('/api/report/realtime', methods=['GET'])
def report_realtime():
    """Báo cáo realtime dùng READ COMMITTED — có thể xảy ra Phantom Read."""
    month = request.args.get('month')
    try:
        month_val = int(month) if month else None
    except ValueError:
        return jsonify({"error": "Tháng không hợp lệ"}), 400
    return _run_realtime_report("report_revenue_realtime", month_val)


@app.route('/api/report/realtime/safe', methods=['GET'])
def report_realtime_safe():
    """Báo cáo realtime dùng SERIALIZABLE — ngăn Phantom Read."""
    month = request.args.get('month')
    try:
        month_val = int(month) if month else None
    except ValueError:
        return jsonify({"error": "Tháng không hợp lệ"}), 400
    return _run_realtime_report("report_revenue_realtime_safe", month_val)


@app.route('/api/report/history', methods=['GET'])
def get_report_history():
    """Lấy lịch sử các báo cáo đã chạy từ bảng RevenueReports."""
    limit = request.args.get('limit', 50)
    try:
        limit_val = int(limit)
    except ValueError:
        limit_val = 50
    conn   = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("EXEC get_revenue_reports @limit=?", limit_val)
        rows = cursor.fetchall()
        result = [
            {
                "id":              r[0],
                "report_time":     r[1].isoformat() if r[1] else None,
                "report_month":    r[2],
                "isolation_mode":  r[3],
                "total_revenue":   float(r[4]) if r[4] is not None else 0,
                "total_orders":    r[5],
                "total_customers": r[6],
                "is_consistent":   bool(r[7])
            }
            for r in rows
        ]
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


if __name__ == '__main__':
    app.run(debug=True, port=5000)