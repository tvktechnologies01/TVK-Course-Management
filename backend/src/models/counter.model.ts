import { HydratedDocument, Model, Schema, model, models } from "mongoose";

export interface CounterRecord {
  _id: string; // e.g. "candidate_id_26"
  seq: number;
}

export type CounterDocument = HydratedDocument<CounterRecord>;

const counterSchema = new Schema<CounterRecord>(
  {
    _id: { type: String, required: true },
    seq: { type: Number, default: 0 },
  },
  {
    versionKey: false,
    timestamps: true,
  }
);

export const CounterModel: Model<CounterRecord> =
  (models["Counter"] as Model<CounterRecord>) ||
  model<CounterRecord>("Counter", counterSchema);
