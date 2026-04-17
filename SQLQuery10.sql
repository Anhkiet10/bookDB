-- ============================================================
--  Bao gồm: Tables, Views, Stored Procedures, Functions, Triggers
-- ============================================================

CREATE DATABASE BookDB;
GO
USE BookDB

-- ============================================================
--  1. TABLES
-- ============================================================

CREATE TABLE Authors (
    id        INT PRIMARY KEY IDENTITY,
    full_name NVARCHAR(200) NOT NULL,
    bio       NVARCHAR(MAX),
    birthdate DATE
);
GO

CREATE TABLE Categories (
    id          INT PRIMARY KEY IDENTITY,
    name        NVARCHAR(100) NOT NULL UNIQUE,
    description NVARCHAR(500)
);
GO

CREATE TABLE Books (
    id             INT PRIMARY KEY IDENTITY,
    title          NVARCHAR(200) NOT NULL,
    author_id      INT NOT NULL,
    category_id    INT NOT NULL,
    published_year INT,
    description    NVARCHAR(MAX),
    cover_image    NVARCHAR(500),
    quantity       INT CHECK (quantity >= 0),       
    row_ver        ROWVERSION NOT NULL,
    created_at     DATETIME DEFAULT GETDATE(),
    CONSTRAINT FK_Books_Authors    FOREIGN KEY (author_id)   REFERENCES Authors(id),
    CONSTRAINT FK_Books_Categories FOREIGN KEY (category_id) REFERENCES Categories(id)
);
GO

CREATE TABLE Users (
    id            INT PRIMARY KEY IDENTITY,
    username      NVARCHAR(100) NOT NULL UNIQUE,
    email         NVARCHAR(200) NOT NULL UNIQUE,
    password_hash NVARCHAR(255) NOT NULL,
    role          NVARCHAR(20)  DEFAULT 'user',
    created_at    DATETIME      DEFAULT GETDATE()
);
GO


-- ============================================================
--  6. DỮ LIỆU MẪU
-- ============================================================

INSERT INTO Authors (full_name, bio, birthdate) VALUES
(N'Nguyễn Nhật Ánh', N'Nhà văn nổi tiếng Việt Nam', '1955-05-07'),
(N'Tô Hoài',         N'Tác giả Dế Mèn Phiêu Lưu Ký', '1920-09-27'),
(N'Nam Cao',         N'Nhà văn hiện thực phê phán',   '1917-10-29');

INSERT INTO Categories (name, description) VALUES
(N'Văn học',          N'Sách văn học trong và ngoài nước'),
(N'Thiếu nhi',        N'Sách dành cho trẻ em'),
(N'Tâm lý - Kỹ năng', N'Sách phát triển bản thân');

use BookDB;

INSERT INTO Books (title, author_id, category_id, published_year, description,quantity) VALUES
(N'Mắt Biếc',                      1, 1, 1990, N'Câu chuyện tình yêu đẹp và buồn',1),
(N'Tôi Thấy Hoa Vàng Trên Cỏ Xanh',1, 1, 1991, N'Tuổi thơ miền quê',2),
(N'Dế Mèn Phiêu Lưu Ký',           2, 2, 1941, N'Cuộc phiêu lưu của chú dế mèn',0),
(N'Chí Phèo',                       3, 1, 1941, N'Bi kịch người nông dân',1);
GO

CREATE VIEW vw_books AS
SELECT b.id, b.title, b.author_id, b.category_id,
               a.full_name AS author, c.name AS category,
               b.published_year, b.description,b.quantity,
               b.row_ver
        FROM Books b
        JOIN Authors    a ON b.author_id   = a.id
        JOIN Categories c ON b.category_id = c.id

use BookDB

CREATE alter  VIEW vw_authors AS
SELECT 
    id, 
    full_name, 
    bio, 
    CAST(birthdate AS VARCHAR) as birthdate_string,-- chuyển đổi từ văn bản qua , vì cVì View là một bảng ảo, nó không chấp nhận những cột vô danh này.
    row_ver
FROM Authors;

create  view vw_categories as
SELECT id, name, description ,row_ver
FROM Categories;
-- ===============================================
-- ------------------------------------------------------------
--  INSERTBOOOKS
--  Isolation: SERIALIZABLE
--  Lý do: Ngăn phantom read — tránh trường hợp hai session
--         cùng INSERT sách trùng author/category chưa tồn tại.
-- ------------------------------------------------------------
create PROC INSERTBOOOKS
  @title        NVARCHAR(200),
  @author_id    INT,
  @category_id  INT,
  @published_year INT,
  @description  NVARCHAR(MAX),
  @quantity     INT
