

import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession } from '../../../../lib/auth';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerAuthSession();
    
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const area = await prisma.area.findUnique({
      where: { id: params.id },
      include: {
        employees: {
          select: { id: true, firstName: true, lastName: true, position: true }
        }
      }
    });

    if (!area) {
      return NextResponse.json({ error: 'Área no encontrada' }, { status: 404 });
    }

    return NextResponse.json(area);
  } catch (error) {
    console.error('Get area error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerAuthSession();
    
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    const { name, description } = await request.json();

    if (!name) {
      return NextResponse.json(
        { error: 'El nombre del área es requerido' },
        { status: 400 }
      );
    }

    const area = await prisma.area.update({
      where: { id: params.id },
      data: {
        name,
        description: description || null
      }
    });

    return NextResponse.json(area);
  } catch (error) {
    console.error('Update area error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerAuthSession();
    
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    // Check if area has employees
    const area = await prisma.area.findUnique({
      where: { id: params.id },
      include: {
        employees: true
      }
    });

    if (!area) {
      return NextResponse.json({ error: 'Área no encontrada' }, { status: 404 });
    }

    if (area.employees.length > 0) {
      return NextResponse.json(
        { error: 'No se puede eliminar un área que tiene empleados asignados' },
        { status: 400 }
      );
    }

    await prisma.area.delete({
      where: { id: params.id }
    });

    return NextResponse.json({ message: 'Área eliminada correctamente' });
  } catch (error) {
    console.error('Delete area error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
