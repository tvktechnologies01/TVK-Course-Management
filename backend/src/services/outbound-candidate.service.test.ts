import { describe, expect, it, vi, beforeEach } from "vitest";
import { candidateService, CandidateRepository } from "./candidate.service";
import { CandidateModel } from "../models/candidate.model";
import { AuthenticatedAccount } from "../models/user.model";
import { HttpError } from "../middleware/error-handler";

describe("Outbound Candidate Service Tests", () => {
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

  const hrAccount1: AuthenticatedAccount = {
    id: "HR-001",
    role: "HR",
    name: "Priya Sharma",
    email: "priya@tvktech.com",
    username: "priya",
    employeeId: "EMP-HR-001",
    active: true,
    mustChangePassword: false,
  };

  const hrAccount2: AuthenticatedAccount = {
    id: "HR-002",
    role: "HR",
    name: "Vikram Seth",
    email: "vikram@tvktech.com",
    username: "vikram",
    employeeId: "EMP-HR-002",
    active: true,
    mustChangePassword: false,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(CandidateModel, "countDocuments").mockResolvedValue(0 as never);
  });

  describe("listOutbound Query Filters", () => {
    it("allows Manager to retrieve ALL outbound candidates including unassigned candidates (assignedToId: null)", async () => {
      let capturedFilter: any;
      vi.spyOn(CandidateRepository.prototype, "list").mockImplementation(async (filter) => {
        capturedFilter = filter;
        return {
          items: [
            {
              id: "OUT-001",
              name: "Unassigned Candidate",
              source: "OUTBOUND",
              assignedToId: null,
              paymentToken: "tok-1",
              toJSON: () => ({ id: "OUT-001", name: "Unassigned Candidate", assignedToId: null }),
            } as any,
          ],
          total: 1,
        };
      });

      const result = await candidateService.listOutbound({}, managerAccount);

      expect(capturedFilter.source).toBe("OUTBOUND");
      // filter.assignedToId must NOT be restricted to { $ne: null }
      expect(capturedFilter.assignedToId).toBeUndefined();
      expect(result.items.length).toBe(1);
      expect(result.items[0].assignedToId).toBeNull();
    });

    it("allows Manager to explicitly filter for Pending HR Assignment (hrId: 'unassigned' or 'pending')", async () => {
      let capturedFilter: any;
      vi.spyOn(CandidateRepository.prototype, "list").mockImplementation(async (filter) => {
        capturedFilter = filter;
        return { items: [], total: 0 };
      });

      await candidateService.listOutbound({ hrId: "unassigned" }, managerAccount);
      expect(capturedFilter.assignedToId).toBeNull();

      await candidateService.listOutbound({ hrId: "pending" }, managerAccount);
      expect(capturedFilter.assignedToId).toBeNull();
    });

    it("allows Manager to explicitly filter for Assigned candidates (hrId: 'assigned')", async () => {
      let capturedFilter: any;
      vi.spyOn(CandidateRepository.prototype, "list").mockImplementation(async (filter) => {
        capturedFilter = filter;
        return { items: [], total: 0 };
      });

      await candidateService.listOutbound({ hrId: "assigned" }, managerAccount);
      expect(capturedFilter.assignedToId).toEqual({ $ne: null });
    });

    it("allows Manager to filter by a specific HR Recruiter employeeId", async () => {
      let capturedFilter: any;
      vi.spyOn(CandidateRepository.prototype, "list").mockImplementation(async (filter) => {
        capturedFilter = filter;
        return { items: [], total: 0 };
      });

      await candidateService.listOutbound({ hrId: "EMP-HR-001" }, managerAccount);
      expect(capturedFilter.assignedToId).toBe("EMP-HR-001");
    });

    it("strictly restricts HR user to only their own assigned candidates", async () => {
      let capturedFilter: any;
      vi.spyOn(CandidateRepository.prototype, "list").mockImplementation(async (filter) => {
        capturedFilter = filter;
        return { items: [], total: 0 };
      });

      // Even if an HR attempts to pass hrId or unassigned in query, HR role must lock to their employeeId
      await candidateService.listOutbound({ hrId: "EMP-HR-002" }, hrAccount1);
      expect(capturedFilter.source).toBe("OUTBOUND");
      expect(capturedFilter.assignedToId).toBe("EMP-HR-001");
    });

    it("returns the global outbound count while keeping HR candidate records restricted", async () => {
      let capturedFilter: any;
      vi.spyOn(CandidateModel, "countDocuments").mockResolvedValue(5 as never);
      vi.spyOn(CandidateRepository.prototype, "list").mockImplementation(async (filter) => {
        capturedFilter = filter;
        return { items: [], total: 0 };
      });

      const result = await candidateService.listOutbound({}, hrAccount1);

      expect(capturedFilter.assignedToId).toBe("EMP-HR-001");
      expect(result.items).toEqual([]);
      expect(result.pagination.total).toBe(0);
      expect(result.totalOutboundCount).toBe(5);
    });
  });

  describe("Candidate Access Control (findInboundOrAccessible)", () => {
    it("allows Manager to view an unassigned Outbound candidate", async () => {
      const mockOutbound = {
        id: "OUT-001",
        _id: "OUT-001",
        name: "Test Outbound",
        source: "OUTBOUND",
        assignedToId: null,
      };
      vi.spyOn(CandidateModel, "findById").mockResolvedValue(mockOutbound as any);

      const found = await candidateService.findInboundOrAccessible("OUT-001", managerAccount);
      expect(found).toBeDefined();
      expect(found.id).toBe("OUT-001");
    });

    it("denies HR user from viewing an unassigned Outbound candidate (throws 404)", async () => {
      const mockOutbound = {
        id: "OUT-001",
        _id: "OUT-001",
        name: "Test Outbound",
        source: "OUTBOUND",
        assignedToId: null,
      };
      vi.spyOn(CandidateModel, "findById").mockResolvedValue(mockOutbound as any);

      await expect(
        candidateService.findInboundOrAccessible("OUT-001", hrAccount1)
      ).rejects.toThrow(new HttpError(404, "CANDIDATE_NOT_FOUND", "Candidate not found."));
    });

    it("denies HR user from viewing an Outbound candidate assigned to another HR", async () => {
      const mockOutboundAssignedOther = {
        id: "OUT-002",
        _id: "OUT-002",
        name: "Other Outbound",
        source: "OUTBOUND",
        assignedToId: "EMP-HR-002",
      };
      vi.spyOn(CandidateModel, "findById").mockResolvedValue(mockOutboundAssignedOther as any);

      await expect(
        candidateService.findInboundOrAccessible("OUT-002", hrAccount1)
      ).rejects.toThrow(new HttpError(404, "CANDIDATE_NOT_FOUND", "Candidate not found."));
    });

    it("allows HR user to view an Outbound candidate assigned to them", async () => {
      const mockOutboundAssignedMe = {
        id: "OUT-003",
        _id: "OUT-003",
        name: "My Outbound Candidate",
        source: "OUTBOUND",
        assignedToId: "EMP-HR-001",
      };
      vi.spyOn(CandidateModel, "findById").mockResolvedValue(mockOutboundAssignedMe as any);

      const found = await candidateService.findInboundOrAccessible("OUT-003", hrAccount1);
      expect(found).toBeDefined();
      expect(found.id).toBe("OUT-003");
    });
  });
});
