import { HydratedDocument, Model, Schema, model, models } from "mongoose";

export interface TrainerFeedbackRecord {
  _id: string;
  trainerId: string;
  trainerName: string;
  studentId: string;
  studentName: string;
  courseName: string;
  rating: number; // 1-5
  feedback: string;
  createdAt: Date;
}

export type TrainerFeedbackDocument = HydratedDocument<TrainerFeedbackRecord>;

const feedbackSchema = new Schema<TrainerFeedbackRecord>(
  {
    _id: { type: String, required: true },
    trainerId: { type: String, required: true, index: true },
    trainerName: { type: String, required: true, trim: true },
    studentId: { type: String, required: true, index: true },
    studentName: { type: String, required: true, trim: true },
    courseName: { type: String, required: true, trim: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    feedback: { type: String, default: "", maxlength: 1000 },
    createdAt: { type: Date, default: Date.now },
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

feedbackSchema.index({ trainerId: 1, createdAt: -1 });

export const TrainerFeedbackModel: Model<TrainerFeedbackRecord> =
  (models["TrainerFeedback"] as Model<TrainerFeedbackRecord>) ??
  model<TrainerFeedbackRecord>("TrainerFeedback", feedbackSchema);
