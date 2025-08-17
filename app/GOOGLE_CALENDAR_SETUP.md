
# Configuración de Google Calendar API

## Funcionalidad Implementada

Se ha agregado la integración con Google Calendar para crear eventos automáticamente cuando se aprueba una solicitud de permiso. Los eventos se crean en el calendario "SGN" con el formato: **"Nombre Empleado - Tipo de Solicitud"**.

## Configuración Requerida

Para habilitar esta funcionalidad, es necesario configurar las credenciales de Google Calendar API en el archivo `.env`:

### 1. Crear proyecto en Google Cloud Console

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un nuevo proyecto o selecciona uno existente
3. Habilita la **Google Calendar API**

### 2. Crear credenciales OAuth 2.0

1. Ve a **APIs & Services > Credentials**
2. Haz clic en **"Create Credentials" > "OAuth client ID"**
3. Configura la pantalla de consentimiento OAuth si no está configurada
4. Selecciona **"Web application"** como tipo de aplicación
5. Agrega `https://developers.google.com/oauthplayground` como URI de redirección autorizada
6. Guarda el **Client ID** y **Client Secret**

### 3. Generar Refresh Token

1. Ve a [OAuth 2.0 Playground](https://developers.google.com/oauthplayground)
2. Haz clic en el ícono de configuración (⚙️)
3. Marca **"Use your own OAuth credentials"**
4. Ingresa tu **Client ID** y **Client Secret**
5. En **Step 1**, selecciona **Google Calendar API v3** y marca:
   - `https://www.googleapis.com/auth/calendar`
   - `https://www.googleapis.com/auth/calendar.events`
6. Haz clic en **"Authorize APIs"**
7. Autoriza el acceso con la cuenta de Google que maneja el calendario SGN
8. En **Step 2**, haz clic en **"Exchange authorization code for tokens"**
9. Copia el **Refresh Token** generado

### 4. Configurar variables de entorno

Agrega las siguientes variables al archivo `.env`:

```env
# Configuración Google Calendar API
GOOGLE_CLIENT_ID="tu_client_id_aqui"
GOOGLE_CLIENT_SECRET="tu_client_secret_aqui"
GOOGLE_REFRESH_TOKEN="tu_refresh_token_aqui"
GOOGLE_CALENDAR_ID="SGN"
```

### 5. Configurar el calendario

- Asegúrate de que el calendario "SGN" exista en la cuenta de Google configurada
- Si el calendario tiene un ID específico diferente a "SGN", actualiza `GOOGLE_CALENDAR_ID` con el ID correcto
- Puedes encontrar el ID del calendario en la configuración del calendario de Google

## Funcionamiento

Una vez configurado correctamente:

1. **Cuando se aprueba una solicitud**: Se crea automáticamente un evento en Google Calendar
2. **Formato del evento**: "Juan Pérez - Día Personal"
3. **Tipos de evento**:
   - **Solicitudes de horas**: Evento con horario específico
   - **Otros tipos**: Evento de día completo
4. **Colores**: Cada tipo de solicitud tiene un color diferente
5. **Descripción**: Incluye motivo, turno (si aplica) y información adicional

## Manejo de Errores

- Si las credenciales no están configuradas, la aplicación funcionará normalmente pero no creará eventos
- Los errores de calendario no afectan el proceso de aprobación de solicitudes
- Los errores se registran en los logs para debugging

## Notas Importantes

- ⚠️ **La integración es opcional**: La aplicación funciona sin configurar Google Calendar
- 🔐 **Seguridad**: Mantén las credenciales seguras y no las compartas
- 📧 **Misma cuenta**: Se recomienda usar la misma cuenta de Google que envía los emails (`cchaves@sgntech.net`)
- ⏱️ **Zona horaria**: Los eventos se crean en zona horaria America/Bogota

## Verificación

Para verificar que la configuración está correcta, revisa los logs de la aplicación cuando apruebes una solicitud. Deberías ver mensajes como:

```
Evento creado exitosamente en Google Calendar: evento_id_123
```

Si hay errores en la configuración, verás mensajes de error específicos en los logs.
