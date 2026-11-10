import { describe, expect, it } from "vitest";
import { certificatePdfService, formatCertificateDate } from "./certificate-pdf.service";

describe("CertificatePdfService", () => {
  it("should generate a valid PDF buffer matching the TVK Technologies design reference", () => {
    const pdfBuffer = certificatePdfService.generateCertificatePdf({
      candidateId: "cand-12345",
      candidateName: "Kavitha Raman",
      courseName: "Full Stack Development (Java)",
      courseDuration: "3 Months",
      completionDate: "October 15, 2026",
      issueDate: "October 27, 2026",
      certificateId: "CERT-2026-6FHY8",
      signatoryName: "Dr. V. Kumar",
      signatoryTitle: "Authorized Signatory",
      companyName: "TVK Technologies Edu Private Limited",
      tagline: "EMPOWERING CAREER GROWTH",
    });

    expect(pdfBuffer).toBeInstanceOf(Buffer);
    expect(pdfBuffer.length).toBeGreaterThan(1000);

    const pdfString = pdfBuffer.toString("binary");
    expect(pdfString.startsWith("%PDF-1.4")).toBe(true);
    expect(pdfString.includes("%%EOF")).toBe(true);
    expect(pdfString.includes("[0 0 842 595]")).toBe(true); // A4 Landscape
    expect(pdfString.includes("TVK Technologies Edu Private Limited")).toBe(true);
    expect(pdfString.includes("CERTIFICATE OF COMPLETION")).toBe(true);
    expect(pdfString.includes("Kavitha Raman")).toBe(true);
    expect(pdfString.includes("Full Stack Development (Java)")).toBe(true);
    expect(pdfString.includes("CERT-2026-6FHY8")).toBe(true);
    expect(pdfString.includes("SCAN TO VERIFY")).toBe(true);
    expect(pdfString.includes("BEST")).toBe(true);
    expect(pdfString.includes("Authorized Signatory")).toBe(true);
  });

  it("should generate a valid un-editable PNG image buffer directly with TVK branding and authority seal", () => {
    const pngBuffer = certificatePdfService.generateCertificatePng({
      candidateId: "cand-12345",
      candidateName: "Kavitha Raman",
      courseName: "Full Stack Development (Java)",
      courseDuration: "3 Months",
      completionDate: "October 15, 2026",
      issueDate: "October 27, 2026",
      certificateId: "CERT-2026-6FHY8",
      signatoryName: "Dr. V. Kumar",
      signatoryTitle: "Authorized Signatory",
      companyName: "TVK Technologies Edu Private Limited",
      tagline: "EMPOWERING CAREER GROWTH",
    });

    expect(pngBuffer).toBeInstanceOf(Buffer);
    expect(pngBuffer.length).toBeGreaterThan(10000);
    // PNG magic bytes: 0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A
    expect(pngBuffer[0]).toBe(0x89);
    expect(pngBuffer[1]).toBe(0x50); // P
    expect(pngBuffer[2]).toBe(0x4e); // N
    expect(pngBuffer[3]).toBe(0x47); // G
  });

  it("should generate a valid un-editable JPEG image buffer with header logo and authority seal", () => {
    const jpegBuffer = certificatePdfService.generateCertificateJpeg({
      candidateId: "cand-12345",
      candidateName: "Kavitha Raman",
      courseName: "Full Stack Development (Java)",
      courseDuration: "3 Months",
      completionDate: "October 15, 2026",
      issueDate: "October 27, 2026",
      certificateId: "CERT-2026-6FHY8",
      signatoryName: "Dr. V. Kumar",
      signatoryTitle: "Authorized Signatory",
      companyName: "TVK Technologies Edu Private Limited",
      tagline: "EMPOWERING CAREER GROWTH",
    });

    expect(jpegBuffer).toBeInstanceOf(Buffer);
    expect(jpegBuffer.length).toBeGreaterThan(10000);
    // JPEG magic bytes: 0xFF 0xD8
    expect(jpegBuffer[0]).toBe(0xff);
    expect(jpegBuffer[1]).toBe(0xd8);
  });

  it("should handle special characters and parentheses safely in certificates", () => {
    const pdfBuffer = certificatePdfService.generateCertificatePdf({
      candidateId: "cand-67890",
      candidateName: "John (Developer) Doe",
      courseName: "C# & .NET (Advanced)",
      courseDuration: "1 Month",
      completionDate: "October 20, 2026",
      issueDate: "October 27, 2026",
      certificateId: "CERT-2026-0099",
      signatoryName: "Director",
    });

    const pdfString = pdfBuffer.toString("binary");
    expect(pdfString.includes("John (Developer) Doe")).toBe(true);
    expect(pdfString.includes("C# & .NET (Advanced)")).toBe(true);
  });

  it("should format dates consistently", () => {
    expect(formatCertificateDate("2026-09-28")).toContain("September 28, 2026");
    expect(formatCertificateDate(new Date(2026, 8, 28))).toContain("September 28, 2026");
  });

  it("should auto-scale long candidate names and course titles without errors", () => {
    const longName = "Alexander Bartholomew Montgomery-Featherstonehaugh";
    const longCourse = "Enterprise Cloud Computing with Kubernetes, Terraform & AWS Advanced Infrastructure";
    const pdfBuffer = certificatePdfService.generateCertificatePdf({
      candidateId: "cand-long-1",
      candidateName: longName,
      courseName: longCourse,
      courseDuration: "6 Months",
      certificateId: "CERT-2026-LONG",
    });

    expect(pdfBuffer).toBeInstanceOf(Buffer);
    const pdfString = pdfBuffer.toString("binary");
    expect(pdfString.includes(longName)).toBe(true);
    expect(pdfString.includes(longCourse)).toBe(true);
  });
});
