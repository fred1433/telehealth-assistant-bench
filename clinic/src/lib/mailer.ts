import nodemailer from 'nodemailer';
import { env } from './env';

export interface Mail {
  to: string;
  subject: string;
  text: string;
}

/** In-memory outbox used when MAIL_TRANSPORT=memory (tests). */
export const mailOutbox: Mail[] = [];

let transporter: nodemailer.Transporter | undefined;

function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.smtpHost,
      port: env.smtpPort,
      secure: false,
      ignoreTLS: true,
    });
  }
  return transporter;
}

export async function sendMail(mail: Mail): Promise<void> {
  if (env.mailTransport === 'memory') {
    mailOutbox.push(mail);
    return;
  }
  await getTransporter().sendMail({ from: env.mailFrom, to: mail.to, subject: mail.subject, text: mail.text });
}
