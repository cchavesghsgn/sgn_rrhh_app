
# SGN RRHH - Sistema de Gestión de Recursos Humanos

Una aplicación web moderna para la gestión de recursos humanos desarrollada con Next.js, TypeScript y PostgreSQL.

## 🚀 Características

- **Gestión de Empleados**: CRUD completo de empleados con información detallada
- **Sistema de Solicitudes**: Manejo de permisos personales, remotos y por horas
- **Dashboard Administrativo**: Panel de control para administradores
- **Notificaciones por Email**: Sistema automático de notificaciones
- **Integración con Google Calendar**: Creación automática de eventos
- **Autenticación Segura**: Sistema de login con NextAuth.js

## 🛠️ Tecnologías Utilizadas

- **Frontend**: Next.js 14, React 18, TypeScript
- **Backend**: Next.js API Routes, Prisma ORM
- **Base de Datos**: PostgreSQL
- **Autenticación**: NextAuth.js
- **UI/UX**: Tailwind CSS, Radix UI, Shadcn/ui
- **Email**: Nodemailer
- **Calendario**: Google Calendar API

## 📋 Requisitos Previos

- Node.js 18+ 
- PostgreSQL
- Cuenta de Gmail para notificaciones
- Google Calendar API (opcional)

## 🔧 Variables de Entorno Requeridas

```env
# Base de datos
DATABASE_URL="postgresql://usuario:password@host:5432/database"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="tu-secret-key"

# Email SMTP
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="tu-email@gmail.com"
SMTP_PASS="tu-app-password"

# Google Calendar (Opcional)
GOOGLE_CLIENT_ID="tu-client-id"
GOOGLE_CLIENT_SECRET="tu-client-secret"
GOOGLE_REFRESH_TOKEN="tu-refresh-token"
GOOGLE_CALENDAR_ID="tu-calendar-id"
```

## 🚀 Instalación y Desarrollo

1. **Clonar el repositorio**
```bash
git clone [tu-repo-url]
cd sgn_rrhh_app
```

2. **Instalar dependencias**
```bash
cd app
yarn install
```

3. **Configurar base de datos**
```bash
npx prisma db push
npx prisma db seed
```

4. **Ejecutar en desarrollo**
```bash
yarn dev
```

5. **Abrir en navegador**: http://localhost:3000

## 👥 Credenciales de Prueba

- **Admin**: john@doe.com / johndoe123
- **Empleados**: Todos usan password: 123456

## 📦 Despliegue

### AWS Amplify
La aplicación está optimizada para AWS Amplify con configuración automática.

### Variables de Entorno en Producción
Configurar todas las variables de entorno listadas arriba en el panel de Amplify.

## 🤝 Contribución

1. Fork el proyecto
2. Crea una rama para tu feature
3. Commit tus cambios
4. Push a la rama
5. Abre un Pull Request

## 📄 Licencia

Este proyecto es privado y confidencial.

---

Desarrollado con ❤️ para SGN
