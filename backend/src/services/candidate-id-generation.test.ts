import { describe, expect, it, vi, beforeEach } from "vitest";
import { candidateService, CandidateRepository } from "./candidate.service";
import { CandidateModel } from "../models/candidate.model";
import { AuthenticatedAccount } from "../models/user.model";
import { CounterModel } from "../models/counter.model";
import { CourseModel } from "../models/course.model";
import { ActivityLogModel } from "../models/activity-log.model";

describe("Centralized Automatic Candidate ID Generation Integration", () => {
  const managerAccount: AuthenticatedAccount = {
    id: "MGR-001",
    role: "MANAGER",
    name: "Operations Manager",
    email: "manager@tvktech.com",
    username: "manager",
    employeeId: "EMP-MGR-001",
    active: true,
    mustChangePassword: false,
  };

  let mockCounterSeq = 0;

  beforeEach(() => {
    vi.restoreAllMocks();
    mockCounterSeq = 0;

    (vi.spyOn(CounterModel, "findOneAndUpdate") as any).mockImplementation(async (query: any, update: any) => {
      const inc = update.$inc?.seq || 1;
      mockCounterSeq += inc;
      return { _id: query._id, seq: mockCounterSeq } as any;
    });

    vi.spyOn(CourseModel, "findOne").mockResolvedValue(null as any);
    vi.spyOn(ActivityLogModel, "create").mockResolvedValue({} as any);
  });

  it("should assign sequential TVK-YY-NNNNN IDs to Inbound and Outbound candidates sharing one counter", async () => {
    let createdRecords: any[] = [];
    vi.spyOn(CandidateRepository.prototype, "findDuplicate").mockResolvedValue(null);
    vi.spyOn(CandidateRepository.prototype, "create").mockImplementation(async (record: any) => {
      createdRecords.push(record);
      return {
        ...record,
        id: record._id,
        toJSON: () => ({ ...record, id: record._id }),
      } as any;
    });

    // 1. Inbound Candidate Registration
    await candidateService.registerPublic({
      name: "Alice Inbound",
      email: "alice@example.com",
      phone: "+91 99999 11111",
      dateOfBirth: "2000-01-01",
      address: "123 Main St",
      location: "Chennai",
      state: "Tamil Nadu",
      pincode: "600001",
      degree: "B.Tech",
      college: "Anna University",
      yearOfPassing: "2024",
      lookingFor: "Course",
      programmingLanguage: "Java Full Stack",
      modeOfCourse: "Online",
      howDidYouFindUs: "Google",
    } as any);

    // 2. Outbound Candidate Creation
    await candidateService.createOutbound(
      {
        name: "Bob Outbound",
        email: "bob@example.com",
        phone: "+91 99999 22222",
        position: "Python Developer",
        experience: "2 Years",
        location: "Bengaluru",
        skills: ["Python", "Django"],
        entryMethod: "MANUAL_TYPING",
      },
      undefined,
      managerAccount
    );

    // 3. Manager Direct Creation / Batch Import
    await candidateService.create(
      {
        name: "Charlie Direct",
        email: "charlie@example.com",
        phone: "+91 99999 33333",
        position: "React Developer",
        experience: "Fresher",
        location: "Hyderabad",
        skills: ["React", "TypeScript"],
        source: "EXCEL_IMPORT",
        resumeName: "charlie.pdf",
        status: "NEW",
        notes: "",
      },
      managerAccount
    );

    expect(createdRecords).toHaveLength(3);
    const yr = new Date().getFullYear().toString().slice(-2);

    expect(createdRecords[0]._id).toBe(`TVK-${yr}-00001`);
    expect(createdRecords[0].name).toBe("Alice Inbound");

    expect(createdRecords[1]._id).toBe(`TVK-${yr}-00002`);
    expect(createdRecords[1].name).toBe("Bob Outbound");

    expect(createdRecords[2]._id).toBe(`TVK-${yr}-00003`);
    expect(createdRecords[2].name).toBe("Charlie Direct");
  });

  it("should preserve existing Candidate ID during updates and never regenerate", async () => {
    const existingCandidate = {
      id: "TVK-26-00042",
      _id: "TVK-26-00042",
      name: "David Preserved",
      email: "david@example.com",
      phone: "+91 99999 44444",
      status: "NEW",
      save: async function () { return this; },
      toJSON: function () { return { ...this, id: this._id }; },
      markModified: () => {},
    };

    vi.spyOn(CandidateRepository.prototype, "findById").mockResolvedValue(existingCandidate as any);
    vi.spyOn(CandidateRepository.prototype, "findDuplicate").mockResolvedValue(null);

    const updated = await candidateService.update(
      "TVK-26-00042",
      { name: "David Updated", location: "Coimbatore" },
      managerAccount
    );

    expect(updated["id"]).toBe("TVK-26-00042");
    expect(updated["name"]).toBe("David Updated");
    // Counter must not have been touched
    expect(mockCounterSeq).toBe(0);
  });
});
