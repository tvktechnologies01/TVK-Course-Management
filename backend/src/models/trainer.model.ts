import { HydratedDocument, Model, Schema, model, models } from "mongoose";

export const TRAINER_EMPLOYMENT_TYPES = ["FULL_TIME", "PART_TIME", "CONTRACT"] as const;
export type TrainerEmploymentType = typeof TRAINER_EMPLOYMENT_TYPES[number];

export const TRAINER_AVAILABILITY_STATUSES = ["AVAILABLE", "ABSENT", "ON_LEAVE", "UNAVAILABLE"] as const;
export type TrainerAvailabilityStatus = typeof TRAINER_AVAILABILITY_STATUSES[number];

export const TRAINER_STATUSES = ["ACTIVE", "INACTIVE"] as const;
export type TrainerStatus = typeof TRAINER_STATUSES[number];

export interface TrainerRecord {
  _id: string; // e.g. "TVK-TR-00001"
  name: string;
  email: string;
  phone: string;
  qualification: string;
  specialization: string;
  skills: string[];
  assignedCourses: string[]; // Courses currently assigned to teach
  qualifiedCourses: string[]; // Courses qualified to teach
  employmentType: TrainerEmploymentType;
  maxCapacity: number;
  currentStudentCount: number;
  availability: TrainerAvailabilityStatus;
  status: TrainerStatus;
  absenceStartDate: Date | null;
  expectedReturnDate: Date | null;
  actualReturnDate: Date | null;
  absenceReason?: string;
  hourlyRate?: number;
  contractTerms?: string;
  documents?: Array<{ name: string; url?: string; uploadedAt: Date }>;
  averageRating?: number;
  totalRatings?: number;
  notes?: string;
  createdBy?: string;
  createdByUserId?: string;
  // Portal Credentials
  accountPasswordHash?: string;
  accountPassword?: string;
  mustChangePassword?: boolean;
  lastLoginAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type TrainerDocument = HydratedDocument<TrainerRecord>;

const trainerSchema = new Schema<TrainerRecord>(
  {
    _id: { type: String, required: true },
    name: { type: String, required: true, trim: true, maxlength: 160, index: true },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254, index: true },
    phone: { type: String, default: "", trim: true, maxlength: 40 },
    qualification: { type: String, default: "", trim: true, maxlength: 120 },
    specialization: { type: String, default: "", trim: true, maxlength: 160 },
    skills: { type: [String], default: [] },
    assignedCourses: { type: [String], default: [] },
    qualifiedCourses: { type: [String], default: [] },
    employmentType: {
      type: String,
      enum: TRAINER_EMPLOYMENT_TYPES,
      default: "FULL_TIME",
      required: true,
    },
    maxCapacity: { type: Number, default: 20, min: 1 },
    currentStudentCount: { type: Number, default: 0, min: 0 },
    availability: {
      type: String,
      enum: TRAINER_AVAILABILITY_STATUSES,
      default: "AVAILABLE",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: TRAINER_STATUSES,
      default: "ACTIVE",
      required: true,
      index: true,
    },
    absenceStartDate: { type: Date, default: null },
    expectedReturnDate: { type: Date, default: null },
    actualReturnDate: { type: Date, default: null },
    absenceReason: { type: String, default: "", maxlength: 1000 },
    hourlyRate: { type: Number, default: 0, min: 0 },
    contractTerms: { type: String, default: "", maxlength: 2000 },
    documents: {
      type: [
        {
          name: { type: String, required: true },
          url: { type: String, default: "" },
          uploadedAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
    averageRating: { type: Number, default: 5.0, min: 1, max: 5 },
    totalRatings: { type: Number, default: 0, min: 0 },
    notes: { type: String, default: "", maxlength: 2000 },
    createdBy: { type: String, default: "Manager" },
    createdByUserId: { type: String, default: "" },
    accountPasswordHash: { type: String, select: false },
    accountPassword: { type: String, default: "TVK@Trainer2026" },
    mustChangePassword: { type: Boolean, default: true },
    lastLoginAt: { type: Date, default: null },
  },
  {
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
  }
);

trainerSchema.index({ status: 1, availability: 1 });
trainerSchema.index({ qualifiedCourses: 1 });

export const TrainerModel: Model<TrainerRecord> =
  (models["Trainer"] as Model<TrainerRecord>) ??
  model<TrainerRecord>("Trainer", trainerSchema);
