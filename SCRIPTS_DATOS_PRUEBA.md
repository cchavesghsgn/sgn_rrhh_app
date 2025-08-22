
# 🧪 Scripts de Datos de Prueba - Sistema RRHH

## 🎯 **Propósito**
Scripts SQL para crear datos de prueba consistentes para validar el sistema.

---

## 🏗️ **SCRIPT 1: Limpiar Datos de Prueba**

```sql
-- ⚠️ CUIDADO: Esto eliminará TODOS los datos de prueba
-- Solo ejecutar en entornos de desarrollo/testing

-- Eliminar solicitudes de prueba
DELETE FROM leave_requests WHERE employee_id IN (
  SELECT id FROM employees WHERE dni LIKE 'TEST%'
);

-- Eliminar empleados de prueba
DELETE FROM employees WHERE dni LIKE 'TEST%';

-- Eliminar usuarios de prueba  
DELETE FROM users WHERE email LIKE '%test.com' AND email != 'john@doe.com';

-- Eliminar áreas de prueba
DELETE FROM areas WHERE name LIKE 'Test%';
```

---

## 🏗️ **SCRIPT 2: Crear Datos de Prueba Base**

```sql
-- Crear áreas de prueba
INSERT INTO areas (id, name, description) VALUES
('test-area-1', 'Test Desarrollo', 'Área de desarrollo para pruebas'),
('test-area-2', 'Test Marketing', 'Área de marketing para pruebas'),
('test-area-3', 'Test RRHH', 'Área de RRHH para pruebas')
ON CONFLICT (name) DO NOTHING;

-- Crear usuarios empleados de prueba
INSERT INTO users (id, email, password, name, role) VALUES
('test-user-1', 'maria@test.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/lewdBzThQ4KpB4Zrq', 'María García', 'EMPLOYEE'),
('test-user-2', 'carlos@test.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/lewdBzThQ4KpB4Zrq', 'Carlos López', 'EMPLOYEE'),
('test-user-3', 'ana@test.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/lewdBzThQ4KpB4Zrq', 'Ana Martínez', 'EMPLOYEE'),
('test-user-4', 'pedro@test.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/lewdBzThQ4KpB4Zrq', 'Pedro Rodríguez', 'EMPLOYEE')
ON CONFLICT (email) DO NOTHING;

-- Crear empleados de prueba  
INSERT INTO employees (id, user_id, dni, first_name, last_name, birth_date, hire_date, area_id, position, phone) VALUES
('test-emp-1', 'test-user-1', 'TEST11111111', 'María', 'García', '1990-05-15', '2023-01-15', 'test-area-1', 'Developer', '+54 11 1111-1111'),
('test-emp-2', 'test-user-2', 'TEST22222222', 'Carlos', 'López', '1988-08-22', '2022-06-10', 'test-area-2', 'Marketing Manager', '+54 11 2222-2222'),
('test-emp-3', 'test-user-3', 'TEST33333333', 'Ana', 'Martínez', '1992-12-03', '2023-03-20', 'test-area-3', 'HR Specialist', '+54 11 3333-3333'),
('test-emp-4', 'test-user-4', 'TEST44444444', 'Pedro', 'Rodríguez', '1985-02-28', '2021-09-01', 'test-area-1', 'Senior Developer', '+54 11 4444-4444')
ON CONFLICT (dni) DO NOTHING;
```

---

## 🏗️ **SCRIPT 3: Crear Solicitudes de Prueba**

```sql
-- Solicitudes en diferentes estados para pruebas

-- Solicitud de licencia PENDIENTE
INSERT INTO leave_requests (id, employee_id, type, start_date, end_date, reason, status) VALUES
('test-req-1', 'test-emp-1', 'LICENSE', '2024-08-20', '2024-08-22', 'Examen médico de rutina', 'PENDING');

-- Solicitud personal APROBADA (medio día mañana)
INSERT INTO leave_requests (id, employee_id, type, start_date, end_date, is_half_day, shift, reason, status) VALUES
('test-req-2', 'test-emp-2', 'PERSONAL', '2024-08-25', '2024-08-25', true, 'MORNING', 'Trámite personal', 'APPROVED');

-- Solicitud remoto RECHAZADA (día completo)
INSERT INTO leave_requests (id, employee_id, type, start_date, end_date, shift, reason, status, admin_notes) VALUES
('test-req-3', 'test-emp-3', 'REMOTE', '2024-08-28', '2024-08-28', 'FULL_DAY', 'Trabajo desde casa', 'REJECTED', 'No se puede trabajar remoto ese día debido a reunión importante');

-- Solicitud de horas PENDIENTE
INSERT INTO leave_requests (id, employee_id, type, start_date, end_date, hours, start_time, end_time, reason, status) VALUES
('test-req-4', 'test-emp-4', 'HOURS', '2024-08-30', '2024-08-30', 4, '10:00', '14:00', 'Cita médica especialista', 'PENDING');

-- Solicitud personal día completo APROBADA
INSERT INTO leave_requests (id, employee_id, type, start_date, end_date, shift, reason, status) VALUES
('test-req-5', 'test-emp-1', 'PERSONAL', '2024-09-05', '2024-09-05', 'FULL_DAY', 'Día personal', 'APPROVED');
```

