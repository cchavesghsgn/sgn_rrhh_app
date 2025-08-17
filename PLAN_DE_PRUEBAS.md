
# 📋 Plan de Pruebas - Sistema de RRHH SGN

## 🎯 **Objetivo**
Verificar que todas las funcionalidades del sistema de gestión de recursos humanos funcionen correctamente antes de desplegar actualizaciones o cambios.

## 📊 **Alcance de las Pruebas**
- ✅ **Autenticación y Autorización**
- ✅ **Gestión de Empleados** (CRUD)  
- ✅ **Gestión de Áreas**
- ✅ **Sistema de Solicitudes** (4 tipos)
- ✅ **Dashboard Administrativo**
- ✅ **Dashboard de Empleados**
- ✅ **Notificaciones por Email**
- ✅ **Integración Google Calendar**

---

## 🔐 **SECCIÓN 1: PRUEBAS DE AUTENTICACIÓN**

### Test 1.1: Login de Administrador
**Precondición:** Usuario administrador existe en la base de datos  
**Datos de prueba:** `john@doe.com` / `johndoe123`

| Paso | Acción | Resultado Esperado |
|------|--------|-------------------|
| 1 | Acceder a `/login` | Página de login se carga |
| 2 | Ingresar credenciales de admin | Campos aceptan entrada |
| 3 | Click en "Iniciar Sesión" | Redirección a `/dashboard` |
| 4 | Verificar header | Muestra "Panel de Administración" |
| 5 | Verificar menú lateral | Opciones de admin visibles |

**Estado:** ⬜ PENDIENTE ✅ PASS ❌ FAIL

### Test 1.2: Login de Empleado
**Precondición:** Usuario empleado existe en la base de datos  
**Datos de prueba:** `maria@company.com` / `123456`

| Paso | Acción | Resultado Esperado |
|------|--------|-------------------|
| 1 | Acceder a `/login` | Página de login se carga |
| 2 | Ingresar credenciales de empleado | Campos aceptan entrada |
| 3 | Click en "Iniciar Sesión" | Redirección a `/dashboard` |
| 4 | Verificar header | Muestra "Dashboard de Empleado" |
| 5 | Verificar menú | Solo opciones de empleado |

**Estado:** ⬜ PENDIENTE ✅ PASS ❌ FAIL

### Test 1.3: Login con Credenciales Incorrectas
**Datos de prueba:** `wrong@email.com` / `wrongpass`

| Paso | Acción | Resultado Esperado |
|------|--------|-------------------|
| 1 | Ingresar credenciales incorrectas | Campos aceptan entrada |
| 2 | Click en "Iniciar Sesión" | Mensaje de error aparece |
| 3 | Verificar redirección | Permanece en `/login` |

**Estado:** ⬜ PENDIENTE ✅ PASS ❌ FAIL

### Test 1.4: Logout
**Precondición:** Usuario logueado

| Paso | Acción | Resultado Esperado |
|------|--------|-------------------|
| 1 | Click en "Cerrar Sesión" | Confirmación de logout |
| 2 | Verificar redirección | Redirección a `/login` |
| 3 | Intentar acceder a dashboard | Redirección automática a login |

**Estado:** ⬜ PENDIENTE ✅ PASS ❌ FAIL

---

## 👥 **SECCIÓN 2: GESTIÓN DE EMPLEADOS (ADMIN)**

### Test 2.1: Ver Lista de Empleados
**Precondición:** Logueado como administrador

| Paso | Acción | Resultado Esperado |
|------|--------|-------------------|
| 1 | Ir a `/admin/employees` | Lista de empleados se carga |
| 2 | Verificar tarjetas de empleados | Información completa visible |
| 3 | Verificar botones de acción | "Editar" y "Eliminar" presentes |
| 4 | Verificar días disponibles | Horas/días actualizados correctamente |

**Estado:** ⬜ PENDIENTE ✅ PASS ❌ FAIL

