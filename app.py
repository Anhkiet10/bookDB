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
            "DATABASE=BookDB;"
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
    #cursor (con trỏ) chính là người thủ thư (hoặc một cánh tay robot) đứng đợi lệnh của bạn.
    cursor.execute(
        "SELECT id, password_hash, role FROM Users WHERE email=?",
        data['email']
    )
    row = cursor.fetchone() # vì là tài khoản chỉ có 1 dòng nên dùng fetchone lấy theo mảng với lần lượt row[0],row[1],row[2]
    conn.close()
    if row and check_password_hash(
        row[1], data['password']):
        return jsonify({"message": "đăng nhập thành công", "role": row[2], "user_id": row[0]})
    return jsonify({"error": "sai tài khoản hoặc mật khẩu"}), 401

#đăng ký
@app.route('/api/register',methods = ['POST'])
def register():
    data=request.json
    hashed=generate_password_hash(data['password'])
    conn=get_db()
    cursor = conn.cursor()
    try:
        # cursor.execute( #đây là lệnh tạo admin 
        #     "INSERT INTO Users (username, email, password_hash,role) VALUES (?, ?, ?,?)",
        #     data['username'], data['email'], hashed,"admin"
        # )
        cursor.execute(
            "INSERT INTO Users (username, email, password_hash) VALUES (?, ?, ?)",
            data['username'], data['email'], hashed,
        )
        conn.commit()
        return jsonify({"message": "Đăng ký thành công"}), 201
    except Exception as e:
        return jsonify({"error": "Tên đăng nhập hoặc email đã tồn tại"}), 400
    finally:
        conn.close()

# trang danh sách books
@app.route('/api/books',methods = ['GET'])
def get_books():
    conn=get_db()
    cursor = conn.cursor()
    cursor.execute("""select id,title
      ,author
      ,category
      ,published_year
      ,description
      ,quantity
    ,category_id
      ,author_id
                    FROM vw_books""") # # biến cursor thực hiện hàm execute để truy vấn select ...
    books = [ # tạo mảng books để khi for i in cursor.fetchall() để lấy dữ liệu r cho vào mảng books -  for r in cursor.fetchall() thực hiện trước
        {
            "id": r[0], "title": r[1], 
            "author": r[2], "category": r[3],
            "published_year": r[4], "description": r[5],"quantity" : r[6],"category_id" : r[7],"author_id" : r[8]
        }
        for r in cursor.fetchall() #là method của cursor object trong thư viện pyodbc,Lấy toàn bộ dữ liệu còn lại từ kết quả query
        #r cx ko cần khai báo trước, chỉ cần for và cursor.fetchall()
    ]
    conn.close()
    return jsonify(books)

