'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import toast from 'react-hot-toast';
import { Card, CardContent } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';

export default function ChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [repeatPassword, setRepeatPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || !repeatPassword) {
      toast.error('Completa todos los campos');
      return;
    }
    if (newPassword !== repeatPassword) {
      toast.error('La nueva contraseña no coincide');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('La nueva contraseña debe tener al menos 8 caracteres');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/account/change-password', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword })
      });
      if (res.ok) {
        toast.success('Contraseña actualizada. Vuelve a iniciar sesión.');
        await signOut({ callbackUrl: '/login' });
      } else {
        const data = await res.json().catch(() => ({} as any));
        toast.error(data.error || 'No se pudo cambiar la contraseña');
      }
    } catch (err) {
      toast.error('Error de red');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <Card className="sgn-card">
        <CardContent className="p-6">
          <h1 className="text-xl font-bold mb-4 text-sgn-dark">Cambiar contraseña</h1>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current">Contraseña actual</Label>
              <Input id="current" type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new">Nueva contraseña</Label>
              <Input id="new" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="repeat">Repetir nueva contraseña</Label>
              <Input id="repeat" type="password" value={repeatPassword} onChange={e => setRepeatPassword(e.target.value)} />
            </div>
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'Guardando…' : 'Guardar'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
