
import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession } from '../../../lib/auth';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerAuthSession();
    
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const areas = await prisma.area.findMany({
      include: {
        employees: {
          select: { id: true, firstName: true, lastName: true }
        }
      },
      orderBy: { name: 'asc' }
    });

    return NextResponse.json(areas);
  } catch (error) {
    console.error('Get areas error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerAuthSession();
    
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    const { name, description } = await request.json();

    if (!name) {
      return NextResponse.json(
        { error: 'El nombre del área es requerido' },
        { status: 400 }
      );
    }

    const area = await prisma.area.create({
      data: {
        id: crypto.randomUUID(),
        name,
        description: description || null,
        updatedAt: new Date()
      }
    });

    return NextResponse.json(area, { status: 201 });
  } catch (error) {
    console.error('Create area error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
