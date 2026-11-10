import { createHash, randomBytes, randomUUID } from "node:crypto";
import { FilterQuery } from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { ActivityLogModel } from "../models/activity-log.model";
import { AssignmentHistoryModel } from "../models/assignment-history.model";
import { CandidateDocument, CandidateModel, CandidateRecord, CandidateStatus } from "../models/candidate.model";
import { CourseModel } from "../models/course.model";
import { CrmControlModel } from "../models/crm-control.model";
import { PaymentModel, PaymentRecord } from "../models/payment.model";
import { ResumeFileModel } from "../models/resume-file.model";
import { UserModel } from "../models/user.model";
import { AuthenticatedAccount } from "../models/user.model";
import { HttpError } from "../middleware/error-handler";
import { ActivityLogService, activityLogService } from "./activity-log.service";
import { EmailService, emailService } from "./email.service";
import { WhatsAppService, whatsappService } from "./whatsapp.service";
import { certificatePdfService } from "./certificate-pdf.service";
import { receiptPdfService } from "./receipt-pdf.service";
import { offerLetterPdfService } from "./offer-letter-pdf.service";
import { normalizeCourseTitle, ensureCourseTracks } from "./course.service";
import { getNextCandidateId } from "./counter.service";
import {
  candidateListQuerySchema,
  CandidateRegistrationInput,
  courseCompletionSchema,
  courseDetailsUpdateSchema,
  createCandidateAccountSchema,
  candidatePortalLoginSchema,
  candidateChangePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  submitPaymentProofSchema,
  verifyPaymentSchema,
  rejectPaymentSchema,
  outboundCandidateSchema,
  correctionRequestSchema,
  contactManagerSchema,
  updateCandidateCredentialsSchema,
} from "../validators/candidate.validators";
import { paginationResult } from "../validators/common.validators";

export function deriveInitialCandidatePassword(candidateName?: string): string {
  const cleanName = (candidateName || "Candidate").replace(/[^a-zA-Z]/g, "") || "TVK";
  const initial = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
  return `TVK@${initial}!2026`;
}

export async function healCandidateAccountPasswords(): Promise<void> {
  try {
    const candidates = await CandidateModel.find({
      accountCreated: true,
      $or: [
        { accountPassword: { $exists: false } },
        { accountPassword: null },
        { accountPassword: "" },
      ],
    }).select("+accountPasswordHash");

    for (const cand of candidates) {
      const fallbackPass = deriveInitialCandidatePassword(cand.name);
      cand.accountPassword = fallbackPass;
      cand.accountPasswordHash = await bcrypt.hash(fallbackPass, 12);
      await cand.save();
    }
  } catch (err) {
    console.warn("Could not heal candidate account passwords:", err);
  }
}

export class CandidateRepository {
  findById(id: string): Promise<CandidateDocument | null> {
    return CandidateModel.findById(id);
  }

  findOne(filter: FilterQuery<CandidateRecord>): Promise<CandidateDocument | null> {
    return CandidateModel.findOne(filter);
  }

  async findDuplicate(email: string, phone: string, excludeId?: string): Promise<CandidateDocument | null> {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPhone = phone.replace(/\D/g, "");
    const checks: FilterQuery<CandidateRecord>[] = [];
    if (normalizedEmail) checks.push({ normalizedEmail });
    if (normalizedPhone) checks.push({ normalizedPhone });
    if (!checks.length) return null;

    return CandidateModel.findOne({
      $and: [
        { $or: checks },
        ...(excludeId ? [{ _id: { $ne: excludeId } }] : []),
      ],
    }).select("+normalizedEmail +normalizedPhone");
  }

  create(record: CandidateRecord): Promise<CandidateDocument> {
    return CandidateModel.create(record);
  }

  async list(
    filter: FilterQuery<CandidateRecord>,
    sort: Record<string, 1 | -1>,
    skip: number,
    limit: number,
  ): Promise<{ items: CandidateDocument[]; total: number }> {
    const [items, total] = await Promise.all([
      CandidateModel.find(filter).sort(sort).skip(skip).limit(limit),
      CandidateModel.countDocuments(filter),
    ]);
    return { items, total };
  }

  async update(document: CandidateDocument): Promise<CandidateDocument> {
    return document.save();
  }

  async delete(id: string): Promise<void> {
    await CandidateModel.deleteOne({ _id: id });
  }
}

export const candidateRepository = new CandidateRepository();

type CandidateCreate = Omit<CandidateRecord, "_id" | "normalizedEmail" | "normalizedPhone" | "assignedToId" | "assignedToName" | "lastContactedAt" | "nextFollowUpAt" | "appliedDate"> & {
  id?: string;
  appliedDate?: Date;
  resumeFileId?: string;
};

export class CandidateService {
  constructor(
    private readonly candidates: CandidateRepository = candidateRepository,
    private readonly logs: ActivityLogService = activityLogService,
    private readonly emails: EmailService = emailService,
    private readonly whatsapp: WhatsAppService = whatsappService,
  ) { }

