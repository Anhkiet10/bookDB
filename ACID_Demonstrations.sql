-- ============================================================
-- ACID & CONCURRENCY ISSUES - PRACTICAL EXAMPLES FOR BookDB
-- ============================================================
-- Purpose: Demonstrations của các vấn đề đồng thời trong SQL Server
-- Cách chạy: Mở 2 Query windows cùng lúc
-- ============================================================

-- ============================================================
-- 1. DEMONSTRATION: LOST UPDATE
-- ============================================================
-- Kịch bản: Hai user cùng mua 1 cuốn sách
-- Mở 2 cửa sổ query và chạy lần lượt theo hướng dẫn

-- Connection 1: Transaction A - Mua 1 cuốn sách (chậm)
-- ============================================================
/*
USE BookDB;

-- Bước 1: Xem quantity hiện tại
SELECT 'Bước 1 - Transaction A' as [Step], quantity FROM Books WHERE id = 1;

-- Bước 2: Lưu giá trị vào biến (giả lập read operation)
BEGIN TRANSACTION
DECLARE @quantity INT;
SELECT @quantity = quantity FROM Books WHERE id = 1;
PRINT 'Transaction A: Đã đọc quantity = ' + CAST(@quantity AS VARCHAR);

-- Bước 3: Chờ để Transaction B cập nhật
PRINT 'Transaction A: Đang chờ 10 giây...';
WAITFOR DELAY '00:00:10';

-- Bước 4: Cập nhật (mua 1 cuốn)
UPDATE Books SET quantity = @quantity - 1 WHERE id = 1;
PRINT 'Transaction A: Đã update quantity = ' + CAST(@quantity - 1 AS VARCHAR);

-- Bước 5: Commit
COMMIT;
PRINT 'Transaction A: COMMITTED';

-- Bước 6: Kiểm tra kết quả cuối cùng
SELECT 'Bước 6 - Kết quả cuối' as [Step], quantity FROM Books WHERE id = 1;
*/

-- Connection 2: Transaction B - Mua 5 cuốn sách (nhanh)
-- ============================================================
/*
USE BookDB;

-- Bước 1: Xem quantity hiện tại
SELECT 'Bước 1 - Transaction B' as [Step], quantity FROM Books WHERE id = 1;

-- Bước 2: Chờ 3 giây để Transaction A bắt đầu
PRINT 'Transaction B: Chờ 3 giây...';
WAITFOR DELAY '00:00:03';

-- Bước 3: Lưu giá trị vào biến
BEGIN TRANSACTION
DECLARE @quantity INT;
SELECT @quantity = quantity FROM Books WHERE id = 1;
PRINT 'Transaction B: Đã đọc quantity = ' + CAST(@quantity AS VARCHAR);

-- Bước 4: Cập nhật (mua 5 cuốn) - Chạy ngay lập tức
UPDATE Books SET quantity = @quantity - 5 WHERE id = 1;
PRINT 'Transaction B: Đã update quantity = ' + CAST(@quantity - 5 AS VARCHAR);

-- Bước 5: Commit
COMMIT;
PRINT 'Transaction B: COMMITTED';

-- Bước 6: Kiểm tra kết quả cuối cùng
SELECT 'Bước 6 - Kết quả cuối' as [Step], quantity FROM Books WHERE id = 1;
*/

