import { HydratedDocument, Model, Schema, model, models } from "mongoose";

export const CANDIDATE_STATUSES = [
  "NEW", "ASSIGNED", "CONTACT_PENDING", "CALLED", "NO_RESPONSE", "CALL_BACK",
  "INTERESTED", "NOT_INTERESTED", "INTERVIEW_SCHEDULED", "INTERVIEW_COMPLETED",
  "SELECTED", "REJECTED", "ON_HOLD", "ARCHIVED",
] as const;

export const CANDIDATE_SOURCES = ["IR_RESUME", "WEBSITE_APPLICATION", "EXCEL_IMPORT", "OUTBOUND"] as const;
export type CandidateStatus = typeof CANDIDATE_STATUSES[number];
export type CandidateSource = typeof CANDIDATE_SOURCES[number];

export interface CandidateRecord {
  _id: string;
  name: string;
  phone: string;
  email: string;
  normalizedPhone?: string;
  normalizedEmail?: string;
  position: string;
  experience: string;
  location: string;
  skills: string[];
  source: CandidateSource;
  resumeName: string;
  resumeFileId?: string;
  status: CandidateStatus;
  assignedToId: string | null;
  assignedToName: string | null;
  appliedDate: Date;
  lastContactedAt: Date | null;
  nextFollowUpAt: Date | null;
  notes: string;
  dateOfBirth?: string;
  address?: string;
  state?: string;
  pincode?: string;
  yearOfPassing?: string;
  degree?: string;
  college?: string;
  lookingFor?: string;
  programmingLanguage?: string;
  modeOfCourse?: string;
  primarySkills?: string;
  secondarySkills?: string;
  howDidYouFindUs?: string;
  courseDuration?: string;
  preferredStartDate?: Date | null;
  additionalTraining?: string[];

  // HR-managed Course Details & Inbound
  joiningDate?: string | null;
  courseDate?: string | null;
  courseStartDate?: string | null;
  courseName?: string;
  totalFee?: number;
  amountPaid?: number;
  balance?: number;
  paymentStatus?: "Pending" | "Verification Pending" | "Partially Paid" | "Paid" | "Rejected";
  paymentInstructions?: string;
  paymentQrCode?: string;
  paymentToken?: string;
  paymentTokenExpiresAt?: Date | null;

  // Candidate Portal Account
  accountCreated?: boolean;
  accountUsername?: string;
  accountPasswordHash?: string;
  accountPassword?: string;
  accountMustChangePassword?: boolean;
  accountCreatedAt?: Date | null;
  passwordResetToken?: string | null;
  passwordResetExpiresAt?: Date | null;

  // Trainer & Tasks
  trainerId?: string;
  trainerName?: string;
  trainerEmail?: string;
  trainerAssignedAt?: Date | null;
  trainerAllocationStatus?: "UNASSIGNED" | "ASSIGNED" | "REASSIGNED";
  expectedCompletionDate?: string | null;
  assignedTasks?: Array<{
    id: string;
    title: string;
    description: string;
    status: "Pending" | "In Progress" | "Completed";
    dueDate?: string;
  }>;
  correctionRequests?: Array<{
    id: string;
    requestText: string;
    requestedAt: Date;
    status: "Pending" | "In Progress" | "Resolved" | "Reviewed" | "Completed";
    completedAt?: Date | null;
    completedBy?: string | null;
    candidateName?: string;
    email?: string;
    phone?: string;
    courseName?: string;
    type?: "SUPPORT_REQUEST" | "CORRECTION";
  }>;

  // Course Completion & Certificate
  courseCompleted?: boolean;
  completionDate?: string | null;
  certificateStatus?: "NOT_ISSUED" | "ISSUED" | "REVOKED";
  certificateId?: string | null;
  certificateIssuedAt?: Date | null;
  certificateRevokedAt?: Date | null;
  certificateRevocationReason?: string | null;
  certificateSignatory?: string;
}

export type CandidateDocument = HydratedDocument<CandidateRecord>;

