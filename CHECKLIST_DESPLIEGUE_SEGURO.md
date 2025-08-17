
# ✅ Checklist de Despliegue Seguro - SGN RRHH App

**🎯 OBJETIVO**: Desplegar actualizaciones SIN PERDER DATOS de producción

---

## 🔍 **PRE-DESPLIEGUE** (5 minutos)

### Validación Técnica:
- [ ] ✅ **Código compila**: `yarn build` sin errores
- [ ] ✅ **Variables válidas**: `yarn db:validate` exitoso  
- [ ] ✅ **Pruebas locales**: `yarn dev` funciona correctamente
- [ ] ✅ **Git limpio**: `git status` sin cambios pendientes

### Validación de Seguridad:
- [ ] ✅ **Script seguro**: `amplify.yml` usa `db:seed-production`
- [ ] ✅ **No usa scripts destructivos**: Verificar que NO usa `seed.ts` original
- [ ] ✅ **NODE_ENV=production**: Configurado en AWS Amplify  
- [ ] ✅ **DATABASE_URL**: Apunta a producción (no desarrollo)

### Preparación:
- [ ] ✅ **Equipo notificado**: Avisar sobre deploy en curso
- [ ] ✅ **Horario apropiado**: Fuera de horas pico si es posible
- [ ] ✅ **AWS Console abierto**: Para monitorear el proceso
- [ ] ✅ **Tiempo reservado**: Al menos 30 minutos para verificación

---

## 🚀 **DURANTE EL DESPLIEGUE** (10-15 minutos)

### Iniciar Deploy:
- [ ] ✅ **Git push**: `git push origin main` ejecutado
- [ ] ✅ **AWS detecta**: Build iniciado automáticamente en Amplify Console
- [ ] ✅ **Monitoreo activo**: Observando logs en tiempo real

### Fases del Deploy (AWS Amplify):
- [ ] ✅ **Provision** ⏱️ ~2 min - Preparando entorno
- [ ] ✅ **Build** ⏱️ ~5-8 min - Compilando + validaciones
- [ ] ✅ **Deploy** ⏱️ ~2 min - Subiendo nueva versión  
- [ ] ✅ **Verify** ⏱️ ~1 min - Verificaciones finales

### Señales de Éxito a Buscar:
- [ ] ✅ **"🔍 Validating environment variables..."** - Variables OK
- [ ] ✅ **"✅ Validación completada exitosamente"** - Config válida
- [ ] ✅ **"🔄 Running safe database migrations..."** - BD actualizada
- [ ] ✅ **"🌱 Setting up initial data (safe for production)..."** - Seed seguro
- [ ] ✅ **"✅ No es necesario ejecutar seed inicial"** - Datos preservados

### 🚨 Señales de Alarma:
- [ ] ⚠️ **Errores rojos** en logs
- [ ] ⚠️ **"Variables obligatorias faltantes"**
- [ ] ⚠️ **Build toma >10 minutos**
- [ ] ⚠️ **Errores de conexión a BD**

---

## 🔍 **POST-DESPLIEGUE** (15-20 minutos)

### Verificación Inmediata (5 minutos):
- [ ] ✅ **App carga**: Acceder a https://tu-dominio.amplifyapp.com
- [ ] ✅ **Sin errores**: Página principal carga sin errores  
- [ ] ✅ **Login funciona**: Probar con admin existente
- [ ] ✅ **Dashboard visible**: Pantalla principal accesible

### Verificación de Datos (10 minutos):
- [ ] ✅ **Empleados preservados**: Lista completa visible
- [ ] ✅ **Áreas intactas**: Todas las áreas existentes
- [ ] ✅ **Solicitudes históricas**: Requests anteriores visibles
- [ ] ✅ **Usuarios pueden loguear**: Credenciales existentes funcionan

### Verificación Funcional (10 minutos):
- [ ] ✅ **Crear empleado**: Formulario funciona
- [ ] ✅ **Editar datos**: Modificaciones se guardan
- [ ] ✅ **Nueva solicitud**: Crear request como empleado
- [ ] ✅ **Aprobar solicitud**: Como admin
- [ ] ✅ **Reportes actualizados**: Nueva funcionalidad operativa

### Verificación de Performance:
- [ ] ✅ **Carga rápida**: <3 segundos página principal
- [ ] ✅ **Responsive**: Probar en móvil/tablet  
- [ ] ✅ **Sin errores console**: F12 → Console sin errores rojos
- [ ] ✅ **Emails funcionan**: Si hay notificaciones configuradas

---

