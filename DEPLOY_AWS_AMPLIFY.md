
# 🚀 Guía Completa de Despliegue en AWS Amplify

Esta guía te llevará paso a paso desde tu aplicación local hasta una aplicación web completamente funcional en AWS Amplify.

## 📋 Pre-requisitos

- ✅ Cuenta de AWS activa
- ✅ Cuenta de GitHub 
- ✅ Aplicación preparada (archivos ya creados)
- ✅ Base de datos PostgreSQL en la nube

---

## **PASO 1: Subir Código a GitHub** 🐙

### 1.1 Crear Repositorio en GitHub
1. Ve a [GitHub.com](https://github.com)
2. Click en **"New repository"**
3. Nombre: `sgn-rrhh-app` (o el que prefieras)
4. Selecciona **Private** o **Public**
5. **NO** marques "Initialize with README"
6. Click **"Create repository"**

### 1.2 Subir tu Código
Ejecuta estos comandos desde tu terminal local:

```bash
# Ir al directorio de tu aplicación
cd /home/ubuntu/sgn_rrhh_app

# Inicializar Git
git init

# Agregar todos los archivos
git add .

# Hacer el primer commit
git commit -m "Initial commit - SGN RRHH App"

# Conectar con tu repositorio (CAMBIAR POR TU URL)
git remote add origin https://github.com/TU-USUARIO/sgn-rrhh-app.git

# Subir código
git branch -M main
git push -u origin main
```

---

## **PASO 2: Configurar Base de Datos PostgreSQL** 🗄️

### Opción A: Supabase (Recomendado - Gratis)

1. Ve a [supabase.com](https://supabase.com)
2. **"Start your project"** → **"New project"**
3. Nombre: `sgn-rrhh-db`
4. Database Password: **Anota esta contraseña**
5. Region: Selecciona la más cercana
6. **"Create new project"** (espera ~3 minutos)

7. **Obtener URL de Conexión:**
   - Ve a **Settings** → **Database**
   - Copia la **Connection String**
   - Formato: `postgresql://postgres:TU-PASSWORD@HOST:5432/postgres`

### Opción B: AWS RDS PostgreSQL

1. AWS Console → **RDS** → **Create database**
2. **PostgreSQL** → **Free tier**
3. DB Instance: `sgn-rrhh-db`
4. Username: `postgres`
5. Password: **Anota esta contraseña**
6. **Create database** (espera ~10 minutos)
7. Obtener endpoint de la instancia

---

## **PASO 3: Configurar AWS Amplify** ⚡

### 3.1 Acceder a AWS Amplify
1. [AWS Console](https://console.aws.amazon.com/)
2. Buscar **"Amplify"**
3. **"Create new app"** → **"Host web app"**

### 3.2 Conectar con GitHub
1. Seleccionar **"GitHub"**
2. **"Connect branch"**
3. Autorizar AWS Amplify en GitHub
4. Seleccionar tu repositorio: `sgn-rrhh-app`
5. Branch: **main**
6. **Next**

### 3.3 Configurar Build Settings
1. **App name**: `SGN-RRHH-App`
2. **Build and test settings**: Automáticamente detecta `amplify.yml`
3. **Advanced settings** → **Add environment variable**

### 3.4 Notas de configuración (amplify.yml)
- Node.js: se fija automáticamente a Node 18 si `nvm` está disponible durante el build.
- Tareas de Base de Datos (seguras): solo se ejecutan en ramas `main`/`master` y cuando defines `RUN_DB_TASKS=1` en variables de entorno de Amplify.
  - Prebuild (opcional): valida variables con `yarn db:validate`.
  - Postbuild: si existen migraciones (`prisma/migrations`), usa `npx prisma migrate deploy`; si no, usa `npx prisma db push`.
  - Seeding: `yarn db:seed-production` solo si `RUN_DB_TASKS=1` en `main/master`.
- Recomendación: no definas `RUN_DB_TASKS` en previews/branches de prueba para evitar tocar la BD.

---

## **PASO 4: Variables de Entorno** 🔐

Agregar estas variables en **Advanced settings**:

### Variables Obligatorias:
```
DATABASE_URL = postgresql://postgres:PASSWORD@HOST:5432/postgres
NEXTAUTH_URL = https://TU-DOMINIO.amplifyapp.com
NEXTAUTH_SECRET = mi-super-secret-key-2024
SMTP_HOST = smtp.gmail.com
SMTP_PORT = 587
SMTP_USER = tu-email@gmail.com
SMTP_PASS = tu-app-password
```

### Variables Opcionales (Google Calendar):
```
GOOGLE_CLIENT_ID = tu-client-id
GOOGLE_CLIENT_SECRET = tu-client-secret
GOOGLE_REFRESH_TOKEN = tu-refresh-token
GOOGLE_CALENDAR_ID = tu-calendar-id
```

### 4.1 Obtener App Password de Gmail
1. Ve a tu [Cuenta de Google](https://myaccount.google.com/)
2. **Seguridad** → **Verificación en dos pasos** (activar si no está)
3. **Contraseñas de aplicación** 
4. Seleccionar **"Correo"** y **"Otro"**
5. Nombre: `SGN RRHH App`
6. **Generar** → Copiar la contraseña de 16 dígitos

---

## **PASO 5: Desplegar** 🚀

1. **"Save and deploy"** en AWS Amplify
2. **Esperar el proceso** (5-10 minutos):
   - ✅ Provision
   - ✅ Build  
   - ✅ Deploy
   - ✅ Verify

3. **Si hay errores en Build:**
   - Revisar logs en la consola
   - Verificar variables de entorno
   - Asegurar que DATABASE_URL sea correcta

---

## **PASO 6: Configurar Base de Datos** 📊

### 6.1 Ejecutar Migraciones
Una vez deployado exitosamente:

1. AWS Amplify Console → Tu app → **Backend environments**
2. **Terminal/SSH access** o usar tu terminal local:

```bash
# Conectar a tu base de datos y ejecutar:
npx prisma db push --skip-generate
```

### 6.2 Poblar Datos Iniciales (Seed)
```bash
npx prisma db seed
```

---

## **PASO 7: Verificar Despliegue** ✅

### 7.1 Probar la Aplicación
1. Click en el **dominio de Amplify** (ej: `https://main.d1234567890.amplifyapp.com`)
2. **Verificar carga de página principal**
3. **Probar login** con credenciales:
   - Admin: `john@doe.com` / `johndoe123`

### 7.2 Probar Funcionalidades
- ✅ **Login/Logout**
- ✅ **Dashboard admin**
- ✅ **Gestión de empleados**  
- ✅ **Crear solicitudes**
- ✅ **Envío de emails**

---

## **PASO 8: Dominio Personalizado (Opcional)** 🌐

1. AWS Amplify → **Domain management**
2. **Add domain** 
3. Escribir tu dominio: `rrhh.tuempresa.com`
4. **Configure domain**
5. **Actualizar DNS** en tu proveedor de dominio
6. **Esperar validación SSL** (~30 minutos)

---

## **PASO 9: Configurar Actualizaciones Automáticas** 🔄

AWS Amplify automáticamente:
- ✅ **Redespliega** cada vez que haces `git push` a main
- ✅ **Mantiene historial** de deployments
- ✅ **Rollback** fácil si algo falla

### Para Actualizar tu App:
```bash
# En tu máquina local
git add .
git commit -m "Nueva característica agregada"
git push origin main
# AWS Amplify automáticamente redesplegará
```

---

## 🛠️ **Resolución de Problemas Comunes**

### Error de Build: "Prisma generate failed"
**Solución:** Verificar que `DATABASE_URL` esté configurada correctamente

### Error: "NextAuth configuration error"  
**Solución:** Verificar `NEXTAUTH_URL` y `NEXTAUTH_SECRET`

### Error: "Cannot send email"
**Solución:** Verificar credenciales SMTP y App Password de Gmail

### Error de Base de Datos: "Connection timeout"
**Solución:** Verificar que la base de datos permita conexiones externas

---

## 📊 **Monitoreo y Logs**

1. **AWS Amplify Console** → Tu app → **Monitoring**
2. **CloudWatch Logs** para logs detallados
3. **Build history** para ver deployments anteriores
4. **Performance insights** para métricas

---

## 💰 **Estimación de Costos**

### AWS Amplify:
- **Hosting**: ~$1-5 USD/mes para tráfico básico
- **Build**: ~$0.01 por minuto de build

### Base de Datos:
- **Supabase**: Gratis hasta 500MB
- **AWS RDS**: ~$15-25 USD/mes (t3.micro)

**Total estimado**: $1-30 USD/mes dependiendo del tráfico y base de datos elegida.

---

## 🎉 **¡Felicitaciones!**

Tu aplicación de RRHH está ahora:
- ✅ **Desplegada en la nube**
- ✅ **Accesible desde cualquier lugar**
- ✅ **Con SSL/HTTPS automático**
- ✅ **Actualizaciones automáticas**
- ✅ **Escalable y confiable**

**URL de tu app**: https://tu-dominio.amplifyapp.com

---

## 📞 **Soporte**

Si encuentras problemas:
1. **Revisar logs** en AWS Amplify Console
2. **Verificar variables** de entorno
3. **Comprobar conexión** a base de datos
4. **Revisar documentación** de AWS Amplify

¡Tu aplicación de RRHH está lista para producción! 🚀