-- ============================================================
-- GIẢI PHÁP 1: Lost Update - Optimistic Locking với ROWVERSION
-- ============================================================
/*
-- Chuẩn bị: Reset dữ liệu
UPDATE Books SET quantity = 100 WHERE id = 1;

-- Connection 1: Transaction A - Với Optimistic Lock
BEGIN TRANSACTION
DECLARE @quantity INT, @row_ver ROWVERSION;
SELECT @quantity = quantity, @row_ver = row_ver FROM Books WHERE id = 1;
PRINT 'Txn A: Đọc quantity=' + CAST(@quantity AS VARCHAR) + ', row_ver=' + CAST(@row_ver AS VARCHAR);

PRINT 'Txn A: Chờ 5 giây...';
WAITFOR DELAY '00:00:05';

-- Cập nhật chỉ nếu row_ver không thay đổi
UPDATE Books 
SET quantity = @quantity - 1 
WHERE id = 1 AND row_ver = @row_ver;

IF @@ROWCOUNT = 0
    PRINT 'Txn A: UPDATE FAILED - Row đã được sửa bởi txn khác!';
ELSE
    PRINT 'Txn A: UPDATE SUCCESS';

COMMIT;

-- Connection 2: Transaction B - Vào giữa lúc A chờ
BEGIN TRANSACTION
DECLARE @quantity INT;
SELECT @quantity = quantity FROM Books WHERE id = 1;
PRINT 'Txn B: Đọc quantity=' + CAST(@quantity AS VARCHAR);

UPDATE Books SET quantity = @quantity - 5 WHERE id = 1;
PRINT 'Txn B: Update xong';
COMMIT;

-- Kiểm tra kết quả: nên là 94 (100 - 5 - 1) hoặc 95 (tùy vào update nào chạy)
SELECT 'Kết quả cuối' as [Result], quantity FROM Books WHERE id = 1;
*/

-- ============================================================
-- GIẢI PHÁP 2: Lost Update - Pessimistic Locking (UPDLOCK)
-- ============================================================
/*
-- Chuẩn bị: Reset dữ liệu
UPDATE Books SET quantity = 100 WHERE id = 1;

-- Connection 1: Với Pessimistic Lock
BEGIN TRANSACTION
DECLARE @quantity INT;
SELECT @quantity = quantity FROM Books (UPDLOCK) WHERE id = 1;
PRINT 'Txn A: UPDLOCK - Đọc quantity=' + CAST(@quantity AS VARCHAR);

PRINT 'Txn A: Chờ 5 giây...';
WAITFOR DELAY '00:00:05';

UPDATE Books SET quantity = @quantity - 1 WHERE id = 1;
PRINT 'Txn A: Update xong';
COMMIT;

-- Connection 2: Sẽ bị block khi đến SELECT của Txn A
SELECT 'Txn B' as [Info], quantity FROM Books WHERE id = 1;
PRINT 'Txn B: Lưu ý - Txn A giữ lock, nên Txn B phải chờ!';
*/

-- ============================================================
-- 2. DEMONSTRATION: DIRTY READ
-- ============================================================
-- Kịch bản: Txn B đọc dữ liệu chưa commit từ Txn A

-- Connection 1: Transaction A - Update rồi Rollback
-- ============================================================
/*
USE BookDB;

BEGIN TRANSACTION
UPDATE Books SET quantity = 999 WHERE id = 1;
PRINT 'Txn A: UPDATE quantity = 999 (chưa COMMIT)';

-- Chờ Txn B đọc dữ liệu
PRINT 'Txn A: Chờ Txn B đọc...';
WAITFOR DELAY '00:00:05';

ROLLBACK;
PRINT 'Txn A: ROLLBACK - dữ liệu không thay đổi!';

SELECT 'Kết quả Txn A' as [Step], quantity FROM Books WHERE id = 1;
*/

-- Connection 2: Transaction B - Đọc với READ UNCOMMITTED
-- ============================================================
/*
-- ✗ SAI: Cho phép Dirty Read
SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;
PRINT 'Txn B: ISOLATION LEVEL = READ UNCOMMITTED';

WAITFOR DELAY '00:00:02';

BEGIN TRANSACTION
SELECT 'Txn B - Dirty Read (SAI)' as [Info], quantity FROM Books WHERE id = 1;
PRINT 'Txn B: Đã đọc quantity = 999 (Dirty Data!)';

WAITFOR DELAY '00:00:05';

SELECT 'Txn B - Kiểm tra lại' as [Info], quantity FROM Books WHERE id = 1;
PRINT 'Txn B: Quantity lại bị đổi thành quantity gốc (Inconsistent Read!)';
COMMIT;
*/

