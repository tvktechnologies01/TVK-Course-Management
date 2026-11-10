import { describe, expect, it } from "vitest";
import { receiptPdfService } from "./receipt-pdf.service";

describe("ReceiptPdfService", () => {
  it("should generate a valid PDF receipt buffer with PDF-1.4 header and footer", () => {
    const pdfBuffer = receiptPdfService.generateReceiptPdf({
      receiptNumber: "RCP-2026-9901",
      candidateId: "CAN-12345",
      candidateName: "Kavitha Raman",
      courseName: "Full Stack Java Development",
      totalFee: 25000,
      amountPaid: 15000,
      remainingBalance: 10000,
      paymentDate: "October 27, 2026",
      transactionRef: "UPI-42891002341",
      issueDate: "October 27, 2026",
      paymentStatus: "Partially Paid",
    });

    expect(pdfBuffer).toBeInstanceOf(Buffer);
    expect(pdfBuffer.length).toBeGreaterThan(500);

    const pdfString = pdfBuffer.toString("binary");
    expect(pdfString.startsWith("%PDF-1.4")).toBe(true);
    expect(pdfString.includes("%%EOF")).toBe(true);
    expect(pdfString.includes("TVK TECHNOLOGIES")).toBe(true);
    expect(pdfString.includes("OFFICIAL PAYMENT RECEIPT")).toBe(true);
    expect(pdfString.includes("RCP-2026-9901")).toBe(true);
    expect(pdfString.includes("CAN-12345")).toBe(true);
    expect(pdfString.includes("KAVITHA RAMAN")).toBe(true);
    expect(pdfString.includes("UPI-42891002341")).toBe(true);
  });

  it("should sanitize special characters in receipt text", () => {
    const pdfBuffer = receiptPdfService.generateReceiptPdf({
      receiptNumber: "RCP-2026-9902",
      candidateId: "CAN-99999",
      candidateName: "Alex (Engineering) O'Connor",
      courseName: "Cloud & DevOps (AWS/Azure)",
      totalFee: 30000,
      amountPaid: 30000,
      remainingBalance: 0,
      paymentDate: "October 27, 2026",
      transactionRef: "NEFT(REF#12345)",
      issueDate: "October 27, 2026",
      paymentStatus: "Paid",
    });

    const pdfString = pdfBuffer.toString("binary");
    expect(pdfString.includes("ALEX \\(ENGINEERING\\) O'CONNOR")).toBe(true);
    expect(pdfString.includes("Cloud & DevOps \\(AWS/Azure\\)")).toBe(true);
    expect(pdfString.includes("NEFT\\(REF#12345\\)")).toBe(true);
  });
});
