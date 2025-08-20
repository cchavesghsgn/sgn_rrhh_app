
import nodemailer from 'nodemailer';

// Configuración del transportador de correo
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

// Interfaces para los datos de correo
export interface NewRequestEmailData {
  employeeName: string;
  employeeEmail: string;
  requestType: string;
  requestDate: string;
  reason: string;
  requestId: string;
}

export interface RequestStatusEmailData {
  employeeName: string;
  requestType: string;
  requestDate: string;
  status: 'approved' | 'rejected';
  adminComment?: string | null;
}

// Templates de correo
const getNewRequestEmailTemplate = (data: NewRequestEmailData) => {
  return {
    subject: `Nueva Solicitud de ${data.requestType} - ${data.employeeName}`,
    html: `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Nueva Solicitud</title>
        <style>
          .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
          .header { background-color: #1e3a8a; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f8fafc; }
          .card { background: white; padding: 20px; border-radius: 8px; margin: 10px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
          .field { margin: 10px 0; }
          .label { font-weight: bold; color: #374151; }
          .value { color: #6b7280; }
          .button { background-color: #1e3a8a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 10px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔔 Nueva Solicitud de Permiso</h1>
          </div>
          <div class="content">
            <div class="card">
              <h2>Detalles de la Solicitud</h2>
              <div class="field">
                <span class="label">Empleado:</span>
                <span class="value">${data.employeeName}</span>
              </div>
              <div class="field">
                <span class="label">Email:</span>
                <span class="value">${data.employeeEmail}</span>
              </div>
              <div class="field">
                <span class="label">Tipo de Solicitud:</span>
                <span class="value">${data.requestType}</span>
              </div>
              <div class="field">
                <span class="label">Fecha:</span>
                <span class="value">${data.requestDate}</span>
              </div>
              <div class="field">
                <span class="label">Motivo:</span>
                <div class="value" style="margin-top: 5px; padding: 10px; background-color: #f3f4f6; border-radius: 4px;">
                  ${data.reason}
                </div>
              </div>
            </div>
            <div style="text-align: center;">
              <a href="${process.env.NEXTAUTH_URL}/admin/requests/${data.requestId}" class="button">
                Ver Solicitud
              </a>
            </div>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `Nueva solicitud de ${data.requestType} de ${data.employeeName}. Motivo: ${data.reason}. Ver en: ${process.env.NEXTAUTH_URL}/admin/requests/${data.requestId}`
  };
};

const getRequestStatusEmailTemplate = (data: RequestStatusEmailData) => {
  const statusColor = data.status === 'approved' ? '#10b981' : '#ef4444';
  const statusText = data.status === 'approved' ? '✅ APROBADA' : '❌ RECHAZADA';
  const statusMessage = data.status === 'approved' 
    ? 'Tu solicitud ha sido aprobada.' 
    : 'Tu solicitud ha sido rechazada.';

  return {
    subject: `Solicitud ${data.status === 'approved' ? 'Aprobada' : 'Rechazada'} - ${data.requestType}`,
    html: `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Estado de Solicitud</title>
        <style>
          .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
          .header { background-color: ${statusColor}; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f8fafc; }
          .card { background: white; padding: 20px; border-radius: 8px; margin: 10px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
          .field { margin: 10px 0; }
          .label { font-weight: bold; color: #374151; }
          .value { color: #6b7280; }
          .status { font-size: 24px; font-weight: bold; text-align: center; color: ${statusColor}; margin: 20px 0; }
          .button { background-color: #1e3a8a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 10px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📋 Estado de tu Solicitud</h1>
          </div>
          <div class="content">
            <div class="status">${statusText}</div>
            <div class="card">
              <h2>Hola, ${data.employeeName}</h2>
              <p>${statusMessage}</p>
              <div class="field">
                <span class="label">Tipo de Solicitud:</span>
                <span class="value">${data.requestType}</span>
              </div>
              <div class="field">
                <span class="label">Fecha:</span>
                <span class="value">${data.requestDate}</span>
              </div>
              ${(data.adminComment && data.adminComment.trim()) ? `
                <div class="field">
                  <span class="label">Comentarios del Administrador:</span>
                  <div class="value" style="margin-top: 5px; padding: 10px; background-color: #f3f4f6; border-radius: 4px;">
                    ${data.adminComment}
                  </div>
                </div>
              ` : ''}
            </div>
            <div style="text-align: center;">
              <a href="${process.env.NEXTAUTH_URL}/requests" class="button">
                Ver Mis Solicitudes
              </a>
            </div>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `Tu solicitud de ${data.requestType} ha sido ${data.status === 'approved' ? 'aprobada' : 'rechazada'}. ${(data.adminComment && data.adminComment.trim()) ? 'Comentarios: ' + data.adminComment : ''}`
  };
};

// Funciones de envío
export const sendNewRequestNotification = async (adminEmails: string[], data: NewRequestEmailData) => {
  try {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.log('SMTP no configurado, saltando envío de correo');
      return { success: true, message: 'SMTP no configurado' };
    }

    const transporter = createTransporter();
    const template = getNewRequestEmailTemplate(data);

    const results = await Promise.allSettled(
      adminEmails.map(email => 
        transporter.sendMail({
          from: `"Sistema RRHH SGN" <${process.env.SMTP_USER}>`,
          to: email,
          subject: template.subject,
          text: template.text,
          html: template.html,
        })
      )
    );

    const failed = results.filter(r => r.status === 'rejected');
    if (failed.length > 0) {
      console.error('Algunos correos fallaron:', failed);
    }

    return { 
      success: true, 
      message: `Enviado a ${adminEmails.length - failed.length} de ${adminEmails.length} administradores` 
    };
  } catch (error) {
    console.error('Error enviando correo a administradores:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' };
  }
};

export const sendRequestStatusNotification = async (employeeEmail: string, data: RequestStatusEmailData) => {
  try {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.log('SMTP no configurado, saltando envío de correo');
      return { success: true, message: 'SMTP no configurado' };
    }

    const transporter = createTransporter();
    const template = getRequestStatusEmailTemplate(data);

    await transporter.sendMail({
      from: `"Sistema RRHH SGN" <${process.env.SMTP_USER}>`,
      to: employeeEmail,
      subject: template.subject,
      text: template.text,
      html: template.html,
    });

    return { success: true, message: 'Correo enviado exitosamente' };
  } catch (error) {
    console.error('Error enviando correo al empleado:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' };
  }
};