AS
BEGIN
  SET NOCOUNT ON;
  SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;
    -- SERIALIZABLE: mức cao nhất — khóa range, ngăn phantom read.
    -- Phù hợp khi INSERT cần đảm bảo author_id / category_id
    -- không bị xóa hoặc thay đổi bởi transaction song song.
  BEGIN TRY
    BEGIN TRANSACTION;           -- Bắt đầu giao dịch

      INSERT INTO Books
        (title, author_id, category_id,
         published_year, description, quantity)
      VALUES
        (@title, @author_id, @category_id,
         @published_year, @description, @quantity);

    COMMIT TRANSACTION;          -- Cam kết nếu không lỗi

  END TRY
  BEGIN CATCH
    IF @@TRANCOUNT > 0
      ROLLBACK TRANSACTION;      -- Hoàn tác toàn bộ nếu lỗi

    THROW;                       -- Trả lỗi về cho ứng dụng
  END CATCH;
END;


-- ------------------------------------------------------------
--  insertauthors
--  Isolation: SERIALIZABLE
--  Lý do: Ngăn hai session cùng INSERT tác giả trùng full_name
--         (dù không có UNIQUE constraint, vẫn nên bảo vệ).
-- ------------------------------------------------------------
CREATE PROC insertauthors
@full_name  NVARCHAR(200),
    @bio        NVARCHAR(MAX),
    @birthdate  DATE
AS
BEGIN
    SET NOCOUNT ON;
    SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;
    BEGIN TRY
        BEGIN TRANSACTION;
 
            INSERT INTO Authors (full_name, bio, birthdate)
            VALUES (@full_name, @bio, @birthdate);
 
        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
-- ------------------------------------------------------------
--  insercategories
--  Isolation: SERIALIZABLE
--  Lý do: Categories có UNIQUE constraint trên cột name.
--         SERIALIZABLE ngăn phantom read — tránh hai session
--         cùng INSERT category trùng tên vượt qua kiểm tra.
-- ------------------------------------------------------------
CREATE PROC insercategories
@name        NVARCHAR(100),
@description NVARCHAR(500)
AS
BEGIN
    SET NOCOUNT ON;
    SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;
    BEGIN TRY
        BEGIN TRANSACTION;
 
            INSERT INTO Categories (name, description)
            VALUES (@name, @description);
 
        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;


create PROC upbooks
     @id int,
    @title NVARCHAR(200),
    @author_id int,
    @category_id int,
    @published_year int,
    @description NVARCHAR(MAX),
    @quantity int,
    @row_ver BINARY(8)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    SET TRANSACTION ISOLATION LEVEL READ COMMITTED;

    BEGIN TRY
        BEGIN TRANSACTION;
        UPDATE Books
        SET title = @title,
            author_id = @author_id,
            category_id = @category_id,
            published_year = @published_year,
            description = @description,
            quantity = @quantity
        WHERE id = @id
          AND row_ver = @row_ver;
        IF @@ROWCOUNT = 0
        BEGIN
            ROLLBACK TRANSACTION;
            THROW 50001,
                  N'Conflict: Dữ liệu đã được sửa bởi người dùng khác. Vui lòng tải lại và thử lại.',
                  1;
        END
        SELECT row_ver AS new_row_ver
        FROM Books
        WHERE id = @id;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END


CREATE PROC upcategories
 @id          INT,
    @name        NVARCHAR(100),
    @description NVARCHAR(500),
    @row_ver   BINARY(8)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    SET TRANSACTION ISOLATION LEVEL READ COMMITTED;
    BEGIN TRY
        BEGIN TRANSACTION;

            UPDATE Categories
            SET name        = @name,
                description = @description
            WHERE id = @id AND row_ver  = @row_ver;

             IF @@ROWCOUNT = 0
        BEGIN
            ROLLBACK TRANSACTION;
            THROW 50001,
                  N'Conflict: Dữ liệu đã được sửa bởi người dùng khác. Vui lòng tải lại và thử lại.',
                  1;
        END

        SELECT row_ver AS new_row_ver
        FROM Categories
        WHERE id = @id;
 
 
        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;


create proc upauthors
 @id         INT,
    @full_name  NVARCHAR(200),
    @bio        NVARCHAR(MAX),
    @birthdate  DATE,
    @row_ver   BINARY(8)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    SET TRANSACTION ISOLATION LEVEL READ COMMITTED;
    BEGIN TRY
        BEGIN TRANSACTION;
            UPDATE Authors
            SET full_name = @full_name,
                bio       = @bio,
                birthdate = @birthdate
            WHERE id = @id AND row_ver  = @row_ver;

             IF @@ROWCOUNT = 0
        BEGIN
            ROLLBACK TRANSACTION;
            THROW 50001,
                  N'Conflict: Dữ liệu đã được sửa bởi người dùng khác. Vui lòng tải lại và thử lại.',
                  1;
        END

        SELECT row_ver AS new_row_ver
        FROM Authors
        WHERE id = @id;
 
        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;

 -- ------------------------------------------------------------
