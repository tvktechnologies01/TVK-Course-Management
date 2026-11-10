import { HydratedDocument, Model, Schema, model, models } from "mongoose";

export interface StudentScorecardRecord {
  _id: string;
  studentId: string;
  studentName: string;
  courseName: string;
  trainerId: string;
  trainerName: string;
  technicalScore: number; // 1-10
  problemSolvingScore: number; // 1-10
  communicationScore: number; // 1-10
  overallScore: number; // Average (1-10)
  readinessStatus: "READY" | "NEEDS_IMPROVEMENT" | "NOT_READY";
  feedback: string;
  recommendedRole?: string;
  evaluatedBy: string;
  assessedAt: Date;
}

export type StudentScorecardDocument = HydratedDocument<StudentScorecardRecord>;

const scorecardSchema = new Schema<StudentScorecardRecord>(
  {
    _id: { type: String, required: true },
    studentId: { type: String, required: true, index: true },
    studentName: { type: String, required: true, trim: true },
    courseName: { type: String, required: true, trim: true, index: true },
    trainerId: { type: String, required: true, index: true },
    trainerName: { type: String, required: true, trim: true },
    technicalScore: { type: Number, required: true, min: 1, max: 10 },
    problemSolvingScore: { type: Number, required: true, min: 1, max: 10 },
    communicationScore: { type: Number, required: true, min: 1, max: 10 },
    overallScore: { type: Number, required: true, min: 1, max: 10 },
    readinessStatus: {
      type: String,
      enum: ["READY", "NEEDS_IMPROVEMENT", "NOT_READY"],
      default: "NEEDS_IMPROVEMENT",
      required: true,
      index: true,
    },
    feedback: { type: String, default: "", maxlength: 2000 },
    recommendedRole: { type: String, default: "", maxlength: 160 },
    evaluatedBy: { type: String, default: "Trainer" },
    assessedAt: { type: Date, default: Date.now },
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

scorecardSchema.index({ studentId: 1, assessedAt: -1 });

export const StudentScorecardModel: Model<StudentScorecardRecord> =
  (models["StudentScorecard"] as Model<StudentScorecardRecord>) ??
  model<StudentScorecardRecord>("StudentScorecard", scorecardSchema);
