import { Router } from "express";
import multer from "multer";
import { rateLimit } from "express-rate-limit";
import {
  candidatePortalChangePassword,
  candidatePortalDownloadCertificate,
  candidatePortalDownloadCurriculum,
  candidatePortalDownloadResume,
  candidatePortalForgotPassword,
  candidatePortalGetCurriculum,
  candidatePortalLogin,
  candidatePortalResetPassword,
  candidatePortalSubmitCorrectionRequest,
  candidatePortalSubmitPayment,
  downloadPaymentReceipt,
  getCandidatePortalMyDetails,
  getPublicPaymentDetails,
  submitPublicPaymentProof,
  submitContactManager,
  getPublicCoursesList,
} from "../controllers/candidate.controller";
import { requireCandidateAuth } from "../middleware/candidate-auth";
import { HttpError } from "../middleware/error-handler";

const candidateLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 25,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    error: { code: "RATE_LIMITED", message: "Too many login attempts. Please try again later." },
  },
});

const ALLOWED_PROOF_EXTS = [".png", ".jpg", ".jpeg", ".pdf"];
const proofUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024, // 2 MB limit for payment receipts / screenshots
    files: 1,
  },
  fileFilter(_request, file, callback) {
    const ext = file.originalname.slice(file.originalname.lastIndexOf(".")).toLowerCase();
    if (!ALLOWED_PROOF_EXTS.includes(ext)) {
      return callback(new HttpError(400, "INVALID_FILE_TYPE", "Only PNG, JPG, JPEG, and PDF files are allowed for payment proof."));
    }
    callback(null, true);
  },
});

export const candidatePortalRouter = Router();

// Public Candidate Authentication & Password Recovery
candidatePortalRouter.post("/login", candidateLoginLimiter, candidatePortalLogin);
candidatePortalRouter.post("/forgot-password", candidatePortalForgotPassword);
candidatePortalRouter.post("/reset-password", candidatePortalResetPassword);
candidatePortalRouter.post("/contact-manager", submitContactManager);
candidatePortalRouter.get("/courses", getPublicCoursesList);

// Public Candidate-Specific Payment Page (Accessed before portal account creation)
candidatePortalRouter.get("/payment-link/:token", getPublicPaymentDetails);
candidatePortalRouter.post("/payment-link/:token/submit", proofUpload.single("proof"), submitPublicPaymentProof);

// Authenticated Candidate Portal Routes
candidatePortalRouter.use(requireCandidateAuth);

candidatePortalRouter.get("/my-details", getCandidatePortalMyDetails);
candidatePortalRouter.post("/change-password", candidatePortalChangePassword);
candidatePortalRouter.post("/correction-request", candidatePortalSubmitCorrectionRequest);
candidatePortalRouter.post("/submit-payment", proofUpload.single("proof"), candidatePortalSubmitPayment);
candidatePortalRouter.get("/receipts/:receiptNumber/download", downloadPaymentReceipt);
candidatePortalRouter.get("/certificate/download", candidatePortalDownloadCertificate);
candidatePortalRouter.get("/curriculum", candidatePortalGetCurriculum);
candidatePortalRouter.get("/curriculum/download", candidatePortalDownloadCurriculum);
candidatePortalRouter.get("/resume/download", candidatePortalDownloadResume);
candidatePortalRouter.get("/resumes/:resumeFileId/download", candidatePortalDownloadResume);
