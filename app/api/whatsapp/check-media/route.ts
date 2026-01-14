// app/api/whatsapp/check-media/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const mediaId = searchParams.get('mediaId');

    if (!mediaId) {
      return NextResponse.json(
        { error: 'mediaId parameter is required' },
        { status: 400 }
      );
    }

    // Get media info
    const MEDIA_INFO_URL = `https://graph.facebook.com/${process.env.WHATSAPP_API_VERSION}/${mediaId}`;
    
    const response = await fetch(MEDIA_INFO_URL, {
      headers: {
        'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { 
          error: 'Failed to get media info',
          details: data 
        },
        { status: response.status }
      );
    }

    // Also try to get the actual media URL
    let mediaUrl = null;
    if (data.url) {
      const urlResponse = await fetch(data.url, {
        headers: {
          'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
        },
      });
      mediaUrl = {
        status: urlResponse.status,
        headers: Object.fromEntries(urlResponse.headers.entries())
      };
    }

    return NextResponse.json({
      mediaInfo: data,
      mediaUrl: mediaUrl
    });

  } catch (error) {
    console.error('Error checking media:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}