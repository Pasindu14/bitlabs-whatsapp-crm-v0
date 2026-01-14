// app/api/whatsapp/send-audio/route.ts
import { NextRequest, NextResponse } from 'next/server';

const WHATSAPP_API_URL = `https://graph.facebook.com/${process.env.WHATSAPP_API_VERSION}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;

// Helper function to send a template message first (to open 24-hour window)
async function sendTemplateMessage(to: string) {
  const templatePayload = {
    messaging_product: 'whatsapp',
    to: to,
    type: 'template',
    template: {
      name: 'hello_world', // Default WhatsApp template - should work on all accounts
      language: {
        code: 'en_US'
      }
    }
  };

  console.log('Sending template message first:', JSON.stringify(templatePayload, null, 2));

  const response = await fetch(WHATSAPP_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(templatePayload),
  });

  return await response.json();
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { to, audioUrl, audioId, sendTemplate } = body;

    if (!to) {
      return NextResponse.json(
        { error: 'Recipient phone number is required' },
        { status: 400 }
      );
    }

    if (!audioUrl && !audioId) {
      return NextResponse.json(
        { error: 'Either audioUrl or audioId is required' },
        { status: 400 }
      );
    }

    // If requested, send template message first to open 24-hour window
    if (sendTemplate) {
      const templateResponse = await sendTemplateMessage(to);
      console.log('Template message response:', JSON.stringify(templateResponse, null, 2));
      
      // Wait a moment for the template to process
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Prepare the audio message payload
    const messagePayload: any = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: to,
      type: 'audio',
      audio: audioId 
        ? { id: audioId } // Using uploaded media ID
        : { link: audioUrl } // Using external URL
    };

    console.log('Sending audio message:', JSON.stringify(messagePayload, null, 2));

    // Send the audio message
    const response = await fetch(WHATSAPP_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messagePayload),
    });

    const responseData = await response.json();

    console.log('WhatsApp API Response:', JSON.stringify(responseData, null, 2));

    if (!response.ok) {
      return NextResponse.json(
        { 
          error: 'Failed to send audio message',
          details: responseData,
          hint: responseData.error?.message?.includes('24 hour') 
            ? 'Try enabling "Send Template First" option - you may need to initiate conversation with a template message'
            : undefined
        },
        { status: response.status }
      );
    }

    return NextResponse.json({
      success: true,
      messageId: responseData.messages?.[0]?.id,
      response: responseData
    });

  } catch (error) {
    console.error('Error sending audio message:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Upload audio file to WhatsApp Media API
export async function PUT(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File;

    if (!audioFile) {
      return NextResponse.json(
        { error: 'Audio file is required' },
        { status: 400 }
      );
    }

    const MEDIA_UPLOAD_URL = `https://graph.facebook.com/${process.env.WHATSAPP_API_VERSION}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/media`;

    // Upload the audio file
    const uploadFormData = new FormData();
    uploadFormData.append('file', audioFile);
    uploadFormData.append('messaging_product', 'whatsapp');
    
    // Don't specify type - let WhatsApp detect it
    console.log('Uploading audio:', {
      name: audioFile.name,
      size: audioFile.size,
      type: audioFile.type
    });

    const uploadResponse = await fetch(MEDIA_UPLOAD_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
      },
      body: uploadFormData,
    });

    const uploadData = await uploadResponse.json();

    if (!uploadResponse.ok) {
      return NextResponse.json(
        { 
          error: 'Failed to upload audio file',
          details: uploadData 
        },
        { status: uploadResponse.status }
      );
    }

    return NextResponse.json({
      success: true,
      mediaId: uploadData.id,
      response: uploadData
    });

  } catch (error) {
    console.error('Error uploading audio file:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Check account phone numbers (GET endpoint for debugging)
export async function GET(request: NextRequest) {
  try {
    const PHONE_INFO_URL = `https://graph.facebook.com/${process.env.WHATSAPP_API_VERSION}/${process.env.WHATSAPP_PHONE_NUMBER_ID}`;
    
    const response = await fetch(PHONE_INFO_URL, {
      headers: {
        'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
      },
    });

    const data = await response.json();

    return NextResponse.json({
      phoneNumberInfo: data,
      accountStatus: data.quality_rating || 'unknown'
    });

  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}