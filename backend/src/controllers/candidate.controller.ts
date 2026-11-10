import { pipeline } from "node:stream/promises";
import { Request, Response } from "express";
import { candidateService } from "../services/candidate.service";
import { resumeService } from "../services/resume.service";
import { courseService } from "../services/course.service";
import { emailService } from "../services/email.service";
import { whatsappService } from "../services/whatsapp.service";
import { HttpError } from "../middleware/error-handler";
import {
  candidateBodySchema,
  candidateNoteSchema,
  candidatePatchSchema,
  candidatePortalLoginSchema,
  candidateRegistrationSchema,
  candidateStatusSchema,
  candidatePaymentParamsSchema,
  idParamSchema,
  sendCandidateEmailSchema,
  sendCandidateWhatsAppSchema,
} from "../validators/candidate.validators";

function accountFrom(request: Request) {
  if (!request.account) throw new HttpError(401, "UNAUTHENTICATED", "Sign in to continue.");
  return request.account;
}

export async function registerCandidate(request: Request, response: Response): Promise<void> {
  const validated = candidateRegistrationSchema.parse(request.body);
  const result = await candidateService.registerPublic(validated, request.file);
  response.status(201).json({ success: true, data: result });
}

export async function listCandidates(request: Request, response: Response): Promise<void> {
  const result = await candidateService.list(request.query, accountFrom(request));
  response.json({ success: true, data: result });
}

export async function createCandidate(request: Request, response: Response): Promise<void> {
  const candidate = await candidateService.create(candidateBodySchema.parse(request.body), accountFrom(request));
  response.status(201).json({ success: true, data: candidate });
}

export async function createCandidates(request: Request, response: Response): Promise<void> {
  const body = candidateBodySchema.array().min(1).max(100).parse(request.body);
  const candidates = await candidateService.createMany(body, accountFrom(request));
  response.status(201).json({ success: true, data: candidates });
}

export async function getCandidate(request: Request, response: Response): Promise<void> {
  const { id } = idParamSchema.parse(request.params);
  const candidate = await candidateService.get(id, accountFrom(request));
  response.json({ success: true, data: candidate });
}

export async function updateCandidate(request: Request, response: Response): Promise<void> {
  const { id } = idParamSchema.parse(request.params);
  const changes = candidatePatchSchema.parse(request.body);
  const candidate = await candidateService.update(id, changes, accountFrom(request));
  response.json({ success: true, data: candidate });
}

export async function updateCandidateStatus(request: Request, response: Response): Promise<void> {
  const { id } = idParamSchema.parse(request.params);
  const { status, message } = candidateStatusSchema.parse(request.body);
  const candidate = await candidateService.changeStatus(id, status, accountFrom(request), message);
  response.json({ success: true, data: candidate });
}

export async function archiveCandidate(request: Request, response: Response): Promise<void> {
  const { id } = idParamSchema.parse(request.params);
  response.json({ success: true, data: await candidateService.archive(id, accountFrom(request)) });
}

export async function restoreCandidate(request: Request, response: Response): Promise<void> {
  const { id } = idParamSchema.parse(request.params);
  response.json({ success: true, data: await candidateService.restore(id, accountFrom(request)) });
}

export async function deleteCandidate(request: Request, response: Response): Promise<void> {
  const { id } = idParamSchema.parse(request.params);
  await candidateService.deleteArchived(id, accountFrom(request));
  response.status(204).end();
}

export async function getAssignmentHistory(request: Request, response: Response): Promise<void> {
  const { id } = idParamSchema.parse(request.params);
  response.json({ success: true, data: await candidateService.assignmentHistory(id, accountFrom(request)) });
}

export async function listArchivedCandidates(request: Request, response: Response): Promise<void> {
  const archivedQuery = { ...request.query, status: "ARCHIVED" };
  const result = await candidateService.list(archivedQuery, accountFrom(request));
  response.json({ success: true, data: result });
}

