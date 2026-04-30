# Đánh Giá ACID và 4 Vấn Đề Đồng Thời (Concurrency Issues)

## I. ACID PROPERTIES (Tính Chất ACID)

### 1. **Atomicity (Tính Nguyên Tử)**

- **Định nghĩa**: Một giao dịch (transaction) được thực hiện hoàn toàn hoặc không thực hiện gì cả (All or Nothing)
- **Ví dụ**: Khi chuyển tiền từ tài khoản A sang B, nếu có lỗi xảy ra giữa chừng, toàn bộ giao dịch sẽ bị rollback
- **Trong BookDB**: Khi tạo một cuốn sách, nếu lỗi xảy ra ở giữa, dữ liệu Books, Authors sẽ không được lưu

```sql
BEGIN TRANSACTION
    INSERT INTO Authors (full_name, bio) VALUES ('John Doe', 'Author bio')
    INSERT INTO Books (title, author_id, ...) VALUES ('Book Title', 1, ...)
    -- Nếu lỗi ở đây, cả 2 INSERT sẽ rollback
COMMIT TRANSACTION
```

### 2. **Consistency (Tính Nhất Quán)**

- **Định nghĩa**: Dữ liệu luôn ở trạng thái hợp lệ, thỏa mãn tất cả các ràng buộc (constraints)
- **Ví dụ**:
  - Tính chất NOT NULL phải được đảm bảo
  - Foreign Key phải tồn tại
  - CHECK constraints phải được kiểm tra (quantity >= 0)
- **Trong BookDB**: Không thể tạo Books mà không có author_id hợp lệ hoặc quantity < 0

```sql
-- ✓ Valid - Quantity >= 0
INSERT INTO Books (title, author_id, category_id, quantity)
VALUES ('Valid Book', 1, 1, 10);

-- ✗ Invalid - Violates CHECK constraint
INSERT INTO Books (title, author_id, category_id, quantity)
VALUES ('Invalid Book', 1, 1, -5);  -- LỖI!
```

### 3. **Isolation (Tính Cô Lập)**

- **Định nghĩa**: Các giao dịch đồng thời không ảnh hưởng lẫn nhau
- **Mức độ Isolation trong SQL Server** (từ thấp đến cao):
  1. **READ UNCOMMITTED** - Thấp nhất, chỉ không lock
  2. **READ COMMITTED** - Mặc định, chỉ đọc dữ liệu đã commit
  3. **REPEATABLE READ** - Tránh Dirty Read & Non-repeatable Read
  4. **SERIALIZABLE** - Cao nhất, toàn bộ transaction được serialize
  5. **SNAPSHOT** - Sử dụng versioning

```sql
SET TRANSACTION ISOLATION LEVEL READ COMMITTED;
BEGIN TRANSACTION
    -- Chỉ đọc dữ liệu đã được commit bởi giao dịch khác
    SELECT quantity FROM Books WHERE id = 1;
COMMIT;
```

### 4. **Durability (Tính Bền Vững)**

- **Định nghĩa**: Dữ liệu đã commit sẽ được lưu vĩnh viễn, không bị mất kể cả khi có sự cố
- **Ví dụ**: Ngay cả khi máy tính bị tắt đột ngột, dữ liệu đã commit vẫn được bảo toàn
- **Trong SQL Server**: Dữ liệu được ghi vào transaction log

```sql
BEGIN TRANSACTION
    UPDATE Books SET quantity = 100 WHERE id = 1;
COMMIT;  -- Dữ liệu này sẽ tồn tại vĩnh viễn
```

---

## II. 4 VẤN ĐỀ ĐỒNG THỜI (CONCURRENCY ISSUES)

### 1. **LOST UPDATE (Mất Cập Nhật)**

**Định nghĩa**: Một giao dịch cập nhật dữ liệu bị ghi đè bởi giao dịch khác

**Kịch bản**:

```
Bước 1: Transaction A đọc Books quantity = 10
Bước 2: Transaction B đọc Books quantity = 10
Bước 3: Transaction A cập nhật quantity = 9 (mua 1 cuốn) ✓ lưu
Bước 4: Transaction B cập nhật quantity = 5 (mua 5 cuốn) ✓ lưu
Kết quả: Chỉ 5 cuốn bị bán, không phải 6 cuốn! 1 cuốn mất! ✗
```

