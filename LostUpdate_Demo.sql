-- ============================================================
-- MÔ PHỎNG LOST UPDATE (Mất dữ liệu cập nhật)
-- ============================================================
-- Kịch bản: Hai session đọc cùng 1 record, cả hai sửa đổi.
-- Session nào commit sau sẽ ghi đè hoàn toàn changes của session trước.
-- ============================================================

USE BookDB;
GO

-- Thiết lập lại dữ liệu mẫu
DELETE FROM Books;
DELETE FROM Authors;
DELETE FROM Categories;
DBCC CHECKIDENT ('Books', RESEED, 0);
DBCC CHECKIDENT ('Authors', RESEED, 0);
DBCC CHECKIDENT ('Categories', RESEED, 0);

INSERT INTO Authors (full_name, bio, birthdate) VALUES
(N'Nguyễn Nhật Ánh', N'Nhà văn nổi tiếng Việt Nam', '1955-05-07');

INSERT INTO Categories (name, description) VALUES
(N'Văn học', N'Sách văn học trong và ngoài nước');

INSERT INTO Books (title, author_id, category_id, published_year, description, quantity) VALUES
(N'Mắt Biếc', 1, 1, 1990, N'Câu chuyện tình yêu đẹp và buồn', 10);
GO

-- ============================================================
-- GIẢI THÍCH: Tại sao Lost Update xảy ra?
-- ============================================================
-- 1. Session A đọc quantity = 10
-- 2. Session B đọc quantity = 10 (cùng lúc, trước khi A commit)
-- 3. Session A: UPDATE Books SET quantity = 15 WHERE id = 1
-- 4. Session B: UPDATE Books SET quantity = 20 WHERE id = 1
-- 5. Session A commit trước → quantity = 15
-- 6. Session B commit sau → quantity = 20 (ghi đè mất 15!)
--
-- Kết quả: Thay đổi của Session A (15) bị "mất" hoàn toàn!
-- ============================================================

PRINT N'=== Dữ liệu ban đầu ===';
SELECT * FROM Books;
GO

-- ============================================================
-- CÁCH 1: Mô phỏng bằng hai query riêng biệt (giả lập)
-- ============================================================
PRINT N'';
PRINT N'=== Bắt đầu mô phỏng Lost Update ===';

-- Giả lập Session 1: Đọc và tính toán
DECLARE @qty_session1 INT;
SELECT @qty_session1 = quantity FROM Books WHERE id = 1;
PRINT N'Session 1 đọc được quantity: ' + CAST(@qty_session1 AS NVARCHAR(10));

-- Giả lập Session 2: Đọc cùng dữ liệu (trước khi Session 1 commit)
DECLARE @qty_session2 INT;
SELECT @qty_session2 = quantity FROM Books WHERE id = 1;
PRINT N'Session 2 đọc được quantity: ' + CAST(@qty_session2 AS NVARCHAR(10));

-- Session 1: Cập nhật thêm 5 (quantity + 5)
UPDATE Books SET quantity = @qty_session1 + 5 WHERE id = 1;
PRINT N'Session 1 cập nhật: quantity = ' + CAST(@qty_session1 + 5 AS NVARCHAR(10));

-- Session 2: Cập nhật thêm 10 (quantity + 10) - ghi đè!
UPDATE Books SET quantity = @qty_session2 + 10 WHERE id = 1;
PRINT N'Session 2 cập nhật: quantity = ' + CAST(@qty_session2 + 10 AS NVARCHAR(10));

PRINT N'';
PRINT N'=== Kết quả sau khi cả hai cập nhật ===';
SELECT * FROM Books;
GO

-- ============================================================
-- CÁCH 2: Sử dụng hai connection riêng (thực tế hơn)
-- ============================================================
/*
-- Trong SQL Server Management Studio, mở hai cửa sổ query:

-- === SESSION 1 (Connection 1) ===
USE BookDB;
BEGIN TRANSACTION;
    DECLARE @qty INT;
    SELECT @qty = quantity FROM Books WHERE id = 1;
    PRINT N'Session 1 đọc: ' + CAST(@qty AS NVARCHAR(10));
    -- ... xử lý khác ...
    UPDATE Books SET quantity = @qty + 5 WHERE id = 1;
    -- Đừng commit ngay, để Session 2 chạy
COMMIT;

-- === SESSION 2 (Connection 2) ===
USE BookDB;
BEGIN TRANSACTION;
    DECLARE @qty INT;
    SELECT @qty = quantity FROM Books WHERE id = 1;
    PRINT N'Session 2 đọc: ' + CAST(@qty AS NVARCHAR(10));
    -- ... xử lý khác ...
    UPDATE Books SET quantity = @qty + 10 WHERE id = 1;
COMMIT;
*/

-- ============================================================
-- CÁCH NGĂN LOST UPDATE: Sử dụng optimistic/pessimistic locking
-- ============================================================

-- Optimistic Locking: Dùng ROWVERSION (đã có trong DB)
PRINT N'';
PRINT N'=== Minh họa Optimistic Locking ===';

-- Thiết lập lại
UPDATE Books SET quantity = 10 WHERE id = 1;

DECLARE @row_ver BINARY(8);
SELECT @row_ver = row_ver FROM Books WHERE id = 1;
PRINT N'Row version ban đầu: ' + CAST(@row_ver AS NVARCHAR(20));

-- Session 1 cập nhật với row_ver kiểm tra
UPDATE Books 
SET quantity = 15, row_ver = row_ver 
WHERE id = 1 AND row_ver = @row_ver;

IF @@ROWCOUNT > 0
    PRINT N'Session 1 cập nhật thành công!'
ELSE
    PRINT N'Session 1 thất bại - dữ liệu đã bị thay đổi!';

SELECT * FROM Books;
GO

-- ============================================================
-- KẾT LUẬN
-- ============================================================
PRINT N'';
PRINT N'=== KẾT LUẬN ===';
PRINT N'Lost Update xảy ra khi:';
PRINT N'  1. Hai transaction đọc cùng dữ liệu';
PRINT N'  2. Cả hai đều sửa đổi dựa trên dữ liệu đã đọc';
PRINT N'  3. Transaction commit sau ghi đè changes của transaction trước';
PRINT N'';
PRINT N'Cách ngăn chặn:';
PRINT N'  - Pessimistic Locking: SELECT ... WITH (UPDLOCK)';
PRINT N'  - Optimistic Locking: Dùng ROWVERSION hoặc timestamp';
PRINT N'  - Isolation Level: SERIALIZABLE hoặc SNAPSHOT';
GO