-- Connection 2 (Cách đúng): Đọc với READ COMMITTED
-- ============================================================
/*
-- ✓ ĐÚNG: Chỉ đọc dữ liệu đã COMMIT
SET TRANSACTION ISOLATION LEVEL READ COMMITTED;
PRINT 'Txn B: ISOLATION LEVEL = READ COMMITTED';

WAITFOR DELAY '00:00:02';

BEGIN TRANSACTION
PRINT 'Txn B: Chờ dữ liệu được COMMIT...';
SELECT 'Txn B - Clean Read (ĐÚNG)' as [Info], quantity FROM Books WHERE id = 1;
PRINT 'Txn B: Chỉ đọc dữ liệu đã được COMMIT từ Txn A';
COMMIT;
*/

-- ============================================================
-- 3. DEMONSTRATION: NON-REPEATABLE READ
-- ============================================================
-- Kịch bán: Cùng query chạy 2 lần trong 1 Txn nhưng kết quả khác

-- Connection 1: Transaction A - Đọc 2 lần
-- ============================================================
/*
SET TRANSACTION ISOLATION LEVEL READ COMMITTED;  -- ⚠️ Mặc định
PRINT 'Txn A: ISOLATION LEVEL = READ COMMITTED';

BEGIN TRANSACTION
DECLARE @q1 INT, @q2 INT;

-- Lần 1: Đọc
SELECT @q1 = quantity FROM Books WHERE id = 1;
PRINT 'Txn A - Lần 1: quantity = ' + CAST(@q1 AS VARCHAR);

-- Chờ Txn B cập nhật
PRINT 'Txn A: Chờ 5 giây...';
WAITFOR DELAY '00:00:05';

-- Lần 2: Đọc lại
SELECT @q2 = quantity FROM Books WHERE id = 1;
PRINT 'Txn A - Lần 2: quantity = ' + CAST(@q2 AS VARCHAR);

IF @q1 = @q2
    PRINT 'Txn A: ✓ Dữ liệu nhất quán';
ELSE
    PRINT 'Txn A: ✗ Non-repeatable Read! @q1=' + CAST(@q1 AS VARCHAR) + ', @q2=' + CAST(@q2 AS VARCHAR);

COMMIT;
*/

-- Connection 2: Transaction B - Cập nhật giữa lúc A
-- ============================================================
/*
WAITFOR DELAY '00:00:02';

UPDATE Books SET quantity = 777 WHERE id = 1;
PRINT 'Txn B: UPDATE quantity = 777 và COMMIT';
COMMIT;
*/

-- ============================================================
-- GIẢI PHÁP: NON-REPEATABLE READ - REPEATABLE READ
-- ============================================================
-- Connection 1: Với REPEATABLE READ
-- ============================================================
/*
SET TRANSACTION ISOLATION LEVEL REPEATABLE READ;  -- ✓ Phòng chống
PRINT 'Txn A: ISOLATION LEVEL = REPEATABLE READ';

BEGIN TRANSACTION
DECLARE @q1 INT, @q2 INT;

-- Lần 1: Đọc (sẽ lock row này)
SELECT @q1 = quantity FROM Books WHERE id = 1;
PRINT 'Txn A - Lần 1: quantity = ' + CAST(@q1 AS VARCHAR) + ' (LOCKED)';

PRINT 'Txn A: Chờ 5 giây...';
WAITFOR DELAY '00:00:05';

-- Lần 2: Đọc lại (Txn B không thể update)
SELECT @q2 = quantity FROM Books WHERE id = 1;
PRINT 'Txn A - Lần 2: quantity = ' + CAST(@q2 AS VARCHAR);

IF @q1 = @q2
    PRINT 'Txn A: ✓ Dữ liệu nhất quán (Repeatable Read)';
ELSE
    PRINT 'Txn A: ✗ Inconsistency detected!';

COMMIT;
*/