**SQL Example**:

```sql
-- Transaction A (Connection 1)
BEGIN TRANSACTION
SELECT @quantity = quantity FROM Books WHERE id = 1;  -- Đọc: 10
WAITFOR DELAY '00:00:05';  -- Chờ
UPDATE Books SET quantity = @quantity - 1 WHERE id = 1;  -- Cập nhật: 9
COMMIT;

-- Transaction B (Connection 2) - Chạy trong lúc A chờ
BEGIN TRANSACTION
SELECT @quantity = quantity FROM Books WHERE id = 1;  -- Đọc: 10
UPDATE Books SET quantity = @quantity - 5 WHERE id = 1;  -- Cập nhật: 5
COMMIT;
```

**Giải pháp**:

- ✓ Sử dụng Optimistic Locking (ROWVERSION/Timestamp)
- ✓ Sử dụng Pessimistic Locking (SELECT FOR UPDATE)
- ✓ Tăng mức Isolation Level lên REPEATABLE READ hoặc SERIALIZABLE

```sql
-- Giải pháp 1: Optimistic Locking with ROWVERSION
BEGIN TRANSACTION
SELECT @quantity = quantity, @row_ver = row_ver FROM Books WHERE id = 1;
UPDATE Books
SET quantity = @quantity - 1
WHERE id = 1 AND row_ver = @row_ver;  -- Kiểm tra row_ver
COMMIT;

-- Giải pháp 2: Pessimistic Locking
BEGIN TRANSACTION
SELECT @quantity = quantity FROM Books (UPDLOCK) WHERE id = 1;
UPDATE Books SET quantity = @quantity - 1 WHERE id = 1;
COMMIT;
```

**Mức Isolation để ngăn**: REPEATABLE READ, SERIALIZABLE

---

### 2. **DIRTY READ (Đọc Dữ Liệu Rác)**

**Định nghĩa**: Đọc dữ liệu chưa được commit bởi giao dịch khác (dữ liệu "bẩn")

**Kịch bản**:

```
Bước 1: Transaction A bắt đầu, UPDATE Books quantity = 50
Bước 2: Transaction B đọc quantity = 50 (chưa commit!) ✗ Dirty Read
Bước 3: Transaction A ROLLBACK, quantity quay lại 100
Kết quả: Transaction B đã đọc dữ liệu không tồn tại! ✗
```

**SQL Example**:

```sql
-- Transaction A (Connection 1)
BEGIN TRANSACTION
UPDATE Books SET quantity = 50 WHERE id = 1;  -- Cập nhật nhưng chưa COMMIT
WAITFOR DELAY '00:00:05';
ROLLBACK;  -- Rollback - dữ liệu không thay đổi

-- Transaction B (Connection 2) - Chạy trong lúc A
SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;  -- ⚠️ Cho phép Dirty Read
BEGIN TRANSACTION
SELECT quantity FROM Books WHERE id = 1;  -- Đọc 50 (Dirty Data!)
COMMIT;
```

**Giải pháp**:

- ✓ Sử dụng ít nhất READ COMMITTED (mặc định SQL Server)
- ✓ Không nên dùng READ UNCOMMITTED trong production
- ✓ Sử dụng REPEATABLE READ, SERIALIZABLE, hoặc SNAPSHOT

```sql
-- ✓ Đúng: Chỉ đọc dữ liệu đã commit
SET TRANSACTION ISOLATION LEVEL READ COMMITTED;
BEGIN TRANSACTION
SELECT quantity FROM Books WHERE id = 1;
COMMIT;
```

**Mức Isolation để ngăn**: READ COMMITTED (mặc định), REPEATABLE READ, SERIALIZABLE, SNAPSHOT

---

### 3. **NON-REPEATABLE READ (Không Đọc Lại Được)**

**Định nghĩa**: Đọc cùng dữ liệu 2 lần trong một giao dịch nhưng kết quả khác nhau

**Kịch bản**:

```
Bước 1: Transaction A đọc Books quantity = 10
Bước 2: Transaction B UPDATE quantity = 20 và COMMIT
Bước 3: Transaction A đọc lại quantity = 20 (khác lần 1!)
Kết quả: Cùng query, kết quả khác nhau! ✗
```

