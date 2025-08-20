

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';
import { 
  User,
  Mail,
  Phone,
  Building2,
  Calendar,
  IdCard,
  Briefcase,
  Eye,
  EyeOff,
  ArrowLeft,
  Loader2,
  Upload,
  Camera,
  Clock
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import toast from 'react-hot-toast';

interface Area {
  id: string;
  name: string;
  description?: string;
}

interface NewEmployeeFormData {
  email: string;
  password: string;
  confirmPassword: string;
  dni: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  hireDate: string;
  areaId: string;
  position: string;
  phone: string;
  role: 'ADMIN' | 'EMPLOYEE';
  profileImage?: File | null;
  vacationDays: string;
  personalHours: string;
  remoteHours: string;
  availableHours: string;
}

export default function NewEmployeeForm() {
  const router = useRouter();
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [formData, setFormData] = useState<NewEmployeeFormData>({
    email: '',
    password: '',
    confirmPassword: '',
    dni: '',
    firstName: '',
    lastName: '',
    birthDate: '',
    hireDate: '',
    areaId: '',
    position: '',
    phone: '',
    role: 'EMPLOYEE',
    profileImage: null,
    vacationDays: '20',
    personalHours: '96',
    remoteHours: '96',
    availableHours: '16'
  });
  const [errors, setErrors] = useState<Partial<NewEmployeeFormData>>({});

  useEffect(() => {
    const fetchAreas = async () => {
      try {
        const response = await fetch('/api/areas');
        if (response.ok) {
          const data = await response.json();
          setAreas(data);
        }
      } catch (error) {
        console.error('Error fetching areas:', error);
        toast.error('Error al cargar las áreas');
      }
    };

    fetchAreas();
  }, []);

  const validateForm = () => {
    const newErrors: Partial<NewEmployeeFormData> = {};

    if (!formData.email) {
      newErrors.email = 'El email es requerido';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'El email no es válido';
    }

    if (!formData.password) {
      newErrors.password = 'La contraseña es requerida';
    } else if (formData.password.length < 6) {
      newErrors.password = 'La contraseña debe tener al menos 6 caracteres';
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Confirma la contraseña';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Las contraseñas no coinciden';
    }

    if (!formData.dni) {
      newErrors.dni = 'El DNI es requerido';
    } else if (!/^\d{7,8}$/.test(formData.dni)) {
      newErrors.dni = 'El DNI debe tener 7 u 8 dígitos';
    }

    if (!formData.firstName) {
      newErrors.firstName = 'El nombre es requerido';
    }

    if (!formData.lastName) {
      newErrors.lastName = 'El apellido es requerido';
    }

    if (!formData.birthDate) {
      newErrors.birthDate = 'La fecha de nacimiento es requerida';
    }

    if (!formData.hireDate) {
      newErrors.hireDate = 'La fecha de ingreso es requerida';
    }

    if (!formData.areaId) {
      newErrors.areaId = 'El área es requerida';
    }

    if (!formData.position) {
      newErrors.position = 'El puesto es requerido';
    }

    if (!formData.vacationDays) {
      newErrors.vacationDays = 'Los días de vacaciones son requeridos';
    } else if (isNaN(Number(formData.vacationDays)) || Number(formData.vacationDays) < 0) {
      newErrors.vacationDays = 'Debe ser un número válido';
    }

    if (!formData.personalHours) {
      newErrors.personalHours = 'Las horas particulares son requeridas';
    } else if (isNaN(Number(formData.personalHours)) || Number(formData.personalHours) < 0) {
      newErrors.personalHours = 'Debe ser un número válido';
    }

    if (!formData.remoteHours) {
      newErrors.remoteHours = 'Las horas remotas son requeridas';
    } else if (isNaN(Number(formData.remoteHours)) || Number(formData.remoteHours) < 0) {
      newErrors.remoteHours = 'Debe ser un número válido';
    }

    if (!formData.availableHours) {
      newErrors.availableHours = 'Las horas disponibles son requeridas';
    } else if (isNaN(Number(formData.availableHours)) || Number(formData.availableHours) < 0) {
      newErrors.availableHours = 'Debe ser un número válido';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field: keyof NewEmployeeFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast.error('Por favor selecciona una imagen válida');
        return;
      }
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('La imagen no debe superar los 5MB');
        return;
      }
      
      setFormData(prev => ({ ...prev, profileImage: file }));
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      toast.error('Por favor, completa todos los campos correctamente');
      return;
    }

    setLoading(true);

    try {
      let response: Response;
      
      // Use FormData if image is present, otherwise JSON
      if (formData.profileImage) {
        const submitData = new FormData();
        
        // Add only the necessary form fields (exclude confirmPassword and null values)
        const fieldsToInclude = ['email', 'password', 'dni', 'firstName', 'lastName', 'birthDate', 'hireDate', 'areaId', 'position', 'phone', 'role', 'vacationDays', 'personalHours', 'remoteHours', 'availableHours'];
        
        fieldsToInclude.forEach((field) => {
          const value = formData[field as keyof NewEmployeeFormData];
          if (value !== null && value !== '' && value !== undefined) {
            submitData.append(field, value as string);
          }
        });

        // Add the profile image
        if (formData.profileImage) {
          submitData.append('profileImage', formData.profileImage);
        }

        response = await fetch('/api/employees', {
          method: 'POST',
          body: submitData,
        });
      } else {
        // Use JSON when no image
        const submitData = {
          email: formData.email,
          password: formData.password,
          dni: formData.dni,
          firstName: formData.firstName,
          lastName: formData.lastName,
          birthDate: formData.birthDate,
          hireDate: formData.hireDate,
          areaId: formData.areaId,
          position: formData.position,
          phone: formData.phone,
          role: formData.role,
          vacationDays: Number(formData.vacationDays),
          personalHours: Number(formData.personalHours),
          remoteHours: Number(formData.remoteHours),
          availableHours: Number(formData.availableHours)
        };

        response = await fetch('/api/employees', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(submitData),
        });
      }

      if (response.ok) {
        toast.success('Empleado creado exitosamente');
        router.push('/admin/employees');
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Error al crear el empleado');
      }
    } catch (error) {
      console.error('Error creating employee:', error);
      toast.error('Error al crear el empleado');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="sgn-card">
      <CardHeader>
        <div className="flex items-center gap-4">
          <Link href="/admin/employees">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver
            </Button>
          </Link>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Información del Empleado
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Datos de acceso */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-sgn-dark border-b pb-2">
                Datos de Acceso
              </h3>
              
              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Email *
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  placeholder="empleado@sgn.com"
                  className={errors.email ? 'border-red-500' : ''}
                />
                {errors.email && <p className="text-sm text-red-500">{errors.email}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Contraseña *</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => handleInputChange('password', e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className={errors.password ? 'border-red-500' : ''}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-0 top-0 h-full px-3"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                {errors.password && <p className="text-sm text-red-500">{errors.password}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar Contraseña *</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={formData.confirmPassword}
                    onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                    placeholder="Confirma la contraseña"
                    className={errors.confirmPassword ? 'border-red-500' : ''}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-0 top-0 h-full px-3"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                {errors.confirmPassword && <p className="text-sm text-red-500">{errors.confirmPassword}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">Rol</Label>
                <Select value={formData.role} onValueChange={(value) => handleInputChange('role', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona el rol" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EMPLOYEE">Empleado</SelectItem>
                    <SelectItem value="ADMIN">Administrador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Datos personales */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-sgn-dark border-b pb-2">
                Datos Personales
              </h3>

              <div className="space-y-2">
                <Label htmlFor="dni" className="flex items-center gap-2">
                  <IdCard className="h-4 w-4" />
                  DNI *
                </Label>
                <Input
                  id="dni"
                  type="text"
                  value={formData.dni}
                  onChange={(e) => handleInputChange('dni', e.target.value.replace(/\D/g, ''))}
                  placeholder="12345678"
                  maxLength={8}
                  className={errors.dni ? 'border-red-500' : ''}
                />
                {errors.dni && <p className="text-sm text-red-500">{errors.dni}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">Nombre *</Label>
                  <Input
                    id="firstName"
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => handleInputChange('firstName', e.target.value)}
                    placeholder="Juan"
                    className={errors.firstName ? 'border-red-500' : ''}
                  />
                  {errors.firstName && <p className="text-sm text-red-500">{errors.firstName}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="lastName">Apellido *</Label>
                  <Input
                    id="lastName"
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => handleInputChange('lastName', e.target.value)}
                    placeholder="Pérez"
                    className={errors.lastName ? 'border-red-500' : ''}
                  />
                  {errors.lastName && <p className="text-sm text-red-500">{errors.lastName}</p>}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="birthDate" className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Fecha de Nacimiento *
                </Label>
                <Input
                  id="birthDate"
                  type="date"
                  value={formData.birthDate}
                  onChange={(e) => handleInputChange('birthDate', e.target.value)}
                  className={errors.birthDate ? 'border-red-500' : ''}
                />
                {errors.birthDate && <p className="text-sm text-red-500">{errors.birthDate}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone" className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  Teléfono
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  placeholder="+54 11 1234-5678"
                />
              </div>

              {/* Profile Image */}
              <div className="space-y-2">
                <Label htmlFor="profileImage" className="flex items-center gap-2">
                  <Camera className="h-4 w-4" />
                  Foto de Perfil
                </Label>
                <div className="flex items-center gap-4">
                  {imagePreview ? (
                    <div className="relative w-20 h-20 rounded-full overflow-hidden border-2 border-gray-200">
                      <Image
                        src={imagePreview}
                        alt="Vista previa"
                        fill
                        className="object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-gray-100 border-2 border-gray-200 flex items-center justify-center">
                      <User className="h-8 w-8 text-gray-400" />
                    </div>
                  )}
                  <div className="flex-1">
                    <Input
                      id="profileImage"
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => document.getElementById('profileImage')?.click()}
                      className="w-full"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Seleccionar Imagen
                    </Button>
                    <p className="text-sm text-gray-500 mt-1">
                      JPG, PNG o GIF (máx. 5MB)
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Datos laborales */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-sgn-dark border-b pb-2">
              Datos Laborales
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="hireDate" className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Fecha de Ingreso *
                </Label>
                <Input
                  id="hireDate"
                  type="date"
                  value={formData.hireDate}
                  onChange={(e) => handleInputChange('hireDate', e.target.value)}
                  className={errors.hireDate ? 'border-red-500' : ''}
                />
                {errors.hireDate && <p className="text-sm text-red-500">{errors.hireDate}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="areaId" className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Área *
                </Label>
                <Select value={formData.areaId} onValueChange={(value) => handleInputChange('areaId', value)}>
                  <SelectTrigger className={errors.areaId ? 'border-red-500' : ''}>
                    <SelectValue placeholder="Selecciona un área" />
                  </SelectTrigger>
                  <SelectContent>
                    {areas.map((area) => (
                      <SelectItem key={area.id} value={area.id}>
                        {area.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.areaId && <p className="text-sm text-red-500">{errors.areaId}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="position" className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4" />
                  Puesto *
                </Label>
                <Input
                  id="position"
                  type="text"
                  value={formData.position}
                  onChange={(e) => handleInputChange('position', e.target.value)}
                  placeholder="Desarrollador Senior"
                  className={errors.position ? 'border-red-500' : ''}
                />
                {errors.position && <p className="text-sm text-red-500">{errors.position}</p>}
              </div>
            </div>
          </div>

          {/* Licencias y Permisos Anuales */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-sgn-dark border-b pb-2">
              Licencias y Permisos Anuales
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="vacationDays" className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Días de Vacaciones *
                </Label>
                <Input
                  id="vacationDays"
                  type="number"
                  min="0"
                  value={formData.vacationDays}
                  onChange={(e) => handleInputChange('vacationDays', e.target.value)}
                  placeholder="20"
                  className={errors.vacationDays ? 'border-red-500' : ''}
                />
                {errors.vacationDays && <p className="text-sm text-red-500">{errors.vacationDays}</p>}
                <p className="text-xs text-gray-500">Días de vacaciones disponibles para el año</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="personalHours" className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Horas Particulares *
                </Label>
                <Input
                  id="personalHours"
                  type="number"
                  min="0"
                  value={formData.personalHours}
                  onChange={(e) => handleInputChange('personalHours', e.target.value)}
                  placeholder="96"
                  className={errors.personalHours ? 'border-red-500' : ''}
                />
                {errors.personalHours && <p className="text-sm text-red-500">{errors.personalHours}</p>}
                <p className="text-xs text-gray-500">Horas para asuntos personales</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="remoteHours" className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Horas Remotas *
                </Label>
                <Input
                  id="remoteHours"
                  type="number"
                  min="0"
                  value={formData.remoteHours}
                  onChange={(e) => handleInputChange('remoteHours', e.target.value)}
                  placeholder="96"
                  className={errors.remoteHours ? 'border-red-500' : ''}
                />
                {errors.remoteHours && <p className="text-sm text-red-500">{errors.remoteHours}</p>}
                <p className="text-xs text-gray-500">Horas para trabajo remoto</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="availableHours" className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Horas Disponibles *
                </Label>
                <Input
                  id="availableHours"
                  type="number"
                  min="0"
                  value={formData.availableHours}
                  onChange={(e) => handleInputChange('availableHours', e.target.value)}
                  placeholder="16"
                  className={errors.availableHours ? 'border-red-500' : ''}
                />
                {errors.availableHours && <p className="text-sm text-red-500">{errors.availableHours}</p>}
                <p className="text-xs text-gray-500">Horas flexibles disponibles</p>
              </div>
            </div>

            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-700">
                <strong>Nota:</strong> Estos valores representan la cantidad total disponible para el año actual. 
                Se establecen valores por defecto pero pueden ser ajustados según las políticas de la empresa 
                y el puesto del empleado.
              </p>
            </div>
          </div>

          {/* Botones de acción */}
          <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t">
            <Link href="/admin/employees" className="flex-1">
              <Button type="button" variant="outline" className="w-full">
                Cancelar
              </Button>
            </Link>
            <Button 
              type="submit" 
              disabled={loading}
              className="flex-1"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creando Empleado...
                </>
              ) : (
                'Crear Empleado'
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
