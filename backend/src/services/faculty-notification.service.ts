import nodemailer from "nodemailer";
import { whatsappService } from "./whatsapp.service";
import { emailService } from "./email.service";
import { UserModel } from "../models/user.model";
import { ActivityLogModel } from "../models/activity-log.model";

export interface FacultyLeaveNotificationPayload {
  trainerId: string;
  trainerName: string;
  trainerEmail?: string;
  leaveType: string;
  leaveReason: string;
  startDate: string;
  expectedReturnDate?: string;
  handoverNotes?: string;
  affectedStudentsCount: number;
  affectedBatchesCount: number;
  backupTrainerSuggestions?: string[];
}

export class FacultyNotificationService {
  private defaultManagerEmail = process.env.MANAGER_NOTIFICATION_EMAIL || "manager@tvktechnologies.com";
  private defaultManagerPhone = process.env.MANAGER_NOTIFICATION_PHONE || "919876543210";

  /**
   * Dispatches automated notification intimating manager of a faculty leave request.
   */
  async notifyManagerOnTrainerLeave(payload: FacultyLeaveNotificationPayload): Promise<{
    emailDispatched: boolean;
    whatsappDispatched: boolean;
  }> {
    const returnDateStr = payload.expectedReturnDate || "To be confirmed";
    const handoverText = payload.handoverNotes ? `\nHandover Notes: ${payload.handoverNotes}` : "";
    const managerTarget = await this.resolveManagerTarget();

    console.log(`[FACULTY_NOTIFICATION] 🚨 Trainer Leave Alert Triggered: ${payload.trainerName} (${payload.trainerId})`);

    // 1. Log System Activity Log
    try {
      await ActivityLogModel.create({
        candidateId: payload.trainerId,
        candidateName: payload.trainerName,
        type: "FACULTY_LEAVE_ALERT",
        message: `Faculty ${payload.trainerName} (${payload.trainerId}) applied for ${payload.leaveType} leave from ${payload.startDate} to ${returnDateStr}. Reason: "${payload.leaveReason}". Impact: ${payload.affectedStudentsCount} students across ${payload.affectedBatchesCount} batches.`,
        performedBy: payload.trainerName,
        performedByUserId: payload.trainerId,
      });
    } catch (err) {
      console.warn("[FACULTY_NOTIFICATION] Could not write to ActivityLog:", err);
    }

    // 2. Automated WhatsApp Intimation
    let whatsappDispatched = false;
    const whatsappMessage =
      `🚨 *TVK Faculty Leave Alert*\n\n` +
      `*Faculty:* ${payload.trainerName} (${payload.trainerId})\n` +
      `*Category:* ${payload.leaveType}\n` +
      `*Duration:* ${payload.startDate} to ${returnDateStr}\n` +
      `*Reason:* "${payload.leaveReason}"${handoverText}\n\n` +
      `⚠️ *Impact:* ${payload.affectedStudentsCount} students across ${payload.affectedBatchesCount} batches.\n\n` +
      `Please check the CRM topbar [🔔] or Trainer Management to review and assign backup coverage.`;

    try {
      if (!whatsappService.isDeliveryEnabled()) {
        console.log(`[FACULTY_NOTIFICATION] WhatsApp in test mode: simulated dispatch to manager`);
        whatsappDispatched = true;
      } else {
        const waConfig = whatsappService.getConfig();
        if (waConfig.isConfigured && managerTarget.phone) {
          const formattedPhone = whatsappService.formatPhoneNumber(managerTarget.phone);
          const url = `https://graph.facebook.com/v21.0/${waConfig.phoneId}/messages`;
          await fetch(url, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${waConfig.token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              messaging_product: "whatsapp",
              recipient_type: "individual",
              to: formattedPhone,
              type: "text",
              text: { body: whatsappMessage },
            }),
          });
          whatsappDispatched = true;
          console.log(`[FACULTY_NOTIFICATION] WhatsApp intimation sent to manager: ${formattedPhone}`);
        } else {
          console.log(`[FACULTY_NOTIFICATION] WhatsApp simulated dispatch (credentials not set in .env): ${whatsappMessage.replace(/\n/g, " ")}`);
        }
      }
    } catch (err: any) {
      console.warn("[FACULTY_NOTIFICATION] WhatsApp delivery skipped/failed:", err?.message || err);
    }

    // 3. Automated Email Intimation
    let emailDispatched = false;
    const emailSubject = `[ALERT] Faculty On Leave: ${payload.trainerName} (${payload.startDate} to ${returnDateStr})`;
    const emailHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden;">
        <div style="background: #0f172a; padding: 20px 24px; color: #ffffff;">
          <h2 style="margin: 0; font-size: 18px; color: #f59e0b;">🚨 TVK Technologies — Faculty Leave Alert</h2>
          <p style="margin: 4px 0 0; font-size: 13px; color: #94a3b8;">Automated intimation generated from Trainer Portal</p>
        </div>

        <div style="padding: 24px;">
          <p style="font-size: 15px; margin-top: 0;">Dear Manager,</p>
          <p>Faculty member <strong>${payload.trainerName}</strong> (ID: <code>${payload.trainerId}</code>) has registered leave / absence:</p>

          <table style="width: 100%; border-collapse: collapse; margin: 18px 0; font-size: 14px;">
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 8px 0; color: #64748b; width: 140px; font-weight: 600;">Category:</td>
              <td style="padding: 8px 0; font-weight: bold; color: #d97706;">${payload.leaveType}</td>
            </tr>
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 8px 0; color: #64748b; font-weight: 600;">Period:</td>
              <td style="padding: 8px 0;">${payload.startDate} &rarr; ${returnDateStr}</td>
            </tr>
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 8px 0; color: #64748b; font-weight: 600;">Reason:</td>
              <td style="padding: 8px 0; font-style: italic;">"${payload.leaveReason}"</td>
            </tr>
            ${
              payload.handoverNotes
                ? `<tr style="border-bottom: 1px solid #f1f5f9;">
                     <td style="padding: 8px 0; color: #64748b; font-weight: 600;">Handover Notes:</td>
                     <td style="padding: 8px 0;">${payload.handoverNotes}</td>
                   </tr>`
                : ""
            }
            <tr>
              <td style="padding: 8px 0; color: #64748b; font-weight: 600;">Curriculum Impact:</td>
              <td style="padding: 8px 0; color: #dc2626; font-weight: 600;">
                ⚠️ ${payload.affectedStudentsCount} Enrolled Students across ${payload.affectedBatchesCount} Active Batches
              </td>
            </tr>
          </table>

          <div style="margin-top: 24px; padding-top: 18px; border-top: 1px solid #e2e8f0; text-align: center;">
            <a href="http://localhost:4200/trainer-management" style="display: inline-block; background: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px;">
              Open Trainer Management Dashboard &rarr;
            </a>
          </div>
        </div>

        <div style="background: #f8fafc; padding: 12px 24px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center;">
          This is an automated notification from TVK Recruitment CRM Faculty Attendance System.
        </div>
      </div>
    `;

    try {
      const smtpConfig = emailService.getSmtpConfig();
      if (smtpConfig.isConfigured && managerTarget.email) {
        const transporter = nodemailer.createTransport({
          host: smtpConfig.host,
          port: smtpConfig.port,
          secure: smtpConfig.secure,
          auth: smtpConfig.user && smtpConfig.pass ? { user: smtpConfig.user, pass: smtpConfig.pass } : undefined,
          tls: { rejectUnauthorized: false },
        });

        await transporter.sendMail({
          from: `"TVK Faculty System" <${smtpConfig.from}>`,
          to: managerTarget.email,
          subject: emailSubject,
          html: emailHtml,
        });
        emailDispatched = true;
        console.log(`[FACULTY_NOTIFICATION] Email intimation sent to manager: ${managerTarget.email}`);
      } else {
        console.log(`[FACULTY_NOTIFICATION] Email simulated dispatch (SMTP not configured in .env): ${emailSubject}`);
      }
    } catch (err: any) {
      console.warn("[FACULTY_NOTIFICATION] Email delivery skipped/failed:", err?.message || err);
    }

    return { emailDispatched, whatsappDispatched };
  }

  /**
   * Morning Cut-Off Digest: intimates manager of trainers who have not checked in and have not informed leave.
   */
  async notifyManagerOnDailyAbsenceDigest(
    missingTrainers: Array<{ trainerId: string; trainerName: string; affectedStudentsCount: number }>,
    date: string
  ): Promise<void> {
    if (!missingTrainers || missingTrainers.length === 0) return;

    const managerTarget = await this.resolveManagerTarget();
    console.log(`[FACULTY_NOTIFICATION] ⏰ Daily Cut-Off Alert: ${missingTrainers.length} trainer(s) missing on ${date}`);

    const trainerListText = missingTrainers
      .map((t) => `• ${t.trainerName} (${t.trainerId}) — ${t.affectedStudentsCount} students`)
      .join("\n");

    const message =
      `⏰ *TVK Morning Faculty Cut-Off Digest (${date})*\n\n` +
      `The following ${missingTrainers.length} faculty member(s) have *NOT checked in* and have not informed of leave:\n\n` +
      `${trainerListText}\n\n` +
      `Please check the TVK notification bell [🔔] or management portal to take action.`;

    // 1. WhatsApp Intimation
    try {
      if (!whatsappService.isDeliveryEnabled()) {
        console.log(`[FACULTY_NOTIFICATION] Cut-off digest WhatsApp simulated (test mode): ${message.replace(/\n/g, " ")}`);
      } else {
        const waConfig = whatsappService.getConfig();
        if (waConfig.isConfigured && managerTarget.phone) {
          const formattedPhone = whatsappService.formatPhoneNumber(managerTarget.phone);
          const url = `https://graph.facebook.com/v21.0/${waConfig.phoneId}/messages`;
          await fetch(url, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${waConfig.token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              messaging_product: "whatsapp",
              recipient_type: "individual",
              to: formattedPhone,
              type: "text",
              text: { body: message },
            }),
          });
        } else {
          console.log(`[FACULTY_NOTIFICATION] Cut-off digest simulated dispatch: ${message.replace(/\n/g, " ")}`);
        }
      }
    } catch (err: any) {
      console.warn("[FACULTY_NOTIFICATION] Cut-off WhatsApp skipped:", err?.message || err);
    }
  }

  private async resolveManagerTarget(): Promise<{ email: string; phone: string }> {
    let email = this.defaultManagerEmail;
    let phone = this.defaultManagerPhone;

    try {
      const managerUser = await UserModel.findOne({ role: "MANAGER" }).exec();
      if (managerUser?.email) email = managerUser.email;
      if ((managerUser as any)?.phone) phone = (managerUser as any).phone;
    } catch {
      // fallback to defaults
    }

    return { email, phone };
  }
}

export const facultyNotificationService = new FacultyNotificationService();
