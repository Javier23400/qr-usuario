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

IF OBJECT_ID(N'dbo.CredencialesUsuarios', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.CredencialesUsuarios (
    UsuarioId INT NOT NULL PRIMARY KEY,
    NombreUsuario NVARCHAR(100) NOT NULL UNIQUE,
    PasswordHash NVARCHAR(255) NOT NULL,
    Activo BIT NOT NULL CONSTRAINT DF_CredencialesUsuarios_Activo DEFAULT 1,
    DebeCambiarClave BIT NOT NULL CONSTRAINT DF_CredencialesUsuarios_DebeCambiarClave DEFAULT 1,
    UltimoAcceso DATETIME2 NULL,
    CONSTRAINT FK_CredencialesUsuarios_Usuarios FOREIGN KEY (UsuarioId) REFERENCES dbo.Usuarios(Id)
  );
END;
GO

IF COL_LENGTH(N'dbo.CredencialesUsuarios', N'DebeCambiarClave') IS NULL
  ALTER TABLE dbo.CredencialesUsuarios ADD DebeCambiarClave BIT NOT NULL CONSTRAINT DF_CredencialesUsuarios_DebeCambiarClave DEFAULT 1;
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

DECLARE @Credenciales TABLE (
  Nombre NVARCHAR(100),
  Apellido NVARCHAR(100),
  Ciudad VARCHAR(50),
  NombreUsuario NVARCHAR(100),
  PasswordHash NVARCHAR(255)
);

INSERT INTO @Credenciales (Nombre, Apellido, Ciudad, NombreUsuario, PasswordHash) VALUES
  (N'DANIEL', N'PALACIOS', 'QUITO', N'daniel.palacios', N'$2a$12$M8BL/IFC1t/KiK3YdT7/TOCKYUxfrltK1.1JwuX3GFWFR01BxGXXu'),
  (N'WILLIAM', N'VIRACOCHA', 'QUITO', N'william.viracocha', N'$2a$12$PasLCE5ATsoGWT11dkQczuaTdRRkYdA0pJAx4GT430TTR0AexCWc.'),
  (N'LUIS', N'CACUANGO', 'QUITO', N'luis.cacuango', N'$2a$12$SsdREUhKhbpfNHbpCBN4xOsUHE5JjXM/Cli1s6fNGxUli4iGAgqL2'),
  (N'ALEXANDER', N'RAMIREZ', 'QUITO', N'alexander.ramirez', N'$2a$12$g/W7Mt1RLHqnUNbW3k.YHOzbujZ62oqSB/SCMlUoGMSyrYeX4Yiry'),
  (N'SANDRA', N'MOROCHO', 'QUITO', N'sandra.morocho', N'$2a$12$Le07B5LAfcANdweDBC1L6Ofq5jO3FMo7Cz8tvKRTsZh318.BJh6EW'),
  (N'ANDRES', N'PASQUEL', 'QUITO', N'andres.pasquel', N'$2a$12$TI4QBUtyf18sjLKRQ6sT9uf1KlvXQ7e8DqrfpSG4boS.gdiWbvNVq'),
  (N'LUIS', N'GANCHOZO', 'GUAYAQUI', N'luis.ganchozo', N'$2a$12$MdqtbEgpqDoCVH6w5CsEY.RHS5Joi1zGijhgDcLl0mJMNjke0BiTK'),
  (N'CARLA', N'BOZADA', 'GUAYAQUI', N'carla.bozada', N'$2a$12$sjU0yQN6W4GHn4YlE7uIbedvjm8wIg9lCUuUNJxxXSYSeOmRrT7uq'),
  (N'MARIELA', N'SILVA', 'GUAYAQUI', N'mariela.silva', N'$2a$12$qTfCLWfGBT1y/MEE2PJPu.5.Cb5LG/iLpV.LL4O3PH6r3ncmMGuCu'),
  (N'RENE', N'CARREÑO', 'MANTA', N'rene.carreno', N'$2a$12$yO69DhbxxUl9CEqfw3Vpyet/MHpcnQy.LYXYSmrwazD7tlVZN6Jjy'),
  (N'VICTOR', N'DEMERA', 'MANTA', N'victor.demera', N'$2a$12$v1d6SQtDEJ7SOyjVDz094eYiBfmsISuqprbbsB5wEcioXgLCvfxiK'),
  (N'SERGIO', N'MOROCHO', 'CUENCA', N'sergio.morocho', N'$2a$12$Fha8zaMpD3qCmZBg2Lx/G.8nnlMLK.4Hgx26wv6AzImc4TdugLt8W');

-- Cada clave inicial es temporal, exclusiva y debe cambiarse al ingresar por primera vez.
-- Solo se almacena su hash BCrypt, nunca la clave en texto plano.
INSERT INTO dbo.CredencialesUsuarios (UsuarioId, NombreUsuario, PasswordHash, DebeCambiarClave)
SELECT usuario.Id, fuente.NombreUsuario, fuente.PasswordHash, 1
FROM @Credenciales fuente
INNER JOIN dbo.Usuarios usuario
  ON usuario.Nombre = fuente.Nombre
  AND usuario.Apellido = fuente.Apellido
  AND usuario.Ciudad = fuente.Ciudad
WHERE NOT EXISTS (
  SELECT 1 FROM dbo.CredencialesUsuarios credencial WHERE credencial.UsuarioId = usuario.Id
);
GO
