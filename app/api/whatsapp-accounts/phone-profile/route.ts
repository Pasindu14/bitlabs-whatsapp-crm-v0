import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { whatsappPhoneProfileQuerySchema, whatsappPhoneProfileResponseSchema } from '@/features/whatsapp-accounts/schemas/whatsapp-phone-profile.schema';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const phoneNumberId = searchParams.get('phoneNumberId');
    const fields = searchParams.get('fields');

    const validatedInput = whatsappPhoneProfileQuerySchema.parse({
      phoneNumberId,
      fields: fields || undefined,
    });

    const graphApiVersion = process.env.WHATSAPP_API_VERSION || 'v19.0';
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

    if (!accessToken) {
      return NextResponse.json(
        { error: 'WhatsApp access token not configured' },
        { status: 500 }
      );
    }

    const fieldsParam = buildFieldsParam(validatedInput.fields);
    const graphApiUrl = `https://graph.facebook.com/${graphApiVersion}/${validatedInput.phoneNumberId}${fieldsParam}`;

    const response = await axios.get(graphApiUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'User-Agent': 'BitLabs WhatsApp CRM',
      },
    });

    console.log('Meta API Response:', JSON.stringify(response.data, null, 2));
    const validatedData = whatsappPhoneProfileResponseSchema.parse(response.data);

    return NextResponse.json(validatedData);
  } catch (error) {
    console.error('Phone profile API error:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      accessTokenExists: !!process.env.WHATSAPP_ACCESS_TOKEN,
      graphApiVersion: process.env.WHATSAPP_API_VERSION || 'v19.0',
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function buildFieldsParam(fields?: string): string {
  if (!fields) return '';
  const fieldMap: Record<string, string> = {
    name_status: 'name_status',
    code_verification_status: 'code_verification_status',
    both: 'name_status,code_verification_status',
  };
  return `?fields=${fieldMap[fields] || ''}`;
}
