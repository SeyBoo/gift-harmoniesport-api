export interface MessageRecipient {
  email?: string;
  phone?: string;
  name?: string;
}

export interface MessagePayload {
  subject?: string;
  body: string;
  htmlBody?: string;
  recipients: MessageRecipient[];
}

export interface MessageResult {
  success: boolean;
  sentCount: number;
  failedCount: number;
  errors?: Array<{
    recipient: MessageRecipient;
    error: string;
  }>;
}

export interface IMessageConnector {
  send(payload: MessagePayload): Promise<MessageResult>;
  validateRecipient(recipient: MessageRecipient): boolean;
  getProviderName(): string;
}