--  deletebooks
--  Isolation: READ COMMITTED
--  Lý do: DELETE theo PK — không cần đọc lại dữ liệu nhiều lần,
--         chỉ cần chắc bản ghi tồn tại tại thời điểm xóa.
--         READ COMMITTED là đủ và giảm tranh chấp lock.
-- ------------------------------------------------------------

 CREATE alter PROC deletebooks
    @id INT
AS
BEGIN
    SET NOCOUNT ON;
    SET TRANSACTION ISOLATION LEVEL READ COMMITTED;
    -- READ COMMITTED: Đủ cho DELETE theo PK.
    -- Tránh dirty read, không giữ lock lâu, giảm deadlock.

    BEGIN TRY
        BEGIN TRANSACTION;
            DELETE FROM Books WHERE id = @id;
 
        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

-- ------------------------------------------------------------
--  deleteauthors
--  Isolation: READ COMMITTED
--  Lý do: DELETE theo PK đơn giản, READ COMMITTED là đủ.
-- ------------------------------------------------------------
create alter proc deleteauthors
@id int
as
begin
SET NOCOUNT ON;
SET TRANSACTION ISOLATION LEVEL READ COMMITTED;
 
    BEGIN TRY
        BEGIN TRANSACTION;
            DELETE FROM Authors WHERE id = @id;
 
        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO
-- ------------------------------------------------------------
--  deletecategories
--  Isolation: READ COMMITTED
--  Lý do: DELETE theo PK, không cần mức cao hơn.
-- ------------------------------------------------------------
create alter proc deletecategories
@id int
as
begin
SET NOCOUNT ON; -- Khi bạn chạy lệnh SQL, SQL Server thường trả về thông báo kiểu "(1 row(s) affected)".
-- và lệnh này là để tắt thông báo đó đi
SET TRANSACTION ISOLATION LEVEL READ COMMITTED;
    BEGIN TRY
        BEGIN TRANSACTION;
            DELETE FROM Categories WHERE id = @id;
 
        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;-- @@TRANCOUNT: Là một biến hệ thống đếm xem có bao nhiêu Transaction đang mở.
        -- kiểm tra nếu thấy có transaction nào đang mở thì sẽ đóng nó và rollback.
        THROW;
    END CATCH;
END;
GO

use BookDB
-- trigger quanrn lý nhật ký 
-- Trigger cho bảng Books
-- Tạo bảng EditLogs để lưu nhật ký chỉnh sửa
CREATE TABLE EditLogs (
    id INT IDENTITY(1,1) PRIMARY KEY,
    table_name NVARCHAR(50) NOT NULL, 
    record_id INT NOT NULL,  
    action NVARCHAR(10) NOT NULL, 
    edit_time DATETIME DEFAULT GETDATE() 
);
GO

-- ==================== TRIGGERS CHO BẢNG BOOKS ====================
-- Trigger INSERT cho Books
CREATE TRIGGER trg_Books_Insert
ON Books
AFTER INSERT
AS
BEGIN
    INSERT INTO EditLogs (table_name, record_id, action)
    SELECT 'Books', i.id, 'INSERT'
    FROM inserted i;
END;
GO

-- Trigger UPDATE cho Books
CREATE TRIGGER trg_Books_Update
ON Books
AFTER UPDATE
AS
BEGIN
    INSERT INTO EditLogs (table_name, record_id, action)
    SELECT 'Books', i.id, 'UPDATE'
    FROM inserted i;
END;
GO

-- Trigger DELETE cho Books
CREATE TRIGGER trg_Books_Delete
ON Books
AFTER DELETE
AS
BEGIN
    INSERT INTO EditLogs (table_name, record_id, action)
    SELECT 'Books', d.id, 'DELETE'
    FROM deleted d;
END;
GO

-- ==================== TRIGGERS CHO BẢNG AUTHORS ====================
-- Trigger INSERT cho Authors
CREATE TRIGGER trg_Authors_Insert
ON Authors
AFTER INSERT
AS
BEGIN
    INSERT INTO EditLogs (table_name, record_id, action)
    SELECT 'Authors', i.id, 'INSERT'
    FROM inserted i;
END;
GO

