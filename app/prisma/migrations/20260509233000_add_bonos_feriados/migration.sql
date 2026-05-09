-- AlterEnum
ALTER TYPE "BonosArchivoTipo" ADD VALUE IF NOT EXISTS 'FERIADOS';

-- CreateTable
CREATE TABLE IF NOT EXISTS "bonos_feriados" (
    "id" TEXT NOT NULL,
    "uploadId" TEXT NOT NULL,
    "mesAnio" CHAR(7) NOT NULL,
    "fecha" DATE NOT NULL,
    "conmemoracion" VARCHAR(255),
    "rowNumber" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bonos_feriados_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "bonos_feriados_mesAnio_idx" ON "bonos_feriados"("mesAnio");
CREATE INDEX IF NOT EXISTS "bonos_feriados_fecha_idx" ON "bonos_feriados"("fecha");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'bonos_feriados_uploadId_fkey'
  ) THEN
    ALTER TABLE "bonos_feriados"
      ADD CONSTRAINT "bonos_feriados_uploadId_fkey"
      FOREIGN KEY ("uploadId") REFERENCES "bonos_uploads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;
