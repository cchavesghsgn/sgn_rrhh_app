BEGIN;

CREATE TABLE IF NOT EXISTS "bonos_calculos" (
  "id" TEXT NOT NULL,
  "mesAnio" CHAR(7) NOT NULL,
  "estado" VARCHAR(50) NOT NULL DEFAULT 'CALCULADO',
  "totalEmpleados" INTEGER NOT NULL DEFAULT 0,
  "totalBonos" INTEGER NOT NULL DEFAULT 0,
  "resumenPdfPath" VARCHAR(1000),
  "planillaExcelPath" VARCHAR(1000),
  "detalleJson" JSONB,
  "generadoPor" TEXT NOT NULL,
  "generadoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "bonos_calculos_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "bonos_calculos_mesAnio_key" UNIQUE ("mesAnio")
);

CREATE TABLE IF NOT EXISTS "bonos_calculo_empleados" (
  "id" TEXT NOT NULL,
  "calculoId" TEXT NOT NULL,
  "empleadoId" TEXT NOT NULL,
  "mesAnio" CHAR(7) NOT NULL,
  "sueldoNeto" INTEGER NOT NULL DEFAULT 0,
  "expPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "bonoExperiencia" INTEGER NOT NULL DEFAULT 0,
  "kpiPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "bonoKpi" INTEGER NOT NULL DEFAULT 0,
  "horasExtras" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "valorHora" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "bonoDesarrollo" INTEGER NOT NULL DEFAULT 0,
  "bonoCumplimiento" INTEGER NOT NULL DEFAULT 0,
  "totalBono" INTEGER NOT NULL DEFAULT 0,
  "htmlResumen" TEXT NOT NULL,
  "detalleJson" JSONB,
  "generadoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "bonos_calculo_empleados_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "bonos_calculo_empleados_empleadoId_mesAnio_key" UNIQUE ("empleadoId", "mesAnio")
);

CREATE INDEX IF NOT EXISTS "bonos_calculos_mesAnio_idx" ON "bonos_calculos"("mesAnio");
CREATE INDEX IF NOT EXISTS "bonos_calculos_generadoPor_idx" ON "bonos_calculos"("generadoPor");
CREATE INDEX IF NOT EXISTS "bonos_calculo_empleados_calculoId_idx" ON "bonos_calculo_empleados"("calculoId");
CREATE INDEX IF NOT EXISTS "bonos_calculo_empleados_mesAnio_idx" ON "bonos_calculo_empleados"("mesAnio");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'bonos_calculos_generadoPor_fkey'
  ) THEN
    ALTER TABLE "bonos_calculos"
      ADD CONSTRAINT "bonos_calculos_generadoPor_fkey"
      FOREIGN KEY ("generadoPor") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'bonos_calculo_empleados_calculoId_fkey'
  ) THEN
    ALTER TABLE "bonos_calculo_empleados"
      ADD CONSTRAINT "bonos_calculo_empleados_calculoId_fkey"
      FOREIGN KEY ("calculoId") REFERENCES "bonos_calculos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'bonos_calculo_empleados_empleadoId_fkey'
  ) THEN
    ALTER TABLE "bonos_calculo_empleados"
      ADD CONSTRAINT "bonos_calculo_empleados_empleadoId_fkey"
      FOREIGN KEY ("empleadoId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

COMMIT;