const candidateSchema = new Schema<CandidateRecord>({
  _id: { type: String, required: true },
  name: { type: String, default: "", trim: true, maxlength: 160 },
  phone: { type: String, default: "", trim: true, maxlength: 40 },
  email: { type: String, default: "", trim: true, lowercase: true, maxlength: 254 },
  normalizedPhone: { type: String, select: false },
  normalizedEmail: { type: String, select: false },
  position: { type: String, default: "", trim: true, maxlength: 160 },
  experience: { type: String, default: "", trim: true, maxlength: 120 },
  location: { type: String, default: "", trim: true, maxlength: 160 },
  skills: { type: [String], default: [] },
  source: { type: String, enum: CANDIDATE_SOURCES, required: true },
  resumeName: { type: String, default: "", trim: true, maxlength: 255 },
  resumeFileId: { type: String },
  status: { type: String, enum: CANDIDATE_STATUSES, default: "NEW", required: true },
  assignedToId: { type: String, default: null },
  assignedToName: { type: String, default: null },
  appliedDate: { type: Date, default: Date.now },
  lastContactedAt: { type: Date, default: null },
  nextFollowUpAt: { type: Date, default: null },
  notes: { type: String, default: "", maxlength: 12000 },
  dateOfBirth: { type: String, default: "", trim: true, maxlength: 40 },
  address: { type: String, default: "", trim: true, maxlength: 500 },
  state: { type: String, default: "", trim: true, maxlength: 100 },
  pincode: { type: String, default: "", trim: true, maxlength: 6 },
  yearOfPassing: { type: String, default: "", trim: true, maxlength: 20 },
  degree: { type: String, default: "", trim: true, maxlength: 120 },
  college: { type: String, default: "", trim: true, maxlength: 200 },
  lookingFor: { type: String, default: "", trim: true, maxlength: 80 },
  programmingLanguage: { type: String, default: "", trim: true, maxlength: 100 },
  modeOfCourse: { type: String, default: "", trim: true, maxlength: 40 },
  primarySkills: { type: String, default: "", trim: true, maxlength: 200 },
  secondarySkills: { type: String, default: "", trim: true, maxlength: 200 },
  howDidYouFindUs: { type: String, default: "", trim: true, maxlength: 80 },
  courseDuration: { type: String, default: "", trim: true, maxlength: 40 },
  preferredStartDate: { type: Date, default: null },
  additionalTraining: { type: [String], default: [] },

  joiningDate: { type: String, default: null },
  courseDate: { type: String, default: null },
  courseStartDate: { type: String, default: null },
  courseName: { type: String, default: "", trim: true, maxlength: 160 },
  totalFee: { type: Number, default: 0, min: 0 },
  amountPaid: { type: Number, default: 0, min: 0 },
  balance: { type: Number, default: 0 },
  paymentStatus: {
    type: String,
    enum: ["Pending", "Verification Pending", "Partially Paid", "Paid", "Rejected"],
    default: "Pending",
  },
  paymentInstructions: { type: String, default: "", maxlength: 2000 },
  paymentQrCode: { type: String, default: "" },
  paymentToken: { type: String, default: null },
  paymentTokenExpiresAt: { type: Date, default: null },

  accountCreated: { type: Boolean, default: false },
  accountUsername: { type: String, trim: true, lowercase: true, maxlength: 80 },
  accountPasswordHash: { type: String, default: null, select: false },
  accountPassword: { type: String, default: "" },
  accountMustChangePassword: { type: Boolean, default: false },
  accountCreatedAt: { type: Date, default: null },
  passwordResetToken: { type: String, default: null, select: false },
  passwordResetExpiresAt: { type: Date, default: null, select: false },

  trainerId: { type: String, default: null, index: true },
  trainerName: { type: String, default: "", trim: true, maxlength: 120 },
  trainerEmail: { type: String, default: "", trim: true, lowercase: true, maxlength: 254 },
  trainerAssignedAt: { type: Date, default: null },
  trainerAllocationStatus: { type: String, enum: ["UNASSIGNED", "ASSIGNED", "REASSIGNED"], default: "UNASSIGNED" },
  expectedCompletionDate: { type: String, default: null },
  assignedTasks: {
    type: [{
      id: { type: String, required: true },
      title: { type: String, required: true },
      description: { type: String, default: "" },
      status: { type: String, enum: ["Pending", "In Progress", "Completed"], default: "Pending" },
      dueDate: { type: String, default: null },
    }],
    default: [],
  },
  correctionRequests: {
    type: [{
      id: { type: String, required: true },
      requestText: { type: String, required: true },
      requestedAt: { type: Date, default: Date.now },
      status: { type: String, enum: ["Pending", "In Progress", "Resolved", "Reviewed", "Completed"], default: "Pending" },
      completedAt: { type: Date, default: null },
      completedBy: { type: String, default: null },
      candidateName: { type: String },
      email: { type: String },
      phone: { type: String },
      courseName: { type: String },
      type: { type: String, default: "SUPPORT_REQUEST" },
    }],
    default: [],
  },

  courseCompleted: { type: Boolean, default: false },
  completionDate: { type: String, default: null },
  certificateStatus: { type: String, enum: ["NOT_ISSUED", "ISSUED", "REVOKED"], default: "NOT_ISSUED" },
  certificateId: { type: String, default: null },
  certificateIssuedAt: { type: Date, default: null },
  certificateRevokedAt: { type: Date, default: null },
  certificateRevocationReason: { type: String, default: null },
  certificateSignatory: { type: String, default: "Dr. V. Kumar, Director of Training" },
}, {
  timestamps: true,
  versionKey: false,
  toJSON: {
    virtuals: true,
    transform(_document, value: Record<string, unknown>) {
      value["id"] = value["id"] || value["_id"] || (_document as any)?._id;
      delete value["_id"];
      delete value["normalizedEmail"];
      delete value["normalizedPhone"];
      delete value["accountPasswordHash"];
      delete value["passwordResetToken"];
      delete value["passwordResetExpiresAt"];
      return value;
    },
  },
});

candidateSchema.index({ normalizedEmail: 1 }, {
  unique: true,
  partialFilterExpression: { normalizedEmail: { $type: "string" } },
});
candidateSchema.index({ normalizedPhone: 1 }, {
  unique: true,
  partialFilterExpression: { normalizedPhone: { $type: "string" } },
});
candidateSchema.index({ accountUsername: 1 }, {
  unique: true,
  sparse: true,
});
candidateSchema.index({ paymentToken: 1 }, {
  sparse: true,
});
candidateSchema.index({ status: 1, createdAt: -1 });
candidateSchema.index({ assignedToId: 1, status: 1, updatedAt: -1 });
candidateSchema.index({ source: 1, createdAt: -1 });
candidateSchema.index({ name: "text", email: "text", phone: "text", position: "text" });

candidateSchema.pre<CandidateDocument>("validate", function setNormalizedContacts() {
  const email = (this.email || "").trim().toLowerCase();
  const phone = (this.phone || "").replace(/\D/g, "");
  this.normalizedEmail = email || undefined;
  this.normalizedPhone = phone || undefined;
});

export const CandidateModel: Model<CandidateRecord> = models["Candidate"] as Model<CandidateRecord> ?? model<CandidateRecord>("Candidate", candidateSchema);