-- ============================================================
-- 4. DEMONSTRATION: PHANTOM READ
-- ============================================================
-- Kịch bản: Số lượng row thay đổi giữa 2 lần COUNT

-- Connection 1: Transaction A - Count 2 lần
-- ============================================================
/*
SET TRANSACTION ISOLATION LEVEL REPEATABLE READ;  -- ⚠️ Không ngăn Phantom
PRINT 'Txn A: ISOLATION LEVEL = REPEATABLE READ';

BEGIN TRANSACTION
DECLARE @c1 INT, @c2 INT;

-- Lần 1: Count
SELECT @c1 = COUNT(*) FROM Books WHERE category_id = 1;
PRINT 'Txn A - Lần 1: COUNT(*) = ' + CAST(@c1 AS VARCHAR);

PRINT 'Txn A: Chờ 5 giây...';
WAITFOR DELAY '00:00:05';

-- Lần 2: Count lại
SELECT @c2 = COUNT(*) FROM Books WHERE category_id = 1;
PRINT 'Txn A - Lần 2: COUNT(*) = ' + CAST(@c2 AS VARCHAR);

IF @c1 = @c2
    PRINT 'Txn A: ✓ Số row nhất quán';
ELSE
    PRINT 'Txn A: ✗ PHANTOM READ! @c1=' + CAST(@c1 AS VARCHAR) + ', @c2=' + CAST(@c2 AS VARCHAR);

COMMIT;
*/

-- Connection 2: Transaction B - Insert vào giữa lúc A
-- ============================================================
/*
WAITFOR DELAY '00:00:02';

-- Chuẩn bị: Kiểm tra category_id = 1 có tồn tại không
SELECT TOP 1 @cat_id = category_id FROM Books WHERE category_id = 1;

IF @cat_id IS NOT NULL
BEGIN
    INSERT INTO Books (title, author_id, category_id, quantity, created_at)
    VALUES ('Phantom Book', 1, 1, 10, GETDATE());
    PRINT 'Txn B: INSERT 1 cuốn sách với category_id = 1';
    COMMIT;
END
*/

-- ============================================================
-- GIẢI PHÁP: PHANTOM READ - SERIALIZABLE
-- ============================================================
-- Connection 1: Với SERIALIZABLE
-- ============================================================
/*
SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;  -- ✓ Ngăn Phantom
PRINT 'Txn A: ISOLATION LEVEL = SERIALIZABLE';

BEGIN TRANSACTION
DECLARE @c1 INT, @c2 INT;

-- Lần 1: Count (lock range)
SELECT @c1 = COUNT(*) FROM Books WHERE category_id = 1;
PRINT 'Txn A - Lần 1: COUNT(*) = ' + CAST(@c1 AS VARCHAR) + ' (RANGE LOCK)';

PRINT 'Txn A: Chờ 5 giây...';
WAITFOR DELAY '00:00:05';

-- Lần 2: Count lại
SELECT @c2 = COUNT(*) FROM Books WHERE category_id = 1;
PRINT 'Txn A - Lần 2: COUNT(*) = ' + CAST(@c2 AS VARCHAR);

IF @c1 = @c2
    PRINT 'Txn A: ✓ Số row nhất quán (Serializable)';
ELSE
    PRINT 'Txn A: ✗ Inconsistency!';

COMMIT;
*/

