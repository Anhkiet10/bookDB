-- ============================================================
-- MÔ PHỎNG: TRANSACTION DÀI + ĐỌC PHẢI DỮ LIỆU SAI
-- ============================================================
-- Kịch bản: User A đang sửa sách (chưa commit) 
--           → User B click xem chi tiết sẽ thấy gì?
-- ============================================================

USE BookDB;
GO

-- Thiết lập dữ liệu ban đầu
DELETE FROM Books;
DBCC CHECKIDENT ('Books', RESEED, 0);

INSERT INTO Authors (full_name, bio, birthdate) VALUES
(N'Nguyễn Nhật Ánh', N'Nhà văn nổi tiếng', '1955-05-07');

INSERT INTO Categories (name, description) VALUES
(N'Văn học', N'Sách văn học');

INSERT INTO Books (title, author_id, category_id, published_year, description, quantity) VALUES
(N'Mắt Biếc', 1, 1, 1990, N'Câu chuyện tình yêu đẹp', 10);
GO

PRINT N'=== Dữ liệu ban đầu ===';
SELECT id, title, quantity FROM Books;
GO

-- ============================================================
-- CÁCH 1: Mô phỏng bằng script (giả lập 2 session)
-- ============================================================
PRINT N'';
PRINT N'=== Bắt đầu mô phỏng ===';
PRINT N'Step 1: User A bắt đầu sửa quantity về 0 (NHƯNG CHƯA COMMIT)';

-- Giả lập: User A bắt đầu UPDATE nhưng không commit
BEGIN TRANSACTION;
    UPDATE Books SET quantity = 0 WHERE id = 1;
    -- KHÔNG COMMIT - giữ transaction mở
    
    PRINT N'  → User A đã UPDATE nhưng chưa commit';
    PRINT N'  → Database chưa thay đổi!';
GO

PRINT N'';
PRINT N'Step 2: User B click "Xem chi tiết sách"';

-- Giả lập: User B đọc dữ liệu (trong khi User A chưa commit)
SET TRANSACTION ISOLATION LEVEL READ COMMITTED; -- Mặc định

SELECT id, title, quantity 
FROM Books 
WHERE id = 1;

PRINT N'';
PRINT N'→ Với READ COMMITTED: User B thấy quantity = 10 (CHƯA ĐƯỢC CẬP NHẬT)';
PRINT N'→ Đây là hiện tượng "Dirty Read"? KHÔNG!';
PRINT N'→ READ COMMITTED không đọc uncommitted data.';
GO

-- ============================================================
-- THỬ VỚI READ UNCOMMITTED (cho phép đọc dữ liệu chưa commit)
-- ============================================================
PRINT N'';
PRINT N'=== THỬ VỚI READ UNCOMMITTED ===';

-- Giả lập lại: User A UPDATE
BEGIN TRANSACTION;
    UPDATE Books SET quantity = 999 WHERE id = 1;
    PRINT N'User A UPDATE quantity = 999 (chưa commit)';
GO

-- User B đọc với READ UNCOMMITTED
SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;

SELECT id, title, quantity 
FROM Books 
WHERE id = 1;

PRINT N'';
PRINT N'→ Với READ UNCOMMITTED: User B thấy quantity = 999 (DỮ LIỆU CHƯA COMMIT!)';
PRINT N'→ ĐÂY LÀ DIRTY READ!';
GO

-- Rollback của User A
ROLLBACK;
PRINT N'';
PRINT N'User A ROLLBACK → Database quay về:';

SELECT id, title, quantity FROM Books WHERE id = 1;
GO

-- ============================================================
-- CÁCH 2: Dùng hai query window thực sự (SSMS)
-- ============================================================
/*
-- Query Window 1: User A (Admin sửa sách)
USE BookDB;
BEGIN TRANSACTION;
    UPDATE Books SET quantity = 0 WHERE id = 1;
    -- ĐỪNG COMMIT - để ngỏ ra đi uống coffee
    
-- Query Window 2: User B (Người dùng xem chi tiết sách)
USE BookDB;
SET TRANSACTION ISOLATION LEVEL READ COMMITTED;
SELECT * FROM Books WHERE id = 1;
-- Kết quả: quantity vẫn = 10 (chưa thấy thay đổi của User A)

-- Thử với READ UNCOMMITTED:
SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;
SELECT * FROM Books WHERE id = 1;
-- Kết quả: quantity = 0 (thấy dữ liệu chưa commit!)

-- Quay lại Query Window 1:
ROLLBACK; -- Hoặc COMMIT
*/

-- ============================================================
-- KẾT LUẬN
-- ============================================================
PRINT N'';
PRINT N'=== KẾT LUẬN ===';
PRINT N'';
PRINT N'Isolation Level    | User B đọc được gì?';
PRINT N'---------------------|----------------------------------';
PRINT N'READ COMMITTED      | Dữ liệu đã commit = 10 (Đúng)   ';
PRINT N'READ UNCOMMITTED    | Dữ liệu chưa commit = 999 (Sai!)  ';
PRINT N'REPEATABLE READ     | Dữ liệu đã commit = 10 (Đúng)   ';
PRINT N'SERIALIZABLE        | Dữ liệu đã commit = 10 (Đúng)   ';
PRINT N'SNAPSHOT            | Dữ liệu đã commit = 10 (Đúng)   ';
PRINT N'';
PRINT N'→ Để tránh vấn đề này:';
PRINT N'  1. Dùng READ COMMITTED (mặc định) hoặc cao hơn';
PRINT N'  2. Đặt timeout cho transaction';
PRINT N'  3. Dùng optimistic locking (ROWVERSION)';
GO