### Test 2.2: Crear Nuevo Empleado
**Precondición:** Logueado como administrador

**Datos de prueba:**
- Email: `nuevo@empleado.com`
- Password: `123456`
- DNI: `12345678`
- Nombre: `Juan`
- Apellido: `Pérez`
- Fecha de Nacimiento: `1990-01-01`
- Fecha de Contratación: `2024-01-01`
- Área: `Desarrollo`
- Cargo: `Developer`
- Teléfono: `+54 11 1234-5678`

| Paso | Acción | Resultado Esperado |
|------|--------|-------------------|
| 1 | Click en "Nuevo Empleado" | Formulario se abre |
| 2 | Llenar todos los campos obligatorios | Campos aceptan entrada |
| 3 | Click en "Crear Empleado" | Mensaje de éxito |
| 4 | Verificar en lista | Nuevo empleado aparece |
| 5 | Verificar valores por defecto | 20 días vacaciones, 96h personales, etc. |

**Estado:** ⬜ PENDIENTE ✅ PASS ❌ FAIL

### Test 2.3: Editar Empleado Existente
**Precondición:** Empleado existe en la base de datos

| Paso | Acción | Resultado Esperado |
|------|--------|-------------------|
| 1 | Click en "Editar" de un empleado | Formulario pre-llenado se abre |
| 2 | Modificar nombre y teléfono | Campos aceptan cambios |
| 3 | Click en "Actualizar" | Mensaje de éxito |
| 4 | Verificar en lista | Cambios reflejados |

**Estado:** ⬜ PENDIENTE ✅ PASS ❌ FAIL

### Test 2.4: Eliminar Empleado
**Precondición:** Empleado sin solicitudes existe

| Paso | Acción | Resultado Esperado |
|------|--------|-------------------|
| 1 | Click en "Eliminar" | Modal de confirmación aparece |
| 2 | Confirmar eliminación | Empleado removido de la lista |
| 3 | Verificar en base de datos | Registro eliminado |

**Estado:** ⬜ PENDIENTE ✅ PASS ❌ FAIL

---

## 📝 **SECCIÓN 3: SISTEMA DE SOLICITUDES**

### Test 3.1: Crear Solicitud de Licencia (LICENSE)
**Precondición:** Logueado como empleado

**Datos de prueba:**
- Tipo: `Licencia`
- Fecha Inicio: `2024-08-20`
- Fecha Fin: `2024-08-22`
- Motivo: `Examen médico`

| Paso | Acción | Resultado Esperado |
|------|--------|-------------------|
| 1 | Ir a `/requests/new` | Formulario de solicitud se carga |
| 2 | Seleccionar "Licencia" | Campos apropiados aparecen |
| 3 | Llenar fechas y motivo | Campos aceptan entrada |
| 4 | Click en "Enviar Solicitud" | Mensaje de éxito |
| 5 | Verificar estado | Aparece como "PENDIENTE" |
| 6 | Verificar email a admin | Email enviado correctamente |

**Estado:** ⬜ PENDIENTE ✅ PASS ❌ FAIL

### Test 3.2: Crear Solicitud Personal - Medio Día
**Datos de prueba:**
- Tipo: `Día Personal`
- Fecha: `2024-08-25`
- Medio día: `Mañana`
- Motivo: `Trámite personal`

| Paso | Acción | Resultado Esperado |
|------|--------|-------------------|
| 1 | Seleccionar "Día Personal" | Opciones de turno aparecen |
| 2 | Seleccionar "Mañana" | Campo turno actualizado |
| 3 | Enviar solicitud | Solicitud creada |
| 4 | Verificar días descontados | Se descuentan 4 horas (medio día) |

**Estado:** ⬜ PENDIENTE ✅ PASS ❌ FAIL