  async list(rawQuery: unknown, account: AuthenticatedAccount) {
    const query = candidateListQuerySchema.parse(rawQuery);
    const filter: FilterQuery<CandidateRecord> = {};
    if (query.status) filter.status = query.status;
    if (query.source) filter.source = query.source;
    if (query.dateFrom || query.dateTo) {
      filter.appliedDate = {
        ...(query.dateFrom ? { $gte: query.dateFrom } : {}),
        ...(query.dateTo ? { $lte: query.dateTo } : {}),
      };
    }

    if (account.role === "HR") {
      filter.assignedToId = account.employeeId;
    } else if (query.hrId) {
      if (query.hrId === "unassigned" || query.hrId === "null") {
        filter.assignedToId = null;
      } else if (query.hrId === "assigned") {
        filter.assignedToId = { $ne: null };
      } else {
        filter.assignedToId = query.hrId;
      }
    }

    if (query.search) {
      const expression = new RegExp(query.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [
        { name: expression },
        { email: expression },
        { phone: expression },
        { position: expression },
      ];
    }

    const direction = query.order === "asc" ? 1 : -1;
    const result = await this.candidates.list(
      filter,
      { [query.sortBy]: direction, _id: 1 },
      (query.page - 1) * query.pageSize,
      query.pageSize,
    );
    return {
      items: result.items.map((candidate) => candidate.toJSON()),
      pagination: paginationResult(result.total, query.page, query.pageSize),
    };
  }

  async get(id: string, account: AuthenticatedAccount): Promise<Record<string, unknown>> {
    const candidate = await this.findInboundOrAccessible(id, account);
    return candidate.toJSON();
  }

  async create(input: CandidateCreate, account: AuthenticatedAccount): Promise<Record<string, unknown>> {
    if (account.role !== "MANAGER") throw new HttpError(403, "FORBIDDEN", "Only Managers can create candidates.");
    const duplicate = await this.candidates.findDuplicate(input.email, input.phone);
    if (duplicate) throw new HttpError(409, "CANDIDATE_DUPLICATE", "A candidate with this email or phone already exists.");

    if (input.resumeFileId) {
      const resumeExists = await ResumeFileModel.exists({
        _id: input.resumeFileId,
        candidateId: "",
        uploadedByUserId: account.id,
      });
      if (!resumeExists) throw new HttpError(422, "RESUME_INVALID", "The resume upload is unavailable or already attached.");
    }

    const { id, ...candidateInput } = input;
    const candidateId = id || (await getNextCandidateId());
    const candidate = await this.candidates.create({
      ...candidateInput,
      _id: candidateId,
      appliedDate: candidateInput.appliedDate ?? new Date(),
      assignedToId: null,
      assignedToName: null,
      lastContactedAt: null,
      nextFollowUpAt: null,
    });
    if (candidate.resumeFileId) {
      const attached = await ResumeFileModel.updateOne(
        { _id: candidate.resumeFileId, candidateId: "", uploadedByUserId: account.id },
        { $set: { candidateId: candidate.id } },
      );
      if (!attached.modifiedCount) {
        await this.candidates.delete(candidate.id);
        throw new HttpError(422, "RESUME_INVALID", "The resume upload could not be attached.");
      }
    }
    await this.logs.record(candidate.id, candidate.name, "CANDIDATE_CREATED", `Candidate added from ${candidate.resumeName || "manual entry"}`, account);
    return candidate.toJSON();
  }

  async createMany(inputs: CandidateCreate[], account: AuthenticatedAccount) {
    if (account.role !== "MANAGER") throw new HttpError(403, "FORBIDDEN", "Only Managers can import candidates.");
    if (inputs.length < 1 || inputs.length > 100) throw new HttpError(400, "BATCH_SIZE_INVALID", "Candidate import batches must contain 1 to 100 records.");

    const imported: Record<string, unknown>[] = [];
    const seenEmails = new Set<string>();
    const seenPhones = new Set<string>();
    for (const input of inputs) {
      const email = input.email.trim().toLowerCase();
      const phone = input.phone.replace(/\D/g, "");
      if ((email && seenEmails.has(email)) || (phone && seenPhones.has(phone)) || await this.candidates.findDuplicate(email, phone)) {
        continue;
      }
      if (email) seenEmails.add(email);
      if (phone) seenPhones.add(phone);
      try {
        imported.push(await this.create(input, account));
      } catch (error: unknown) {
        if (!(typeof error === "object" && error !== null && "code" in error && error.code === 11000)) throw error;
      }
    }
    return imported;
  }

  async update(id: string, changes: Partial<CandidateRecord> & { completedCorrectionRequestId?: string }, account: AuthenticatedAccount): Promise<Record<string, unknown>> {
    const candidate = await this.findInboundOrAccessible(id, account);

    if (changes.email !== undefined || changes.phone !== undefined) {
      const duplicate = await this.candidates.findDuplicate(changes.email ?? candidate.email, changes.phone ?? candidate.phone, id);
      if (duplicate) throw new HttpError(409, "CANDIDATE_DUPLICATE", "A candidate with this email or phone already exists.");
    }

    const { completedCorrectionRequestId, ...candidateChanges } = changes as any;
    for (const [key, value] of Object.entries(candidateChanges)) {
      if (value !== undefined) {
        (candidate as any)[key] = value;
      }
    }
    if (candidateChanges.skills) {
      candidate.skills = candidateChanges.skills;
      candidate.markModified("skills");
    }
    if (candidateChanges.additionalTraining) {
      candidate.additionalTraining = candidateChanges.additionalTraining;
      candidate.markModified("additionalTraining");
    }

    if (completedCorrectionRequestId && candidate.correctionRequests && candidate.correctionRequests.length > 0) {
      const req = candidate.correctionRequests.find((r) => r.id === completedCorrectionRequestId);
      if (req) {
        req.status = "Completed";
        req.completedAt = new Date();
        req.completedBy = account.name || account.email;
        candidate.markModified("correctionRequests");
      }
    }

    await candidate.save();
    await this.logs.record(candidate.id, candidate.name, "CANDIDATE_UPDATED", "Candidate information updated", account);
    return candidate.toJSON();
  }

  async addNote(id: string, note: string, account: AuthenticatedAccount): Promise<Record<string, unknown>> {
    const candidate = await this.findAccessible(id, account);
    candidate.notes = candidate.notes ? `${candidate.notes}\n${note}` : note;
    await this.candidates.update(candidate);
    await this.logs.record(candidate.id, candidate.name, "NOTE_ADDED", note, account);
    return candidate.toJSON();
  }

  async sendEmail(
    id: string,
    payload: { to: string; subject: string; message: string },
    account: AuthenticatedAccount,
  ) {
    const candidate = await this.findAccessible(id, account);
    const emailResult = await this.emails.sendCandidateEmail({
      to: payload.to,
      subject: payload.subject,
      message: payload.message,
      actor: account,
    });

    candidate.lastContactedAt = new Date();
    await this.candidates.update(candidate);

    await this.logs.record(
      candidate.id,
      candidate.name,
      "EMAIL_SENT",
      `Sent email to ${payload.to}: "${payload.subject}"`,
      account,
    );

    return {
      result: emailResult,
      candidate: candidate.toJSON(),
    };
  }

  async sendWhatsApp(
    id: string,
    payload: {
      phone?: string;
      message: string;
      templateKey?: string;
      candidateName?: string;
      candidatePosition?: string;
    },
    account: AuthenticatedAccount,
  ) {
    const candidate = await this.findAccessible(id, account);
    const targetPhone = payload.phone?.trim() || candidate.phone;
    if (!targetPhone) {
      throw new HttpError(400, "PHONE_REQUIRED", "Candidate phone number is required to send WhatsApp message.");
    }

    const whatsappResult = await this.whatsapp.sendCandidateMessage({
      phone: targetPhone,
      message: payload.message,
      templateKey: payload.templateKey,
      candidateName: payload.candidateName || candidate.name,
      candidatePosition: payload.candidatePosition || candidate.position,
      actor: account,
    });

    candidate.lastContactedAt = new Date();
    await this.candidates.update(candidate);

    const templateInfo = whatsappResult.templateUsed ? ` [Template: ${whatsappResult.templateUsed}]` : "";
    await this.logs.record(
      candidate.id,
      candidate.name,
      "WHATSAPP_SENT",
      `Sent WhatsApp message to ${targetPhone}${templateInfo}: "${(payload.message || "").slice(0, 100)}"`,
      account,
    );

    return {
      result: whatsappResult,
      candidate: candidate.toJSON(),
    };
  }

  async changeStatus(id: string, status: CandidateStatus, account: AuthenticatedAccount, message?: string): Promise<Record<string, unknown>> {
    const candidate = await this.findAccessible(id, account);
    const previousStatus = candidate.status;
    if (previousStatus === status) return candidate.toJSON();
    if (status === "ARCHIVED" && account.role !== "MANAGER") throw new HttpError(403, "FORBIDDEN", "Only Managers can archive candidates.");

    candidate.status = status;
    if (status === "CALLED") candidate.lastContactedAt = new Date();
    await this.candidates.update(candidate);
    await this.logs.record(candidate.id, candidate.name, status === "CALLED" ? "CALL" : "STATUS_CHANGED", message || `Status changed from ${previousStatus.replaceAll("_", " ")} to ${status.replaceAll("_", " ")}`, account);
    return candidate.toJSON();
  }

  async archive(id: string, account: AuthenticatedAccount): Promise<Record<string, unknown>> {
    if (account.role !== "MANAGER") throw new HttpError(403, "FORBIDDEN", "Only Managers can archive candidates.");
    const candidate = await this.findAccessible(id, account);
    if (candidate.status !== "ARCHIVED") {
      candidate.status = "ARCHIVED";
      await this.candidates.update(candidate);
      await this.logs.record(candidate.id, candidate.name, "ARCHIVED", "Candidate archived", account);
    }
    return candidate.toJSON();
  }

  async restore(id: string, account: AuthenticatedAccount): Promise<Record<string, unknown>> {
    if (account.role !== "MANAGER") throw new HttpError(403, "FORBIDDEN", "Only Managers can restore candidates.");
    const candidate = await this.candidates.findById(id);
    if (!candidate || candidate.status !== "ARCHIVED") throw new HttpError(404, "CANDIDATE_NOT_FOUND", "Archived candidate not found.");
    candidate.status = "NEW";
    await this.candidates.update(candidate);
    await this.logs.record(candidate.id, candidate.name, "RESTORED", "Candidate restored from archive", account);
    return candidate.toJSON();
  }

  async deleteArchived(id: string, account: AuthenticatedAccount): Promise<void> {
    if (account.role !== "MANAGER") throw new HttpError(403, "FORBIDDEN", "Only Managers can permanently delete candidates.");
    const candidate = await this.candidates.findById(id);
    if (!candidate || candidate.status !== "ARCHIVED") throw new HttpError(404, "CANDIDATE_NOT_FOUND", "Archived candidate not found.");
    await this.logs.record(candidate.id, candidate.name, "CANDIDATE_DELETED", "Archived candidate permanently deleted", account);
    await this.candidates.delete(id);
  }

  async assignmentHistory(id: string, account: AuthenticatedAccount) {
    const candidate = await this.findAccessible(id, account);
    return AssignmentHistoryModel.find({ candidateId: candidate.id }).sort({ assignedAt: -1 }).lean();
  }

  async registerPublic(input: CandidateRegistrationInput, resumeFile?: Express.Multer.File): Promise<Record<string, unknown>> {
    const duplicate = await this.candidates.findDuplicate(input.email, input.phone);
    if (duplicate) {
      throw new HttpError(409, "CANDIDATE_DUPLICATE", "A candidate with this email or phone number already exists.");
    }

    let resumeRecordId: string | undefined;
    let resumeRecordName = "";

    if (resumeFile) {
      if (resumeFile.size > 1 * 1024 * 1024) {
        throw new HttpError(400, "UPLOAD_TOO_LARGE", "Resume file size must not exceed 1 MB.");
      }

      const originalName = resumeFile.originalname.replace(/[\\/\u0000-\u001f]/g, "_").slice(-255);
      const ext = originalName.slice(originalName.lastIndexOf(".")).toLowerCase();
      if (![".pdf", ".doc", ".docx"].includes(ext)) {
        throw new HttpError(400, "INVALID_FILE_TYPE", "Only PDF, DOC, and DOCX files are allowed.");
      }

      const mimeType = resumeFile.mimetype || (
        ext === ".pdf" ? "application/pdf" :
        ext === ".docx" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" :
        "application/msword"
      );

      const createdFile = await ResumeFileModel.create({
        originalName,
        mimeType,
        size: resumeFile.size,
        sha256: createHash("sha256").update(resumeFile.buffer).digest("hex"),
        candidateId: "",
        uploadedByUserId: "PUBLIC_REGISTRATION",
        data: resumeFile.buffer,
      });

      resumeRecordId = createdFile.id;
      resumeRecordName = createdFile.originalName;
    }

    const candidateId = await getNextCandidateId();
    const isJob = (input.modeOfCourse as string) === "Job" || input.lookingFor === "Job";
    const position = isJob
      ? (input.primarySkills ? `${input.lookingFor} - ${input.primarySkills}` : input.lookingFor)
      : `${input.lookingFor} - ${input.programmingLanguage}`;

    const skillList: string[] = [];
    if (input.primarySkills) skillList.push(input.primarySkills);
    if (input.secondarySkills) skillList.push(input.secondarySkills);
    if (!isJob && input.programmingLanguage && !skillList.includes(input.programmingLanguage)) {
      skillList.unshift(input.programmingLanguage);
    }
    const skills = skillList.length > 0 ? skillList : (input.programmingLanguage ? [input.programmingLanguage] : []);
    const formattedStartDate = input.preferredStartDate ? new Date(input.preferredStartDate) : null;

    const notesSummary = [
      "=== TVK TECHNOLOGIES CANDIDATE REGISTRATION ===",
      `Date of Birth: ${input.dateOfBirth}`,
      `Street Address: ${input.address}`,
      `Location: ${input.location}`,
      `State: ${input.state}`,
      `PIN Code: ${input.pincode}`,
      `Name of Degree: ${input.degree}`,
      `College/University: ${input.college}`,
      `Year of Passing: ${input.yearOfPassing}`,
      `Looking For: ${input.lookingFor}`,
      `Course: ${input.programmingLanguage || "N/A (Job)"}`,
      `Mode of Course: ${input.modeOfCourse}`,
      ...(input.primarySkills ? [`Primary Skills: ${input.primarySkills}`] : []),
      ...(input.secondarySkills ? [`Secondary Skills: ${input.secondarySkills}`] : []),
      `Course Duration: ${input.courseDuration || "N/A"}`,
      `Preferred Start Date: ${input.preferredStartDate || "N/A"}`,
      `How Did You Find Us: ${input.howDidYouFindUs}`,
    ].join("\n");

    const cleanCourse = normalizeCourseTitle(input.programmingLanguage);
    let initialTotalFee = 0;
    try {
      if (cleanCourse) {
        const courseDoc = await CourseModel.findOne({
          name: new RegExp(`^${cleanCourse.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"),
        });
        if (courseDoc) {
          ensureCourseTracks(courseDoc);
          const matchedTrack = courseDoc.tracks?.find(
            (t) => t.duration.toLowerCase() === (input.courseDuration || "").trim().toLowerCase(),
          );
          initialTotalFee = matchedTrack?.fees ?? (courseDoc.fees || 0);
        }
      }
    } catch {
      // Ignore lookup failure on creation
    }

    const candidate = await this.candidates.create({
      _id: candidateId,
      name: input.name,
      phone: input.phone,
      email: input.email,
      position,
      courseName: cleanCourse || input.programmingLanguage || "",
      experience: `Year of Passing: ${input.yearOfPassing}`,
      location: input.location,
      skills,
      source: "WEBSITE_APPLICATION",
      resumeName: resumeRecordName,
      resumeFileId: resumeRecordId,
      status: "NEW",
      assignedToId: null,
      assignedToName: null,
      appliedDate: new Date(),
      lastContactedAt: null,
      nextFollowUpAt: null,
      notes: notesSummary,
      dateOfBirth: input.dateOfBirth,
      address: input.address,
      state: input.state,
      pincode: input.pincode,
      yearOfPassing: input.yearOfPassing,
      degree: input.degree,
      college: input.college,
      lookingFor: input.lookingFor,
      programmingLanguage: input.programmingLanguage,
      modeOfCourse: input.modeOfCourse,
      primarySkills: input.primarySkills,
      secondarySkills: input.secondarySkills,
      howDidYouFindUs: input.howDidYouFindUs,
      courseDuration: input.courseDuration,
      preferredStartDate: formattedStartDate,
      totalFee: initialTotalFee,
      balance: initialTotalFee,
    });

    if (resumeRecordId) {
      await ResumeFileModel.updateOne({ _id: resumeRecordId }, { candidateId: candidate._id });
    }

    try {
      await ActivityLogModel.create({
        _id: randomUUID(),
        candidateId: candidate.id,
        candidateName: candidate.name,
        type: "CANDIDATE_CREATED",
        message: `Candidate registered online for ${input.lookingFor} (${input.programmingLanguage})`,
        performedBy: "Public Registration Portal",
        performedByUserId: "PUBLIC_REGISTRATION",
      });
    } catch {
      // Non-blocking for registration
    }

    return candidate.toJSON();
  }

  async findInboundOrAccessible(id: string, account: AuthenticatedAccount): Promise<CandidateDocument> {
    const candidate = await this.candidates.findById(id);
    if (!candidate) throw new HttpError(404, "CANDIDATE_NOT_FOUND", "Candidate not found.");
    // Inbound records from website application or candidates assigned to this HR or all if manager
    if (
      account.role === "HR" &&
      candidate.source !== "WEBSITE_APPLICATION" &&
      !candidate.programmingLanguage &&
      !candidate.lookingFor &&
      candidate.assignedToId !== account.employeeId
    ) {
      throw new HttpError(404, "CANDIDATE_NOT_FOUND", "Candidate not found.");
    }
    if (candidate.accountCreated && (!candidate.accountPassword || candidate.accountPassword.trim() === "")) {
      const fallbackPass = deriveInitialCandidatePassword(candidate.name);
      candidate.accountPassword = fallbackPass;
      if (!candidate.accountPasswordHash) {
        candidate.accountPasswordHash = await bcrypt.hash(fallbackPass, 12);
      }
      void candidate.save();
    }
    return candidate;
  }

  // --- Feature 1: Inbound Management ---

  async listInbound(rawQuery: unknown, _account: AuthenticatedAccount) {
    const query = candidateListQuerySchema.parse(rawQuery);
    const conditions: FilterQuery<CandidateRecord>[] = [
      {
        $or: [
          { source: "WEBSITE_APPLICATION" },
          { programmingLanguage: { $exists: true, $ne: "" } },
          { lookingFor: { $exists: true, $ne: "" } },
          { degree: { $exists: true, $ne: "" } },
        ],
      },
    ];

    if (query.status) {
      conditions.push({ status: query.status });
    }

    if (query.search) {
      const expression = new RegExp(query.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      conditions.push({
        $or: [
          { name: expression },
          { email: expression },
          { phone: expression },
          { position: expression },
          { location: expression },
          { programmingLanguage: expression },
          { lookingFor: expression },
        ],
      });
    }

    const filter: FilterQuery<CandidateRecord> = conditions.length === 1 ? conditions[0] : { $and: conditions };

    const direction = query.order === "asc" ? 1 : -1;
    const result = await this.candidates.list(
      filter,
      { [query.sortBy]: direction, _id: 1 },
      (query.page - 1) * query.pageSize,
      query.pageSize,
    );

    // Ensure all inbound candidates have a paymentToken initialized and account password populated
    for (const item of result.items) {
      if (!item.paymentToken) {
        item.paymentToken = randomBytes(24).toString("hex");
        item.paymentTokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        void item.save();
      }
      if (item.accountCreated && (!item.accountPassword || item.accountPassword.trim() === "")) {
        item.accountPassword = deriveInitialCandidatePassword(item.name);
        void item.save();
      }
    }

    return {
      items: result.items.map((candidate) => candidate.toJSON()),
      pagination: paginationResult(result.total, query.page, query.pageSize),
    };
  }

  async updateCourseDetails(id: string, rawInput: unknown, account: AuthenticatedAccount) {
    const input = courseDetailsUpdateSchema.parse(rawInput);
    const candidate = await this.findInboundOrAccessible(id, account);

    const totalFee = input.totalFee ?? 0;
    const amountPaid = input.amountPaid ?? 0;
    const balance = Math.max(0, totalFee - amountPaid);

    if (input.joiningDate !== undefined) candidate.joiningDate = input.joiningDate;
    if (input.courseDate !== undefined) candidate.courseDate = input.courseDate;
    if (input.courseStartDate !== undefined) candidate.courseStartDate = input.courseStartDate;
    if (input.courseName !== undefined) candidate.courseName = normalizeCourseTitle(input.courseName);
    if (input.courseDuration !== undefined) candidate.courseDuration = input.courseDuration;
    candidate.totalFee = totalFee;
    candidate.amountPaid = amountPaid;
    candidate.balance = balance;
    candidate.paymentStatus = input.paymentStatus;
    candidate.paymentInstructions = input.paymentInstructions;

    if (!candidate.paymentToken) {
      candidate.paymentToken = randomBytes(24).toString("hex");
      candidate.paymentTokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    }

    await this.candidates.update(candidate);
    await this.logs.record(
      candidate.id,
      candidate.name,
      "CANDIDATE_UPDATED",
      `Course and payment details updated: Fee ₹${totalFee}, Paid ₹${amountPaid}, Balance ₹${balance}, Status: ${input.paymentStatus}`,
      account,
    );

    return candidate.toJSON();
  }

  async getCommonPaymentQr(): Promise<string> {
    const record = await CrmControlModel.findOne({ key: "common_payment_qr" }).lean();
    if (record?.value) {
      return record.value;
    }
    const existing = await CandidateModel.findOne({ paymentQrCode: { $exists: true, $ne: "" } })
      .select("paymentQrCode")
      .lean();
    if (existing?.paymentQrCode) {
      await CrmControlModel.findOneAndUpdate(
        { key: "common_payment_qr" },
        { value: existing.paymentQrCode, updatedBy: "SYSTEM" },
        { upsert: true, new: true },
      );
      return existing.paymentQrCode;
    }
    return "";
  }

  async updateCommonPaymentQr(qrCodeDataUrl: string, account: AuthenticatedAccount): Promise<{ qrCode: string }> {
    if (account.role !== "MANAGER") {
      throw new HttpError(403, "FORBIDDEN", "Only Managers can modify payment QR codes.");
    }
    await CrmControlModel.findOneAndUpdate(
      { key: "common_payment_qr" },
      { value: qrCodeDataUrl, updatedBy: account.name || account.username },
      { upsert: true, new: true },
    );
    await CandidateModel.updateMany({}, { $set: { paymentQrCode: qrCodeDataUrl } });

    await this.logs.record(
      "SYSTEM",
      "ALL_CANDIDATES",
      "CANDIDATE_UPDATED",
      "Official payment QR code updated by manager and synchronized across all candidates",
      account,
    );

    return { qrCode: qrCodeDataUrl };
  }

  async updatePaymentQr(id: string, qrCodeDataUrl: string, account: AuthenticatedAccount) {
    if (account.role !== "MANAGER") throw new HttpError(403, "FORBIDDEN", "Only Managers can modify payment QR codes.");
    const candidate = await this.findInboundOrAccessible(id, account);
    
    // Update common QR code and synchronize across all candidates
    await this.updateCommonPaymentQr(qrCodeDataUrl, account);

    candidate.paymentQrCode = qrCodeDataUrl;
    if (!candidate.paymentToken) {
      candidate.paymentToken = randomBytes(24).toString("hex");
      candidate.paymentTokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    }
    await this.candidates.update(candidate);

    await this.logs.record(
      candidate.id,
      candidate.name,
      "CANDIDATE_UPDATED",
      "Payment QR Code uploaded/updated for candidate and synchronized across all candidates",
      account,
    );

    return candidate.toJSON();
  }

  // --- Outbound Candidates Management ---

  async createOutbound(rawInput: unknown, resumeFile: Express.Multer.File | undefined, account: AuthenticatedAccount) {
    const input = outboundCandidateSchema.parse(rawInput);
    if (input.entryMethod === "RECEIVED_FROM_EMAIL" && !resumeFile) {
      throw new HttpError(400, "OUTBOUND_RESUME_REQUIRED", "Attach the resume received by email.");
    }

    const duplicate = await this.candidates.findDuplicate(input.email, input.phone);
    if (duplicate) {
      throw new HttpError(409, "CANDIDATE_DUPLICATE", "A candidate with this email or phone number already exists.");
    }

    let resumeRecordId: string | undefined;
    let resumeRecordName = "";

    if (resumeFile) {
      const originalName = resumeFile.originalname.replace(/[\\/\u0000-\u001f]/g, "_").slice(-255);
      const ext = originalName.slice(originalName.lastIndexOf(".")).toLowerCase();
      const mimeType = resumeFile.mimetype || (ext === ".pdf" ? "application/pdf" : "application/octet-stream");

      const createdFile = await ResumeFileModel.create({
        originalName,
        mimeType,
        size: resumeFile.size,
        sha256: createHash("sha256").update(resumeFile.buffer).digest("hex"),
        candidateId: "",
        uploadedByUserId: account.id,
        data: resumeFile.buffer,
      });

      resumeRecordId = createdFile.id;
      resumeRecordName = createdFile.originalName;
    }

    const candidateId = await getNextCandidateId();
    const skillsList = Array.isArray(input.skills)
      ? input.skills
      : (typeof input.skills === "string" ? input.skills.split(",").map((s) => s.trim()).filter(Boolean) : []);

    const candidate = await this.candidates.create({
      _id: candidateId,
      name: input.name,
      phone: input.phone,
      email: input.email,
      position: input.position,
      courseName: input.position,
      experience: input.experience,
      location: input.location,
      skills: skillsList,
      source: "OUTBOUND",
      resumeName: resumeRecordName,
      resumeFileId: resumeRecordId,
      status: "NEW",
      assignedToId: null,
      assignedToName: null,
      appliedDate: new Date(),
      lastContactedAt: null,
      nextFollowUpAt: null,
      notes: [
        input.entryMethod === "MANUAL_TYPING" ? "Entry Method: Manual Typing (Outbound)" :
          input.entryMethod === "RECEIVED_FROM_EMAIL" ? "Entry Method: Received from Email (Outbound)" : "",
        input.notes || (input.entryMethod === "RECEIVED_FROM_EMAIL" ? "Resume received by email." : "Outbound candidate received from email/external source."),
      ].filter(Boolean).join("\n"),
      paymentToken: randomBytes(24).toString("hex"),
      paymentTokenExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    if (resumeRecordId) {
      await ResumeFileModel.updateOne({ _id: resumeRecordId }, { candidateId: candidate._id });
    }

    await this.logs.record(
      candidate.id,
      candidate.name,
      "CANDIDATE_CREATED",
      `${input.entryMethod === "RECEIVED_FROM_EMAIL" ? "Outbound candidate received by email" : "Outbound candidate manually added"} with resume: ${resumeRecordName || "No file"}`,
      account,
    );

    return candidate.toJSON();
  }

  async listOutbound(rawQuery: unknown, account: AuthenticatedAccount) {
    const query = candidateListQuerySchema.parse(rawQuery);
    const filter: FilterQuery<CandidateRecord> = {
      source: "OUTBOUND",
    };
    const totalOutboundCountPromise = CandidateModel.countDocuments({ source: "OUTBOUND" });

    if (account.role === "HR") {
      filter.assignedToId = account.employeeId;
    } else if (query.hrId) {
      const normalizedHr = query.hrId.toLowerCase();
      if (normalizedHr === "unassigned" || normalizedHr === "pending" || normalizedHr === "null") {
        filter.assignedToId = null;
      } else if (normalizedHr === "assigned") {
        filter.assignedToId = { $ne: null };
      } else {
        filter.assignedToId = query.hrId;
      }
    }

    if (query.status) {
      filter.status = query.status;
    }

    if (query.search) {
      const expression = new RegExp(query.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [
        { name: expression },
        { email: expression },
        { phone: expression },
        { position: expression },
        { location: expression },
      ];
    }

    const direction = query.order === "asc" ? 1 : -1;
    const [result, totalOutboundCount] = await Promise.all([
      this.candidates.list(
        filter,
        { [query.sortBy]: direction, _id: 1 },
        (query.page - 1) * query.pageSize,
        query.pageSize,
      ),
      totalOutboundCountPromise,
    ]);

    for (const item of result.items) {
      if (!item.paymentToken) {
        item.paymentToken = randomBytes(24).toString("hex");
        item.paymentTokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        void item.save();
      }
      if (item.accountCreated && (!item.accountPassword || item.accountPassword.trim() === "")) {
        item.accountPassword = deriveInitialCandidatePassword(item.name);
        void item.save();
      }
    }

    return {
      items: result.items.map((candidate) => candidate.toJSON()),
      pagination: paginationResult(result.total, query.page, query.pageSize),
      totalOutboundCount,
    };
  }

  // --- Feature 2: Certificate Management ---

  async listCertificates(rawQuery: unknown, _account: AuthenticatedAccount) {
    const query = candidateListQuerySchema.parse(rawQuery);
    const filter: FilterQuery<CandidateRecord> = {};

    if (query.status) {
      filter.status = query.status;
    }

    if (query.search) {
      const expression = new RegExp(query.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [
        { name: expression },
        { email: expression },
        { phone: expression },
        { certificateId: expression },
        { position: expression },
      ];
    }

    const direction = query.order === "asc" ? 1 : -1;
    const result = await this.candidates.list(
      filter,
      { [query.sortBy]: direction, _id: 1 },
      (query.page - 1) * query.pageSize,
      query.pageSize,
    );

    return {
      items: result.items.map((candidate) => candidate.toJSON()),
      pagination: paginationResult(result.total, query.page, query.pageSize),
    };
  }

  async markCourseCompletion(id: string, rawInput: unknown, account: AuthenticatedAccount) {
    const input = courseCompletionSchema.parse(rawInput);
    const candidate = await this.findInboundOrAccessible(id, account);

    candidate.courseCompleted = input.courseCompleted;
    candidate.completionDate = input.courseCompleted ? (input.completionDate || new Date().toISOString().slice(0, 10)) : null;

    await this.candidates.update(candidate);
    await this.logs.record(
      candidate.id,
      candidate.name,
      "CANDIDATE_UPDATED",
      input.courseCompleted
        ? `Course marked as completed on ${candidate.completionDate}`
        : "Course completion status cleared",
      account,
    );

    return candidate.toJSON();
  }

  async generateCertificate(
    id: string,
    account: AuthenticatedAccount,
    regenerate = false,
    options?: { courseName?: string; courseDuration?: string },
  ) {
    const candidate = await this.findInboundOrAccessible(id, account);

    // 1. Strict Completion Requirement:
    // Do not issue a completion certificate merely because a candidate registered, enrolled, or paid.
    if (!candidate.courseCompleted || !candidate.completionDate) {
      throw new HttpError(
        400,
        "COURSE_NOT_COMPLETED",
        "Candidate course must be marked as completed with a completion date before generating certificate.",
      );
    }

    // 2. Enrolled Course Retrieval & Verification:
    let resolvedCourse = "";
    if (options?.courseName && options.courseName.trim()) {
      resolvedCourse = normalizeCourseTitle(options.courseName.trim());
      if (candidate.courseName && normalizeCourseTitle(candidate.courseName) !== resolvedCourse) {
        const otherPositions = [candidate.position, candidate.programmingLanguage]
          .filter(Boolean)
          .map((p) => normalizeCourseTitle(p!));
        if (!otherPositions.includes(resolvedCourse)) {
          throw new HttpError(
            400,
            "INVALID_ENROLLMENT_SELECTION",
            `Candidate is not enrolled in the selected course '${options.courseName}'.`,
          );
        }
      }
      candidate.courseName = resolvedCourse;
    } else {
      resolvedCourse = (candidate.courseName || candidate.position || candidate.programmingLanguage || "").trim();
      if (!resolvedCourse) {
        throw new HttpError(
          400,
          "ENROLLMENT_DATA_MISSING",
          "Candidate does not have an enrolled course on record to issue a certificate.",
        );
      }
      resolvedCourse = normalizeCourseTitle(resolvedCourse);
      candidate.courseName = resolvedCourse;
    }

    if (options?.courseDuration && options.courseDuration.trim()) {
      candidate.courseDuration = options.courseDuration.trim();
    }

    // 3. Unique Certificate ID & Prevent Duplicates:
    const existingCertId = candidate.certificateId;
    if (existingCertId && !regenerate) {
      // Prevent duplicate creation on multiple clicks
      return candidate.toJSON();
    }

    // Generate authentic, unique certificate ID matching reference format (e.g. CERT-2026-6FHY8)
    const certId =
      existingCertId && regenerate
        ? existingCertId
        : `CERT-${new Date().getFullYear()}-${randomBytes(3).toString("hex").toUpperCase()}`;

    candidate.certificateId = certId;
    candidate.certificateStatus = "ISSUED";
    candidate.certificateIssuedAt = candidate.certificateIssuedAt || new Date();
    candidate.certificateSignatory = candidate.certificateSignatory || "Dr. V. Kumar, Director of Training";

    await this.candidates.update(candidate);
    await this.logs.record(
      candidate.id,
      candidate.name,
      "CANDIDATE_UPDATED",
      regenerate
        ? `Certificate regenerated: ID ${certId}`
        : `Certificate generated and issued: ID ${certId}`,
      account,
    );

    return candidate.toJSON();
  }

  async getCertificatePdf(id: string, account?: AuthenticatedAccount) {
    const candidate = account ? await this.findInboundOrAccessible(id, account) : await this.candidates.findById(id);
    if (!candidate) throw new HttpError(404, "CANDIDATE_NOT_FOUND", "Candidate not found.");
    if (candidate.certificateStatus === "REVOKED") {
      throw new HttpError(400, "CERTIFICATE_REVOKED", `Certificate '${candidate.certificateId}' has been revoked and can no longer be downloaded.`);
    }
    if (candidate.certificateStatus !== "ISSUED" || !candidate.certificateId) {
      throw new HttpError(400, "CERTIFICATE_NOT_ISSUED", "Certificate has not been generated or issued for this candidate.");
    }

    const enrolledCourse = (candidate.courseName || candidate.position || candidate.programmingLanguage || "").trim();
    if (!enrolledCourse) {
      throw new HttpError(400, "ENROLLMENT_DATA_MISSING", "Enrolled course record is missing for this candidate.");
    }
    const courseName = normalizeCourseTitle(enrolledCourse);
    const courseDuration = candidate.courseDuration || "";
    const completionDate = candidate.completionDate || "";
    const issueDate = candidate.certificateIssuedAt ? new Date(candidate.certificateIssuedAt).toISOString().slice(0, 10) : "";

    const baseUrl = env.clientOrigins[0] || "https://tvktechnologies.com";
    const verificationUrl = `${baseUrl}/verify-certificate?id=${encodeURIComponent(candidate.certificateId)}`;

    const certData = {
      candidateId: candidate.id,
      candidateName: candidate.name,
      courseName,
      courseDuration,
      completionDate,
      issueDate,
      certificateId: candidate.certificateId,
      signatoryName: candidate.certificateSignatory || "Dr. V. Kumar",
      signatoryTitle: "Authorized Signatory",
      companyName: "TVK Technologies Edu Private Limited",
      tagline: "EMPOWERING CAREER GROWTH",
      verificationUrl,
    };

    const pngBuffer = certificatePdfService.generateCertificatePng(certData);
    const imageBuffer = certificatePdfService.generateCertificateJpeg(certData);
    const pdfBuffer = certificatePdfService.generateCertificatePdf(certData);

    return {
      pdfBuffer,
      imageBuffer,
      pngBuffer,
      filename: `TVK-Certificate-${candidate.certificateId}.png`,
      pdfFilename: `TVK-Certificate-${candidate.certificateId}.pdf`,
      contentType: "image/png",
    };
  }

  async getOfferLetterPdf(id: string, actor: AuthenticatedAccount | { candidateId: string; role: "CANDIDATE" }) {
    let candidate;
    if ("candidateId" in actor && actor.role === "CANDIDATE") {
      if (actor.candidateId !== id) {
        throw new HttpError(403, "FORBIDDEN", "You can only view your own offer letter.");
      }
      candidate = await CandidateModel.findById(id);
      if (!candidate) {
        candidate = await CandidateModel.findOne({
          $or: [{ _id: id }, { id: id }, { email: id.toLowerCase() }],
        });
      }
      if (!candidate) {
        throw new HttpError(404, "CANDIDATE_NOT_FOUND", "Candidate record not found.");
      }
    } else {
      candidate = await this.candidates.findById(id);
      if (!candidate) {
        candidate = await CandidateModel.findOne({
          $or: [{ _id: id }, { id: id }, { email: id.toLowerCase() }],
        });
      }
      if (!candidate) {
        throw new HttpError(404, "CANDIDATE_NOT_FOUND", "Candidate not found.");
      }
    }

    const offerData = {
      candidateId: candidate.id || (candidate as any)._id,
      candidateName: candidate.name,
      college: candidate.college || undefined,
      courseName: candidate.courseName || candidate.position || undefined,
      startDate: candidate.courseStartDate || candidate.joiningDate || undefined,
      endDate: candidate.completionDate || undefined,
    };

    const pdfBuffer = offerLetterPdfService.generateOfferLetterPdf(offerData);
    const pngBuffer = offerLetterPdfService.generateOfferLetterPng(offerData);
    const jpegBuffer = offerLetterPdfService.generateOfferLetterJpeg(offerData);

    return {
      pdfBuffer,
      pngBuffer,
      jpegBuffer,
      filename: `Offer_Letter_${candidate.id || (candidate as any)._id}.pdf`,
    };
  }

  async getCertificatePng(id: string, account?: AuthenticatedAccount) {
    const candidate = account ? await this.findInboundOrAccessible(id, account) : await this.candidates.findById(id);
    if (!candidate) throw new HttpError(404, "CANDIDATE_NOT_FOUND", "Candidate not found.");
    if (candidate.certificateStatus === "REVOKED") {
      throw new HttpError(400, "CERTIFICATE_REVOKED", `Certificate '${candidate.certificateId}' has been revoked and can no longer be downloaded.`);
    }
    if (candidate.certificateStatus !== "ISSUED" || !candidate.certificateId) {
      throw new HttpError(400, "CERTIFICATE_NOT_ISSUED", "Certificate has not been generated or issued for this candidate.");
    }

    const enrolledCourse = (candidate.courseName || candidate.position || candidate.programmingLanguage || "").trim();
    if (!enrolledCourse) {
      throw new HttpError(400, "ENROLLMENT_DATA_MISSING", "Enrolled course record is missing for this candidate.");
    }
    const courseName = normalizeCourseTitle(enrolledCourse);
    const courseDuration = candidate.courseDuration || "";
    const completionDate = candidate.completionDate || "";
    const issueDate = candidate.certificateIssuedAt ? new Date(candidate.certificateIssuedAt).toISOString().slice(0, 10) : "";

    const baseUrl = env.clientOrigins[0] || "https://tvktechnologies.com";
    const verificationUrl = `${baseUrl}/verify-certificate?id=${encodeURIComponent(candidate.certificateId)}`;

    const certData = {
      candidateId: candidate.id,
      candidateName: candidate.name,
      courseName,
      courseDuration,
      completionDate,
      issueDate,
      certificateId: candidate.certificateId,
      signatoryName: candidate.certificateSignatory || "Dr. V. Kumar",
      signatoryTitle: "Authorized Signatory",
      companyName: "TVK Technologies Edu Private Limited",
      tagline: "EMPOWERING CAREER GROWTH",
      verificationUrl,
    };

    const pngBuffer = certificatePdfService.generateCertificatePng(certData);

    return {
      pngBuffer,
      filename: `TVK-Certificate-${candidate.certificateId}.png`,
      contentType: "image/png",
    };
  }

  async revokeCertificate(
    id: string,
    reason: string,
    account: AuthenticatedAccount,
  ) {
    const candidate = await this.findInboundOrAccessible(id, account);
    if (!candidate.certificateId || candidate.certificateStatus !== "ISSUED") {
      throw new HttpError(400, "CERTIFICATE_NOT_ISSUED", "No active issued certificate found to revoke for this candidate.");
    }

    const cleanReason = (reason || "").trim() || "Revoked by administrative authority";
    candidate.certificateStatus = "REVOKED";
    candidate.certificateRevokedAt = new Date();
    candidate.certificateRevocationReason = cleanReason;

    await this.candidates.update(candidate);
    await this.logs.record(
      candidate.id,
      candidate.name,
      "CANDIDATE_UPDATED",
      `Certificate revoked: ID ${candidate.certificateId}. Reason: ${cleanReason}`,
      account,
    );

    return candidate.toJSON();
  }

  async verifyCertificatePublic(certificateId: string) {
    if (!certificateId || !certificateId.trim()) {
      throw new HttpError(400, "INVALID_CERTIFICATE_ID", "Certificate ID must be provided.");
    }
    const cleanId = certificateId.trim();
    const candidate = await this.candidates.findOne({ certificateId: cleanId });
    if (!candidate || candidate.certificateStatus === "NOT_ISSUED") {
      throw new HttpError(404, "CERTIFICATE_NOT_FOUND", `Certificate with ID '${cleanId}' was not found or has not been issued.`);
    }

    if (candidate.certificateStatus === "REVOKED") {
      return {
        valid: false,
        status: "REVOKED",
        certificateId: candidate.certificateId,
        candidateName: candidate.name,
        candidateId: candidate.id,
        courseName: candidate.courseName || candidate.position || "Professional IT Training",
        revokedAt: candidate.certificateRevokedAt,
        revocationReason: candidate.certificateRevocationReason || "Revoked by administrative authority",
        issuer: "TVK Technologies Edu Private Limited",
        issuedAt: candidate.certificateIssuedAt,
      };
    }

    return {
      valid: true,
      certificateId: candidate.certificateId,
      candidateName: candidate.name,
      candidateId: candidate.id,
      courseName: candidate.courseName || candidate.position || "Professional IT Training",
      courseDuration: candidate.courseDuration || "Course Program",
      completionDate: candidate.completionDate,
      issuedAt: candidate.certificateIssuedAt,
      signatory: candidate.certificateSignatory || "Dr. V. Kumar",
      issuer: "TVK Technologies Edu Private Limited",
      tagline: "EMPOWERING CAREER GROWTH",
      status: "AUTHENTIC",
    };
  }

  // --- Feature 3: Payment Links, Tracking, Verification & Receipts ---

  async getOrCreatePaymentToken(id: string, account: AuthenticatedAccount) {
    const candidate = await this.findInboundOrAccessible(id, account);
    if (!candidate.paymentToken || !candidate.paymentTokenExpiresAt || candidate.paymentTokenExpiresAt < new Date()) {
      candidate.paymentToken = randomBytes(24).toString("hex");
      candidate.paymentTokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await this.candidates.update(candidate);
    }

    return {
      paymentToken: candidate.paymentToken,
      expiresAt: candidate.paymentTokenExpiresAt,
      candidateId: candidate.id,
      name: candidate.name,
    };
  }

  async getPublicPaymentDetails(token: string) {
    const cleanToken = token.trim();
    const candidate = await CandidateModel.findOne({
      paymentToken: cleanToken,
      paymentTokenExpiresAt: { $gt: new Date() },
    });

    if (!candidate) {
      throw new HttpError(404, "PAYMENT_LINK_NOT_FOUND", "This payment link is invalid, expired, or has been revoked.");
    }

    const payments = await PaymentModel.find({ candidateId: candidate._id }).sort({ createdAt: -1 });

    const cleanCourse = normalizeCourseTitle(candidate.courseName || candidate.programmingLanguage || candidate.position || "Professional IT Training");

    // Expose only non-sensitive information necessary for making and tracking payments
    return {
      candidateName: candidate.name,
      courseName: cleanCourse,
      courseDuration: candidate.courseDuration || "3 Months",
      joiningDate: candidate.joiningDate,
      courseStartDate: candidate.courseStartDate || candidate.courseDate,
      totalFee: candidate.totalFee || 0,
      amountPaid: candidate.amountPaid || 0,
      balance: candidate.balance ?? Math.max(0, (candidate.totalFee || 0) - (candidate.amountPaid || 0)),
      paymentStatus: candidate.paymentStatus || "Pending",
      paymentInstructions: candidate.paymentInstructions || "Please scan the QR code to complete payment and enter your transaction reference below.",
      paymentQrCode: (await this.getCommonPaymentQr()) || candidate.paymentQrCode || "",
      recentPayments: payments.map((p) => ({
        id: p._id,
        amount: p.amount,
        status: p.status,
        transactionRef: p.transactionRef,
        paidAt: p.paidAt,
        receiptNumber: p.receiptNumber,
      })),
    };
  }

  async submitPublicPaymentProof(token: string, rawInput: unknown, file: Express.Multer.File | undefined) {
    const input = submitPaymentProofSchema.parse(rawInput);
    const candidate = await CandidateModel.findOne({
      paymentToken: token.trim(),
      paymentTokenExpiresAt: { $gt: new Date() },
    });

    if (!candidate) {
      throw new HttpError(404, "PAYMENT_LINK_NOT_FOUND", "Payment link is invalid or expired.");
    }

    let proofUrl = "";
    if (file) {
      proofUrl = `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;
    }

    const paymentAmount = input.amount && input.amount > 0
      ? input.amount
      : (candidate.balance && candidate.balance > 0 ? candidate.balance : (candidate.totalFee || 0));

    const paymentId = `PAY-${Date.now()}-${randomUUID().slice(0, 6)}`;
    const payment = await PaymentModel.create({
      _id: paymentId,
      candidateId: candidate._id,
      candidateName: candidate.name,
      courseName: candidate.courseName || candidate.position || "IT Training Course",
      amount: paymentAmount,
      transactionRef: input.transactionRef.trim(),
      paymentProofUrl: proofUrl,
      status: "Verification Pending",
      paidAt: input.paymentDate ? new Date(input.paymentDate) : new Date(),
      notes: input.notes || "Submitted via public candidate payment link",
    });

    candidate.paymentStatus = "Verification Pending";
    await candidate.save();

    return payment.toJSON();
  }

  async listCandidatePayments(candidateId: string, account?: AuthenticatedAccount) {
    if (account) {
      await this.findInboundOrAccessible(candidateId, account);
    }
    const payments = await PaymentModel.find({ candidateId }).sort({ createdAt: -1 });
    return payments.map((p) => p.toJSON());
  }

  async listAllPayments(rawQuery: unknown, _account: AuthenticatedAccount) {
    const query = candidateListQuerySchema.parse(rawQuery);
    const filter: FilterQuery<PaymentRecord> = {};

    if (query.status && ["Verification Pending", "Verified", "Rejected"].includes(query.status)) {
      filter.status = query.status as any;
    }

    if (query.search) {
      const exp = new RegExp(query.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [
        { candidateName: exp },
        { candidateId: exp },
        { transactionRef: exp },
        { receiptNumber: exp },
        { courseName: exp },
      ];
    }

    const skip = (query.page - 1) * query.pageSize;
    const [items, total] = await Promise.all([
      PaymentModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(query.pageSize),
      PaymentModel.countDocuments(filter),
    ]);
    const candidateIds = [...new Set(items.map((payment) => payment.candidateId))];
    const candidates = candidateIds.length
      ? await CandidateModel.find({ _id: { $in: candidateIds } }).select("name email phone paymentQrCode").lean()
      : [];
    const candidateById = new Map(candidates.map((candidate) => [String(candidate._id), candidate]));

    return {
      items: items.map((payment) => {
        const candidate = candidateById.get(String(payment.candidateId));
        return {
          ...payment.toJSON(),
          candidateName: payment.candidateName || candidate?.name || "",
          candidateEmail: candidate?.email || "",
          candidatePhone: candidate?.phone || "",
          paymentQrCode: candidate?.paymentQrCode || "",
        };
      }),
      pagination: paginationResult(total, query.page, query.pageSize),
    };
  }

  async verifyPayment(candidateId: string, paymentId: string, rawInput: unknown, account: AuthenticatedAccount) {
    if (account.role !== "MANAGER") throw new HttpError(403, "FORBIDDEN", "Only Managers can verify payments.");
    const input = verifyPaymentSchema.parse(rawInput);
    const payment = await PaymentModel.findOne({ _id: paymentId, candidateId });
    if (!payment) {
      throw new HttpError(404, "PAYMENT_NOT_FOUND", "Payment record not found.");
    }

    const candidate = await this.findInboundOrAccessible(candidateId, account);

    const receiptNumber = payment.receiptNumber || `RCP-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;

    payment.status = "Verified";
    payment.amount = input.verifiedAmount;
    payment.verifiedAt = new Date();
    payment.verifiedBy = account.name || account.username;
    payment.receiptNumber = receiptNumber;
    payment.receiptIssueDate = new Date();
    if (input.notes) payment.notes = input.notes;
    await payment.save();

    // Recalculate candidate total verified payments
    const verifiedPayments = await PaymentModel.find({ candidateId, status: "Verified" });
    const totalVerifiedPaid = verifiedPayments.reduce((acc, curr) => acc + (curr.amount || 0), 0);

    candidate.amountPaid = totalVerifiedPaid;
    candidate.balance = Math.max(0, (candidate.totalFee || 0) - totalVerifiedPaid);

    if (candidate.balance === 0 && (candidate.totalFee || 0) > 0) {
      candidate.paymentStatus = "Paid";
    } else if (candidate.amountPaid > 0) {
      candidate.paymentStatus = "Partially Paid";
    } else {
      candidate.paymentStatus = "Pending";
    }

    await candidate.save();

    await this.logs.record(
      candidate.id,
      candidate.name,
      "CANDIDATE_UPDATED",
      `Payment verified: ₹${input.verifiedAmount}. Receipt: ${receiptNumber}. Status: ${candidate.paymentStatus}`,
      account,
    );

    return {
      payment: payment.toJSON(),
      candidate: candidate.toJSON(),
    };
  }

  async rejectPayment(candidateId: string, paymentId: string, rawInput: unknown, account: AuthenticatedAccount) {
    if (account.role !== "MANAGER") throw new HttpError(403, "FORBIDDEN", "Only Managers can reject payments.");
    const input = rejectPaymentSchema.parse(rawInput);
    const payment = await PaymentModel.findOne({ _id: paymentId, candidateId });
    if (!payment) {
      throw new HttpError(404, "PAYMENT_NOT_FOUND", "Payment record not found.");
    }

    const candidate = await this.findInboundOrAccessible(candidateId, account);

    payment.status = "Rejected";
    payment.rejectionReason = input.rejectionReason;
    await payment.save();

    // Check if other pending submissions exist
    const pendingCount = await PaymentModel.countDocuments({ candidateId, status: "Verification Pending" });
    if (pendingCount === 0) {
      if (candidate.amountPaid && candidate.amountPaid > 0) {
        candidate.paymentStatus = candidate.balance === 0 ? "Paid" : "Partially Paid";
      } else {
        candidate.paymentStatus = "Pending";
      }
      await candidate.save();
    }

    await this.logs.record(
      candidate.id,
      candidate.name,
      "CANDIDATE_UPDATED",
      `Payment rejected: ${input.rejectionReason}`,
      account,
    );

    return {
      payment: payment.toJSON(),
      candidate: candidate.toJSON(),
    };
  }

  async getReceiptPdf(receiptNumber: string, actor: { id?: string; candidateId?: string; role?: string } | AuthenticatedAccount) {
    const payment = await PaymentModel.findOne({ receiptNumber });
    if (!payment || payment.status !== "Verified") {
      throw new HttpError(404, "RECEIPT_NOT_FOUND", "Receipt not found or payment is not verified.");
    }

    const candidate = await CandidateModel.findById(payment.candidateId);
    if (!candidate) {
      throw new HttpError(404, "CANDIDATE_NOT_FOUND", "Candidate record not found.");
    }

    // Authorization check: candidates can only download their own receipt
    const candidateId = ("candidateId" in actor && actor.candidateId) ? actor.candidateId : ("id" in actor ? actor.id : undefined);
    if ("role" in actor && actor.role === "CANDIDATE" && candidateId !== candidate.id && candidateId !== String(candidate._id) && candidateId !== payment.candidateId) {
      throw new HttpError(403, "FORBIDDEN", "You are not authorized to view another candidate's receipt.");
    }

    const paymentDateStr = payment.paidAt
      ? new Date(payment.paidAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
      : new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    const issueDateStr = payment.receiptIssueDate
      ? new Date(payment.receiptIssueDate).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
      : new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

    const pdfBuffer = receiptPdfService.generateReceiptPdf({
      receiptNumber: payment.receiptNumber || receiptNumber,
      candidateId: candidate.id,
      candidateName: candidate.name,
      courseName: candidate.courseName || candidate.position || "Professional IT Training Course",
      totalFee: candidate.totalFee || payment.amount,
      amountPaid: payment.amount,
      remainingBalance: candidate.balance ?? 0,
      paymentDate: paymentDateStr,
      transactionRef: payment.transactionRef,
      issueDate: issueDateStr,
      paymentStatus: (candidate.balance ?? 0) === 0 ? "Paid in Full" : "Partially Paid",
    });

    return {
      pdfBuffer,
      filename: `TVK-Receipt-${receiptNumber}.pdf`,
    };
  }

  // --- Feature 4: Candidate Credentials & Account Management ---

  async createCandidateAccount(candidateId: string, rawInput: unknown, account: AuthenticatedAccount) {
    const input = createCandidateAccountSchema.parse(rawInput || {});
    const candidate = await this.findInboundOrAccessible(candidateId, account);

    if (candidate.accountCreated) {
      throw new HttpError(409, "ACCOUNT_EXISTS", "A portal account has already been created for this candidate.");
    }

    let username = input.username
      ? input.username.toLowerCase().trim()
      : candidate.email.split("@")[0].toLowerCase().replace(/[^a-z0-9._-]/g, "");

    if (username.length < 3) {
      username = `cand_${randomBytes(3).toString("hex")}`;
    }

    // Ensure username uniqueness
    const existing = await CandidateModel.findOne({ accountUsername: username });
    if (existing) {
      username = `${username}_${randomBytes(2).toString("hex")}`;
    }

    const tempPassword = input.temporaryPassword || `TVK@${randomBytes(3).toString("hex").toUpperCase()}!${Math.floor(10 + Math.random() * 90)}`;
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    candidate.accountCreated = true;
    candidate.accountUsername = username;
    candidate.accountPasswordHash = passwordHash;
    candidate.accountPassword = tempPassword;
    candidate.accountMustChangePassword = false;
    candidate.accountCreatedAt = new Date();
    await candidate.save();

    const portalLoginUrl = `${env.clientOrigins[0] || "http://localhost:4200"}/candidate-login`;
    let emailSent = false;
    let offerLetterAttached = false;
    try {
      const attachments: Array<{ filename: string; content: Buffer; contentType?: string }> = [];
      if (input.attachOfferLetter) {
        const offerPdf = offerLetterPdfService.generateOfferLetterPdf({
          candidateId: candidate.id,
          candidateName: candidate.name,
          college: candidate.college || undefined,
          courseName: candidate.courseName || undefined,
          startDate: candidate.courseStartDate || candidate.joiningDate || undefined,
          endDate: candidate.completionDate || undefined,
        });
        attachments.push({
          filename: `Offer_Letter_${candidate.id}.pdf`,
          content: offerPdf,
          contentType: "application/pdf",
        });
        offerLetterAttached = true;
      }

      await emailService.sendCandidateEmail({
        to: candidate.email,
        subject: offerLetterAttached
          ? "TVK Technologies - Candidate Portal Login Credentials & Offer Letter"
          : "TVK Technologies - Candidate Portal Login Credentials",
        message: `Dear ${candidate.name},\n\nYour official TVK Technologies Candidate Portal account has been created.\n\nLogin URL: ${portalLoginUrl}\nUsername: ${username}\nPassword: ${tempPassword}\n\nPlease use these credentials provided by management to sign in to your Candidate Portal.${offerLetterAttached ? "\n\nPlease find your official Offer Letter / Internship Certificate attached to this email." : ""}\n\nBest regards,\nTVK Technologies Admissions Team`,
        actor: account,
        attachments,
      });
      emailSent = true;
    } catch (err) {
      console.warn("[CandidateService] Could not send credentials email:", err);
    }

    await this.logs.record(
      candidate.id,
      candidate.name,
      "CANDIDATE_UPDATED",
      `Candidate portal account created: username '${username}'. Email sent: ${emailSent}${offerLetterAttached ? " (with Offer Letter attached)" : ""}`,
      account,
    );

    return {
      success: true,
      username,
      emailSent,
      offerLetterAttached,
      accountCreatedAt: candidate.accountCreatedAt,
    };
  }

  async resetCandidatePasswordByHr(candidateId: string, account: AuthenticatedAccount, rawInput?: unknown) {
    if (rawInput && typeof rawInput === "object" && (rawInput as any).newPassword) {
      return this.updateCandidateCredentials(candidateId, rawInput, account);
    }

    const candidate = await this.findInboundOrAccessible(candidateId, account);
    if (!candidate.accountCreated) {
      throw new HttpError(400, "ACCOUNT_NOT_FOUND", "Candidate account has not been created yet.");
    }

    const tempPassword = `TVK@${randomBytes(3).toString("hex").toUpperCase()}!${Math.floor(10 + Math.random() * 90)}`;
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    candidate.accountPasswordHash = passwordHash;
    candidate.accountPassword = tempPassword;
    candidate.accountMustChangePassword = false;
    await candidate.save();

    const portalLoginUrl = `${env.clientOrigins[0] || "http://localhost:4200"}/candidate-login`;
    let emailSent = false;
    try {
      await emailService.sendCandidateEmail({
        to: candidate.email,
        subject: "TVK Technologies - Password Reset Credentials",
        message: `Dear ${candidate.name},\n\nYour candidate portal password has been reset by HR / Management.\n\nLogin URL: ${portalLoginUrl}\nUsername: ${candidate.accountUsername}\nPassword: ${tempPassword}\n\nPlease use these credentials to sign in to your Candidate Portal.\n\nBest regards,\nTVK Technologies Admissions Team`,
        actor: account,
      });
      emailSent = true;
    } catch (err) {
      console.warn("[CandidateService] Could not send reset email:", err);
    }

    await this.logs.record(
      candidate.id,
      candidate.name,
      "CANDIDATE_UPDATED",
      `Candidate portal password reset by HR for '${candidate.accountUsername}'`,
      account,
    );

    return {
      success: true,
      emailSent,
    };
  }

  async updateCandidateCredentials(candidateId: string, rawInput: unknown, account: AuthenticatedAccount) {
    const input = updateCandidateCredentialsSchema.parse(rawInput);
    const cleanUsername = input.username.toLowerCase().trim();

    const candidate = await this.findInboundOrAccessible(candidateId, account);

    // Verify username uniqueness against any other candidate
    const existing = await CandidateModel.findOne({
      accountUsername: cleanUsername,
      _id: { $ne: candidate._id },
    });
    if (existing) {
      throw new HttpError(409, "USERNAME_EXISTS", `Username '${cleanUsername}' is already taken by another candidate.`);
    }

    const passwordHash = await bcrypt.hash(input.newPassword, 12);

    candidate.accountUsername = cleanUsername;
    candidate.accountPasswordHash = passwordHash;
    candidate.accountPassword = input.newPassword;
    candidate.accountCreated = true;
    candidate.accountMustChangePassword = false;
    if (!candidate.accountCreatedAt) {
      candidate.accountCreatedAt = new Date();
    }
    await candidate.save();

    const portalLoginUrl = `${env.clientOrigins[0] || "http://localhost:4200"}/candidate-login`;
    let emailSent = false;
    let offerLetterAttached = false;
    try {
      const attachments: Array<{ filename: string; content: Buffer; contentType?: string }> = [];
      if (input.attachOfferLetter) {
        const offerPdf = offerLetterPdfService.generateOfferLetterPdf({
          candidateId: candidate.id,
          candidateName: candidate.name,
          college: candidate.college || undefined,
          courseName: candidate.courseName || undefined,
          startDate: candidate.courseStartDate || candidate.joiningDate || undefined,
          endDate: candidate.completionDate || undefined,
        });
        attachments.push({
          filename: `Offer_Letter_${candidate.id}.pdf`,
          content: offerPdf,
          contentType: "application/pdf",
        });
        offerLetterAttached = true;
      }

      await emailService.sendCandidateEmail({
        to: candidate.email,
        subject: offerLetterAttached
          ? "TVK Technologies - Updated Candidate Portal Login Credentials & Offer Letter"
          : "TVK Technologies - Updated Candidate Portal Login Credentials",
        message: `Dear ${candidate.name},\n\nYour official TVK Technologies Candidate Portal credentials have been updated by management.\n\nLogin URL: ${portalLoginUrl}\nUsername: ${cleanUsername}\nPassword: ${input.newPassword}\n\nPlease use these credentials to sign in to your Candidate Portal.${offerLetterAttached ? "\n\nPlease find your official Offer Letter / Internship Certificate attached to this email." : ""}\n\nBest regards,\nTVK Technologies Admissions Team`,
        actor: account,
        attachments,
      });
      emailSent = true;
    } catch (err) {
      console.warn("[CandidateService] Could not send credentials update email:", err);
    }

    await this.logs.record(
      candidate.id,
      candidate.name,
      "CANDIDATE_UPDATED",
      `Candidate portal credentials updated by management for '${cleanUsername}'. Email sent: ${emailSent}${offerLetterAttached ? " (with Offer Letter attached)" : ""}`,
      account,
    );

    return {
      success: true,
      username: cleanUsername,
      password: input.newPassword,
      emailSent,
      offerLetterAttached,
      message: `Updated credentials for '${cleanUsername}' saved securely and ${emailSent ? "emailed to " + candidate.email : "ready for login"}.`,
    };
  }

  // --- Feature 5 & 6: Candidate Authentication & Portal Endpoints ---

  async candidatePortalLogin(rawInput: unknown) {
    const input = candidatePortalLoginSchema.parse(rawInput);

    // Support both credential login (username/password) and identifier/phone fallback
    if (input.username && input.password) {
      const cleanUsername = input.username.trim().toLowerCase();
      const candidate = await CandidateModel.findOne({
        $or: [
          { accountUsername: cleanUsername },
          { normalizedEmail: cleanUsername },
        ],
      }).select("+accountPasswordHash");

      if (!candidate || !candidate.accountCreated || !candidate.accountPasswordHash) {
        throw new HttpError(401, "INVALID_CREDENTIALS", "Invalid username or password, or portal account has not been set up.");
      }

      const isValid = await bcrypt.compare(input.password, candidate.accountPasswordHash);
      if (!isValid) {
        throw new HttpError(401, "INVALID_CREDENTIALS", "Invalid username or password.");
      }

      const token = jwt.sign(
        {
          sub: candidate.id,
          role: "CANDIDATE",
          candidateId: candidate.id,
          username: candidate.accountUsername,
          mustChangePassword: false,
        },
        env.jwtSecret,
        { expiresIn: "7d" },
      );

      const candidateData = candidate.toJSON();
      const payments = await PaymentModel.find({ candidateId: candidate._id }).sort({ createdAt: -1 });

      return {
        token,
        mustChangePassword: false,
        candidate: {
          ...candidateData,
          payments: payments.map((p) => p.toJSON()),
        },
      };
    }

    // Fallback: identifier + phone login
    const cleanIdentifier = (input.identifier || "").trim().toLowerCase();
    const cleanPhone = (input.phone || "").replace(/\D/g, "");

    const candidate = await CandidateModel.findOne({
      $or: [
        { _id: (input.identifier || "").trim() },
        { normalizedEmail: cleanIdentifier },
      ],
    }).select("+normalizedPhone");

    if (!candidate) {
      throw new HttpError(401, "UNAUTHENTICATED", "No candidate record found with this ID or Email.");
    }

    const candidatePhone = (candidate.phone || "").replace(/\D/g, "");
    if (!candidatePhone || candidatePhone !== cleanPhone) {
      throw new HttpError(401, "UNAUTHENTICATED", "The provided phone number does not match our registration records.");
    }

    const token = jwt.sign(
      { sub: candidate.id, role: "CANDIDATE", candidateId: candidate.id },
      env.jwtSecret,
      { expiresIn: "7d" },
    );

    const payments = await PaymentModel.find({ candidateId: candidate._id }).sort({ createdAt: -1 });

    return {
      token,
      mustChangePassword: false,
      candidate: {
        ...candidate.toJSON(),
        payments: payments.map((p) => p.toJSON()),
      },
    };
  }

  async changeCandidatePassword(candidateId: string, rawInput: unknown) {
    const input = candidateChangePasswordSchema.parse(rawInput);
    const candidate = await CandidateModel.findById(candidateId).select("+accountPasswordHash");
    if (!candidate) {
      throw new HttpError(404, "CANDIDATE_NOT_FOUND", "Candidate record not found.");
    }

    const newHash = await bcrypt.hash(input.newPassword, 12);
    candidate.accountPasswordHash = newHash;
    candidate.accountPassword = input.newPassword;
    candidate.accountMustChangePassword = false;
    await candidate.save();

    return { success: true, message: "Password updated successfully." };
  }

  async candidateForgotPassword(rawInput: unknown) {
    const input = forgotPasswordSchema.parse(rawInput);
    const cleanEmail = input.email.trim().toLowerCase();
    const candidate = await CandidateModel.findOne({ normalizedEmail: cleanEmail });

    if (candidate && candidate.accountCreated) {
      const resetToken = randomBytes(32).toString("hex");
      candidate.passwordResetToken = resetToken;
      candidate.passwordResetExpiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      await candidate.save();

      const resetUrl = `${env.clientOrigins[0] || "http://localhost:4200"}/candidate-login?resetToken=${resetToken}`;
      try {
        await emailService.sendCandidateEmail({
          to: candidate.email,
          subject: "TVK Technologies - Password Reset Request",
          message: `Dear ${candidate.name},\n\nWe received a request to reset your Candidate Portal password.\n\nPlease click the link below to set a new password:\n${resetUrl}\n\nIf you did not request this, you can safely ignore this message.\n\nBest regards,\nTVK Technologies`,
          actor: { id: "SYSTEM", name: "TVK Support", email: "support@tvktechnologies.com", role: "MANAGER", username: "system", employeeId: "SYS01", active: true, mustChangePassword: false },
        });
      } catch (err) {
        console.warn("[CandidateService] Could not send password reset email:", err);
      }
    }

    return {
      success: true,
      message: "If an account exists with this email, password reset instructions have been sent.",
    };
  }

  async candidateResetPassword(rawInput: unknown) {
    const input = resetPasswordSchema.parse(rawInput);
    const candidate = await CandidateModel.findOne({
      passwordResetToken: input.token.trim(),
      passwordResetExpiresAt: { $gt: new Date() },
    });

    if (!candidate) {
      throw new HttpError(400, "INVALID_TOKEN", "Password reset token is invalid or has expired.");
    }

    candidate.accountPasswordHash = await bcrypt.hash(input.newPassword, 12);
    candidate.accountPassword = input.newPassword;
    candidate.accountMustChangePassword = false;
    candidate.passwordResetToken = null;
    candidate.passwordResetExpiresAt = null;
    await candidate.save();

    return { success: true, message: "Password has been reset successfully. You can now login with your new password." };
  }

  async submitCorrectionRequest(candidateId: string, rawInput: unknown) {
    const input = correctionRequestSchema.parse(rawInput);
    const candidate = await CandidateModel.findById(candidateId);
    if (!candidate) {
      throw new HttpError(404, "CANDIDATE_NOT_FOUND", "Candidate record not found.");
    }

    candidate.correctionRequests = candidate.correctionRequests || [];
    candidate.correctionRequests.push({
      id: randomUUID(),
      requestText: input.requestText,
      requestedAt: new Date(),
      status: "Pending",
    });
    await candidate.save();

    return { success: true, message: "Correction request submitted successfully to HR." };
  }

  async getCandidatePortalDetails(candidateId: string) {
    const candidate = await this.candidates.findById(candidateId);
    if (!candidate) throw new HttpError(404, "CANDIDATE_NOT_FOUND", "Candidate not found.");

    const payments = await PaymentModel.find({ candidateId }).sort({ createdAt: -1 });

    const candidateData = candidate.toJSON();
    const cleanCourse = normalizeCourseTitle(candidate.courseName || candidate.programmingLanguage || candidate.position || "");

    let totalFee = candidate.totalFee || 0;
    let balance = candidate.balance ?? Math.max(0, totalFee - (candidate.amountPaid || 0));

    // If totalFee is 0, auto-resolve from course tracks if configured by manager
    if (totalFee === 0 && cleanCourse) {
      try {
        const courseDoc = await CourseModel.findOne({
          name: new RegExp(`^${cleanCourse.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"),
        });
        if (courseDoc) {
          ensureCourseTracks(courseDoc);
          const matchedTrack = courseDoc.tracks?.find(
            (t) => t.duration.toLowerCase() === (candidate.courseDuration || "").trim().toLowerCase(),
          );
          const trackFee = matchedTrack?.fees ?? (courseDoc.fees || 0);
          if (trackFee > 0) {
            totalFee = trackFee;
            balance = Math.max(0, totalFee - (candidate.amountPaid || 0));
          }
        }
      } catch {
        // Ignore resolution error
      }
    }

    return {
      ...candidateData,
      courseName: cleanCourse || candidateData.courseName,
      totalFee,
      balance,
      payments: payments.map((p) => p.toJSON()),
    };
  }

  async submitCandidatePaymentProof(candidateId: string, rawInput: unknown, file: Express.Multer.File | undefined) {
    const input = submitPaymentProofSchema.parse(rawInput);
    const candidate = await this.candidates.findById(candidateId);
    if (!candidate) throw new HttpError(404, "CANDIDATE_NOT_FOUND", "Candidate not found.");

    let proofUrl = "";
    if (file) {
      proofUrl = `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;
    }

    const amount = input.amount && input.amount > 0
      ? input.amount
      : (candidate.balance && candidate.balance > 0 ? candidate.balance : (candidate.totalFee || 0));

    const paymentId = `PAY-${Date.now()}-${randomUUID().slice(0, 6)}`;
    const payment = await PaymentModel.create({
      _id: paymentId,
      candidateId: candidate._id,
      candidateName: candidate.name,
      courseName: candidate.courseName || candidate.position || "IT Training Course",
      amount,
      transactionRef: input.transactionRef.trim(),
      paymentProofUrl: proofUrl,
      status: "Verification Pending",
      paidAt: input.paymentDate ? new Date(input.paymentDate) : new Date(),
      notes: input.notes || "Submitted via candidate portal",
    });

    candidate.paymentStatus = "Verification Pending";
    await candidate.save();

    return payment.toJSON();
  }

  async submitContactManagerRequest(rawInput: unknown) {
    const input = contactManagerSchema.parse(rawInput);
    const cleanEmail = input.email.trim().toLowerCase();
    const cleanPhone = input.phone.trim();

    let candidate = await CandidateModel.findOne({
      $or: [
        { normalizedEmail: cleanEmail },
        { email: { $regex: new RegExp(`^${cleanEmail}$`, "i") } },
      ],
    });

    const requestId = randomUUID();
    const requestItem = {
      id: requestId,
      requestText: input.issueDescription.trim(),
      requestedAt: new Date(),
      status: "Pending" as const,
      completedAt: null,
      completedBy: null,
      candidateName: input.name.trim(),
      email: cleanEmail,
      phone: cleanPhone,
      courseName: input.courseName.trim(),
      type: "SUPPORT_REQUEST" as const,
    };

    if (candidate) {
      candidate.correctionRequests = candidate.correctionRequests || [];
      candidate.correctionRequests.push(requestItem as any);
      candidate.markModified("correctionRequests");
      await candidate.save();
    } else {
      candidate = new CandidateModel({
        name: input.name.trim(),
        email: cleanEmail,
        normalizedEmail: cleanEmail,
        phone: cleanPhone,
        normalizedPhone: cleanPhone.replace(/\D/g, ""),
        position: input.courseName.trim(),
        courseName: input.courseName.trim(),
        source: "WEBSITE_APPLICATION",
        status: "NEW",
        correctionRequests: [requestItem as any],
      });
      await candidate.save();
    }

    await this.logs.record(
      candidate.id,
      candidate.name,
      "CANDIDATE_UPDATED",
      `Support request submitted via Contact Manager: "${input.issueDescription.trim().slice(0, 100)}"`,
      { id: "SYSTEM", name: "Candidate Portal", email: cleanEmail, role: "MANAGER", username: "system", employeeId: "SYS01", active: true, mustChangePassword: false },
    );

    return {
      success: true,
      message: "Your request has been submitted successfully. The manager will review your issue and assist you.",
      requestId,
    };
  }

  async getPublicCourses(): Promise<string[]> {
    const courses = await CourseModel.find({}, { name: 1 }).sort({ name: 1 }).lean();
    if (courses && courses.length > 0) {
      return courses.map((c) => c.name).filter(Boolean);
    }
    return [
      "Full Stack Development with Java & Angular",
      "Cloud Engineering with AWS & Azure",
      "DevOps Engineering",
      "Python for Web Development & Automation",
      "C# & .NET Development",
    ];
  }

  async getAllCorrectionRequests(_account: AuthenticatedAccount) {
    const candidates = await CandidateModel.find(
      { "correctionRequests.0": { $exists: true } },
      { name: 1, email: 1, phone: 1, courseName: 1, accountCreated: 1, accountUsername: 1, correctionRequests: 1 }
    ).lean();

    const notifications: Array<{
      id: string;
      candidateId: string;
      candidateName: string;
      email: string;
      phone: string;
      courseName: string;
      requestText: string;
      requestedAt: Date;
      status: "Pending" | "In Progress" | "Resolved" | "Completed" | "Reviewed";
      completedAt?: Date | null;
      completedBy?: string | null;
      accountCreated: boolean;
      accountUsername: string;
    }> = [];

    for (const cand of candidates) {
      if (cand.correctionRequests && cand.correctionRequests.length > 0) {
        for (const req of cand.correctionRequests) {
          notifications.push({
            id: req.id,
            candidateId: cand._id.toString(),
            candidateName: (req as any).candidateName || cand.name || "Unnamed Candidate",
            email: (req as any).email || cand.email || "",
            phone: (req as any).phone || cand.phone || "",
            courseName: (req as any).courseName || cand.courseName || "Training Course",
            requestText: req.requestText,
            requestedAt: req.requestedAt,
            status: (req.status as any) || "Pending",
            completedAt: req.completedAt,
            completedBy: req.completedBy,
            accountCreated: Boolean(cand.accountCreated),
            accountUsername: cand.accountUsername || "",
          });
        }
      }
    }

    // Sort: Pending first, then In Progress, then by requestedAt descending
    notifications.sort((a, b) => {
      const getPriority = (status: string) => {
        if (status === "Pending") return 1;
        if (status === "In Progress") return 2;
        return 3;
      };
      const diff = getPriority(a.status) - getPriority(b.status);
      if (diff !== 0) return diff;
      return new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime();
    });

    return notifications;
  }

  async updateCorrectionRequestStatus(
    candidateId: string,
    requestId: string,
    status: "Pending" | "In Progress" | "Resolved" | "Completed",
    account: AuthenticatedAccount
  ) {
    const candidate = await this.findInboundOrAccessible(candidateId, account);
    candidate.correctionRequests = candidate.correctionRequests || [];
    const req = candidate.correctionRequests.find((r) => r.id === requestId);
    if (!req) {
      throw new HttpError(404, "REQUEST_NOT_FOUND", "Correction request not found.");
    }

    req.status = status as any;
    if (status === "Completed" || status === "Resolved") {
      req.completedAt = new Date();
      req.completedBy = account.name || account.email;
    } else {
      req.completedAt = null;
      req.completedBy = null;
    }

    candidate.markModified("correctionRequests");
    await candidate.save();

    await this.logs.record(
      candidate.id,
      candidate.name,
      "CANDIDATE_UPDATED",
      `Support/Correction request marked as ${status} by ${account.name || account.email}`,
      account
    );

    return {
      success: true,
      request: req,
      candidate: candidate.toJSON(),
    };
  }

  private async findAccessible(id: string, account: AuthenticatedAccount): Promise<CandidateDocument> {
    const candidate = await this.candidates.findById(id);
    if (!candidate) throw new HttpError(404, "CANDIDATE_NOT_FOUND", "Candidate not found.");
    if (account.role === "HR" && candidate.assignedToId !== account.employeeId) {
      throw new HttpError(404, "CANDIDATE_NOT_FOUND", "Candidate not found.");
    }
    return candidate;
  }
}

export const candidateService = new CandidateService();