export async function addCandidateNote(request: Request, response: Response): Promise<void> {
  const { id } = idParamSchema.parse(request.params);
  const { note } = candidateNoteSchema.parse(request.body);
  response.json({ success: true, data: { candidate: await candidateService.addNote(id, note, accountFrom(request)) } });
}

export async function sendCandidateEmail(request: Request, response: Response): Promise<void> {
  const { id } = idParamSchema.parse(request.params);
  const body = sendCandidateEmailSchema.parse(request.body);
  const result = await candidateService.sendEmail(id, body, accountFrom(request));
  response.json({ success: true, data: result });
}

export function getEmailStatus(_request: Request, response: Response): void {
  response.json({ success: true, data: emailService.getStatus() });
}

export async function sendCandidateWhatsApp(request: Request, response: Response): Promise<void> {
  const { id } = idParamSchema.parse(request.params);
  const body = sendCandidateWhatsAppSchema.parse(request.body);
  const result = await candidateService.sendWhatsApp(id, body, accountFrom(request));
  response.json({ success: true, data: result });
}

export async function getWhatsAppStatus(_request: Request, response: Response): Promise<void> {
  response.json({ success: true, data: await whatsappService.getStatus() });
}

// --- Feature 1: Inbound Management ---

export async function listInboundCandidates(request: Request, response: Response): Promise<void> {
  const result = await candidateService.listInbound(request.query, accountFrom(request));
  response.json({ success: true, data: result });
}

export async function updateCandidateCourseDetails(request: Request, response: Response): Promise<void> {
  const { id } = idParamSchema.parse(request.params);
  const updated = await candidateService.updateCourseDetails(id, request.body, accountFrom(request));
  response.json({ success: true, data: updated });
}

export async function getCommonPaymentQr(_request: Request, response: Response): Promise<void> {
  const qrCode = await candidateService.getCommonPaymentQr();
  response.json({ success: true, data: { qrCode } });
}

export async function uploadCommonPaymentQr(request: Request, response: Response): Promise<void> {
  let qrDataUrl = "";
  if (request.file) {
    qrDataUrl = `data:${request.file.mimetype};base64,${request.file.buffer.toString("base64")}`;
  } else if (typeof request.body.qrCode === "string" && request.body.qrCode.startsWith("data:image/")) {
    qrDataUrl = request.body.qrCode;
  } else {
    throw new HttpError(400, "QR_IMAGE_REQUIRED", "Please upload a PNG or JPG QR code image.");
  }

  const result = await candidateService.updateCommonPaymentQr(qrDataUrl, accountFrom(request));
  response.json({ success: true, data: result });
}

export async function uploadCandidatePaymentQr(request: Request, response: Response): Promise<void> {
  const { id } = idParamSchema.parse(request.params);

  let qrDataUrl = "";
  if (request.file) {
    qrDataUrl = `data:${request.file.mimetype};base64,${request.file.buffer.toString("base64")}`;
  } else if (typeof request.body.qrCode === "string" && request.body.qrCode.startsWith("data:image/")) {
    qrDataUrl = request.body.qrCode;
  } else {
    throw new HttpError(400, "QR_IMAGE_REQUIRED", "Please upload a PNG or JPG QR code image.");
  }

  const updated = await candidateService.updatePaymentQr(id, qrDataUrl, accountFrom(request));
  response.json({ success: true, data: updated });
}

// --- Feature 2: Certificate Management ---

export async function listCandidateCertificates(request: Request, response: Response): Promise<void> {
  const result = await candidateService.listCertificates(request.query, accountFrom(request));
  response.json({ success: true, data: result });
}

export async function markCandidateCourseCompletion(request: Request, response: Response): Promise<void> {
  const { id } = idParamSchema.parse(request.params);
  const updated = await candidateService.markCourseCompletion(id, request.body, accountFrom(request));
  response.json({ success: true, data: updated });
}