-- ============================================================
-- THỰC HÀNH: Test Optimistic Locking với ROWVERSION
-- ============================================================
/*
-- Bước 1: Kiểm tra ROWVERSION
USE BookDB;
SELECT id, title, quantity, row_ver FROM Books WHERE id = 1;

-- Bước 2: Simulate Update với kiểm tra version
DECLARE @bookId INT = 1;
DECLARE @currentQty INT;
DECLARE @currentRowVer ROWVERSION;
DECLARE @newQty INT;

BEGIN TRANSACTION

    -- Đọc giá trị hiện tại
    SELECT @currentQty = quantity, @currentRowVer = row_ver 
    FROM Books WHERE id = @bookId;
    
    PRINT 'Lần 1: quantity=' + CAST(@currentQty AS VARCHAR) 
        + ', row_ver=' + CAST(@currentRowVer AS VARCHAR);
    
    -- Tính toán giá trị mới
    SET @newQty = @currentQty - 1;
    
    -- Update chỉ nếu row_ver không thay đổi
    UPDATE Books 
    SET quantity = @newQty
    WHERE id = @bookId AND row_ver = @currentRowVer;
    
    IF @@ROWCOUNT = 0
    BEGIN
        PRINT 'CONFLICT: Row đã được sửa, Rollback';
        ROLLBACK;
    END
    ELSE
    BEGIN
        PRINT 'SUCCESS: Update thành công';
        COMMIT;
    END
    
-- Kiểm tra kết quả
SELECT id, title, quantity, row_ver FROM Books WHERE id = 1;
*/

-- ============================================================
-- BEST PRACTICE: RECOMMENDED ISOLATION LEVELS
-- ============================================================

-- 1. Cho hoạt động BUY/SELL (Tính sẵn có quan trọng)
-- ============================================================
/*
CREATE PROCEDURE sp_BuyBook
    @BookId INT,
    @UserId INT,
    @Quantity INT,
    @Result NVARCHAR(100) OUTPUT
AS
BEGIN
    SET TRANSACTION ISOLATION LEVEL REPEATABLE READ;
    
    BEGIN TRANSACTION
        DECLARE @AvailableQty INT, @RowVer ROWVERSION;
        
        -- Đọc với lock
        SELECT @AvailableQty = quantity, @RowVer = row_ver
        FROM Books (UPDLOCK) WHERE id = @BookId;
        
        IF @AvailableQty >= @Quantity
        BEGIN
            -- Update
            UPDATE Books 
            SET quantity = quantity - @Quantity
            WHERE id = @BookId AND row_ver = @RowVer;
            
            IF @@ROWCOUNT > 0
            BEGIN
                -- INSERT vào lịch sử
                INSERT INTO BorrowRecords (user_id, book_id, quantity, borrow_date)
                VALUES (@UserId, @BookId, @Quantity, GETDATE());
                
                COMMIT;
                SET @Result = 'SUCCESS';
            END
            ELSE
            BEGIN
                ROLLBACK;
                SET @Result = 'CONFLICT - Please retry';
            END
        END
        ELSE
        BEGIN
            ROLLBACK;
            SET @Result = 'NOT ENOUGH QUANTITY';
        END
    END
END;
*/

-- 2. Cho hoạt động báo cáo (Consistency quan trọng)
-- ============================================================
/*
CREATE PROCEDURE sp_GetBookStats
    @Stats NVARCHAR(MAX) OUTPUT
AS
BEGIN
    SET TRANSACTION ISOLATION LEVEL SNAPSHOT;  -- Không lock, nhất quán
    
    BEGIN TRANSACTION
        DECLARE @TotalBooks INT, @TotalQty INT, @ActiveUsers INT;
        
        SELECT @TotalBooks = COUNT(*), @TotalQty = SUM(quantity)
        FROM Books;
        
        SELECT @ActiveUsers = COUNT(DISTINCT user_id)
        FROM Users;
        
        SET @Stats = 'Total Books: ' + CAST(@TotalBooks AS VARCHAR) 
                   + ', Total Qty: ' + CAST(@TotalQty AS VARCHAR)
                   + ', Active Users: ' + CAST(@ActiveUsers AS VARCHAR);
        
        COMMIT;
    END
END;
*/
