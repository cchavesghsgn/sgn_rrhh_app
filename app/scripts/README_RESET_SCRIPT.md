
# Script de Reinicio de Datos - SGN RRHH

## 📋 Descripción

Este script reinicia completamente los datos de solicitudes de la aplicación SGN RRHH, eliminando todas las solicitudes existentes y restaurando los días/horas disponibles de todos los empleados a su estado inicial.

## ⚠️ ADVERTENCIAS IMPORTANTES

- **OPERACIÓN IRREVERSIBLE**: Una vez ejecutado, no se pueden recuperar las solicitudes eliminadas
- **AFECTA TODA LA BASE DE DATOS**: Elimina todas las solicitudes de todos los empleados
- **USO RECOMENDADO**: Solo para entornos de desarrollo o cuando necesites limpiar datos de prueba

## 🛠️ Funcionalidades

### ✅ Lo que HACE el script:

1. **Elimina todas las solicitudes** de la tabla `leave_requests`
2. **Elimina archivos adjuntos** tanto de la base de datos como del sistema de archivos
3. **Restaura días/horas disponibles** de todos los empleados:
   - `vacationDays` → `totalVacationDays`
   - `personalHours` → `totalPersonalHours`
   - `remoteHours` → `totalRemoteHours`
   - `availableHours` → `totalAvailableHours`
4. **Actualiza timestamps** (`updatedAt`) de todos los empleados

### ❌ Lo que NO HACE el script:

- No elimina empleados
- No elimina usuarios
- No modifica áreas de trabajo
- No afecta configuraciones de la aplicación
- No modifica los valores "totales" asignados (`totalVacationDays`, etc.)

## 🚀 Cómo usar el script

### Prerequisitos:
```bash
# Asegúrate de estar en el directorio correcto
cd /home/ubuntu/sgn_rrhh_app/app

# Verifica que las dependencias estén instaladas
yarn install
```

### Ejecución:
```bash
# Ejecutar el script
yarn tsx scripts/reset-requests-data.ts
```

### Ejemplo de salida esperada:
```
🔄 SGN RRHH - Script de Reinicio de Datos
=========================================

⚠️  ADVERTENCIA IMPORTANTE ⚠️
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Este script realizará las siguientes operaciones IRREVERSIBLES:
• Eliminará TODAS las solicitudes de permisos
• Eliminará TODOS los archivos adjuntos  
• Restaurará los días/horas disponibles de TODOS los empleados
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🏁 Iniciando proceso en 3 segundos...

🚀 Iniciando proceso de reinicio de datos...

📊 Consultando estado actual de la base de datos...
   • Solicitudes existentes: 15
   • Archivos adjuntos existentes: 3
   • Total empleados: 8

🗂️  Eliminando archivos adjuntos físicos...
   ✅ Eliminado: documento_1.pdf
   ✅ Eliminado: imagen_2.jpg
   📁 Limpieza de archivos completada

🗑️  Eliminando todas las solicitudes...
   ✅ Eliminadas 15 solicitudes

🔄 Restaurando días/horas disponibles para todos los empleados...
   ✅ Restaurados los días/horas de todos los empleados

📋 RESUMEN DE OPERACIONES COMPLETADAS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Solicitudes eliminadas: 15
✅ Archivos adjuntos eliminados: 3
✅ Empleados actualizados: 8
✅ Días de vacaciones: Restaurados al total asignado
✅ Horas personales: Restauradas al total asignado
✅ Horas remotas: Restauradas al total asignado
✅ Horas particulares: Restauradas al total asignado
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎉 ¡Reinicio de datos completado exitosamente!
💡 Todos los empleados tienen ahora sus días/horas disponibles restaurados.
💡 Todas las solicitudes anteriores han sido eliminadas.

🔌 Conexión a la base de datos cerrada.
```

## 🔧 Detalles técnicos

### Operaciones realizadas:

1. **Consulta inicial**: Cuenta registros existentes para estadísticas
2. **Limpieza de archivos**: Elimina archivos del directorio `uploads/`
3. **Eliminación de solicitudes**: Usa `deleteMany()` en la tabla `leave_requests`
4. **Restauración de disponibilidades**: Usa SQL crudo para actualizar campos referenciando otros campos de la misma tabla
5. **Actualización de timestamps**: Marca todos los empleados como actualizados

### Consulta SQL utilizada:
```sql
UPDATE employees 
SET 
  "vacationDays" = "totalVacationDays",
  "personalHours" = "totalPersonalHours", 
  "remoteHours" = "totalRemoteHours",
  "availableHours" = "totalAvailableHours",
  "updatedAt" = NOW()
```

## 🎯 Casos de uso recomendados

### ✅ Cuándo usarlo:
- Después de hacer pruebas extensivas en desarrollo
- Al finalizar demostraciones con datos de prueba
- Para limpiar datos antes de poner en producción
- Al inicio de cada ciclo de testing

### ❌ Cuándo NO usarlo:
- En producción con datos reales
- Si no estás seguro de querer eliminar las solicitudes
- Sin hacer backup previo en entornos críticos

## 🛡️ Medidas de seguridad

- **Desconexión automática**: Cierra la conexión a la base de datos al finalizar
- **Manejo de errores**: Reporta errores detallados y sale limpiamente
- **Advertencias claras**: Muestra múltiples advertencias antes de ejecutar
- **Estadísticas**: Muestra qué se va a eliminar antes de hacerlo
- **Retraso de confirmación**: 3 segundos de pausa para cancelar si es necesario

## 📞 Soporte

Si encuentras algún problema con el script:

1. **Revisa los logs** de error detallados
2. **Verifica la conexión** a la base de datos
3. **Comprueba permisos** de archivo en el directorio `uploads/`
4. **Consulta el estado** de la base de datos manualmente si el script falla a medias

---

**Recuerda**: Este script es una herramienta poderosa. Úsala con responsabilidad. ⚡
