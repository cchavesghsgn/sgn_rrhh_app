DELETE FROM "bonos_uploads"
WHERE "tipoArchivo" = 'FERIADOS';

TRUNCATE TABLE "bonos_feriados";

DROP INDEX IF EXISTS "bonos_feriados_mesAnio_idx";

ALTER TABLE "bonos_feriados"
  DROP COLUMN IF EXISTS "mesAnio",
  ADD COLUMN IF NOT EXISTS "anio" INTEGER;

ALTER TABLE "bonos_feriados"
  ALTER COLUMN "anio" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "bonos_feriados_anio_idx"
  ON "bonos_feriados"("anio");
