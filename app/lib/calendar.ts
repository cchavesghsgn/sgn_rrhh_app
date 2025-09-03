

import { google } from 'googleapis';
import { LeaveRequest, Employee, LEAVE_REQUEST_TYPE_LABELS } from './types';

// Configuración de Google Calendar API
const calendar = google.calendar('v3');

interface CalendarEventData {
  employeeName: string;
  requestType: string;
  startDate: Date;
  endDate: Date;
  startTime?: string;
  endTime?: string;
  shift?: string;
  reason?: string;
}

// Obtener cliente OAuth2 autenticado
const getAuthClient = () => {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    'https://developers.google.com/oauthplayground' // redirect URI
  );

  auth.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
  });

  return auth;
};

// Normalizar tipo desde DB (TitleCase) a formato de app (UPPERCASE)
const fromDbType = (t: string) => {
  switch (t) {
    case 'License': return 'LICENSE';
    case 'Personal': return 'PERSONAL';
    case 'Remote': return 'REMOTE';
    case 'Hours': return 'HOURS';
    default: return t;
  }
};

// Etiquetas específicas para títulos de Calendar
const calendarTypeLabel = (type: string): string => {
  switch (type) {
    case 'HOURS': return 'Hora Particular';
    case 'PERSONAL': return 'Día Particular';
    case 'REMOTE': return 'Día Remoto';
    case 'VACATION': return 'Vacaciones';
    case 'LICENSE': return 'Licencia';
    default: return type;
  }
};

// Formatear título del evento con iniciales
const formatEventTitle = (firstName: string, lastName: string, requestType: string): string => {
  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  return `${initials} - ${requestType}`;
};

// Traducir turnos al castellano
const translateShift = (shift: string): string => {
  switch (shift) {
    case 'FULL_DAY': return 'Todo el día';
    case 'MORNING': return 'Mañana';
    case 'AFTERNOON': return 'Tarde';
    default: return shift;
  }
};

// Formatear descripción del evento
const formatEventDescription = (data: CalendarEventData): string => {
  const fmtTime = (t: string) => (t && t.includes(':') ? t : `${t}:00`);

  let description = `Solicitud de ${data.requestType} para ${data.employeeName}\n\n`;

  // Agregar horario si está especificado
  if (data.startTime && data.endTime) {
    description += `Horario: ${fmtTime(data.startTime)} - ${fmtTime(data.endTime)}\n`;
  }

  // Agregar turno si está presente
  if (data.shift) {
    description += `Turno: ${translateShift(data.shift)}\n`;
  }

  description += `\nGenerado automáticamente por el Sistema RRHH SGN`;
  return description;
};

// Crear evento en Google Calendar
export const createCalendarEvent = async (leaveRequest: LeaveRequest & { employees: Employee }): Promise<{ success: boolean; eventId?: string; error?: string }> => {
  try {
    // Verificar que las credenciales estén configuradas
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REFRESH_TOKEN) {
      console.log('Credenciales de Google Calendar no configuradas, saltando creación de evento');
      return { success: true, error: 'Credenciales no configuradas' };
    }

    const auth = getAuthClient();
    
    // Preparar datos del evento
    const employeeName = `${leaveRequest.employees.firstName} ${leaveRequest.employees.lastName}`;
    // Normalizar tipo y usar etiquetas específicas de Calendar para el título
    const normalizedType = fromDbType(leaveRequest.type as unknown as string);
    const requestTypeForTitle = calendarTypeLabel(normalizedType);
    // Unificar: usar misma etiqueta que el título también en la descripción
    const requestTypeForDescription = requestTypeForTitle;
    
    const eventData: CalendarEventData = {
      employeeName,
      requestType: requestTypeForDescription,
      startDate: leaveRequest.startDate,
      endDate: leaveRequest.endDate,
      startTime: leaveRequest.startTime,
      endTime: leaveRequest.endTime,
      shift: leaveRequest.shift,
      reason: leaveRequest.reason,
    };

    // Configurar fechas del evento
    let eventStart: any;
    let eventEnd: any;

    if (normalizedType === 'HOURS' && leaveRequest.startTime && leaveRequest.endTime) {
      // Para solicitudes de horas, crear evento con hora específica
      const startDateTime = new Date(leaveRequest.startDate);
      const endDateTime = new Date(leaveRequest.startDate);
      
      // Parsear horas (admite HH o HH:MM)
      const parse = (t: string): [number, number] => {
        const [h, m] = (t || '').split(':');
        const hour = Number(h);
        const minute = m != null ? Number(m) : 0;
        return [isNaN(hour) ? 0 : hour, isNaN(minute) ? 0 : minute];
      };
      const [startHour, startMinute] = parse(leaveRequest.startTime);
      const [endHour, endMinute] = parse(leaveRequest.endTime);
      
      startDateTime.setHours(startHour, startMinute, 0, 0);
      endDateTime.setHours(endHour, endMinute, 0, 0);
      
      eventStart = { dateTime: startDateTime.toISOString(), timeZone: 'America/Bogota' };
      eventEnd = { dateTime: endDateTime.toISOString(), timeZone: 'America/Bogota' };
    } else {
      // Para otros tipos de solicitudes, crear evento de día completo
      const startDate = new Date(leaveRequest.startDate);
      const endDate = new Date(leaveRequest.endDate);
      
      // Para eventos de día completo, agregar 1 día a la fecha de fin
      endDate.setDate(endDate.getDate() + 1);
      
      eventStart = { date: startDate.toISOString().split('T')[0] };
      eventEnd = { date: endDate.toISOString().split('T')[0] };
    }

    const event = {
      summary: formatEventTitle(leaveRequest.employees.firstName, leaveRequest.employees.lastName, requestTypeForTitle),
      description: formatEventDescription(eventData),
      start: eventStart,
      end: eventEnd,
      colorId: getEventColor(normalizedType), // Color según tipo de solicitud
    };

    // Crear evento en el calendario
    const response = await calendar.events.insert({
      auth,
      calendarId: process.env.GOOGLE_CALENDAR_ID || 'primary', // ID del calendario SGN
      requestBody: event,
    });

    return {
      success: true,
      eventId: response.data.id || undefined,
    };

  } catch (error) {
    console.error('Error creando evento en Google Calendar:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
};

// Obtener color del evento según tipo de solicitud
const getEventColor = (type: string): string => {
  const t = fromDbType(type) as string;
  switch (t) {
    case 'LICENSE': return '6'; // Naranja
    case 'PERSONAL': return '10'; // Verde
    case 'REMOTE': return '9'; // Azul
    case 'HOURS': return '2'; // Salvia
    default: return '1'; // Lavanda
  }
};

// Función para verificar la configuración de Google Calendar
export const checkGoogleCalendarConfig = (): { isConfigured: boolean; missingVars: string[] } => {
  const requiredVars = [
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET', 
    'GOOGLE_REFRESH_TOKEN'
  ];
  
  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  
  return {
    isConfigured: missingVars.length === 0,
    missingVars
  };
};
