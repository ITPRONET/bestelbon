import nodemailer from "nodemailer";

/** Is outgoing mail configured (SMTP of Brevo, Resend, the mail host, ...)? */
export const mailEnabled = () => !!(process.env.SMTP_HOST && process.env.SMTP_PASS);

/**
 * Sends an e-mail through the SMTP server in the environment. Works with any SMTP relay
 * (Brevo: smtp-relay.brevo.com:587, Resend: smtp.resend.com:465). Returns false when mail is off or fails.
 */
export async function sendMail(m: { to: string; subject: string; text: string; html?: string; replyTo?: string; fromName?: string }) {
  if (!mailEnabled()) return false;
  const port = Number(process.env.SMTP_PORT || 465);
  const fromAddr = process.env.MAIL_FROM_ADDRESS || "info@bestelbon.eu";
  const from = m.fromName ? `"${m.fromName.replace(/"/g, "")}" <${fromAddr}>` : process.env.MAIL_FROM || `"BestelBon" <${fromAddr}>`;
  try {
    const t = nodemailer.createTransport({ host: process.env.SMTP_HOST, port, secure: port === 465, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } });
    await t.sendMail({ from, to: m.to, subject: m.subject, text: m.text, html: m.html, replyTo: m.replyTo });
    return true;
  } catch (e) {
    console.error("mail", (e as Error).message);
    return false;
  }
}
