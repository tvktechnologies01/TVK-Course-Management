import { z } from "zod";
import { CANDIDATE_SOURCES, CANDIDATE_STATUSES } from "../models/candidate.model";

const optionalContact = z.string().trim().max(254).refine(
  (value) => value === "" || z.string().email().safeParse(value).success,
  "Email address is invalid.",
).default("");

const candidateFieldsSchema = z.object({
  id: z.string().trim().min(1).max(120).optional(),
  name: z.string().trim().max(160).default(""),
  phone: z.string().trim().max(40).default(""),
  email: optionalContact,
  position: z.string().trim().max(160).default(""),
  experience: z.string().trim().max(120).default(""),
  location: z.string().trim().max(160).default(""),
  skills: z.array(z.string().trim().min(1).max(100)).max(100).default([]),
  source: z.enum(CANDIDATE_SOURCES).default("IR_RESUME"),
  resumeName: z.string().trim().max(255).default(""),
  resumeFileId: z.string().trim().max(120).optional(),
  status: z.enum(CANDIDATE_STATUSES).default("NEW"),
  appliedDate: z.coerce.date().optional(),
  notes: z.string().max(12000).default(""),
  dateOfBirth: z.string().trim().max(40).optional(),
  gender: z.string().trim().max(40).optional(),
  address: z.string().trim().max(500).optional(),
  state: z.string().trim().max(100).optional(),
  pincode: z.string().trim().max(20).optional(),
  degree: z.string().trim().max(120).optional(),
  college: z.string().trim().max(160).optional(),
  yearOfPassing: z.string().trim().max(20).optional(),
  programmingLanguage: z.string().trim().max(120).optional(),
  courseName: z.string().trim().max(160).optional(),
  courseDuration: z.string().trim().max(60).optional(),
  preferredStartDate: z.coerce.date().nullable().optional(),
  additionalTraining: z.array(z.string().trim().max(120)).optional(),
  completedCorrectionRequestId: z.string().trim().max(120).optional(),
}).strict();

export const candidateBodySchema = candidateFieldsSchema.refine((candidate) => Boolean(
  candidate.name || candidate.email || candidate.phone || candidate.position || candidate.experience || candidate.location || candidate.skills.length,
), {
  message: "At least one candidate detail is required.",
  path: ["name"],
});

export const candidatePatchSchema = candidateFieldsSchema
  .omit({ id: true, status: true })
  .partial()
  .strict()
  .refine((changes) => Object.keys(changes).length > 0, "At least one candidate field must be supplied.");

export const candidateStatusSchema = z.object({
  status: z.enum(CANDIDATE_STATUSES),
  message: z.string().trim().max(1000).optional(),
}).strict();

export const candidateNoteSchema = z.object({
  note: z.string().trim().min(1).max(4000),
}).strict();

const optionalQuery = z.string().trim().max(200).optional();
export const candidateListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(500).default(50),
  search: optionalQuery,
  status: z.enum(CANDIDATE_STATUSES).optional(),
  source: z.enum(CANDIDATE_SOURCES).optional(),
  hrId: z.string().trim().max(80).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  sortBy: z.enum(["name", "status", "source", "appliedDate", "createdAt", "updatedAt"]).default("createdAt"),
  order: z.enum(["asc", "desc"]).default("desc"),
}).strict();

export const idParamSchema = z.object({ id: z.string().trim().min(1).max(120) }).passthrough();

export const candidatePaymentParamsSchema = z.object({
  id: z.string().trim().min(1).max(120),
  paymentId: z.string().trim().min(1).max(120),
}).passthrough();

export const sendCandidateEmailSchema = z.object({
  to: z.string().trim().email(),
  subject: z.string().trim().min(1).max(300),
  message: z.string().trim().min(1).max(10000),
}).strict();

export const sendCandidateWhatsAppSchema = z.object({
  phone: z.string().trim().min(5).max(30),
  message: z.string().trim().min(1).max(4096),
  templateKey: z.string().trim().optional(),
  candidateName: z.string().trim().optional(),
  candidatePosition: z.string().trim().optional(),
});

