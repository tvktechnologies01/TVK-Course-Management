import { Router } from "express";
import multer from "multer";
import { rateLimit } from "express-rate-limit";
import { HttpError } from "../middleware/error-handler";
import {
  archiveCandidate,
  addCandidateNote,
  createCandidate,
  createCandidateAccount,
  createCandidates,
  createOutboundCandidate,
  deleteCandidate,
  downloadCandidateCertificate,
  downloadOfferLetter,
  downloadPaymentReceipt,
  generateCandidateCertificate,
  getAssignmentHistory,
  getCandidate,
  getCandidatePaymentToken,
  getCommonPaymentQr,
  getCorrectionRequests,
  getEmailStatus,
  getWhatsAppStatus,
  listAllPayments,
  listArchivedCandidates,
  listCandidateCertificates,
  listCandidatePayments,
  listCandidates,
  listInboundCandidates,
  listOutboundCandidates,
  markCandidateCourseCompletion,
  previewCandidateCertificate,
  registerCandidate,
  rejectCandidatePayment,
  resetCandidatePasswordByHr,
  revokeCandidateCertificate,
  updateCandidateCredentials,
  restoreCandidate,
  sendCandidateEmail,
  sendCandidateWhatsApp,
  updateCandidate,
  updateCandidateCourseDetails,
  updateCandidateStatus,
  updateCorrectionRequestStatus,
  uploadCandidatePaymentQr,
  uploadCommonPaymentQr,
  verifyCandidatePayment,
  verifyCertificatePublic,
} from "../controllers/candidate.controller";
import { requireAuth, requireRole } from "../middleware/require-auth";

const ALLOWED_EXTENSIONS = [".pdf", ".doc", ".docx"];

const registrationUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 1 * 1024 * 1024, // 1 MB limit
    files: 1,
    fields: 30,
  },
  fileFilter(_request, file, callback) {
    const ext = file.originalname.slice(file.originalname.lastIndexOf(".")).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return callback(new HttpError(400, "INVALID_FILE_TYPE", "Only PDF, DOC, and DOCX files are allowed for resume upload."));
    }
    callback(null, true);
  },
});

const registrationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    error: { code: "RATE_LIMITED", message: "Too many registration attempts. Please try again later." },
  },
});

const ALLOWED_QR_EXTENSIONS = [".png", ".jpg", ".jpeg"];

const qrUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024, // 2 MB limit for QR images
    files: 1,
  },
  fileFilter(_request, file, callback) {
    const ext = file.originalname.slice(file.originalname.lastIndexOf(".")).toLowerCase();
    if (!ALLOWED_QR_EXTENSIONS.includes(ext)) {
      return callback(new HttpError(400, "INVALID_FILE_TYPE", "Only PNG and JPG/JPEG image formats are allowed for QR code."));
    }
    callback(null, true);
  },
});

export const candidateRouter = Router();

// Public candidate registration endpoint (unauthenticated)
candidateRouter.post("/register", registrationLimiter, registrationUpload.single("resume"), registerCandidate);

// Public certificate verification endpoint (unauthenticated for QR scan)
candidateRouter.get("/certificates/verify/:certificateId", verifyCertificatePublic);

candidateRouter.use(requireAuth);

// Common Official Payment QR (HR/Manager view, Manager replace)
candidateRouter.get("/payment-qr", getCommonPaymentQr);
candidateRouter.post("/payment-qr", requireRole("MANAGER"), qrUpload.single("qrCode"), uploadCommonPaymentQr);

// Inbound candidates management (HR & Manager)
candidateRouter.get("/inbound", listInboundCandidates);
candidateRouter.patch("/:id/course-details", updateCandidateCourseDetails);
candidateRouter.post("/:id/payment-qr", requireRole("MANAGER"), qrUpload.single("qrCode"), uploadCandidatePaymentQr);

// Outbound candidates management (HR & Manager)
candidateRouter.get("/outbound", listOutboundCandidates);
candidateRouter.post("/outbound", registrationUpload.single("resume"), createOutboundCandidate);

// Payment tracking, verification & receipts (HR & Manager)
candidateRouter.get("/payments", listAllPayments);
candidateRouter.get("/receipts/:receiptNumber/download", downloadPaymentReceipt);
candidateRouter.get("/:id/payment-token", getCandidatePaymentToken);
candidateRouter.get("/:id/payments", listCandidatePayments);
candidateRouter.post("/:id/payments/:paymentId/verify", requireRole("MANAGER"), verifyCandidatePayment);
candidateRouter.post("/:id/payments/:paymentId/reject", requireRole("MANAGER"), rejectCandidatePayment);

// Candidate portal account management (HR & Manager)
candidateRouter.post("/:id/create-account", createCandidateAccount);
candidateRouter.post("/:id/reset-account-password", resetCandidatePasswordByHr);
candidateRouter.post("/:id/update-credentials", updateCandidateCredentials);
candidateRouter.get("/:id/offer-letter", downloadOfferLetter);
candidateRouter.get("/:id/offer-letter/preview", downloadOfferLetter);

// Certificate management (HR & Manager)
candidateRouter.get("/certificates", listCandidateCertificates);
candidateRouter.post("/:id/course-completion", markCandidateCourseCompletion);
candidateRouter.post("/:id/certificate/generate", generateCandidateCertificate);
candidateRouter.post("/:id/certificate/revoke", requireRole("MANAGER"), revokeCandidateCertificate);
candidateRouter.get("/:id/certificate/download", downloadCandidateCertificate);
candidateRouter.get("/:id/certificate/preview", previewCandidateCertificate);

candidateRouter.get("/email-status", getEmailStatus);
candidateRouter.get("/whatsapp-status", getWhatsAppStatus);
candidateRouter.get("/archived", listArchivedCandidates);
candidateRouter.get("/", listCandidates);
candidateRouter.post("/", createCandidate);
candidateRouter.post("/bulk", createCandidates);
candidateRouter.post("/:id/email", sendCandidateEmail);
candidateRouter.post("/:id/whatsapp", sendCandidateWhatsApp);
candidateRouter.post("/:id/notes", addCandidateNote);
candidateRouter.get("/:id/assignment-history", getAssignmentHistory);
candidateRouter.patch("/:id/status", updateCandidateStatus);
candidateRouter.post("/:id/archive", archiveCandidate);
candidateRouter.post("/:id/restore", restoreCandidate);
candidateRouter.patch("/:id", updateCandidate);
candidateRouter.get("/correction-requests", getCorrectionRequests);
candidateRouter.patch("/:id/correction-requests/:requestId", updateCorrectionRequestStatus);
candidateRouter.get("/:id", getCandidate);
candidateRouter.delete("/:id", deleteCandidate);
