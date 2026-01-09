export interface SendTextMessageRequest {
  companyId: number;
  recipientPhoneNumber: string;
  phoneNumberId: string;
  accessToken: string;
  type: 'text' | 'image' | 'audio';
  text?: string;
  mediaUrl?: string;
}

export interface SendTextMessageResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface GetMessageHistoryRequest {
  companyId: number;
  phoneNumberId: string;
  accessToken: string;
  limit?: number;
  before?: string;
  after?: string;
}

export interface GetMessageHistoryResponse {
  success: boolean;
  messages?: unknown[];
  error?: string;
}