export async function generateCandidateCertificate(request: Request, response: Response): Promise<void> {
  const { id } = idParamSchema.parse(request.params);
  const regenerate = request.body?.regenerate === true;
  const courseName = request.body?.courseName as string | undefined;
  const courseDuration = request.body?.courseDuration as string | undefined;
  const updated = await candidateService.generateCertificate(id, accountFrom(request), regenerate, { courseName, courseDuration });
  response.json({ success: true, data: updated });
}

export async function revokeCandidateCertificate(request: Request, response: Response): Promise<void> {
  const { id } = idParamSchema.parse(request.params);
  const reason = String(request.body?.reason || "");
  const updated = await candidateService.revokeCertificate(id, reason, accountFrom(request));
  response.json({ success: true, data: updated });
}

export async function downloadCandidateCertificate(request: Request, response: Response): Promise<void> {
  const { id } = idParamSchema.parse(request.params);
  const result = await candidateService.getCertificatePdf(id, accountFrom(request));
  const format = String(request.query.format || "").toLowerCase();

  if (format === "pdf") {
    response.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(result.pdfFilename)}"`,
      "Content-Length": String(result.pdfBuffer.length),
    });
    response.send(result.pdfBuffer);
    return;
  }

  // Default: PNG format
  response.set({
    "Content-Type": "image/png",
    "Content-Disposition": `attachment; filename="${encodeURIComponent(result.filename)}"`,
    "Content-Length": String(result.pngBuffer.length),
    "Cache-Control": "private, no-cache",
  });
  response.send(result.pngBuffer);
}

export async function previewCandidateCertificate(request: Request, response: Response): Promise<void> {
  const { id } = idParamSchema.parse(request.params);
  const result = await candidateService.getCertificatePdf(id, accountFrom(request));
  const format = String(request.query.format || "").toLowerCase();

  if (format === "pdf") {
    response.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${encodeURIComponent(result.pdfFilename)}"`,
      "Content-Length": String(result.pdfBuffer.length),
    });
    response.send(result.pdfBuffer);
    return;
  }

  // Default: PNG format
  response.set({
    "Content-Type": "image/png",
    "Content-Disposition": `inline; filename="${encodeURIComponent(result.filename)}"`,
    "Content-Length": String(result.pngBuffer.length),
    "Cache-Control": "private, no-cache",
  });
  response.send(result.pngBuffer);
}