**SQL Example**:

```sql
-- Transaction A (Connection 1)
SET TRANSACTION ISOLATION LEVEL READ COMMITTED;  -- ⚠️ Mặc định
BEGIN TRANSACTION
SELECT @q1 = quantity FROM Books WHERE id = 1;  -- Lần 1: 10
WAITFOR DELAY '00:00:03';
SELECT @q2 = quantity FROM Books WHERE id = 1;  -- Lần 2: 20
-- @q1 != @q2 => Non-repeatable Read! ✗
COMMIT;

-- Transaction B (Connection 2) - Chạy trong lúc A
UPDATE Books SET quantity = 20 WHERE id = 1;
COMMIT;
```

**Giải pháp**:

- ✓ Sử dụng REPEATABLE READ để lock các row đã đọc
- ✓ Sử dụng SERIALIZABLE để lock toàn bộ table
- ✓ Sử dụng SNAPSHOT Isolation

```sql
-- ✓ Giải pháp 1: REPEATABLE READ
SET TRANSACTION ISOLATION LEVEL REPEATABLE READ;
BEGIN TRANSACTION
SELECT @q1 = quantity FROM Books WHERE id = 1;  -- Lock row này
WAITFOR DELAY '00:00:03';
SELECT @q2 = quantity FROM Books WHERE id = 1;  -- Cùng giá trị!
-- @q1 == @q2 ✓
COMMIT;

-- ✓ Giải pháp 2: SNAPSHOT Isolation
SET TRANSACTION ISOLATION LEVEL SNAPSHOT;
BEGIN TRANSACTION
SELECT @q1 = quantity FROM Books WHERE id = 1;
WAITFOR DELAY '00:00:03';
SELECT @q2 = quantity FROM Books WHERE id = 1;
-- Sử dụng row version, không lock
COMMIT;
```

**Mức Isolation để ngăn**: REPEATABLE READ, SERIALIZABLE, SNAPSHOT

---

### 4. **PHANTOM READ (Bóng Ma)**

**Định nghĩa**: Số lượng row thay đổi giữa 2 lần đọc cùng một query trong giao dịch

**Kịch bản**:

```
Bước 1: Transaction A đọc Books WHERE category_id = 1 => 5 cuốn
Bước 2: Transaction B INSERT 1 Books mới với category_id = 1 và COMMIT
Bước 3: Transaction A đọc lại cùng query => 6 cuốn (Phantom!)
Kết quả: "Bóng ma" - dòng mới xuất hiện từ hư không! ✗
```

**SQL Example**:

```sql
-- Transaction A (Connection 1)
SET TRANSACTION ISOLATION LEVEL REPEATABLE READ;  -- ⚠️ Không ngăn Phantom
BEGIN TRANSACTION
SELECT COUNT(*) @count1 FROM Books WHERE category_id = 1;  -- Lần 1: 5
WAITFOR DELAY '00:00:03';
SELECT COUNT(*) @count2 FROM Books WHERE category_id = 1;  -- Lần 2: 6
-- @count1 != @count2 => Phantom Read! ✗
COMMIT;

-- Transaction B (Connection 2)
INSERT INTO Books (title, author_id, category_id, quantity, created_at)
VALUES ('New Book', 1, 1, 10, GETDATE());
COMMIT;
```

**Giải pháp**:

- ✓ Sử dụng SERIALIZABLE để lock toàn bộ range
- ✓ Sử dụng SNAPSHOT Isolation

```sql
-- ✓ Giải pháp 1: SERIALIZABLE
SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;
BEGIN TRANSACTION
SELECT COUNT(*) @count1 FROM Books WHERE category_id = 1;  -- Lock range
WAITFOR DELAY '00:00:03';
SELECT COUNT(*) @count2 FROM Books WHERE category_id = 1;  -- Cùng giá trị!
COMMIT;

-- ✓ Giải pháp 2: SNAPSHOT
SET TRANSACTION ISOLATION LEVEL SNAPSHOT;
BEGIN TRANSACTION
SELECT COUNT(*) @count1 FROM Books WHERE category_id = 1;
WAITFOR DELAY '00:00:03';
SELECT COUNT(*) @count2 FROM Books WHERE category_id = 1;
COMMIT;
```

