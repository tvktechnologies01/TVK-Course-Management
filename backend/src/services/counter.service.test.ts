import { describe, expect, it, vi, beforeEach } from "vitest";
import { CounterModel } from "../models/counter.model";
import { getNextCandidateId, getNextTrainerId } from "./counter.service";

describe("Centralized Candidate ID Counter Service", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should generate sequential IDs starting from 00001 for the current year", async () => {
    const memoryCounters: Record<string, number> = {};

    (vi.spyOn(CounterModel, "findOneAndUpdate") as any).mockImplementation(async (query: any, update: any) => {
      const id = query._id;
      const inc = update.$inc?.seq || 1;
      memoryCounters[id] = (memoryCounters[id] || 0) + inc;
      return { _id: id, seq: memoryCounters[id] } as any;
    });

    const id1 = await getNextCandidateId(new Date(2026, 0, 1));
    const id2 = await getNextCandidateId(new Date(2026, 5, 15));
    const id3 = await getNextCandidateId(new Date(2026, 11, 31));

    expect(id1).toBe("TVK-26-00001");
    expect(id2).toBe("TVK-26-00002");
    expect(id3).toBe("TVK-26-00003");
  });

  it("should automatically reset sequence to 00001 when year changes", async () => {
    const memoryCounters: Record<string, number> = {};

    (vi.spyOn(CounterModel, "findOneAndUpdate") as any).mockImplementation(async (query: any, update: any) => {
      const id = query._id;
      const inc = update.$inc?.seq || 1;
      memoryCounters[id] = (memoryCounters[id] || 0) + inc;
      return { _id: id, seq: memoryCounters[id] } as any;
    });

    const id2026 = await getNextCandidateId(new Date(2026, 11, 31));
    expect(id2026).toBe("TVK-26-00001");

    const id2027_1 = await getNextCandidateId(new Date(2027, 0, 1));
    const id2027_2 = await getNextCandidateId(new Date(2027, 0, 2));

    expect(id2027_1).toBe("TVK-27-00001");
    expect(id2027_2).toBe("TVK-27-00002");

    // Next 2026 generation must still increment 2026 without affecting 2027
    const id2026_next = await getNextCandidateId(new Date(2026, 11, 31));
    expect(id2026_next).toBe("TVK-26-00002");
  });

  it("should handle concurrent simultaneous requests safely without collisions", async () => {
    let currentSeq = 0;
    (vi.spyOn(CounterModel, "findOneAndUpdate") as any).mockImplementation(async () => {
      currentSeq += 1;
      return { _id: "candidate_id_26", seq: currentSeq } as any;
    });

    const promises = Array.from({ length: 25 }, () =>
      getNextCandidateId(new Date(2026, 0, 1))
    );
    const results = await Promise.all(promises);

    expect(results).toHaveLength(25);
    const uniqueIds = new Set(results);
    expect(uniqueIds.size).toBe(25);

    // Ensure all match the pattern TVK-26-XXXXX
    results.forEach((id) => {
      expect(id).toMatch(/^TVK-26-\d{5}$/);
    });

    // Check sorted sequence contains 00001 through 00025
    const sorted = [...results].sort();
    expect(sorted[0]).toBe("TVK-26-00001");
    expect(sorted[24]).toBe("TVK-26-00025");
  });

  it("should generate sequential Trainer IDs in format TVK-TR-00001", async () => {
    let currentTrainerSeq = 0;
    (vi.spyOn(CounterModel, "findOneAndUpdate") as any).mockImplementation(async () => {
      currentTrainerSeq += 1;
      return { _id: "trainer_id", seq: currentTrainerSeq } as any;
    });

    const t1 = await getNextTrainerId();
    const t2 = await getNextTrainerId();
    const t3 = await getNextTrainerId();

    expect(t1).toBe("TVK-TR-00001");
    expect(t2).toBe("TVK-TR-00002");
    expect(t3).toBe("TVK-TR-00003");
  });
});