export const LOOKING_FOR_OPTIONS = ["Internship", "Training", "Placements", "Projects", "Job"] as const;
export const REGISTRATION_COURSES = [
  "Full Stack Development with Java & Angular",
  "Cloud Engineering with AWS & Azure",
  "DevOps Engineering",
  "Python for Web Development & Automation",
  "C# & .NET Development",
  "IoT with Embedded C",
  "Digital Marketing",
  "AI with Machine Learning",
  "Python with Data Science",
  "Java with Automation Testing",
  "Java with ReactJS",
  "Hardware and Networking",
  "IoT (Internet of Things)",
  "Robotics",
  "Japanese Spoken",
  "AI & Data Science",
] as const;
export const MODE_OF_COURSE_OPTIONS = ["Online", "Offline"] as const;
export const HOW_FOUND_OPTIONS = [
  "Employee Referral",
  "LinkedIn",
  "Instagram",
  "YouTube",
  "Referred by friends",
  "Referred by Friends",
] as const;
export const INDIAN_STATE_OPTIONS = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa",
  "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala",
  "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland",
  "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura",
  "Uttar Pradesh", "Uttarakhand", "West Bengal", "Andaman and Nicobar Islands",
  "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Jammu and Kashmir",
  "Ladakh", "Lakshadweep", "Puducherry",
] as const;
export const COURSE_DURATION_OPTIONS = ["15 Days", "1 Month", "3 Months", "6 Months"] as const;

function getIndiaDate(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function isValidDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export const candidateRegistrationSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(160),
  email: z.string().trim().email("Please provide a valid email address").max(254),
  phone: z.string().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9."),
  dateOfBirth: z.string().trim().min(1, "Date of birth is required"),
  address: z.string().trim().min(1, "Address is required").max(500),
  location: z.string().trim().min(1, "Location is required").max(160),
  state: z.enum(INDIAN_STATE_OPTIONS, {
    errorMap: () => ({ message: "Please select a valid Indian state or union territory." }),
  }),
  pincode: z.string().regex(/^[1-9]\d{5}$/, "Enter a valid 6-digit Indian PIN code."),
  yearOfPassing: z.string().trim().min(1, "Year of passing is required").max(20),
  degree: z.string().trim().min(1, "Degree is required").max(120),
  college: z.string().trim().min(1, "College/University is required").max(200),
  lookingFor: z.enum(LOOKING_FOR_OPTIONS, {
    errorMap: () => ({ message: "Please select a valid option for Looking For" }),
  }),
  programmingLanguage: z.string().trim().optional().default(""),
  modeOfCourse: z.enum(MODE_OF_COURSE_OPTIONS, {
    errorMap: () => ({ message: "Please select a valid Mode of Course" }),
  }),
  primarySkills: z.string().trim().max(200).optional().default(""),
  secondarySkills: z.string().trim().max(200).optional().default(""),
  howDidYouFindUs: z.enum(HOW_FOUND_OPTIONS, {
    errorMap: () => ({ message: "Please select how you found us" }),
  }),
  courseDuration: z.string().trim().optional().default(""),
  preferredStartDate: z.string().trim().optional().default(""),
}).superRefine((data, ctx) => {
  if (data.lookingFor !== "Job" && (data.modeOfCourse as string) !== "Job") {
    if (!data.programmingLanguage || !(REGISTRATION_COURSES as readonly string[]).includes(data.programmingLanguage)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["programmingLanguage"],
        message: "Please select a valid TVK course.",
      });
    }
    if (!data.courseDuration || !(COURSE_DURATION_OPTIONS as readonly string[]).includes(data.courseDuration)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["courseDuration"],
        message: "Please select Course Duration",
      });
    }
    if (!data.preferredStartDate || !isValidDateOnly(data.preferredStartDate)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["preferredStartDate"],
        message: "Please provide a valid course start date.",
      });
    } else if (data.preferredStartDate < getIndiaDate()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["preferredStartDate"],
        message: "Course start date must be today or later.",
      });
    }
  }
});

export type CandidateRegistrationInput = z.infer<typeof candidateRegistrationSchema>;

