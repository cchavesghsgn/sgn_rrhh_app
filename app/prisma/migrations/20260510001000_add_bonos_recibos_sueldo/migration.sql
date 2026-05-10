-- Alter enum
ALTER TYPE "BonosArchivoTipo" ADD VALUE IF NOT EXISTS 'RECIBOS_PDF';

-- Create table
CREATE TABLE IF NOT EXISTS "bonos_recibos_sueldo" (
  "id" TEXT NOT NULL,
  "uploadId" TEXT NOT NULL,
  "empleadoId" TEXT NOT NULL,
  "mesAnio" CHAR(7) NOT NULL,
  "filePath" VARCHAR(1000) NOT NULL,
  "fileName" VARCHAR(500) NOT NULL,
  "originalName" VARCHAR(500) NOT NULL,
  "pageCount" INTEGER NOT NULL DEFAULT 1,
  "checksum" VARCHAR(64),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "bonos_recibos_sueldo_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS "bonos_recibos_sueldo_empleadoId_mesAnio_key" ON "bonos_recibos_sueldo"("empleadoId", "mesAnio");
CREATE INDEX IF NOT EXISTS "bonos_recibos_sueldo_mesAnio_idx" ON "bonos_recibos_sueldo"("mesAnio");

-- FKs
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bonos_recibos_sueldo_uploadId_fkey') THEN
    ALTER TABLE "bonos_recibos_sueldo"
      ADD CONSTRAINT "bonos_recibos_sueldo_uploadId_fkey"
      FOREIGN KEY ("uploadId") REFERENCES "bonos_uploads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bonos_recibos_sueldo_empleadoId_fkey') THEN
    ALTER TABLE "bonos_recibos_sueldo"
      ADD CONSTRAINT "bonos_recibos_sueldo_empleadoId_fkey"
      FOREIGN KEY ("empleadoId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
