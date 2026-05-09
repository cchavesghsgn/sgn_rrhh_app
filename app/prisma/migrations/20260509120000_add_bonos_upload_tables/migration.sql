-- CreateEnum
CREATE TYPE "BonosArchivoTipo" AS ENUM ('HORARIOS', 'TICKETS_HORAS');

-- CreateTable
CREATE TABLE "bonos_uploads" (
    "id" TEXT NOT NULL,
    "mesAnio" CHAR(7) NOT NULL,
    "tipoArchivo" "BonosArchivoTipo" NOT NULL,
    "fileName" VARCHAR(500) NOT NULL,
    "fileHash" VARCHAR(64),
    "recordsCount" INTEGER NOT NULL DEFAULT 0,
    "loadedBy" TEXT NOT NULL,
    "loadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bonos_uploads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bonos_horarios" (
    "id" TEXT NOT NULL,
    "uploadId" TEXT NOT NULL,
    "mesAnio" CHAR(7) NOT NULL,
    "nombreRelojRaw" VARCHAR(255) NOT NULL,
    "nombreRelojNorm" VARCHAR(255) NOT NULL,
    "fecha" DATE NOT NULL,
    "turno" "DayShift" NOT NULL,
    "horaEntrada" VARCHAR(5),
    "horaSalida" VARCHAR(5),
    "rowNumber" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bonos_horarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bonos_tickets_horas" (
    "id" TEXT NOT NULL,
    "uploadId" TEXT NOT NULL,
    "mesAnio" CHAR(7) NOT NULL,
    "nroTicket" VARCHAR(100),
    "semana" VARCHAR(50),
    "responsableRaw" VARCHAR(255) NOT NULL,
    "responsableNormApe" VARCHAR(255) NOT NULL,
    "asunto" VARCHAR(500),
    "tipo" VARCHAR(100),
    "horasExtras" DOUBLE PRECISION NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bonos_tickets_horas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bonos_uploads_mesAnio_idx" ON "bonos_uploads"("mesAnio");

-- CreateIndex
CREATE INDEX "bonos_uploads_tipoArchivo_idx" ON "bonos_uploads"("tipoArchivo");

-- CreateIndex
CREATE UNIQUE INDEX "bonos_uploads_mesAnio_tipoArchivo_key" ON "bonos_uploads"("mesAnio", "tipoArchivo");

-- CreateIndex
CREATE INDEX "bonos_horarios_mesAnio_idx" ON "bonos_horarios"("mesAnio");

-- CreateIndex
CREATE INDEX "bonos_horarios_nombreRelojNorm_idx" ON "bonos_horarios"("nombreRelojNorm");

-- CreateIndex
CREATE INDEX "bonos_horarios_fecha_idx" ON "bonos_horarios"("fecha");

-- CreateIndex
CREATE INDEX "bonos_tickets_horas_mesAnio_idx" ON "bonos_tickets_horas"("mesAnio");

-- CreateIndex
CREATE INDEX "bonos_tickets_horas_responsableNormApe_idx" ON "bonos_tickets_horas"("responsableNormApe");

-- CreateIndex
CREATE INDEX "bonos_tickets_horas_semana_idx" ON "bonos_tickets_horas"("semana");

-- AddForeignKey
ALTER TABLE "bonos_uploads" ADD CONSTRAINT "bonos_uploads_loadedBy_fkey" FOREIGN KEY ("loadedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bonos_horarios" ADD CONSTRAINT "bonos_horarios_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "bonos_uploads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bonos_tickets_horas" ADD CONSTRAINT "bonos_tickets_horas_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "bonos_uploads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
