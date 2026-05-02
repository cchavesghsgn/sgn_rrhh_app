-- Recalculate remaining balances directly in PostgreSQL.
--
-- Parameters:
--   p_from_date: approved requests with startDate >= p_from_date are considered
--   p_apply: false = preview only, true = apply updates
--
-- Usage examples:
--   -- Preview (no writes)
--   SELECT * FROM recalculate_employee_balances('2026-01-01', false);
--
--   -- Apply updates
--   SELECT * FROM recalculate_employee_balances('2026-01-01', true);

CREATE OR REPLACE FUNCTION public.recalculate_employee_balances(
  p_from_date date,
  p_apply boolean DEFAULT false
)
RETURNS TABLE (
  employee_id text,
  "used_totalVacationDays" integer,
  "totalVacationDays" integer,
  "vacationDays" integer,
  "recalculated_vacationDays" integer,
  "used_totalPersonalHours" integer,
  "totalPersonalHours" integer,
  "personalHours" integer,
  "recalculated_personalHours" integer,
  "used_totalRemoteHours" integer,
  "totalRemoteHours" integer,
  "remoteHours" integer,
  "recalculated_remoteHours" integer,
  "used_totalAvailableHours" integer,
  "totalAvailableHours" integer,
  "availableHours" integer,
  "recalculated_availableHours" integer,
  will_change boolean
)
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_apply THEN
    RETURN QUERY
    WITH request_usage AS (
      SELECT
        lr."employeeId" AS employee_id,
        SUM(
          CASE
            WHEN UPPER(TRIM(lr.type::text)) = 'VACATION'
            THEN ((lr."endDate"::date - lr."startDate"::date) + 1)
            ELSE 0
          END
        )::integer AS vacation_days_used,
        SUM(
          CASE
            WHEN UPPER(TRIM(lr.type::text)) = 'PERSONAL' THEN
              CASE UPPER(TRIM(COALESCE(lr.shift::text, 'FULL_DAY')))
                WHEN 'MORNING' THEN 5
                WHEN 'AFTERNOON' THEN 3
                WHEN 'FULL_DAY' THEN 8
                ELSE 8
              END
            ELSE 0
          END
        )::integer AS personal_hours_used,
        SUM(
          CASE
            WHEN UPPER(TRIM(lr.type::text)) = 'REMOTE' THEN
              CASE UPPER(TRIM(COALESCE(lr.shift::text, 'FULL_DAY')))
                WHEN 'MORNING' THEN 5
                WHEN 'AFTERNOON' THEN 3
                WHEN 'FULL_DAY' THEN 8
                ELSE 8
              END
            ELSE 0
          END
        )::integer AS remote_hours_used,
        SUM(
          CASE
            WHEN UPPER(TRIM(lr.type::text)) = 'HOURS' THEN COALESCE(lr.hours, 0)
            ELSE 0
          END
        )::integer AS available_hours_used
      FROM public.leave_requests lr
      WHERE UPPER(TRIM(lr.status::text)) = 'APPROVED'
        AND lr."startDate"::date >= p_from_date
      GROUP BY lr."employeeId"
    ),
    expected_balances AS (
      SELECT
        e.id AS employee_id,
        COALESCE(ru.vacation_days_used, 0)::integer AS "used_totalVacationDays",
        e."totalVacationDays" AS "totalVacationDays",
        e."vacationDays" AS "vacationDays",
        GREATEST(0, e."totalVacationDays" - COALESCE(ru.vacation_days_used, 0))::integer AS "recalculated_vacationDays",
        COALESCE(ru.personal_hours_used, 0)::integer AS "used_totalPersonalHours",
        e."totalPersonalHours" AS "totalPersonalHours",
        e."personalHours" AS "personalHours",
        GREATEST(0, e."totalPersonalHours" - COALESCE(ru.personal_hours_used, 0))::integer AS "recalculated_personalHours",
        COALESCE(ru.remote_hours_used, 0)::integer AS "used_totalRemoteHours",
        e."totalRemoteHours" AS "totalRemoteHours",
        e."remoteHours" AS "remoteHours",
        GREATEST(0, e."totalRemoteHours" - COALESCE(ru.remote_hours_used, 0))::integer AS "recalculated_remoteHours",
        COALESCE(ru.available_hours_used, 0)::integer AS "used_totalAvailableHours",
        e."totalAvailableHours" AS "totalAvailableHours",
        e."availableHours" AS "availableHours",
        GREATEST(0, e."totalAvailableHours" - COALESCE(ru.available_hours_used, 0))::integer AS "recalculated_availableHours"
      FROM public.employees e
      LEFT JOIN request_usage ru ON ru.employee_id = e.id
    ),
    changed AS (
      SELECT
        eb.*,
        (
          eb."vacationDays" <> eb."recalculated_vacationDays" OR
          eb."personalHours" <> eb."recalculated_personalHours" OR
          eb."remoteHours" <> eb."recalculated_remoteHours" OR
          eb."availableHours" <> eb."recalculated_availableHours"
        ) AS will_change
      FROM expected_balances eb
    ),
    updated AS (
      UPDATE public.employees e
      SET
        "vacationDays" = c."recalculated_vacationDays",
        "personalHours" = c."recalculated_personalHours",
        "remoteHours" = c."recalculated_remoteHours",
        "availableHours" = c."recalculated_availableHours",
        "updatedAt" = NOW()
      FROM changed c
      WHERE e.id = c.employee_id
        AND c.will_change = true
      RETURNING e.id
    )
    SELECT
      c.employee_id,
      c."used_totalVacationDays",
      c."totalVacationDays",
      c."vacationDays",
      c."recalculated_vacationDays",
      c."used_totalPersonalHours",
      c."totalPersonalHours",
      c."personalHours",
      c."recalculated_personalHours",
      c."used_totalRemoteHours",
      c."totalRemoteHours",
      c."remoteHours",
      c."recalculated_remoteHours",
      c."used_totalAvailableHours",
      c."totalAvailableHours",
      c."availableHours",
      c."recalculated_availableHours",
      c.will_change
    FROM changed c
    ORDER BY c.employee_id;
  ELSE
    RETURN QUERY
    WITH request_usage AS (
      SELECT
        lr."employeeId" AS employee_id,
        SUM(
          CASE
            WHEN UPPER(TRIM(lr.type::text)) = 'VACATION'
            THEN ((lr."endDate"::date - lr."startDate"::date) + 1)
            ELSE 0
          END
        )::integer AS vacation_days_used,
        SUM(
          CASE
            WHEN UPPER(TRIM(lr.type::text)) = 'PERSONAL' THEN
              CASE UPPER(TRIM(COALESCE(lr.shift::text, 'FULL_DAY')))
                WHEN 'MORNING' THEN 5
                WHEN 'AFTERNOON' THEN 3
                WHEN 'FULL_DAY' THEN 8
                ELSE 8
              END
            ELSE 0
          END
        )::integer AS personal_hours_used,
        SUM(
          CASE
            WHEN UPPER(TRIM(lr.type::text)) = 'REMOTE' THEN
              CASE UPPER(TRIM(COALESCE(lr.shift::text, 'FULL_DAY')))
                WHEN 'MORNING' THEN 5
                WHEN 'AFTERNOON' THEN 3
                WHEN 'FULL_DAY' THEN 8
                ELSE 8
              END
            ELSE 0
          END
        )::integer AS remote_hours_used,
        SUM(
          CASE
            WHEN UPPER(TRIM(lr.type::text)) = 'HOURS' THEN COALESCE(lr.hours, 0)
            ELSE 0
          END
        )::integer AS available_hours_used
      FROM public.leave_requests lr
      WHERE UPPER(TRIM(lr.status::text)) = 'APPROVED'
        AND lr."startDate"::date >= p_from_date
      GROUP BY lr."employeeId"
    ),
    expected_balances AS (
      SELECT
        e.id AS employee_id,
        COALESCE(ru.vacation_days_used, 0)::integer AS "used_totalVacationDays",
        e."totalVacationDays" AS "totalVacationDays",
        e."vacationDays" AS "vacationDays",
        GREATEST(0, e."totalVacationDays" - COALESCE(ru.vacation_days_used, 0))::integer AS "recalculated_vacationDays",
        COALESCE(ru.personal_hours_used, 0)::integer AS "used_totalPersonalHours",
        e."totalPersonalHours" AS "totalPersonalHours",
        e."personalHours" AS "personalHours",
        GREATEST(0, e."totalPersonalHours" - COALESCE(ru.personal_hours_used, 0))::integer AS "recalculated_personalHours",
        COALESCE(ru.remote_hours_used, 0)::integer AS "used_totalRemoteHours",
        e."totalRemoteHours" AS "totalRemoteHours",
        e."remoteHours" AS "remoteHours",
        GREATEST(0, e."totalRemoteHours" - COALESCE(ru.remote_hours_used, 0))::integer AS "recalculated_remoteHours",
        COALESCE(ru.available_hours_used, 0)::integer AS "used_totalAvailableHours",
        e."totalAvailableHours" AS "totalAvailableHours",
        e."availableHours" AS "availableHours",
        GREATEST(0, e."totalAvailableHours" - COALESCE(ru.available_hours_used, 0))::integer AS "recalculated_availableHours"
      FROM public.employees e
      LEFT JOIN request_usage ru ON ru.employee_id = e.id
    )
    SELECT
      eb.employee_id,
      eb."used_totalVacationDays",
      eb."totalVacationDays",
      eb."vacationDays",
      eb."recalculated_vacationDays",
      eb."used_totalPersonalHours",
      eb."totalPersonalHours",
      eb."personalHours",
      eb."recalculated_personalHours",
      eb."used_totalRemoteHours",
      eb."totalRemoteHours",
      eb."remoteHours",
      eb."recalculated_remoteHours",
      eb."used_totalAvailableHours",
      eb."totalAvailableHours",
      eb."availableHours",
      eb."recalculated_availableHours",
      (
        eb."vacationDays" <> eb."recalculated_vacationDays" OR
        eb."personalHours" <> eb."recalculated_personalHours" OR
        eb."remoteHours" <> eb."recalculated_remoteHours" OR
        eb."availableHours" <> eb."recalculated_availableHours"
      ) AS will_change
    FROM expected_balances eb
    ORDER BY eb.employee_id;
  END IF;
END;
$$;
