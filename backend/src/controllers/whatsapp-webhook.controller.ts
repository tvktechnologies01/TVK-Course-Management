import { randomUUID } from "node:crypto";
import { Request, Response } from "express";
import { env } from "../config/env";
import { ActivityLogModel } from "../models/activity-log.model";
import { CandidateModel } from "../models/candidate.model";
import { WhatsAppMessageModel } from "../models/whatsapp-message.model";

export class WhatsAppWebhookController {
  /**
   * Meta WhatsApp Webhook Verification (GET)
   * Responds to Meta challenge during webhook setup.
   */
  verifyWebhook(req: Request, res: Response): void {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    const verifyToken = env.whatsapp.verifyToken || process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || "tvm_recruitment_webhook_token_2026";

    if (mode === "subscribe" && token === verifyToken) {
      console.log("[WhatsApp Webhook] Verification successful. Challenge echoed.");
      res.status(200).send(challenge);
      return;
    }

    console.warn("[WhatsApp Webhook] Verification rejected. Token mismatch or invalid mode.", {
      mode,
      receivedToken: token,
      expectedToken: verifyToken,
    });
    res.status(403).send("Forbidden: Invalid verification token");
  }

  /**
   * Meta WhatsApp Webhook Event Handler (POST)
   * Receives incoming messages and status callbacks from candidates.
   */
  async handleWebhook(req: Request, res: Response): Promise<void> {
    // 1. Immediately acknowledge Meta to prevent timeouts and duplicate deliveries
    res.status(200).json({ status: "success" });

    const body = req.body;
    if (!body || body.object !== "whatsapp_business_account") {
      return;
    }

    try {
      const entries = Array.isArray(body.entry) ? body.entry : [];
      for (const entry of entries) {
        const changes = Array.isArray(entry.changes) ? entry.changes : [];
        for (const change of changes) {
          if (change.field !== "messages" || !change.value) {
            continue;
          }

          const value = change.value;
          const contacts = Array.isArray(value.contacts) ? value.contacts : [];
          const messages = Array.isArray(value.messages) ? value.messages : [];
          const statuses = Array.isArray(value.statuses) ? value.statuses : [];

          // Process status updates (e.g. read, delivered, failed)
          for (const status of statuses) {
            if (status.status === "failed") {
              const errors = status.errors || [];
              const errorDesc = errors.map((e: any) => e.title || e.message).join(", ") || "Unknown error";
              console.warn(`[WhatsApp Delivery Failed] Recipient: ${status.recipient_id}, Reason: ${errorDesc}`);
            }
          }

          // Process incoming messages from candidates
          for (const msg of messages) {
            await this.processIncomingMessage(msg, contacts);
          }
        }
      }
    } catch (error) {
      console.error("[WhatsApp Webhook Error] Failed to process incoming event:", error);
    }
  }

  private async processIncomingMessage(msg: any, contacts: any[]): Promise<void> {
    const rawFrom = String(msg.from || "").trim();
    if (!rawFrom) return;

    const cleanDigits = rawFrom.replace(/\D/g, "");
    const last10 = cleanDigits.slice(-10);

    // Extract sender name if provided by Meta contact payload
    const matchedContact = contacts.find((c) => String(c.wa_id).replace(/\D/g, "") === cleanDigits);
    const profileName = matchedContact?.profile?.name?.trim() || "";

    // Extract message content according to message type
    let messageText = "";
    switch (msg.type) {
      case "text":
        messageText = msg.text?.body?.trim() || "";
        break;
      case "button":
        messageText = msg.button?.text?.trim() || "";
        break;
      case "interactive":
        messageText =
          msg.interactive?.button_reply?.title ||
          msg.interactive?.list_reply?.title ||
          msg.interactive?.list_reply?.description ||
          "";
        break;
      case "image":
        messageText = msg.image?.caption ? `[Image]: ${msg.image.caption}` : "[Image received]";
        break;
      case "document":
        messageText = msg.document?.filename ? `[Document: ${msg.document.filename}]` : "[Document received]";
        break;
      case "audio":
        messageText = "[Voice Note / Audio Message received]";
        break;
      case "video":
        messageText = "[Video received]";
        break;
      case "location":
        messageText = `[Location]: ${msg.location?.name || ""} (${msg.location?.latitude}, ${msg.location?.longitude})`;
        break;
      default:
        messageText = `[${msg.type || "unknown"} message received]`;
    }

    if (!messageText) {
      messageText = "[Message received]";
    }

    console.log(`[WhatsApp Incoming] From: +${cleanDigits} (${profileName || "Unknown"}), Message: "${messageText}"`);

    // Find candidate matching the phone number (last 10 digits match)
    let candidate = await CandidateModel.findOne({
      $or: [
        { normalizedPhone: { $regex: `${last10}$` } },
        { phone: { $regex: `${last10}$` } },
      ],
    });

    if (candidate) {
      // Existing Candidate: Update last contacted time and log activity
      await CandidateModel.updateOne(
        { _id: candidate._id },
        { $set: { lastContactedAt: new Date() } }
      );

      const senderLabel = candidate.name ? `${candidate.name} (+${cleanDigits})` : `+${cleanDigits}`;

      await ActivityLogModel.create({
        candidateId: candidate._id,
        candidateName: candidate.name || "Candidate",
        type: "WHATSAPP_RECEIVED",
        message: `WhatsApp Reply: "${messageText}"`,
        performedBy: senderLabel,
        performedByUserId: candidate._id,
      });

      await WhatsAppMessageModel.create({
        candidateId: candidate._id,
        candidateName: candidate.name || "Candidate",
        phone: candidate.phone || `+${cleanDigits}`,
        direction: "INBOUND",
        message: messageText,
        senderName: candidate.name || profileName || `+${cleanDigits}`,
        senderUserId: candidate._id,
        wamid: msg.id || null,
        status: "RECEIVED",
      });

      console.log(`[WhatsApp Webhook] Logged reply to candidate: ${candidate.name} (${candidate._id})`);
    } else {
      // New Contact: Auto-create as an Inbound Candidate Lead so the team doesn't lose the message
      const newCandidateId = randomUUID();
      const candidateName = profileName || `WhatsApp User (+${cleanDigits})`;

      const createdCandidate = await CandidateModel.create({
        _id: newCandidateId,
        name: candidateName,
        phone: `+${cleanDigits}`,
        email: "",
        position: "WhatsApp Inbound Applicant",
        experience: "",
        location: "",
        skills: [],
        source: "WEBSITE_APPLICATION",
        resumeName: "",
        status: "NEW",
        appliedDate: new Date(),
        lastContactedAt: new Date(),
        notes: `Inbound WhatsApp conversation initiated. First message: "${messageText}"`,
      });

      await ActivityLogModel.create({
        candidateId: createdCandidate._id,
        candidateName: candidateName,
        type: "WHATSAPP_RECEIVED",
        message: `Inbound WhatsApp Message: "${messageText}"`,
        performedBy: `${candidateName} (+${cleanDigits})`,
        performedByUserId: createdCandidate._id,
      });

      await WhatsAppMessageModel.create({
        candidateId: createdCandidate._id,
        candidateName: candidateName,
        phone: `+${cleanDigits}`,
        direction: "INBOUND",
        message: messageText,
        senderName: candidateName,
        senderUserId: createdCandidate._id,
        wamid: msg.id || null,
        status: "RECEIVED",
      });

      console.log(`[WhatsApp Webhook] Created new lead for incoming WhatsApp: ${candidateName} (${createdCandidate._id})`);
    }
  }
}

export const whatsappWebhookController = new WhatsAppWebhookController();
