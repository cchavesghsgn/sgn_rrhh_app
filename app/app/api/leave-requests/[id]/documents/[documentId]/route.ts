import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { promises as fs } from 'fs';
import path from 'path';

// DELETE - Eliminar un adjunto de una solicitud
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; documentId: string } }
) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id: leaveRequestId, documentId } = params;

    // Buscar el adjunto y la solicitud asociada
    const attachment = await prisma.attachments.findUnique({
      where: { id: documentId },
      include: {
        leave_requests: {
          include: {
            employees: true,
          },
        },
      },
    });

    if (!attachment || attachment.leaveRequestId !== leaveRequestId) {
      return NextResponse.json({ error: 'Adjunto no encontrado' }, { status: 404 });
    }

    // Verificar permisos: el empleado propietario o un admin
    const isOwner = attachment.leave_requests.employees.userId === session.user.id;
    const isAdmin = session.user.role === 'ADMIN';

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: 'Sin permisos para eliminar este adjunto' }, { status: 403 });
    }

    // Intentar eliminar el archivo físico
    try {
      const fullPath = path.join(process.cwd(), 'public', attachment.filePath);
      await fs.unlink(fullPath);
    } catch (fileErr) {
      // No bloquear si no existe físicamente
      console.warn('No se pudo eliminar el archivo físico del adjunto:', fileErr);
    }

    // Eliminar el registro en la base de datos
    await prisma.attachments.delete({ where: { id: documentId } });

    return NextResponse.json({ message: 'Adjunto eliminado exitosamente' });
  } catch (error) {
    console.error('Error al eliminar adjunto de solicitud:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