### Test 3.3: Crear Solicitud de Horas
**Datos de prueba:**
- Tipo: `Horas`
- Fecha: `2024-08-26`
- Hora Inicio: `10:00`
- Hora Fin: `14:00`
- Motivo: `Cita médica`

| Paso | Acción | Resultado Esperado |
|------|--------|-------------------|
| 1 | Seleccionar "Horas" | Campos de hora aparecen |
| 2 | Ingresar horarios | Cálculo automático: 4 horas |
| 3 | Enviar solicitud | Solicitud creada |
| 4 | Verificar descuento | 4 horas descontadas de total |

**Estado:** ⬜ PENDIENTE ✅ PASS ❌ FAIL

### Test 3.4: Crear Solicitud Remoto - Día Completo
**Datos de prueba:**
- Tipo: `Día Remoto`
- Fecha: `2024-08-27`
- Turno: `Todo el día`
- Motivo: `Trabajo desde casa`

| Paso | Acción | Resultado Esperado |
|------|--------|-------------------|
| 1 | Seleccionar "Día Remoto" | Campos apropiados aparecen |
| 2 | Seleccionar "Todo el día" | Campo configurado |
| 3 | Enviar solicitud | Solicitud creada |
| 4 | Verificar descuento | 8 horas descontadas |

**Estado:** ⬜ PENDIENTE ✅ PASS ❌ FAIL

---

## ✅ **SECCIÓN 4: APROBACIÓN DE SOLICITUDES (ADMIN)**

### Test 4.1: Ver Lista de Solicitudes Pendientes
**Precondición:** Logueado como admin, solicitudes pendientes existen

| Paso | Acción | Resultado Esperado |
|------|--------|-------------------|
| 1 | Ir a `/admin/requests` | Lista de solicitudes se carga |
| 2 | Verificar filtros | Filtros por estado funcionan |
| 3 | Verificar información | Datos completos visibles |

**Estado:** ⬜ PENDIENTE ✅ PASS ❌ FAIL

### Test 4.2: Aprobar Solicitud
**Precondición:** Solicitud pendiente existe

| Paso | Acción | Resultado Esperado |
|------|--------|-------------------|
| 1 | Click en solicitud específica | Detalle se abre |
| 2 | Click en "Aprobar" | Modal de confirmación |
| 3 | Agregar notas (opcional) | Campo acepta texto |
| 4 | Confirmar aprobación | Estado cambia a "APROBADO" |
| 5 | Verificar email al empleado | Email de aprobación enviado |
| 6 | Verificar Google Calendar | Evento creado (si configurado) |

**Estado:** ⬜ PENDIENTE ✅ PASS ❌ FAIL

### Test 4.3: Rechazar Solicitud
**Precondición:** Solicitud pendiente existe

| Paso | Acción | Resultado Esperado |
|------|--------|-------------------|
| 1 | Click en "Rechazar" | Modal de confirmación |
| 2 | Agregar motivo del rechazo | Campo obligatorio |
| 3 | Confirmar rechazo | Estado cambia a "RECHAZADO" |
| 4 | Verificar días empleado | Días/horas restaurados |
| 5 | Verificar email | Notificación de rechazo enviada |

**Estado:** ⬜ PENDIENTE ✅ PASS ❌ FAIL

---

## 🏢 **SECCIÓN 5: GESTIÓN DE ÁREAS**

### Test 5.1: Ver Áreas Existentes
**Precondición:** Logueado como admin

| Paso | Acción | Resultado Esperado |
|------|--------|-------------------|
| 1 | Ir a `/admin/areas` | Lista de áreas se carga |
| 2 | Verificar información | Nombre y descripción visibles |
| 3 | Verificar contador empleados | Número correcto de empleados |

**Estado:** ⬜ PENDIENTE ✅ PASS ❌ FAIL

### Test 5.2: Crear Nueva Área
**Datos de prueba:**
- Nombre: `Marketing`
- Descripción: `Área de marketing y comunicaciones`

