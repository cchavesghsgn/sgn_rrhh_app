

/**
 * Utilidades para el manejo de tiempo y cálculo de permisos
 * Sistema: Mañana (5h) + Tarde (3h) = Día completo (8h)
 */

export const SHIFT_HOURS = {
  MORNING: 5,
  AFTERNOON: 3,
  FULL_DAY: 8
} as const;

/**
 * Convierte horas disponibles a un formato legible para el usuario
 * @param totalHours Total de horas disponibles
 * @returns String formateado (ej: "2 días y 1 tarde", "1 mañana", "3 días")
 */
export function formatAvailableTime(totalHours: number): string {
  if (totalHours <= 0) return '0 días';
  
  const fullDays = Math.floor(totalHours / 8);
  const remainingHours = totalHours % 8;
  
  const parts: string[] = [];
  
  if (fullDays > 0) {
    parts.push(`${fullDays} día${fullDays > 1 ? 's' : ''}`);
  }
  
  if (remainingHours === 5) {
    parts.push('1 mañana');
  } else if (remainingHours === 3) {
    parts.push('1 tarde');
  }
  
  return parts.join(' y ') || '0 días';
}

/**
 * Convierte horas disponibles a días decimales para compatibilidad
 * @param totalHours Total de horas disponibles
 * @returns Número de días en decimal (ej: 2.5 días)
 */
export function hoursToDays(totalHours: number): number {
  return Math.round((totalHours / 8) * 100) / 100;
}

/**
 * Convierte días decimales a horas
 * @param days Días en decimal
 * @returns Total de horas
 */
export function daysToHours(days: number): number {
  return Math.round(days * 8);
}

/**
 * Valida si el empleado puede solicitar un turno específico
 * @param availableHours Horas disponibles del empleado
 * @param requestedShift Turno solicitado (MORNING, AFTERNOON, FULL_DAY)
 * @returns true si puede solicitar el turno
 */
export function canRequestShift(availableHours: number, requestedShift: string): boolean {
  switch (requestedShift) {
    case 'MORNING':
      return availableHours >= SHIFT_HOURS.MORNING;
    case 'AFTERNOON':
      return availableHours >= SHIFT_HOURS.AFTERNOON;
    case 'FULL_DAY':
      return availableHours >= SHIFT_HOURS.FULL_DAY;
    default:
      return false;
  }
}

/**
 * Calcula las horas que se deben deducir según el tipo de turno
 * @param shift Turno solicitado (MORNING, AFTERNOON, FULL_DAY)
 * @returns Número de horas a deducir
 */
export function calculateHoursToDeduct(shift: string): number {
  switch (shift) {
    case 'MORNING':
      return SHIFT_HOURS.MORNING;
    case 'AFTERNOON':
      return SHIFT_HOURS.AFTERNOON;
    case 'FULL_DAY':
      return SHIFT_HOURS.FULL_DAY;
    default:
      return 0;
  }
}

/**
 * Obtiene un resumen detallado de las horas disponibles
 * @param totalHours Total de horas disponibles
 * @returns Objeto con desglose detallado
 */
export function getTimeBreakdown(totalHours: number) {
  const fullDays = Math.floor(totalHours / 8);
  const remainingHours = totalHours % 8;
  
  let mornings = fullDays;
  let afternoons = fullDays;
  
  if (remainingHours >= 5) {
    mornings += 1;
  }
  
  if (remainingHours >= 3) {
    afternoons += 1;
  }
  
  return {
    totalHours,
    fullDays,
    remainingHours,
    availableMornings: mornings,
    availableAfternoons: afternoons,
    formattedTime: formatAvailableTime(totalHours),
    daysEquivalent: hoursToDays(totalHours)
  };
}