export async function downloadOfferLetter(request: Request, response: Response): Promise<void> {
  const { id } = idParamSchema.parse(request.params);
  const actor = request.candidateUser || accountFrom(request);
  const format = String(request.query.format || "").toLowerCase();
  const disposition = String(request.query.disposition || "").toLowerCase();
  const result = await candidateService.getOfferLetterPdf(id, actor as any);

  if (format === "pdf") {
    response.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposition === "inline" ? "inline" : "attachment"}; filename="${encodeURIComponent(result.filename)}"`,
      "Content-Length": String(result.pdfBuffer.length),
    });
    response.send(result.pdfBuffer);
    return;
  }

  if (format === "jpeg" || format === "jpg") {
    response.set({
      "Content-Type": "image/jpeg",
      "Content-Disposition": `${disposition === "inline" ? "inline" : "attachment"}; filename="Offer_Letter_${id}.jpeg"`,
      "Content-Length": String(result.jpegBuffer.length),
      "Cache-Control": "private, no-cache",
    });
    response.send(result.jpegBuffer);
    return;
  }

  // Default: PNG image format
  response.set({
    "Content-Type": "image/png",
    "Content-Disposition": `${disposition === "inline" ? "inline" : "attachment"}; filename="Offer_Letter_${id}.png"`,
    "Content-Length": String(result.pngBuffer.length),
    "Cache-Control": "private, no-cache",
  });
  response.send(result.pngBuffer);
}

export async function verifyCertificatePublic(request: Request, response: Response): Promise<void> {
  const certificateId = String(request.params.certificateId || "");
  const result = await candidateService.verifyCertificatePublic(certificateId);
  response.json({ success: true, data: result });
}

// --- Outbound Candidates Management ---

export async function createOutboundCandidate(request: Request, response: Response): Promise<void> {
  let skills = request.body.skills;
  if (typeof skills === "string") {
    try {
      skills = JSON.parse(skills);
    } catch {
      skills = skills ? skills.split(",").map((s: string) => s.trim()) : [];
    }
  }

  const payload = {
    ...request.body,
    skills: Array.isArray(skills) ? skills : [],
  };

  const result = await candidateService.createOutbound(payload, request.file, accountFrom(request));
  response.status(201).json({ success: true, data: result });
}

export async function listOutboundCandidates(request: Request, response: Response): Promise<void> {
  const result = await candidateService.listOutbound(request.query, accountFrom(request));
  response.json({ success: true, data: result });
}

// --- Payment Links, Tracking, Verification & Receipts ---

export async function getCandidatePaymentToken(request: Request, response: Response): Promise<void> {
  const { id } = idParamSchema.parse(request.params);
  const result = await candidateService.getOrCreatePaymentToken(id, accountFrom(request));
  response.json({ success: true, data: result });
}

export async function getPublicPaymentDetails(request: Request, response: Response): Promise<void> {
  const token = String(request.params["token"] || "").trim();
  const result = await candidateService.getPublicPaymentDetails(token);
  response.json({ success: true, data: result });
}

export async function submitPublicPaymentProof(request: Request, response: Response): Promise<void> {
  const token = String(request.params["token"] || "").trim();
  const result = await candidateService.submitPublicPaymentProof(token, request.body, request.file);
  response.status(201).json({ success: true, data: result });
}

export async function listCandidatePayments(request: Request, response: Response): Promise<void> {
  const { id } = idParamSchema.parse(request.params);
  const result = await candidateService.listCandidatePayments(id, accountFrom(request));
  response.json({ success: true, data: result });
}

export async function listAllPayments(request: Request, response: Response): Promise<void> {
  const result = await candidateService.listAllPayments(request.query, accountFrom(request));
  response.json({ success: true, data: result });
}

export async function verifyCandidatePayment(request: Request, response: Response): Promise<void> {
  const parsedParams = candidatePaymentParamsSchema.safeParse(request.params);
  const id = (parsedParams.success ? parsedParams.data.id : "") || String(request.params["id"] || "");
  const paymentId = (parsedParams.success ? parsedParams.data.paymentId : "") || String(request.params["paymentId"] || request.body?.paymentId || "");
  const result = await candidateService.verifyPayment(id, paymentId, request.body, accountFrom(request));
  response.json({ success: true, data: result });
}

export async function rejectCandidatePayment(request: Request, response: Response): Promise<void> {
  const parsedParams = candidatePaymentParamsSchema.safeParse(request.params);
  const id = (parsedParams.success ? parsedParams.data.id : "") || String(request.params["id"] || "");
  const paymentId = (parsedParams.success ? parsedParams.data.paymentId : "") || String(request.params["paymentId"] || request.body?.paymentId || "");
  const result = await candidateService.rejectPayment(id, paymentId, request.body, accountFrom(request));
  response.json({ success: true, data: result });
}

export async function downloadPaymentReceipt(request: Request, response: Response): Promise<void> {
  const receiptNumber = String(request.params["receiptNumber"] || "");
  const actor = request.candidateUser || accountFrom(request);
  const { pdfBuffer, filename } = await candidateService.getReceiptPdf(receiptNumber, actor as any);

  response.set({
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
    "Content-Length": String(pdfBuffer.length),
  });
  response.send(pdfBuffer);
}

// --- Candidate Credentials Management (HR) ---

export async function createCandidateAccount(request: Request, response: Response): Promise<void> {
  const { id } = idParamSchema.parse(request.params);
  const result = await candidateService.createCandidateAccount(id, request.body, accountFrom(request));
  response.status(201).json({ success: true, data: result });
}

export async function resetCandidatePasswordByHr(request: Request, response: Response): Promise<void> {
  const { id } = idParamSchema.parse(request.params);
  const result = await candidateService.resetCandidatePasswordByHr(id, accountFrom(request), request.body);
  response.json({ success: true, data: result });
}

export async function updateCandidateCredentials(request: Request, response: Response): Promise<void> {
  const { id } = idParamSchema.parse(request.params);
  const result = await candidateService.updateCandidateCredentials(id, request.body, accountFrom(request));
  response.json({ success: true, data: result });
}

// --- Candidate Portal Endpoints ---

export async function candidatePortalLogin(request: Request, response: Response): Promise<void> {
  const result = await candidateService.candidatePortalLogin(request.body);
  response.json({ success: true, data: result });
}

export async function candidatePortalChangePassword(request: Request, response: Response): Promise<void> {
  const candidateId = request.candidateUser?.candidateId;
  if (!candidateId) throw new HttpError(401, "UNAUTHENTICATED", "Candidate session missing.");
  const result = await candidateService.changeCandidatePassword(candidateId, request.body);
  response.json({ success: true, data: result });
}

export async function candidatePortalForgotPassword(request: Request, response: Response): Promise<void> {
  const result = await candidateService.candidateForgotPassword(request.body);
  response.json({ success: true, data: result });
}

export async function candidatePortalResetPassword(request: Request, response: Response): Promise<void> {
  const result = await candidateService.candidateResetPassword(request.body);
  response.json({ success: true, data: result });
}

export async function candidatePortalSubmitCorrectionRequest(request: Request, response: Response): Promise<void> {
  const candidateId = request.candidateUser?.candidateId;
  if (!candidateId) throw new HttpError(401, "UNAUTHENTICATED", "Candidate session missing.");
  const result = await candidateService.submitCorrectionRequest(candidateId, request.body);
  response.json({ success: true, data: result });
}

export async function candidatePortalSubmitPayment(request: Request, response: Response): Promise<void> {
  const candidateId = request.candidateUser?.candidateId;
  if (!candidateId) throw new HttpError(401, "UNAUTHENTICATED", "Candidate session missing.");
  const result = await candidateService.submitCandidatePaymentProof(candidateId, request.body, request.file);
  response.status(201).json({ success: true, data: result });
}

export async function getCandidatePortalMyDetails(request: Request, response: Response): Promise<void> {
  const candidateId = request.candidateUser?.candidateId;
  if (!candidateId) throw new HttpError(401, "UNAUTHENTICATED", "Candidate session missing.");
  const candidate = await candidateService.getCandidatePortalDetails(candidateId);
  response.json({ success: true, data: candidate });
}

export async function candidatePortalDownloadCertificate(request: Request, response: Response): Promise<void> {
  const candidateId = request.candidateUser?.candidateId;
  if (!candidateId) throw new HttpError(401, "UNAUTHENTICATED", "Candidate session missing.");
  const result = await candidateService.getCertificatePdf(candidateId);
  const format = String(request.query.format || "").toLowerCase();

  if (format === "pdf") {
    response.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(result.pdfFilename)}"`,
      "Content-Length": String(result.pdfBuffer.length),
    });
    response.send(result.pdfBuffer);
    return;
  }

  // Default: PNG format
  response.set({
    "Content-Type": "image/png",
    "Content-Disposition": `attachment; filename="${encodeURIComponent(result.filename)}"`,
    "Content-Length": String(result.pngBuffer.length),
    "Cache-Control": "private, no-cache",
  });
  response.send(result.pngBuffer);
}