-- Trigger UPDATE cho Authors
CREATE TRIGGER trg_Authors_Update
ON Authors
AFTER UPDATE
AS
BEGIN
    INSERT INTO EditLogs (table_name, record_id, action)
    SELECT 'Authors', i.id, 'UPDATE'
    FROM inserted i;
END;
GO

-- Trigger DELETE cho Authors
CREATE TRIGGER trg_Authors_Delete
ON Authors
AFTER DELETE
AS
BEGIN
    INSERT INTO EditLogs (table_name, record_id, action)
    SELECT 'Authors', d.id, 'DELETE'
    FROM deleted d;
END;
GO

-- ==================== TRIGGERS CHO BẢNG CATEGORIES ====================
-- Trigger INSERT cho Categories
CREATE TRIGGER trg_Categories_Insert
ON Categories
AFTER INSERT
AS
BEGIN
    INSERT INTO EditLogs (table_name, record_id, action)
    SELECT 'Categories', i.id, 'INSERT'
    FROM inserted i;
END;
GO

-- Trigger UPDATE cho Categories
CREATE TRIGGER trg_Categories_Update
ON Categories
AFTER UPDATE
AS
BEGIN
    INSERT INTO EditLogs (table_name, record_id, action)
    SELECT 'Categories', i.id, 'UPDATE'
    FROM inserted i;
END;
GO

-- Trigger DELETE cho Categories
CREATE TRIGGER trg_Categories_Delete
ON Categories
AFTER DELETE
AS
BEGIN
    INSERT INTO EditLogs (table_name, record_id, action)
    SELECT 'Categories', d.id, 'DELETE'
    FROM deleted d;
END;
GO

-- Trigger để tự động xóa logs cũ hơn 90 ngày sau mỗi lần INSERT
CREATE TRIGGER trg_AutoDeleteOldEditLogs
ON EditLogs
AFTER INSERT
AS
BEGIN
    DELETE FROM EditLogs
    WHERE edit_time < DATEADD(DAY, -90, GETDATE());
END;

--===========
use BookDB



--  Stored Procedure      | Isolation Level   | Lý do chính
--  ----------------------|-------------------|------------------------------
--  INSERTBOOOKS          | SERIALIZABLE      | Tránh phantom read khi INSERT
--  upbooks               | chưa cập nhật     | Tránh lost update khi UPDATE
--  deletebooks           | READ COMMITTED    | DELETE theo PK, đủ an toàn
--  insertauthors         | SERIALIZABLE      | Tránh phantom read khi INSERT
--  upauthors             | chưa cập nhật     | Tránh lost update khi UPDATE
--  deleteauthors         | READ COMMITTED    | DELETE theo PK, đủ an toàn
--  insercategories       | SERIALIZABLE      | UNIQUE name → cần range lock
--  upcategories          | chưa cập nhật     | Tránh lost update khi UPDATE
--  deletecategories      | READ COMMITTED    | DELETE theo PK, đủ an toàn
--
--  Nếu hệ thống có tải cao và gặp deadlock thường xuyên:
--  → Bật SNAPSHOT ISOLATION trên database:
--      ALTER DATABASE BookDB SET ALLOW_SNAPSHOT_ISOLATION ON;
--      ALTER DATABASE BookDB SET READ_COMMITTED_SNAPSHOT ON;
--  → Thay READ COMMITTED bằng SNAPSHOT trong các proc DELETE.
--  → SNAPSHOT đọc phiên bản dữ liệu cũ thay vì giữ shared lock,
--    giúp giảm deadlock đáng kể trong môi trường nhiều concurrent user.
--
-- ============================================================
USE master;
GO
 
ALTER DATABASE BookDB SET ALLOW_SNAPSHOT_ISOLATION ON;
-- → Cho phép các proc dùng: SET TRANSACTION ISOLATION LEVEL SNAPSHOT
--   mà không bị lỗi "Snapshot isolation transaction failed"
 
ALTER DATABASE BookDB SET READ_COMMITTED_SNAPSHOT ON;
-- → Toàn bộ READ COMMITTED trong BookDB tự động dùng row versioning,
--   không cần đổi SET TRANSACTION ISOLATION LEVEL trong từng proc.
--   Đây là cách ít rủi ro nhất khi migrate hệ thống hiện có.
 
GO
USE BookDB;
GO
 

 -- ====
 -- xử lý non-repeatable read (ko chạy dòng này)
 -- ===
 IF COL_LENGTH('Books', 'row_ver') IS NULL
 BEGIN
    ALTER TABLE Books
       ADD row_ver ROWVERSION NOT NULL;
 END
