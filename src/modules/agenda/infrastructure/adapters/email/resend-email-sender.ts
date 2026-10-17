import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';
import {
  EmailSenderPort,
  type EmailMessage,
} from '../../../application/ports/email-sender.port.js';

@Injectable()
export class ResendEmailSender extends EmailSenderPort {
  private readonly logger = new Logger(ResendEmailSender.name);
  private readonly client: Resend | null;

  constructor() {
    super();
    const key = process.env.RESEND_API_KEY?.trim();
    this.client = key === undefined || key === '' ? null : new Resend(key);
  }

  isConfigured(): boolean {
    return this.client !== null && this.from() !== null;
  }

  async send(message: EmailMessage): Promise<void> {
    if (this.client === null) {
      throw new Error('Resend is not configured');
    }

    const from = this.from();

    if (from === null) {
      throw new Error('MAIL_FROM is not configured');
    }

    const { error } = await this.client.emails.send({
      from,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
      replyTo: process.env.MAIL_REPLY_TO?.trim() || undefined,
      attachments: message.attachments.map((attachment) => ({
        filename: attachment.filename,
        content: attachment.content,
        contentType: attachment.contentType,
      })),
    });

    if (error !== null) {
      this.logger.warn(`Resend rejected an email: ${error.message}`);
      throw new Error(error.message);
    }
  }

  private from(): string | null {
    const value = process.env.MAIL_FROM?.trim();
    return value === undefined || value === '' ? null : value;
  }
}