@app.route('/api/books/<int:book_id>', methods=['GET'])#dùng để gọi hàm với id để chỉnh sửa sách trong quyền admin
def get_book(book_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        select b.id,title
      ,author_id
      ,category_id
      ,published_year
      ,description
      ,quantity
        FROM vw_books b
        WHERE b.id = ?
    """, book_id)
    r = cursor.fetchone()
    conn.close()
    if not r:
        return jsonify({"error": "Không tìm thấy sách"}), 404
    return jsonify({
        "id": r[0], "title": r[1], "author_id": r[2], "category_id": r[3],
        "published_year": r[4], "description": r[5],"quantity" : r[6]
    })


@app.route('/api/books', methods=['POST'])#taoh mới dùng cho insert
def add_book():
    data = request.json
    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "INSERT INTO Books (title, author_id, category_id, published_year, description, quantity) VALUES (?, ?, ?, ?, ?, ?)",
            data['title'],
            data['author_id'],
            data['category_id'],
            data.get('published_year'),
            data.get('description'),
            data.get('quantity', 0)
        )
        conn.commit()
        return jsonify({"message": "Thêm sách thành công"}), 201
    except Exception as e:
        print(f"Lỗi: {e}")
        return jsonify({"error": "Không thể thêm sách"}), 500
    finally:
        conn.close()


@app.route('/api/books/<int:book_id>', methods=['PUT'])#ghi đè lên khi sửa dùng để update
def update_book(book_id):
    data = request.json
    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "UPDATE Books SET title=?, author_id=?, category_id=?, published_year=?, description=?, quantity=? WHERE id=?",
            data['title'],
            data['author_id'],
            data['category_id'],
            data.get('published_year'),
            data.get('description'),
            data.get('quantity', 0),
            book_id
        )
        conn.commit()
        return jsonify({"message": "Cập nhật sách thành công"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()

@app.route('/api/books/<int:book_id>', methods=['DELETE'])
def delete_book(book_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM Books WHERE id=?", book_id)
    conn.commit()
    conn.close()
    return jsonify({"message": "Xóa sách thành công"})


# ============================================================
#  AUTHORS
# ============================================================

@app.route('/api/authors', methods=['GET'])
def get_authors():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT *  FROM vw_authors")
    authors = [
        {"id": r[0], "full_name": r[1], "bio": r[2], "birthdate": r[3]}
        for r in cursor.fetchall()
    ]
    conn.close()
    return jsonify(authors)


@app.route('/api/authors', methods=['POST'])# insert dựa vào view
def add_author():
    data = request.json
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO Authors (full_name, bio, birthdate) VALUES (?, ?, ?)",
        data['full_name'], data.get('bio'), data.get('birthdate')
    )
    conn.commit()
    conn.close()
    return jsonify({"message": "Thêm tác giả thành công"}), 201


@app.route('/api/authors/<int:author_id>', methods=['PUT'])#ghi đè lên
def update_author(author_id):
    data = request.json
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE Authors SET full_name=?, bio=?, birthdate=? WHERE id=?",
        data['full_name'], data.get('bio'), data.get('birthdate'), author_id
    )
    conn.commit()
    conn.close()
    return jsonify({"message": "Cập nhật tác giả thành công"})


@app.route('/api/authors/<int:author_id>', methods=['DELETE'])
def delete_author(author_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM Authors WHERE id=?", author_id)
    conn.commit()
    conn.close()
    return jsonify({"message": "Xóa tác giả thành công"})


# ============================================================
#  CATEGORIES
# ============================================================

@app.route('/api/categories', methods=['GET'])
def get_categories():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM vw_categories")
    cats = [
        {"id": r[0], "name": r[1], "description": r[2]}
        for r in cursor.fetchall()
    ]
    conn.close()
    return jsonify(cats)


@app.route('/api/categories', methods=['POST'])
def add_category():
    data = request.json
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO Categories (name, description) VALUES (?, ?)",
        data['name'], data.get('description')
    )
    conn.commit()
    conn.close()
    return jsonify({"message": "Thêm thể loại thành công"}), 201


@app.route('/api/categories/<int:cat_id>', methods=['PUT'])
def update_category(cat_id):
    data = request.json
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE Categories SET name=?, description=? WHERE id=?",
        data['name'], data.get('description'), cat_id
    )
    conn.commit()
    conn.close()
    return jsonify({"message": "Cập nhật thể loại thành công"})


@app.route('/api/categories/<int:cat_id>', methods=['DELETE'])
def delete_category(cat_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM Categories WHERE id=?", cat_id)
    conn.commit()
    conn.close()
    return jsonify({"message": "Xóa thể loại thành công"})


#
@app.route('/pdf/<path:filename>')
def serve_pdf(filename):
    response = send_from_directory('static/contents', filename)
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET'
    return response

# Hàm này sẽ được gọi mỗi khi có một chỉnh sửa nào đó được thực hiện trên Books, Authors hoặc Categories

def log_edit(table_name, record_id, action):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO EditLogs (table_name, record_id, action) VALUES (?, ?, ?)",
        table_name, record_id, action
    )
    conn.commit()
    conn.close()

# ============================================================
#  EDIT LOGS
# ============================================================

@app.route('/api/edit-logs', methods=['GET'])
def get_edit_logs():
    conn = get_db()
    cursor = conn.cursor()
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
    conn.close()
    return jsonify(logs)




if __name__ == '__main__':
    app.run(debug=True, port=5000)

