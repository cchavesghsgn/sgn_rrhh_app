
# ⚡ Checklist de Pruebas Rápidas - Sistema RRHH

## 🎯 **Uso**
Esta es una versión condensada del plan de pruebas para verificaciones rápidas antes de deployments o después de cambios menores.

---

## ⚡ **PRUEBAS RÁPIDAS (15 minutos)**

### 🔐 **Autenticación (3 min)**
- [ ] Login admin: `john@doe.com` / `johndoe123` → Dashboard admin
- [ ] Login empleado: `maria@company.com` / `123456` → Dashboard empleado  
- [ ] Logout → Redirección a login

### 👥 **Empleados (3 min)**
- [ ] Ver lista empleados en `/admin/employees`
- [ ] Crear empleado de prueba con datos mínimos
- [ ] Editar empleado existente (cambiar nombre)
- [ ] Eliminar empleado creado

### 📝 **Solicitudes (5 min)**
- [ ] Crear solicitud de licencia (empleado)
- [ ] Crear solicitud personal medio día (empleado)
- [ ] Aprobar solicitud (admin)
- [ ] Rechazar solicitud (admin)

### 📊 **Dashboard (2 min)**
- [ ] Dashboard admin carga correctamente
- [ ] Dashboard empleado carga correctamente
- [ ] Métricas se muestran sin errores

### 📧 **Funcionalidades Críticas (2 min)**
- [ ] Email de nueva solicitud se envía
- [ ] Email de aprobación se envía
- [ ] Calendario Google crea evento (si configurado)

---

## 🚨 **CRITERIOS DE RECHAZO**

Si alguna de estas falla, **NO DESPLEGAR**:
- ❌ No se puede hacer login
- ❌ Error 500 en cualquier página principal
- ❌ No se pueden crear solicitudes
- ❌ No se pueden aprobar/rechazar solicitudes
- ❌ Datos de empleado no se guardan

---

## 📊 **Resultado**

**Fecha:** ___________  
**Ejecutado por:** ___________  
**Estado:** ⬜ APROBADO ❌ RECHAZADO  
**Notas:** ___________

---

## 🔄 **Para Pruebas Completas**
Ver archivo: `PLAN_DE_PRUEBAS.md`