export const courseDetailsUpdateSchema = z.object({
  joiningDate: z.string().trim().nullable().optional(),
  courseDate: z.string().trim().nullable().optional(),
  courseStartDate: z.string().trim().nullable().optional(),
  courseName: z.string().trim().max(160).optional(),
  courseDuration: z.string().trim().optional(),
  totalFee: z.coerce.number().min(0, "Total fee cannot be negative").default(0),
  amountPaid: z.coerce.number().min(0, "Amount paid cannot be negative").default(0),
  paymentStatus: z.enum(["Pending", "Verification Pending", "Partially Paid", "Paid", "Rejected"]).default("Pending"),
  paymentInstructions: z.string().trim().max(2000).default(""),
}).refine((data) => data.amountPaid <= data.totalFee, {
  message: "Amount paid cannot exceed the total course fee.",
  path: ["amountPaid"],
});

export const courseCompletionSchema = z.object({
  courseCompleted: z.boolean(),
  completionDate: z.string().trim().nullable().optional(),
}).refine((data) => !data.courseCompleted || (data.completionDate && data.completionDate.trim().length > 0), {
  message: "Completion date is required when course is marked as completed.",
  path: ["completionDate"],
});

export const candidatePortalLoginSchema = z.object({
  username: z.string().trim().optional(),
  password: z.string().optional(),
  identifier: z.string().trim().optional(),
  phone: z.string().trim().optional(),
}).refine((data) => (data.username && data.password) || (data.identifier && data.phone), {
  message: "Provide either username and password or candidate ID and phone number.",
});

export const createCandidateAccountSchema = z.object({
  username: z.string().trim().min(3).max(80).regex(/^[a-zA-Z0-9._-]+$/, "Username must contain only letters, numbers, dots, underscores, or dashes.").optional(),
  temporaryPassword: z.string().min(6).max(128).optional(),
  attachOfferLetter: z.boolean().optional(),
});

export const candidateChangePasswordSchema = z.object({
  currentPassword: z.string().optional(),
  newPassword: z.string().min(6, "Password must be at least 6 characters").max(128),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email("Please provide a valid registered email address."),
});

export const resetPasswordSchema = z.object({
  token: z.string().trim().min(10, "Reset token is required"),
  newPassword: z.string().min(6, "Password must be at least 6 characters").max(128),
});

export const submitPaymentProofSchema = z.object({
  transactionRef: z.string().trim().min(3, "Transaction reference / UTR is required").max(100),
  amount: z.coerce.number().min(1, "Amount must be at least 1").optional(),
  paymentDate: z.string().trim().optional(),
  notes: z.string().trim().max(1000).optional(),
});

export const verifyPaymentSchema = z.object({
  verifiedAmount: z.coerce.number().min(0, "Verified amount must be positive"),
  notes: z.string().trim().max(1000).optional(),
}).passthrough();

export const rejectPaymentSchema = z.object({
  rejectionReason: z.string().trim().min(2, "Rejection reason is required").max(1000),
}).passthrough();

export const outboundCandidateSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(160),
  email: z.string().trim().email("Valid email is required").max(254),
  phone: z.string().trim().min(6, "Valid phone is required").max(40),
  position: z.string().trim().min(2, "Target position or course is required").max(160),
  experience: z.string().trim().max(120).default(""),
  location: z.string().trim().max(160).default(""),
  skills: z.union([z.string(), z.array(z.string())]).default([]),
  notes: z.string().trim().max(4000).default(""),
  entryMethod: z.enum(["MANUAL_TYPING", "RECEIVED_FROM_EMAIL"]).optional(),
});

export const correctionRequestSchema = z.object({
  requestText: z.string().trim().min(5, "Please describe the correction details").max(2000),
});

export const contactManagerSchema = z.object({
  name: z.string().trim().min(2, "Full name must be at least 2 characters."),
  email: z.string().trim().email("Please provide a valid registered email address."),
  phone: z.string().trim().min(10, "Phone number must be at least 10 digits."),
  courseName: z.string().trim().min(2, "Please select or enter your course name."),
  issueDescription: z.string().trim().min(5, "Please describe your issue (minimum 5 characters).").max(3000),
});

export const updateCandidateCredentialsSchema = z.object({
  username: z.string().trim().min(3, "Username must be at least 3 characters.").max(60),
  newPassword: z.string().min(6, "New password must be at least 6 characters."),
  attachOfferLetter: z.boolean().optional(),
});