## 📊 **MÉTRICAS DE ÉXITO**

### Tiempos Esperados:
- **Deploy total**: 10-15 minutos
- **Verificación**: 15-20 minutos  
- **Total proceso**: ~30 minutos

### Indicadores Críticos:
- [ ] ✅ **0 errores** en build logs
- [ ] ✅ **0 pérdida** de datos existentes
- [ ] ✅ **100% funcionalidad** preservada
- [ ] ✅ **Nuevas features** operativas
- [ ] ✅ **0 usuarios reportan** problemas

---

## 🆘 **PLAN DE EMERGENCIA**

### Si Build Falla:
1. [ ] 🔧 **Revisar logs** específicos en AWS Console
2. [ ] 🔧 **Verificar variables** de entorno
3. [ ] 🔧 **Probar `yarn db:validate`** localmente  
4. [ ] 🔧 **Corregir error** y nuevo push
5. [ ] 🔧 **NO tocar BD** de producción directamente

### Si App No Carga:
1. [ ] 🛑 **Rollback inmediato** - AWS Amplify → Versión anterior
2. [ ] 🛑 **Verificar disponibilidad** en versión previa
3. [ ] 🛑 **Investigar problema** sin prisa
4. [ ] 🛑 **Corregir y re-deployar** cuando esté listo

### Si Datos Perdidos (CRÍTICO):
1. [ ] 🆘 **STOP** - Detener todos los procesos
2. [ ] 🆘 **NO ejecutar** más scripts  
3. [ ] 🆘 **Verificar backups** en `/app/backups/`
4. [ ] 🆘 **Rollback completo** a versión anterior
5. [ ] 🆘 **Contactar soporte** si es necesario

---

## 📝 **REGISTRO DE DEPLOYMENT**

**📅 Fecha**: _______________  
**🕐 Inicio**: ___________  
**🕐 Fin**: _____________  
**📦 Versión**: ___________

**🔄 Cambios Incluidos**:
- [ ] Nueva funcionalidad: ________________
- [ ] Corrección de bugs: _________________  
- [ ] Mejoras de UI: ____________________
- [ ] Optimizaciones: ___________________

**🚨 Problemas Encontrados**:
- [ ] ✅ Ninguno  
- [ ] ⚠️ Menor: ________________________
- [ ] ❌ Crítico: ______________________

**🔧 Acciones Correctivas**:
- [ ] ✅ Ninguna necesaria
- [ ] 🔧 Aplicada: ______________________

**👤 Verificado por**: _______________

**📊 Estado Final**:  
- [ ] ✅ **EXITOSO** - Todo funcionando perfectamente
- [ ] ⚠️ **CON OBSERVACIONES** - Funciona con notas menores  
- [ ] ❌ **FALLIDO** - Requiere rollback y corrección

**📋 Observaciones Adicionales**:
_________________________________________________
_________________________________________________

---

## 💡 **TIPS PARA DEPLOYMENTS PERFECTOS**

### ✅ **Buenas Prácticas**:
- **🕐 Timing**: Deployar en horarios de bajo tráfico
- **📢 Comunicación**: Avisar al equipo antes y después
- **👀 Monitoreo**: Vigilar activamente los primeros 30 min  
- **📝 Documentación**: Registrar siempre cambios y resultados
- **🧘 Paciencia**: No interrumpir procesos automáticos

### ⚠️ **Señales de Alerta**:
- Build >10 minutos
- Errores de conexión BD  
- Performance degradada >50%
- Usuarios reportan problemas inmediatos
- Funcionalidades críticas no disponibles

### 🚫 **NUNCA Hacer**:
- Deployar sin probar localmente
- Saltarse validaciones para "ahorrar tiempo"  
- Modificar BD producción directamente
- Deployar viernes en la tarde 😅
- Ejecutar scripts destructivos en producción

---

## 🎯 **OBJETIVO CUMPLIDO**

Al completar este checklist tienes la **GARANTÍA** de que:

✅ **Datos de producción están SEGUROS**  
✅ **Nueva funcionalidad está DISPONIBLE**  
✅ **Usuarios pueden continuar trabajando NORMALMENTE**  
✅ **Aplicación está OPTIMIZADA y ACTUALIZADA**

---

**🛡️ Recordatorio Final**: Este checklist es tu **SEGURO DE VIDA** para deployments. Úsalo SIEMPRE, sin excepciones.

**🌟 Con este proceso, puedes deployar con total confianza.**

---

*Template v2.0 - Agosto 2024*  
*Última actualización: Implementación exitosa verificada*
