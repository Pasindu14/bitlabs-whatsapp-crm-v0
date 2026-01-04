import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { ConversationService } from '@/features/conversations/services/conversation-service';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { phoneNumber } = body;

    if (!phoneNumber) {
      return NextResponse.json(
        { error: 'Phone number is required' },
        { status: 400 }
      );
    }

    const user = session.user as unknown as { id: string | number; companyId: string | number };
    const companyId = typeof user.companyId === 'string' ? parseInt(user.companyId, 10) : user.companyId;

    // Ensure contact exists
    const contactResult = await ConversationService.ensureContact(
      companyId,
      phoneNumber
    );

    if (!contactResult.success || !contactResult.data) {
      return NextResponse.json(
        { error: contactResult.error || 'Failed to create contact' },
        { status: 500 }
      );
    }

    // Ensure conversation exists
    const conversationResult = await ConversationService.ensureConversation(
      companyId,
      contactResult.data.id
    );

    if (!conversationResult.success) {
      return NextResponse.json(
        { error: conversationResult.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      conversation: conversationResult.data,
      contact: contactResult.data,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
