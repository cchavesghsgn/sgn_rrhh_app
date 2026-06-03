BEGIN;

CREATE TABLE IF NOT EXISTS "bonos_parametros_mensuales" (
  "id" TEXT NOT NULL,
  "mesAnio" CHAR(7) NOT NULL,
  "utilidadPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "updatedBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "bonos_parametros_mensuales_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "bonos_parametros_mensuales_mesAnio_key"
  ON "bonos_parametros_mensuales"("mesAnio");

CREATE INDEX IF NOT EXISTS "bonos_parametros_mensuales_mesAnio_idx"
  ON "bonos_parametros_mensuales"("mesAnio");

CREATE INDEX IF NOT EXISTS "bonos_parametros_mensuales_updatedBy_idx"
  ON "bonos_parametros_mensuales"("updatedBy");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'bonos_parametros_mensuales_updatedBy_fkey'
  ) THEN
    ALTER TABLE "bonos_parametros_mensuales"
      ADD CONSTRAINT "bonos_parametros_mensuales_updatedBy_fkey"
      FOREIGN KEY ("updatedBy") REFERENCES "User"("id")
      ON DELETE RESTRICT
      ON UPDATE CASCADE;
  END IF;
END$$;

COMMIT;
