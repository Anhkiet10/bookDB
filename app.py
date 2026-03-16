

from flask import Flask, jsonify, request
from flask_cors import CORS
import pyodbc
from werkzeug.security import generate_password_hash, check_password_hash
app = Flask(__name__)
CORS(app)

# @app.route("/")
# def test_db():
#     try:#dùng để thử kết nối đến SQL Server và thực hiện các thao tác liên quan đến cơ sở dữ liệu. Nếu có lỗi xảy ra trong quá trình kết nối hoặc thao tác, nó sẽ được bắt và xử lý trong phần except.
#         conn = pyodbc.connect(
#             "DRIVER={ODBC Driver 17 for SQL Server};"
#             "SERVER=127.0.0.1,1433;"
#             "DATABASE=BookDB;"
#             "UID=sa;"
#             "PWD=Aa123456@;"
#             "TrustServerCertificate=yes;"
#         )

    #     return "✅ Connected to SQL Server successfully!"

    # except Exception as e: #dùng để bắt tất cả các loại lỗi có thể xảy ra khi kết nối đến SQL Server, kết hợp với try
    #     return f"❌ Database connection failed: {str(e)}"


# if __name__ == "__main__":
#     app.run(debug=True)

    # app.py

# ==== KẾT NỐI SQL SERVER ====
conn_str = (
    "DRIVER={ODBC Driver 17 for SQL Server};"
            "SERVER=127.0.0.1,1433;"
            "DATABASE=BookDB;"
            "UID=sa;"
            "PWD=Aa123456@;"
            "TrustServerCertificate=yes;"
        )

def get_db():
    return pyodbc.connect(conn_str)


# ==== BOOKS API ====

@app.route('/api/books', methods=['GET'])
def get_books():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT b.id, b.title, b.author_id, b.category_id,
               a.full_name AS author, c.name AS category,
               b.published_year, b.description
        FROM Books b
        JOIN Authors    a ON b.author_id   = a.id
        JOIN Categories c ON b.category_id = c.id
    """)
    books = [
        {
            "id": r[0], "title": r[1], "author_id": r[2], "category_id": r[3],
            "author": r[4], "category": r[5],
            "published_year": r[6], "description": r[7]
        }
        for r in cursor.fetchall()
    ]
    conn.close()
    return jsonify(books)


@app.route('/api/books/<int:book_id>', methods=['GET'])
def get_book(book_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT b.id, b.title, b.author_id, b.category_id,
               a.full_name, c.name, b.published_year, b.description
        FROM Books b
        JOIN Authors    a ON b.author_id   = a.id
        JOIN Categories c ON b.category_id = c.id
        WHERE b.id = ?
    """, book_id)
    r = cursor.fetchone()
    conn.close()
    if not r:
        return jsonify({"error": "Không tìm thấy sách"}), 404
    return jsonify({
        "id": r[0], "title": r[1], "author_id": r[2], "category_id": r[3],
        "author": r[4], "category": r[5],
        "published_year": r[6], "description": r[7]
    })


@app.route('/api/books', methods=['POST'])
def add_book():
    data = request.json
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO Books (title, author_id, category_id, published_year, description)
        VALUES (?, ?, ?, ?, ?)
    """, data['title'], data['author_id'], data['category_id'],
         data.get('published_year'), data.get('description'))
    conn.commit()
    conn.close()
    return jsonify({"message": "Thêm sách thành công"}), 201


@app.route('/api/books/<int:book_id>', methods=['PUT'])
def update_book(book_id):
    data = request.json
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE Books
        SET title=?, author_id=?, category_id=?, published_year=?, description=?
        WHERE id=?
    """, data['title'], data['author_id'], data['category_id'],
         data.get('published_year'), data.get('description'), book_id)
    conn.commit()
    conn.close()
    return jsonify({"message": "Cập nhật sách thành công"})


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
    cursor.execute("SELECT id, full_name, bio, CAST(birthdate AS VARCHAR) FROM Authors")
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
        "INSERT INTO Authors (full_name, bio, birthdate) VALUES (?, ?, ?)",
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
    cursor.execute("SELECT id, name, description FROM Categories")
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


# ============================================================
#  USERS (Auth)
# ============================================================

@app.route('/api/register', methods=['POST'])
def register():
    data = request.json
    hashed = generate_password_hash(data['password'])
    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "INSERT INTO Users (username, email, password_hash) VALUES (?, ?, ?)",
            data['username'], data['email'], hashed
        )
        conn.commit()
        return jsonify({"message": "Đăng ký thành công"}), 201
    except Exception as e:
        return jsonify({"error": "Tên đăng nhập hoặc email đã tồn tại"}), 400
    finally:
        conn.close()


@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT password_hash, role FROM Users WHERE username=?",
        data['username']
    )
    row = cursor.fetchone()
    conn.close()
    if row and check_password_hash(row[0], data['password']):
        return jsonify({"message": "Đăng nhập thành công", "role": row[1]})
    return jsonify({"error": "Sai tài khoản hoặc mật khẩu"}), 401


if __name__ == '__main__':
    app.run(debug=True, port=5000)
