export type CandidateSource =
  | "IR_RESUME"
  | "WEBSITE_APPLICATION"
  | "EXCEL_IMPORT"
  | "OUTBOUND";

export type CandidateStatus =
  | "NEW"
  | "ASSIGNED"
  | "CONTACT_PENDING"
  | "CALLED"
  | "NO_RESPONSE"
  | "CALL_BACK"
  | "INTERESTED"
  | "NOT_INTERESTED"
  | "INTERVIEW_SCHEDULED"
  | "INTERVIEW_COMPLETED"
  | "SELECTED"
  | "REJECTED"
  | "ON_HOLD"
  | "ARCHIVED";

export interface PaymentRecord {
  id: string;
  candidateId: string;
  candidateName: string;
  candidateEmail?: string;
  candidatePhone?: string;
  courseName: string;
  amount: number;
  transactionRef: string;
  paymentProofUrl?: string;
  paymentQrCode?: string;
  status: "Verification Pending" | "Verified" | "Rejected";
  receiptNumber?: string | null;
  receiptIssueDate?: string | null;
  verifiedAt?: string | null;
  verifiedBy?: string | null;
  rejectionReason?: string;
  notes?: string;
  paidAt: string;
  createdAt?: string;
}

export interface Candidate {
  id: string;

  name: string;
  phone: string;
  email: string;

  position: string;
  experience: string;
  location: string;
  skills: string[];

  source: CandidateSource;

  resumeName: string;
  resumeFileId?: string;

  status: CandidateStatus;

  assignedToId: string | null;
  assignedToName: string | null;

  appliedDate: string;

  lastContactedAt: string | null;
  nextFollowUpAt: string | null;

  notes: string;

  dateOfBirth?: string;
  address?: string;
  state?: string;
  pincode?: string;
  yearOfPassing?: string;
  degree?: string;
  college?: string;
  lookingFor?: string;
  programmingLanguage?: string;
  modeOfCourse?: string;
  primarySkills?: string;
  secondarySkills?: string;
  howDidYouFindUs?: string;
  courseDuration?: string;
  preferredStartDate?: string | null;
  additionalTraining?: string[];

  // HR-managed Course Details & Inbound
  joiningDate?: string | null;
  courseDate?: string | null;
  courseStartDate?: string | null;
  courseName?: string;
  totalFee?: number;
  amountPaid?: number;
  balance?: number;
  paymentStatus?: "Pending" | "Verification Pending" | "Partially Paid" | "Paid" | "Rejected";
  paymentInstructions?: string;
  paymentQrCode?: string;
  paymentToken?: string;
  paymentTokenExpiresAt?: string | null;

  // Candidate Portal Account
  accountCreated?: boolean;
  accountUsername?: string;
  accountPassword?: string;
  accountMustChangePassword?: boolean;
  accountCreatedAt?: string | null;

  // Trainer & Tasks
  trainerId?: string;
  trainerName?: string;
  trainerEmail?: string;
  trainerAssignedAt?: string | null;
  trainerAllocationStatus?: "UNASSIGNED" | "ASSIGNED" | "REASSIGNED";
  expectedCompletionDate?: string | null;
  assignedTasks?: Array<{
    id: string;
    title: string;
    description: string;
    status: "Pending" | "In Progress" | "Completed";
    dueDate?: string;
  }>;
  correctionRequests?: Array<{
    id: string;
    requestText: string;
    requestedAt: string;
    status: "Pending" | "Reviewed" | "Completed";
    completedAt?: string | null;
    completedBy?: string | null;
  }>;

  // Payment History
  payments?: PaymentRecord[];

  // Course Completion & Certificate
  courseCompleted?: boolean;
  completionDate?: string | null;
  certificateStatus?: "NOT_ISSUED" | "ISSUED" | "REVOKED";
  certificateId?: string | null;
  certificateIssuedAt?: string | null;
  certificateRevokedAt?: string | null;
  certificateRevocationReason?: string | null;
  certificateSignatory?: string;

  createdAt?: string;
  updatedAt?: string;
}

export interface CandidateCorrectionNotification {
  id: string;
  candidateId: string;
  candidateName: string;
  email?: string;
  phone?: string;
  courseName?: string;
  requestText: string;
  requestedAt: string;
  status: "Pending" | "In Progress" | "Resolved" | "Completed" | "Reviewed";
  completedAt?: string | null;
  completedBy?: string | null;
  accountCreated?: boolean;
  accountUsername?: string;
}
