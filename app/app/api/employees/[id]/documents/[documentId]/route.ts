import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getSignedGetUrl, deleteObject, buildKey } from '@/lib/s3';

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

    try {
      const key = buildKey(`documents/${document.fileName}`);
      const url = await getSignedGetUrl(key, document.fileType, document.originalName);
      return NextResponse.redirect(url, { status: 302 });
    } catch (fileError) {
      console.error('Error generating signed URL:', fileError);
      return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 });
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

    // Eliminar objeto en S3
    try {
      const key = buildKey(`documents/${document.fileName}`);
      await deleteObject(key);
    } catch (fileError) {
      console.warn('Could not delete S3 object:', fileError);
      // Continuar con la eliminación de la base de datos aunque el objeto físico no se pueda eliminar
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
