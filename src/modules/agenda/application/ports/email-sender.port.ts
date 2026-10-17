export interface EmailAttachment {
  filename: string;
  content: string;
  contentType: string;
}

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  attachments: readonly EmailAttachment[];
}

export abstract class EmailSenderPort {
  abstract isConfigured(): boolean;

  abstract send(message: EmailMessage): Promise<void>;
}