| Paso | Acción | Resultado Esperado |
|------|--------|-------------------|
| 1 | Click en "Nueva Área" | Formulario aparece |
| 2 | Llenar campos | Datos aceptados |
| 3 | Click en "Crear" | Área creada exitosamente |
| 4 | Verificar en lista | Nueva área aparece |

**Estado:** ⬜ PENDIENTE ✅ PASS ❌ FAIL

---

## 📊 **SECCIÓN 6: DASHBOARD Y ESTADÍSTICAS**

### Test 6.1: Dashboard Administrativo
**Precondición:** Logueado como admin, datos existen

| Paso | Acción | Resultado Esperado |
|------|--------|-------------------|
| 1 | Ir a `/dashboard` | Dashboard se carga completamente |
| 2 | Verificar métricas generales | Números correctos mostrados |
| 3 | Verificar gráficos | Gráficos se renderizan |
| 4 | Verificar solicitudes recientes | Lista actualizada |
| 5 | Verificar enlaces rápidos | Navegación funciona |

**Estado:** ⬜ PENDIENTE ✅ PASS ❌ FAIL

### Test 6.2: Dashboard de Empleado
**Precondición:** Logueado como empleado

| Paso | Acción | Resultado Esperado |
|------|--------|-------------------|
| 1 | Acceder a dashboard | Información personal visible |
| 2 | Verificar días disponibles | Cálculos correctos |
| 3 | Verificar mis solicitudes | Lista de solicitudes propias |
| 4 | Verificar acciones rápidas | Botones funcionan |

**Estado:** ⬜ PENDIENTE ✅ PASS ❌ FAIL

---

## 📧 **SECCIÓN 7: NOTIFICACIONES POR EMAIL**

### Test 7.1: Email de Nueva Solicitud
**Precondición:** SMTP configurado correctamente

| Paso | Acción | Resultado Esperado |
|------|--------|-------------------|
| 1 | Empleado crea solicitud | Email enviado a admin |
| 2 | Verificar contenido | Información completa incluida |
| 3 | Verificar formato | Email bien formateado |
| 4 | Verificar destinatario | Admin correcto |

**Estado:** ⬜ PENDIENTE ✅ PASS ❌ FAIL

### Test 7.2: Email de Aprobación
**Precondición:** Admin aprueba solicitud

| Paso | Acción | Resultado Esperado |
|------|--------|-------------------|
| 1 | Admin aprueba solicitud | Email enviado a empleado |
| 2 | Verificar contenido | Detalles de aprobación |
| 3 | Verificar formato | Email profesional |

**Estado:** ⬜ PENDIENTE ✅ PASS ❌ FAIL

### Test 7.3: Email de Rechazo
**Precondición:** Admin rechaza solicitud

| Paso | Acción | Resultado Esperado |
|------|--------|-------------------|
| 1 | Admin rechaza con motivo | Email enviado a empleado |
| 2 | Verificar motivo incluido | Razón del rechazo visible |

**Estado:** ⬜ PENDIENTE ✅ PASS ❌ FAIL

---

## 📅 **SECCIÓN 8: INTEGRACIÓN GOOGLE CALENDAR**

### Test 8.1: Creación de Evento en Calendario
**Precondición:** Google Calendar configurado

| Paso | Acción | Resultado Esperado |
|------|--------|-------------------|
| 1 | Admin aprueba solicitud | Evento creado en calendario |
| 2 | Verificar título | "Nombre Empleado + Tipo Solicitud" |
| 3 | Verificar fechas | Correctas según solicitud |
| 4 | Verificar calendario | Evento en calendario SGN |

**Estado:** ⬜ PENDIENTE ✅ PASS ❌ FAIL

---

## 🔒 **SECCIÓN 9: PRUEBAS DE SEGURIDAD**

