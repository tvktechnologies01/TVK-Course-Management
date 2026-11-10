import { HydratedDocument, Model, Schema, model, models } from "mongoose";

export type PaymentStatus = "Verification Pending" | "Verified" | "Rejected";

export interface PaymentRecord {
  _id: string;
  candidateId: string;
  candidateName: string;
  courseName: string;
  amount: number;
  transactionRef: string;
  paymentProofUrl?: string;
  status: PaymentStatus;
  receiptNumber?: string | null;
  receiptIssueDate?: Date | null;
  verifiedAt?: Date | null;
  verifiedBy?: string | null;
  rejectionReason?: string;
  notes?: string;
  paidAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export type PaymentDocument = HydratedDocument<PaymentRecord>;

const paymentSchema = new Schema<PaymentRecord>({
  _id: { type: String, required: true },
  candidateId: { type: String, required: true, index: true },
  candidateName: { type: String, default: "", trim: true },
  courseName: { type: String, default: "", trim: true },
  amount: { type: Number, required: true, min: 0 },
  transactionRef: { type: String, required: true, trim: true, maxlength: 100 },
  paymentProofUrl: { type: String, default: "" },
  status: {
    type: String,
    enum: ["Verification Pending", "Verified", "Rejected"],
    default: "Verification Pending",
    required: true,
  },
  receiptNumber: { type: String, default: null, sparse: true, index: true },
  receiptIssueDate: { type: Date, default: null },
  verifiedAt: { type: Date, default: null },
  verifiedBy: { type: String, default: null },
  rejectionReason: { type: String, default: "", maxlength: 1000 },
  notes: { type: String, default: "", maxlength: 2000 },
  paidAt: { type: Date, default: Date.now },
}, {
  timestamps: true,
  versionKey: false,
  toJSON: {
    virtuals: true,
    transform(_document, value: Record<string, unknown>) {
      value["id"] = value["id"] || value["_id"] || (_document as any)?._id;
      delete value["_id"];
      return value;
    },
  },
});

paymentSchema.index({ candidateId: 1, createdAt: -1 });
paymentSchema.index({ status: 1, createdAt: -1 });

export const PaymentModel: Model<PaymentRecord> =
  (models["Payment"] as Model<PaymentRecord>) ??
  model<PaymentRecord>("Payment", paymentSchema);
