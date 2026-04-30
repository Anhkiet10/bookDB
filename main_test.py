from flask import Flask, jsonify, request , send_from_directory
from flask_cors import CORS
import pyodbc
from werkzeug.security import generate_password_hash, check_password_hash
app = Flask(__name__, static_folder='static')
CORS(app, resources={r"/*": {"origins": "*"}})


conn_str = (
    "DRIVER={ODBC Driver 17 for SQL Server};"
            "SERVER=127.0.0.1,1433;"
            "DATABASE=TESTDB;"
            "UID=sa;"
            "PWD=123456;"
            "TrustServerCertificate=yes;"
        )

def get_db():
    return pyodbc.connect(conn_str)

## đăng nhập
@app.route('/api/login',methods = ['POST'])
def login():
    data=request.json
    conn=get_db()
    cursor=conn.cursor()
    cursor.execute(
        "SELECT password_hash,role FROM Users Where email=?",
        data['email']
    )
    row=cursor.fetchone()
    conn.close()
    if row and check_password_hash(row[0],data['password']):
        return jsonify({"message" : "đăng nhập thành công","role" : row[1]})
    return jsonify({"error": "sai tài khoản hoặc mật khẩu"}),401

#đăng ký
@app.route('/api/register',methods = ['POST'])
def register():
    data=request.json
    hashed=generate_password_hash(data['password'])
    conn=get_db()
    cursor = conn.cursor()
    try:
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
@app.route('/api/books', methods=['GET'])
def get_books():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED")
    cursor.execute("""
        SELECT b.id, b.title, b.author_id, b.category_id,
               a.full_name AS author, c.name AS category,
               b.published_year, b.description, b.quantity
        FROM Books b WITH (NOLOCK)
        JOIN Authors    a  WITH (NOLOCK) ON b.author_id   = a.id
        JOIN Categories c WITH (NOLOCK) ON b.category_id = c.id
    """)
    books = [
        {
            "id": r[0], "title": r[1], "author_id": r[2], "category_id": r[3],
            "author": r[4], "category": r[5],
            "published_year": r[6], "description": r[7], "quantity": r[8]
        }
        for r in cursor.fetchall()
    ]
    conn.close()
    return jsonify(books)

@app.route('/api/books/<int:book_id>', methods=['GET'])
def get_book(book_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED")
    cursor.execute("""
        SELECT b.id, b.title, b.author_id, b.category_id,
               a.full_name, c.name, b.published_year, b.description, b.quantity
        FROM Books b WITH (NOLOCK)
        JOIN Authors    a  WITH (NOLOCK) ON b.author_id   = a.id
        JOIN Categories c WITH (NOLOCK) ON b.category_id = c.id
        WHERE b.id = ?
    """, book_id)
    r = cursor.fetchone()
    conn.close()
    if not r:
        return jsonify({"error": "Không tìm thấy sách"}), 404
    return jsonify({
        "id": r[0], "title": r[1], "author_id": r[2], "category_id": r[3],
        "author": r[4], "category": r[5],
        "published_year": r[6], "description": r[7] ,"quantity": r[8]
    })


@app.route('/api/books', methods=['POST'])
def add_book():
    data = request.json
    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED")
        cursor.execute("""
            INSERT INTO Books (title, author_id, category_id, published_year, description, quantity)
            VALUES (?, ?, ?, ?, ?, ?)
        """, data['title'], data['author_id'], data['category_id'],
            data.get('published_year'), data.get('description'), data.get('quantity', 0))
        
        conn.commit()
        return jsonify({"message": "Thêm sách thành công"}), 201
    except Exception as e:
        print(f"Lỗi: {e}")
        return jsonify({"error": "Không thể thêm sách"}), 500
    finally:
        conn.close()


# ✅ ĐÃ SỬA: Thêm decorator để mô phỏng dirty read
# Session A gọi PUT này → transaction giữ 10 giây chưa commit
# Session B gọi GET /api/books (WITH NOLOCK) → đọc được dữ liệu chưa commit
@app.route('/api/books/<int:book_id>', methods=['PUT'])
def update_book(book_id):
    data = request.json
    # Tạo kết nối với autocommit=False để giữ transaction
    conn = pyodbc.connect(conn_str, autocommit=False)
    cursor = conn.cursor()
    try:
        # Thực hiện UPDATE - chưa commit
        cursor.execute("""
        UPDATE Books
        SET title=?, author_id=?, category_id=?, published_year=?, description=? , quantity=?
        WHERE id=?
    """, data['title'], data['author_id'], data['category_id'],
         data.get('published_year'), data.get('description'), data.get('quantity', 0), book_id)
        
        print(f"Đã cập nhật sách {book_id}, bắt đầu giữ transaction 30s...")
        
        # Giữ transaction MỞ trong 30 giây → Session B đọc được dirty data
        cursor.execute("WAITFOR DELAY '00:00:30'")
        
        # Sau 30 giây: kiểm tra điều kiện để quyết định commit hay rollback
        if data.get('quantity', 0) > 2:
            conn.rollback()
            return jsonify({"error": "Số lượng sách không được lớn hơn 2"}), 400
        else:
            conn.commit()
            return jsonify({"message": "Cập nhật sách thành công"})
    except Exception as e:
        conn.rollback()
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


@app.route('/api/authors', methods=['POST'])
def add_author():
    data = request.json
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "EXEC insertauthors @full_name=? , @bio=? , @birthdate=?",
        data['full_name'], data.get('bio'), data.get('birthdate')
    )
    conn.commit()
    conn.close()
    return jsonify({"message": "Thêm tác giả thành công"}), 201


@app.route('/api/authors/<int:author_id>', methods=['PUT'])
def update_author(author_id):
    data = request.json
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "EXEC upauthors @id=?,@full_name=?, @bio=?, @birthdate=?",
        author_id,data['full_name'], data.get('bio'), data.get('birthdate') 
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
        "EXEC insercategories @name =?, @description =?",
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
        "EXEC upcategories @id=?,@name =?, @description=?",
        cat_id,data['name'], data.get('description') 
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


@app.route('/pdf/<path:filename>')
def serve_pdf(filename):
    response = send_from_directory('static/contents', filename)
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET'
    return response

if __name__ == '__main__':
    #app.run(debug=True, port=5000)

    app.run(debug=True, port=5000, threaded=True)