### Test 9.1: Acceso sin Autorización
| Paso | Acción | Resultado Esperado |
|------|--------|-------------------|
| 1 | Acceder a `/admin` sin login | Redirección a login |
| 2 | Empleado accede a `/admin/employees` | Error 403 o redirección |
| 3 | Modificar solicitud de otro empleado | Acceso denegado |

**Estado:** ⬜ PENDIENTE ✅ PASS ❌ FAIL

### Test 9.2: Validación de Datos
| Paso | Acción | Resultado Esperado |
|------|--------|-------------------|
| 1 | Enviar formulario con campos vacíos | Errores de validación |
| 2 | Ingresar email inválido | Error de formato |
| 3 | Fechas inconsistentes | Error de validación |

**Estado:** ⬜ PENDIENTE ✅ PASS ❌ FAIL

---

## ⚡ **SECCIÓN 10: PRUEBAS DE RENDIMIENTO**

### Test 10.1: Carga de Páginas
| Página | Tiempo Esperado | Resultado |
|--------|----------------|-----------|
| `/login` | < 2 segundos | ⬜ |
| `/dashboard` | < 3 segundos | ⬜ |
| `/admin/employees` | < 3 segundos | ⬜ |
| `/requests` | < 2 segundos | ⬜ |

**Estado:** ⬜ PENDIENTE ✅ PASS ❌ FAIL

---

## 📱 **SECCIÓN 11: PRUEBAS DE RESPONSIVIDAD**

### Test 11.1: Diferentes Dispositivos
| Dispositivo | Resolución | Estado |
|-------------|------------|--------|
| Desktop | 1920x1080 | ⬜ |
| Tablet | 768x1024 | ⬜ |
| Mobile | 375x667 | ⬜ |

---

## 🛠️ **DATOS DE PRUEBA**

### Usuarios de Prueba:
```
Administrador:
- Email: john@doe.com
- Password: johndoe123

Empleados:
- maria@company.com / 123456
- carlos@company.com / 123456
- ana@company.com / 123456
- pedro@company.com / 123456
```

### Áreas de Prueba:
- Desarrollo
- Recursos Humanos  
- Administración
- Ventas

---

## 📋 **CHECKLIST DE EJECUCIÓN**

### Antes de Ejecutar las Pruebas:
- [ ] Base de datos con datos de prueba poblada
- [ ] Variables de entorno configuradas
- [ ] SMTP configurado para emails
- [ ] Google Calendar configurado (opcional)
- [ ] Aplicación ejecutándose sin errores

### Durante la Ejecución:
- [ ] Documentar cada resultado (PASS/FAIL)
- [ ] Tomar screenshots de errores
- [ ] Registrar tiempos de respuesta
- [ ] Verificar logs de errores

### Después de las Pruebas:
- [ ] Compilar reporte de resultados
- [ ] Crear tickets para errores encontrados
- [ ] Documentar issues críticos
- [ ] Planificar correcciones

---

## 📊 **REPORTE DE RESULTADOS**

### Resumen:
- **Total de Casos de Prueba:** 25
- **Ejecutados:** __ / 25
- **Exitosos:** __ / 25  
- **Fallidos:** __ / 25
- **Pendientes:** __ / 25

### Críticos:
- [ ] Autenticación funcional
- [ ] Creación de solicitudes funcional  
- [ ] Aprobación/rechazo funcional
- [ ] Emails enviándose correctamente

### Estado General: 
⬜ **PENDIENTE** ✅ **APROBADO** ❌ **REQUIERE CORRECCIONES**

---

## 📞 **Contacto para Reportar Issues**

Si encuentras errores durante las pruebas:
1. Documenta el error con screenshots
2. Incluye pasos para reproducir
3. Especifica navegador y versión
4. Reporta en el sistema de gestión de proyectos

---

**Versión del Plan:** 1.0  
**Fecha de Creación:** Agosto 2024  
**Próxima Revisión:** Después de cada actualización mayor

**¡Importante!** Este plan debe ejecutarse antes de cualquier despliegue a producción.
