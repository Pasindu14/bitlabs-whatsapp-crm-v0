export interface SendTextMessageRequest {
  companyId: number;
  recipientPhoneNumber: string;
  text: string;
}

export interface SendTextMessageResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}