---

## 🏗️ **SCRIPT 4: Actualizar Días Disponibles (Simular Uso)**

```sql
-- Simular que algunos empleados ya usaron días/horas

-- María García: usó 1 día personal completo (8 horas)
UPDATE employees SET personal_hours = personal_hours - 8 WHERE id = 'test-emp-1';

-- Carlos López: usó medio día personal (4 horas)  
UPDATE employees SET personal_hours = personal_hours - 4 WHERE id = 'test-emp-2';

-- Pedro Rodríguez: usó 4 horas
UPDATE employees SET available_hours = available_hours - 4 WHERE id = 'test-emp-4';
```

---

## 🏗️ **SCRIPT 5: Verificar Datos de Prueba**

```sql
-- Verificar que los datos se crearon correctamente

-- Contar usuarios de prueba
SELECT COUNT(*) as usuarios_prueba FROM users WHERE email LIKE '%test.com';

-- Contar empleados de prueba
SELECT COUNT(*) as empleados_prueba FROM employees WHERE dni LIKE 'TEST%';

-- Contar solicitudes de prueba
SELECT COUNT(*) as solicitudes_prueba FROM leave_requests WHERE id LIKE 'test-req-%';

-- Ver resumen de solicitudes por estado
SELECT status, COUNT(*) as cantidad FROM leave_requests WHERE id LIKE 'test-req-%' GROUP BY status;

-- Ver días disponibles de empleados de prueba
SELECT 
  e.first_name, 
  e.last_name,
  e.vacation_days,
  e.personal_hours,
  e.remote_hours,
  e.available_hours
FROM employees e WHERE e.dni LIKE 'TEST%';
```

---

## 🧹 **SCRIPT DE LIMPIEZA COMPLETA**

```bash
#!/bin/bash
# Script para limpiar y recrear datos de prueba

echo "🧹 Limpiando datos de prueba anteriores..."

# Ejecutar script de limpieza
psql $DATABASE_URL -c "
DELETE FROM leave_requests WHERE employee_id IN (SELECT id FROM employees WHERE dni LIKE 'TEST%');
DELETE FROM employees WHERE dni LIKE 'TEST%';
DELETE FROM users WHERE email LIKE '%test.com' AND email != 'john@doe.com';
DELETE FROM areas WHERE name LIKE 'Test%';
"

echo "🏗️ Creando nuevos datos de prueba..."

# Ejecutar scripts de creación
# (aquí irían los INSERTs de arriba)

echo "✅ Datos de prueba recreados exitosamente"
```

---

## 💡 **NOTAS IMPORTANTES**

### Contraseñas:
- **Todas las contraseñas de prueba:** `123456`
- **Hash bcrypt:** `$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/lewdBzThQ4KpB4Zrq`

### Identificación de Datos de Prueba:
- **DNI:** Empiezan con "TEST"
- **Emails:** Terminan en "@test.com"  
- **IDs:** Empiezan con "test-"

### Uso Recomendado:
1. **Antes de pruebas:** Ejecutar scripts de creación
2. **Durante pruebas:** Usar estos datos como base
3. **Después de pruebas:** Ejecutar script de limpieza

---

## 🚀 **Ejecución Rápida**

```bash
# Desde tu directorio del proyecto
cd /ruta/a/tu/proyecto

# Ejecutar seed completo (incluye datos de prueba)
npx prisma db seed

# O ejecutar scripts específicos
psql $DATABASE_URL -f scripts_datos_prueba.sql
```

---

**¿Necesitas más datos de prueba específicos?** 
Modifica estos scripts según tus necesidades de testing.
