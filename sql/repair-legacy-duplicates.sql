-- Ejecutar una sola vez en Qr_Empresa antes de ejecutar schema.sql.
-- Conserva al usuario que ya tiene QR y elimina solo duplicados sin QR.

USE Qr_Empresa;
GO

SET XACT_ABORT ON;
GO

BEGIN TRY
  BEGIN TRANSACTION;

  DECLARE @UsuariosEsperados TABLE (
    Nombre NVARCHAR(100),
    Apellido NVARCHAR(100),
    Ciudad VARCHAR(50),
    CodigoNuevo VARCHAR(50)
  );

  INSERT INTO @UsuariosEsperados (Nombre, Apellido, Ciudad, CodigoNuevo) VALUES
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

  -- Si ya existen credenciales, evita que queden ligadas a una fila duplicada sin QR.
  IF OBJECT_ID(N'dbo.CredencialesUsuarios', N'U') IS NOT NULL
  BEGIN
    DELETE credencial
    FROM dbo.CredencialesUsuarios credencial
    INNER JOIN dbo.Usuarios duplicado ON duplicado.Id = credencial.UsuarioId
    INNER JOIN @UsuariosEsperados esperado
      ON esperado.Nombre = duplicado.Nombre
      AND esperado.Apellido = duplicado.Apellido
      AND esperado.Ciudad = duplicado.Ciudad
    LEFT JOIN dbo.QRs qrDuplicado ON qrDuplicado.UsuarioId = duplicado.Id
    WHERE qrDuplicado.Id IS NULL
      AND EXISTS (
        SELECT 1
        FROM dbo.Usuarios titular
        INNER JOIN dbo.QRs qrTitular ON qrTitular.UsuarioId = titular.Id
        WHERE titular.Nombre = duplicado.Nombre
          AND titular.Apellido = duplicado.Apellido
          AND titular.Ciudad = duplicado.Ciudad
      );
  END;

  DELETE duplicado
  FROM dbo.Usuarios duplicado
  INNER JOIN @UsuariosEsperados esperado
    ON esperado.Nombre = duplicado.Nombre
    AND esperado.Apellido = duplicado.Apellido
    AND esperado.Ciudad = duplicado.Ciudad
  LEFT JOIN dbo.QRs qrDuplicado ON qrDuplicado.UsuarioId = duplicado.Id
  WHERE qrDuplicado.Id IS NULL
    AND EXISTS (
      SELECT 1
      FROM dbo.Usuarios titular
      INNER JOIN dbo.QRs qrTitular ON qrTitular.UsuarioId = titular.Id
      WHERE titular.Nombre = duplicado.Nombre
        AND titular.Apellido = duplicado.Apellido
        AND titular.Ciudad = duplicado.Ciudad
    );

  -- Conserva los QR existentes y les asigna los códigos usados por el sitio web.
  UPDATE qr
  SET Codigo = esperado.CodigoNuevo
  FROM dbo.QRs qr
  INNER JOIN dbo.Usuarios usuario ON usuario.Id = qr.UsuarioId
  INNER JOIN @UsuariosEsperados esperado
    ON esperado.Nombre = usuario.Nombre
    AND esperado.Apellido = usuario.Apellido
    AND esperado.Ciudad = usuario.Ciudad
  WHERE qr.Codigo <> esperado.CodigoNuevo;

  COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;
GO

-- Verificación: deben quedar 12 usuarios con QR y sin códigos GR heredados.
SELECT
  u.Nombre,
  u.Apellido,
  u.Ciudad,
  q.Codigo
FROM dbo.Usuarios u
INNER JOIN dbo.QRs q ON q.UsuarioId = u.Id
ORDER BY u.Nombre, u.Apellido;
GO