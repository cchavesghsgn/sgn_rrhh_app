
import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    console.log('=== TEST UPLOAD API CALLED ===');
    
    const contentType = request.headers.get('content-type') || '';
    console.log('Content-Type:', contentType);
    
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json({ error: 'Expected multipart/form-data' }, { status: 400 });
    }

    console.log('Parsing FormData...');
    const formData = await request.formData();
    
    console.log('FormData keys:', Array.from(formData.keys()));
    
    // Log all non-file fields
    for (const [key, value] of formData.entries()) {
      if (typeof value === 'string') {
        console.log(`Field ${key}:`, value);
      } else {
        console.log(`File ${key}:`, {
          name: (value as any).name || 'unknown',
          size: (value as any).size || 'unknown',
          type: (value as any).type || 'unknown',
          constructor: value.constructor.name
        });
      }
    }

    // Try to handle the profile image
    const profileImage = formData.get('profileImage');
    console.log('ProfileImage raw value:', profileImage);
    
    if (profileImage && typeof profileImage !== 'string') {
      console.log('Processing image...');
      
      try {
        // Ensure uploads directory exists
        const uploadsDir = path.join(process.cwd(), 'uploads');
        await fs.mkdir(uploadsDir, { recursive: true });
        
        // Try to read the image data
        let buffer: Buffer;
        
        if (typeof (profileImage as any).arrayBuffer === 'function') {
          console.log('Using arrayBuffer method...');
          const bytes = await (profileImage as any).arrayBuffer();
          buffer = Buffer.from(bytes);
          console.log('Buffer created, size:', buffer.length);
        } else {
          console.log('ArrayBuffer method not available');
          return NextResponse.json({ 
            error: 'Cannot read image data',
            details: {
              type: typeof profileImage,
              constructor: profileImage.constructor.name,
              methods: Object.getOwnPropertyNames(profileImage).filter(prop => typeof (profileImage as any)[prop] === 'function')
            }
          });
        }
        
        // Save test file
        const fileName = `test-upload-${Date.now()}.png`;
        const filePath = path.join(uploadsDir, fileName);
        
        await fs.writeFile(filePath, buffer);
        console.log('File saved successfully:', fileName);
        
        return NextResponse.json({
          success: true,
          message: 'File uploaded successfully',
          fileName,
          size: buffer.length,
          originalName: (profileImage as any).name || 'unknown'
        });
        
      } catch (imageError) {
        console.error('Error processing image:', imageError);
        return NextResponse.json({
          error: 'Error processing image',
          details: imageError instanceof Error ? imageError.message : String(imageError)
        }, { status: 500 });
      }
    } else {
      return NextResponse.json({ error: 'No valid image file found' }, { status: 400 });
    }

  } catch (error) {
    console.error('General error in test-upload API:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
