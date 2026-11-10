import { CounterModel } from "../models/counter.model";

/**
 * Generates the next sequential Candidate ID formatted as:
 * TVK-[last two digits of year]-[5-digit sequential number]
 * e.g., TVK-26-00001, TVK-26-00002, TVK-27-00001
 *
 * Uses MongoDB findOneAndUpdate with $inc for atomic, transaction-safe,
 * concurrent increments that reset per year.
 */
export async function getNextCandidateId(customDate?: Date): Promise<string> {
  const date = customDate || new Date();
  const yearSuffix = date.getFullYear().toString().slice(-2); // "26", "27"
  const counterId = `candidate_id_${yearSuffix}`;

  const counter = await CounterModel.findOneAndUpdate(
    { _id: counterId },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  const seqNumber = counter.seq;
  const paddedSeq = seqNumber.toString().padStart(5, "0");
  return `TVK-${yearSuffix}-${paddedSeq}`;
}

/**
 * Generates the next sequential Trainer ID formatted as:
 * TVK-TR-00001, TVK-TR-00002, etc.
 */
export async function getNextTrainerId(): Promise<string> {
  const counterId = "trainer_id";
  const counter = await CounterModel.findOneAndUpdate(
    { _id: counterId },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  const seqNumber = counter.seq;
  const paddedSeq = seqNumber.toString().padStart(5, "0");
  return `TVK-TR-${paddedSeq}`;
}