export async function candidatePortalDownloadResume(request: Request, response: Response): Promise<void> {
  const candidateId = request.candidateUser?.candidateId;
  if (!candidateId) throw new HttpError(401, "UNAUTHENTICATED", "Candidate session missing.");
  const resumeFileId = (request.params["resumeFileId"] as string) || undefined;
  const resume = await resumeService.streamCandidateResume(candidateId, resumeFileId);
  const safeName = encodeURIComponent(resume.filename).replace(/['()]/g, (c) => `%${c.charCodeAt(0).toString(16)}`);
  const mimeType = (resume as { mimeType?: string }).mimeType || (
    resume.filename.toLowerCase().endsWith(".docx")
      ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      : resume.filename.toLowerCase().endsWith(".doc")
        ? "application/msword"
        : "application/pdf"
  );
  response.set({
    "Content-Type": mimeType,
    "Content-Disposition": `attachment; filename*=UTF-8''${safeName}`,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  });
  await pipeline(resume.stream, response);
}

export async function getCorrectionRequests(request: Request, response: Response): Promise<void> {
  const notifications = await candidateService.getAllCorrectionRequests(accountFrom(request));
  response.json({ success: true, data: notifications });
}

export async function updateCorrectionRequestStatus(request: Request, response: Response): Promise<void> {
  const id = String(request.params.id);
  const requestId = String(request.params.requestId);
  const status = request.body?.status;
  if (!["Pending", "In Progress", "Resolved", "Completed"].includes(status)) {
    throw new HttpError(400, "INVALID_STATUS", "Status must be Pending, In Progress, or Resolved.");
  }
  const result = await candidateService.updateCorrectionRequestStatus(id, requestId, status as any, accountFrom(request));
  response.json({ success: true, data: result });
}

export async function submitContactManager(request: Request, response: Response): Promise<void> {
  const result = await candidateService.submitContactManagerRequest(request.body);
  response.status(201).json({ success: true, data: result });
}

export async function getPublicCoursesList(_request: Request, response: Response): Promise<void> {
  const courses = await candidateService.getPublicCourses();
  response.json({ success: true, data: courses });
}

export async function candidatePortalGetCurriculum(request: Request, response: Response): Promise<void> {
  const candidateId = request.candidateUser?.candidateId;
  if (!candidateId) throw new HttpError(401, "UNAUTHENTICATED", "Candidate session missing.");
  const candidate = await candidateService.getCandidatePortalDetails(candidateId);
  const courseName = (candidate.courseName || candidate.programmingLanguage || candidate.position || "") as string;
  const courseDuration = (candidate.courseDuration || "") as string;
  const result = await courseService.getCurriculumForCandidateCourse(courseName, courseDuration);
  response.json({ success: true, data: result });
}

export async function candidatePortalDownloadCurriculum(request: Request, response: Response): Promise<void> {
  const candidateId = request.candidateUser?.candidateId;
  if (!candidateId) throw new HttpError(401, "UNAUTHENTICATED", "Candidate session missing.");
  const candidate = await candidateService.getCandidatePortalDetails(candidateId);
  const courseName = (candidate.courseName || candidate.programmingLanguage || candidate.position || "") as string;
  const courseDuration = (candidate.courseDuration || "") as string;
  const curriculumInfo = await courseService.getCurriculumForCandidateCourse(courseName, courseDuration);
  if (!curriculumInfo.available || !curriculumInfo.fileId) {
    throw new HttpError(404, "CURRICULUM_NOT_FOUND", "Curriculum document has not been uploaded for your course duration yet.");
  }

  const { file, course } = await courseService.getCurriculumFileById(curriculumInfo.fileId);
  const safeCourseName = course.name.replace(/[^a-zA-Z0-9_-]/g, "_");
  const safeDuration = (curriculumInfo.duration || "Track").replace(/[^a-zA-Z0-9_-]/g, "_");
  const ext = file.originalName.slice(file.originalName.lastIndexOf(".")).toLowerCase();
  const downloadName = `TVK-${safeCourseName}-${safeDuration}-Curriculum${ext}`;

  response.setHeader("Content-Type", file.mimeType);
  response.setHeader("Content-Disposition", `attachment; filename="${downloadName}"`);
  response.setHeader("Content-Length", file.size);
  response.send(file.data);
}
