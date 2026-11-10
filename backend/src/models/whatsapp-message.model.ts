import { randomUUID } from "node:crypto";
import { Model, Schema, model, models } from "mongoose";

export interface WhatsAppMessageRecord {
  _id: string;
  candidateId: string;
  candidateName: string;
  phone: string;
  direction: "INBOUND" | "OUTBOUND";
  message: string;
  templateKey?: string | null;
  templateName?: string | null;
  senderName: string;
  senderUserId?: string | null;
  wamid?: string | null;
  status: "SENT" | "DELIVERED" | "READ" | "FAILED" | "RECEIVED";
  createdAt: Date;
}

const whatsAppMessageSchema = new Schema<WhatsAppMessageRecord>(
  {
    _id: { type: String, default: () => randomUUID() },
    candidateId: { type: String, required: true, index: true },
    candidateName: { type: String, default: "", trim: true },
    phone: { type: String, required: true, index: true },
    direction: { type: String, enum: ["INBOUND", "OUTBOUND"], required: true },
    message: { type: String, required: true, maxlength: 10000 },
    templateKey: { type: String, default: null },
    templateName: { type: String, default: null },
    senderName: { type: String, default: "" },
    senderUserId: { type: String, default: null },
    wamid: { type: String, default: null },
    status: {
      type: String,
      enum: ["SENT", "DELIVERED", "READ", "FAILED", "RECEIVED"],
      default: "SENT",
    },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false }
);

whatsAppMessageSchema.index({ candidateId: 1, createdAt: 1 });
whatsAppMessageSchema.index({ phone: 1, createdAt: 1 });

export const WhatsAppMessageModel: Model<WhatsAppMessageRecord> =
  (models["WhatsAppMessage"] as Model<WhatsAppMessageRecord>) ??
  model<WhatsAppMessageRecord>("WhatsAppMessage", whatsAppMessageSchema);