**Mức Isolation để ngăn**: SERIALIZABLE, SNAPSHOT

---

## III. BẢNG SO SÁNH MỨC ISOLATION LEVEL

| Isolation Level      | Lost Update | Dirty Read | Non-repeatable Read | Phantom Read | Lock Độ Mạnh         |
| -------------------- | ----------- | ---------- | ------------------- | ------------ | -------------------- |
| **READ UNCOMMITTED** | ✗ Có        | ✗ Có       | ✗ Có                | ✗ Có         | Yếu                  |
| **READ COMMITTED**   | ✗ Có        | ✓ Không    | ✗ Có                | ✗ Có         | Trung bình           |
| **REPEATABLE READ**  | ✓ Không     | ✓ Không    | ✓ Không             | ✗ Có         | Mạnh                 |
| **SERIALIZABLE**     | ✓ Không     | ✓ Không    | ✓ Không             | ✓ Không      | Rất mạnh             |
| **SNAPSHOT**         | ✓ Không     | ✓ Không    | ✓ Không             | ✓ Không      | Trung bình (version) |

---

## IV. KHUYẾN NGHỊ CHO BookDB

### 1. **Cho Bảng Books (Tính Sẵn Có quan trọng)**

```sql
-- Tránh Lost Update khi mua/bán sách
SET TRANSACTION ISOLATION LEVEL REPEATABLE READ;
BEGIN TRANSACTION
    SELECT @quantity = quantity, @row_ver = row_ver
    FROM Books (UPDLOCK) WHERE id = @bookId;

    IF @quantity >= @buyQuantity
    BEGIN
        UPDATE Books
        SET quantity = quantity - @buyQuantity
        WHERE id = @bookId AND row_ver = @row_ver;
        COMMIT;
    END
    ELSE
    BEGIN
        ROLLBACK;
        PRINT 'Không đủ sách!';
    END
END
```

### 2. **Cho Bảng Users & Borrowings (Tính Toàn vẹn quan trọng)**

```sql
-- Tránh Phantom Read khi kiểm tra user có được mượn thêm không
SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;
BEGIN TRANSACTION
    SELECT COUNT(*) @active_borrows FROM Borrowings
    WHERE user_id = @userId AND return_date IS NULL;

    IF @active_borrows < 5  -- Tối đa 5 sách
    BEGIN
        INSERT INTO Borrowings VALUES (@userId, @bookId, GETDATE(), NULL);
        COMMIT;
    END
    ELSE
    BEGIN
        ROLLBACK;
        PRINT 'Bạn đã mượn quá nhiều sách!';
    END
END
```

### 3. **Cho Report/Analytics (Tính Nhất quán quan trọng)**

```sql
-- Sử dụng SNAPSHOT để tránh lock hành động user
SET TRANSACTION ISOLATION LEVEL SNAPSHOT;
BEGIN TRANSACTION
    SELECT COUNT(*) @total_books, SUM(quantity) @total_qty FROM Books;
    SELECT COUNT(DISTINCT user_id) @active_users FROM Users;
COMMIT;
```

---

## V. KẾT LUẬN

| Vấn đề                  | Tác động                   | Giải pháp Ưu tiên            | Ví dụ BookDB           |
| ----------------------- | -------------------------- | ---------------------------- | ---------------------- |
| **Lost Update**         | $$$ (Lỗi tài chính)        | ROWVERSION + Optimistic Lock | Bảng Books khi bán     |
| **Dirty Read**          | $$ (Dữ liệu sai)           | READ COMMITTED (mặc định)    | Tránh READ UNCOMMITTED |
| **Non-repeatable Read** | $$ (Kết quả không ổn định) | REPEATABLE READ              | Kiểm tra quantity      |
| **Phantom Read**        | $ (Logic lệnh)             | SERIALIZABLE/SNAPSHOT        | Đếm sách theo category |

**Best Practice**:

- ✓ Dùng **READ COMMITTED** làm mặc định
- ✓ Nâng lên **REPEATABLE READ** cho các hành động quan trọng
- ✓ Sử dụng **ROWVERSION** cho Optimistic Locking
- ✓ Sử dụng **SNAPSHOT** cho analytics/report
- ✓ Tránh **SERIALIZABLE** nếu không cần thiết (chậm)
