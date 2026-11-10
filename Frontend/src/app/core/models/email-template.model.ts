export type EmailTemplateKey = "APPLICATION_UPDATE" | "INTERVIEW_INVITATION" | "DOCUMENT_REQUEST" | "CUSTOM";

export interface EmailTemplateOption {
  key: EmailTemplateKey;
  label: string;
}

export const EMAIL_TEMPLATE_OPTIONS: EmailTemplateOption[] = [
  { key: "APPLICATION_UPDATE", label: "Application Update (Default)" },
  { key: "INTERVIEW_INVITATION", label: "Interview Invitation" },
  { key: "DOCUMENT_REQUEST", label: "Document Verification / Request" },
  { key: "CUSTOM", label: "Custom Message" },
];

export function generateEmailTemplate(
  key: EmailTemplateKey,
  candidateName: string,
  candidatePosition: string,
  senderName: string,
  senderEmail: string,
): { subject: string; message: string } {
  const name = candidateName?.trim() || "Candidate";
  const position = candidatePosition?.trim() || "the position";
  const sender = senderName?.trim() || "Recruitment Team";
  const emailLine = senderEmail?.trim() ? `\n${senderEmail.trim()}` : "";

  switch (key) {
    case "APPLICATION_UPDATE":
      return {
        subject: `Regarding your application for ${position} - TVM Recruitment`,
        message: `Dear ${name},\n\nThank you for your interest in the ${position} position with us at TVM Recruitment.\n\nWe have reviewed your profile and would like to connect with you regarding the next steps in our selection process. Please let us know your availability for a brief discussion.\n\nBest regards,\n${sender}\nTVM Recruitment Team${emailLine}`,
      };

    case "INTERVIEW_INVITATION":
      return {
        subject: `Interview Invitation: ${position} - TVM Recruitment`,
        message: `Dear ${name},\n\nWe are pleased to invite you for an interview for the ${position} position.\n\nPlease reply to this email with your preferred date and time slots so we can finalize the schedule and confirm the interview details.\n\nBest regards,\n${sender}\nTVM Recruitment Team${emailLine}`,
      };

    case "DOCUMENT_REQUEST":
      return {
        subject: `Document Verification: ${position} - TVM Recruitment`,
        message: `Dear ${name},\n\nWe are currently reviewing your application for the ${position} position. To proceed with the next stage, could you please reply with your updated resume and relevant credentials?\n\nBest regards,\n${sender}\nTVM Recruitment Team${emailLine}`,
      };

    case "CUSTOM":
    default:
      return {
        subject: `Regarding your application for ${position} - TVM Recruitment`,
        message: `Dear ${name},\n\n\n\nBest regards,\n${sender}\nTVM Recruitment Team${emailLine}`,
      };
  }
}
