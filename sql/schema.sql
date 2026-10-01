-- Ejecutar este archivo en la base de datos configurada en Render.
-- No elimina la tabla heredada dbo.QrOpens ni los datos existentes.

IF OBJECT_ID(N'dbo.Roles', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.Roles (
    Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    Nombre NVARCHAR(100) NOT NULL UNIQUE
  );
END;
GO

IF OBJECT_ID(N'dbo.Usuarios', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.Usuarios (
    Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    Nombre NVARCHAR(100) NOT NULL,
    Apellido NVARCHAR(100) NULL,
    Ciudad VARCHAR(50) NOT NULL,
    RolId INT NOT NULL,
    CreadoEn DATETIME2 NOT NULL CONSTRAINT DF_Usuarios_CreadoEn DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Usuarios_Roles FOREIGN KEY (RolId) REFERENCES dbo.Roles(Id)
  );
END;
GO

IF OBJECT_ID(N'dbo.QRs', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.QRs (
    Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    UsuarioId INT NOT NULL,
    Codigo VARCHAR(50) NOT NULL UNIQUE,
    Ciudad VARCHAR(50) NOT NULL,
    CreadoEn DATETIME2 NOT NULL CONSTRAINT DF_QRs_CreadoEn DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_QRs_Usuarios FOREIGN KEY (UsuarioId) REFERENCES dbo.Usuarios(Id)
  );
END;
GO

IF OBJECT_ID(N'dbo.Escaneos', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.Escaneos (
    Id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    QRId INT NOT NULL,
    FechaEscaneo DATETIME2 NOT NULL CONSTRAINT DF_Escaneos_FechaEscaneo DEFAULT SYSUTCDATETIME(),
    UserAgent NVARCHAR(500) NULL,
    IpCliente NVARCHAR(100) NULL,
    CONSTRAINT FK_Escaneos_QRs FOREIGN KEY (QRId) REFERENCES dbo.QRs(Id)
  );
END;
GO

IF OBJECT_ID(N'dbo.Auditoria', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.Auditoria (
    Id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    Tabla NVARCHAR(128) NOT NULL,
    Accion NVARCHAR(30) NOT NULL,
    UsuarioSistema NVARCHAR(128) NULL,
    FechaCambio DATETIME2 NOT NULL CONSTRAINT DF_Auditoria_FechaCambio DEFAULT SYSUTCDATETIME(),
    RegistroId NVARCHAR(100) NULL,
    DatosAntes NVARCHAR(MAX) NULL,
    DatosDespues NVARCHAR(MAX) NULL
  );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_QRs_Codigo' AND object_id = OBJECT_ID(N'dbo.QRs'))
  CREATE INDEX IX_QRs_Codigo ON dbo.QRs(Codigo);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Escaneos_QR_Fecha' AND object_id = OBJECT_ID(N'dbo.Escaneos'))
  CREATE INDEX IX_Escaneos_QR_Fecha ON dbo.Escaneos(QRId, FechaEscaneo DESC);
GO

IF NOT EXISTS (SELECT 1 FROM dbo.Roles WHERE Nombre = N'COLABORADOR')
  INSERT INTO dbo.Roles (Nombre) VALUES (N'COLABORADOR');
GO

DECLARE @RolId INT = (SELECT Id FROM dbo.Roles WHERE Nombre = N'COLABORADOR');

DECLARE @Usuarios TABLE (Nombre NVARCHAR(100), Apellido NVARCHAR(100), Ciudad VARCHAR(50), Codigo VARCHAR(50));
INSERT INTO @Usuarios (Nombre, Apellido, Ciudad, Codigo) VALUES
  (N'DANIEL', N'PALACIOS', 'QUITO', 'QUIT-001'),
  (N'WILLIAM', N'VIRACOCHA', 'QUITO', 'QUIT-002'),
  (N'LUIS', N'CACUANGO', 'QUITO', 'QUIT-003'),
  (N'ALEXANDER', N'RAMIREZ', 'QUITO', 'QUIT-004'),
  (N'SANDRA', N'MOROCHO', 'QUITO', 'QUIT-005'),
  (N'ANDRES', N'PASQUEL', 'QUITO', 'QUIT-006'),
  (N'LUIS', N'GANCHOZO', 'GUAYAQUI', 'GUAY-001'),
  (N'CARLA', N'BOZADA', 'GUAYAQUI', 'GUAY-002'),
  (N'MARIELA', N'SILVA', 'GUAYAQUI', 'GUAY-003'),
  (N'RENE', N'CARREÑO', 'MANTA', 'MANT-001'),
  (N'VICTOR', N'DEMERA', 'MANTA', 'MANT-002'),
  (N'SERGIO', N'MOROCHO', 'CUENCA', 'CUEN-001');

INSERT INTO dbo.Usuarios (Nombre, Apellido, Ciudad, RolId)
SELECT source.Nombre, source.Apellido, source.Ciudad, @RolId
FROM @Usuarios source
WHERE NOT EXISTS (
  SELECT 1 FROM dbo.Usuarios target
  WHERE target.Nombre = source.Nombre AND target.Apellido = source.Apellido AND target.Ciudad = source.Ciudad
);

INSERT INTO dbo.QRs (UsuarioId, Codigo, Ciudad)
SELECT usuario.Id, source.Codigo, source.Ciudad
FROM @Usuarios source
INNER JOIN dbo.Usuarios usuario
  ON usuario.Nombre = source.Nombre
  AND usuario.Apellido = source.Apellido
  AND usuario.Ciudad = source.Ciudad
WHERE NOT EXISTS (SELECT 1 FROM dbo.QRs qr WHERE qr.Codigo = source.Codigo);
GO
