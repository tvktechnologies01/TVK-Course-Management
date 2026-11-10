import nodemailer, { type Transporter } from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import { env } from "../config/env";
import { HttpError } from "../middleware/error-handler";
import { AuthenticatedAccount } from "../models/user.model";
import { smtpTunnelService } from "./smtp-tunnel.service";

export interface SendMailOptions {
  to: string;
  subject: string;
  message: string;
  actor: AuthenticatedAccount;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
}

export interface SendMailResult {
  sent: boolean;
  simulated: boolean;
  from: string;
  to: string;
  subject: string;
  messageId?: string;
}

export class EmailService {
  getSmtpConfig() {
    const user = process.env.SMTP_USER || env.smtp.user;
    const pass = process.env.SMTP_PASS || env.smtp.pass;
    const isGmail = Boolean(user && user.includes("@gmail.com"));
    const host = process.env.SMTP_HOST || env.smtp.host || (isGmail ? "smtp.gmail.com" : undefined);
    const port = Number(process.env.SMTP_PORT) || env.smtp.port || (isGmail || host?.includes("gmail") ? 465 : 587);
    const secure = process.env.SMTP_SECURE !== undefined
      ? process.env.SMTP_SECURE === "true"
      : (port === 465 || isGmail || (host ? host.includes("gmail") : false));
    const from = process.env.SMTP_FROM || env.smtp.from || user || "training@tvktechs.com";

    const isLocalhost = host === "localhost" || host === "127.0.0.1";
    const sshHost = process.env.SMTP_SSH_HOST || env.smtp.ssh?.host;
    const isConfigured = Boolean(host && ((user && pass) || isLocalhost || port === 25 || !user || sshHost));

    return { host, port, secure, user, pass, from, isConfigured };
  }

  getStatus() {
    const config = this.getSmtpConfig();
    const sshHost = process.env.SMTP_SSH_HOST || env.smtp.ssh?.host;
    return {
      configured: config.isConfigured,
      host: config.host || null,
      tunnel: Boolean(sshHost),
      user: config.user ? `${config.user.slice(0, 3)}***@${config.user.split("@")[1] || ""}` : null,
      from: config.from || null,
    };
  }

  private async getTransporter(): Promise<{ transporter: Transporter | null; from: string }> {
    const config = this.getSmtpConfig();
    if (!config.isConfigured || !config.host) {
      return { transporter: null, from: "" };
    }

    let transportHost = config.host;
    let transportPort = config.port;

    const sshHost = process.env.SMTP_SSH_HOST || env.smtp.ssh?.host;
    const sshUser = process.env.SMTP_SSH_USER || env.smtp.ssh?.user;
    const sshPass = process.env.SMTP_SSH_PASS || env.smtp.ssh?.pass;
    const sshPort = Number(process.env.SMTP_SSH_PORT) || env.smtp.ssh?.port || 22;

    if (sshHost && sshUser && sshPass) {
      try {
        const tunnel = await smtpTunnelService.ensureTunnel({
          sshHost,
          sshPort,
          sshUser,
          sshPass,
          remoteHost: config.host,
          remotePort: config.port,
        });
        transportHost = tunnel.host;
        transportPort = tunnel.port;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[EmailService] Failed to establish SMTP SSH tunnel:", msg);
        throw new HttpError(502, "SMTP_TUNNEL_FAILED", `Unable to establish SSH tunnel to SMTP relay server: ${msg}`);
      }
    }

    const transportOptions: SMTPTransport.Options = {
      host: transportHost,
      port: transportPort,
      secure: config.secure,
      tls: {
        rejectUnauthorized: false,
      },
    };

    if (config.user && config.pass) {
      transportOptions.auth = {
        user: config.user,
        pass: config.pass,
      };
    }

    const transporter = nodemailer.createTransport(transportOptions);
    return { transporter, from: config.from || config.user || "training@tvktechs.com" };
  }

  async sendCandidateEmail(options: SendMailOptions): Promise<SendMailResult> {
    const { to, subject, message, actor } = options;
    const senderName = actor.name || "TVK Management";
    const { transporter, from: deliveryFrom } = await this.getTransporter();
    const replyTo = process.env.SMTP_REPLY_TO || deliveryFrom || actor.email || "training@tvktechs.com";

    if (!transporter) {
      throw new HttpError(
        400,
        "SMTP_NOT_CONFIGURED",
        "Real email delivery requires SMTP settings in backend/.env. Please configure SMTP_HOST, SMTP_PORT, and credentials.",
      );
    }

    const fromHeader = `"${senderName}" <${deliveryFrom}>`;

    try {
      const info = await transporter.sendMail({
        from: fromHeader,
        replyTo,
        to,
        subject,
        text: message,
        html: message.replace(/\n/g, "<br>"),
        ...(options.attachments && options.attachments.length > 0 ? { attachments: options.attachments } : {}),
      });

      return {
        sent: true,
        simulated: false,
        from: deliveryFrom,
        to,
        subject,
        messageId: info.messageId,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "SMTP transmission failed";
      throw new HttpError(
        502,
        "EMAIL_DELIVERY_FAILED",
        `Failed to send email to ${to}: ${errorMessage}. Please check your SMTP settings in backend/.env.`,
      );
    }
  }
}

export const emailService = new EmailService();
