export type WhatsAppTemplateKey =
  | "APPLICATION_UPDATE"
  | "INTEGRATION_TEST"
  | "INTERVIEW_INVITATION"
  | "DOCUMENT_REQUEST"
  | "CUSTOM";

export interface WhatsAppTemplateOption {
  key: WhatsAppTemplateKey;
  label: string;
}

export const WHATSAPP_TEMPLATE_OPTIONS: WhatsAppTemplateOption[] = [
  { key: "APPLICATION_UPDATE", label: "Application Update (Meta Template)" },
  { key: "INTEGRATION_TEST", label: "Meta Integration Test (Approved & Guaranteed Delivery)" },
  { key: "INTERVIEW_INVITATION", label: "Interview Invitation (Meta Template)" },
  { key: "DOCUMENT_REQUEST", label: "Document Request (Meta Template)" },
  { key: "CUSTOM", label: "Custom Message (After Contact Replied)" },
];

export function generateWhatsAppTemplate(
  key: WhatsAppTemplateKey,
  candidateName: string,
  candidatePosition: string,
  senderName: string,
): string {
  const name = candidateName?.trim() || "Candidate";
  const position = candidatePosition?.trim() || "the open position";
  const sender = senderName?.trim() || "Recruitment Team";

  switch (key) {
    case "INTEGRATION_TEST":
      return `Welcome! This is a test message from the WhatsApp Business Platform. You have successfully configured your WhatsApp Business account and completed onboarding. You can now start sending messages to your customers.`;

    case "APPLICATION_UPDATE":
      return `Hello ${name}, thank you for applying for the ${position} role at TVM Recruitment. We would like to connect with you regarding the next round. Please reply to this message with your availability. Best regards, ${sender} from TVM Recruitment Team.`;

    case "INTERVIEW_INVITATION":
      return `Hello ${name}, we are pleased to invite you for an interview for the ${position} role at TVM Recruitment. Please reply with your preferred date and time slots so we can finalize the schedule. Best regards, ${sender} from TVM Recruitment Team.`;

    case "DOCUMENT_REQUEST":
      return `Hello ${name}, regarding your application for the ${position} role at TVM Recruitment, could you please send your updated resume and credentials? Thank you, ${sender} from TVM Recruitment Team.`;

    case "CUSTOM":
    default:
      return `Hello ${name},\n\nRegarding your application for the ${position} role:\n\n\n\nBest regards,\n${sender} (TVM Recruitment)`;
  }
}
