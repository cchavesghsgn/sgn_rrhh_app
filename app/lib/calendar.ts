

// import { google } from 'googleapis';
import { LeaveRequest, Employee, LEAVE_REQUEST_TYPE_LABELS } from './types';

// Configuración de Google Calendar API
// const calendar = google.calendar('v3');

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
  // const auth = new google.auth.OAuth2(
  //   process.env.GOOGLE_CLIENT_ID,
  //   process.env.GOOGLE_CLIENT_SECRET,
  //   'https://developers.google.com/oauthplayground' // redirect URI
  // );

  // auth.setCredentials({
  //   refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
  // });

  return null; // auth;
};

// Formatear título del evento
const formatEventTitle = (employeeName: string, requestType: string): string => {
  return `${employeeName} - ${requestType}`;
};

// Formatear descripción del evento
const formatEventDescription = (data: CalendarEventData): string => {
  let description = `Solicitud de ${data.requestType} para ${data.employeeName}\n\n`;
  
  if (data.reason) {
    description += `Motivo: ${data.reason}\n`;
  }
  
  if (data.shift) {
    description += `Turno: ${data.shift}\n`;
  }
  
  description += `\nGenerado automáticamente por el Sistema RRHH SGN`;
  
  return description;
};

// Crear evento en Google Calendar
export const createCalendarEvent = async (leaveRequest: LeaveRequest & { employee: Employee }): Promise<{ success: boolean; eventId?: string; error?: string }> => {
  try {
    // Verificar que las credenciales estén configuradas
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REFRESH_TOKEN) {
      console.log('Credenciales de Google Calendar no configuradas, saltando creación de evento');
      return { success: true, error: 'Credenciales no configuradas' };
    }

    const auth = getAuthClient();
    
    // Preparar datos del evento
    const employeeName = `${leaveRequest.employee.firstName} ${leaveRequest.employee.lastName}`;
    const requestType = LEAVE_REQUEST_TYPE_LABELS[leaveRequest.type] || leaveRequest.type;
    
    const eventData: CalendarEventData = {
      employeeName,
      requestType,
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

    if (leaveRequest.type === 'HOURS' && leaveRequest.startTime && leaveRequest.endTime) {
      // Para solicitudes de horas, crear evento con hora específica
      const startDateTime = new Date(leaveRequest.startDate);
      const endDateTime = new Date(leaveRequest.startDate);
      
      // Parsear horas (formato HH:MM)
      const [startHour, startMinute] = leaveRequest.startTime.split(':').map(Number);
      const [endHour, endMinute] = leaveRequest.endTime.split(':').map(Number);
      
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
      summary: formatEventTitle(employeeName, requestType),
      description: formatEventDescription(eventData),
      start: eventStart,
      end: eventEnd,
      colorId: getEventColor(leaveRequest.type), // Color según tipo de solicitud
    };

    // Crear evento en el calendario
    // const response = await calendar.events.insert({
    //   auth,
    //   calendarId: process.env.GOOGLE_CALENDAR_ID || 'primary', // ID del calendario SGN
    //   requestBody: event,
    // });

    return {
      success: false, // true,
      eventId: undefined, // response.data.id || undefined,
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
  switch (type) {
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
