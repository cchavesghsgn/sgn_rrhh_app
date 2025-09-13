import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { promises as fs } from 'fs';
import path from 'path';

// GET - Descargar/ver un documento específico
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; documentId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Buscar el documento
    const document = await prisma.employee_documents.findFirst({
      where: {
        id: params.documentId,
        employeeId: params.id
      }
    });

    if (!document) {
      return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 });
    }

    // Leer el archivo
    const fullPath = path.join(process.cwd(), 'public', document.filePath);
    
    try {
      const file = await fs.readFile(fullPath);
      
      return new NextResponse(file, {
        headers: {
          'Content-Type': document.fileType,
          'Content-Disposition': `inline; filename="${document.originalName}"`,
          'Cache-Control': 'public, max-age=31536000',
        },
      });
    } catch (fileError) {
      console.error('Error reading file:', fileError);
      return NextResponse.json({ error: 'Archivo no encontrado en el sistema' }, { status: 404 });
    }

  } catch (error) {
    console.error('Error serving document:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// DELETE - Eliminar un documento
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; documentId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Buscar el documento
    const document = await prisma.employee_documents.findFirst({
      where: {
        id: params.documentId,
        employeeId: params.id
      }
    });

    if (!document) {
      return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 });
    }

    // Eliminar archivo físico
    const fullPath = path.join(process.cwd(), 'public', document.filePath);
    try {
      await fs.unlink(fullPath);
    } catch (fileError) {
      console.warn('Could not delete physical file:', fileError);
      // Continuar con la eliminación de la base de datos aunque el archivo físico no se pueda eliminar
    }

    // Eliminar registro de la base de datos
    await prisma.employee_documents.delete({
      where: { id: params.documentId }
    });

    return NextResponse.json({ message: 'Documento eliminado exitosamente' });

  } catch (error) {
    console.error('Error deleting document:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}