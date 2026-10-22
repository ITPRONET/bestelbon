import nodemailer from "nodemailer";

/** Sends an e-mail through the SMTP server in the environment. Returns false when mail is not configured or fails. */
export async function sendMail(m: { to: string; subject: string; text: string; replyTo?: string }) {
  const host = process.env.SMTP_HOST;
  if (!host || !process.env.SMTP_PASS) return false;
  const port = Number(process.env.SMTP_PORT || 465);
  try {
    const t = nodemailer.createTransport({ host, port, secure: port === 465, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } });
    await t.sendMail({ from: process.env.MAIL_FROM || process.env.SMTP_USER, ...m });
    return true;
  } catch (e) {
    console.error("mail", (e as Error).message);
    return false;
  }
}
