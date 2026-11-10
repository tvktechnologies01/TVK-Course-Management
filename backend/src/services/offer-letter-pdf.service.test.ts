import { describe, it, expect } from "vitest";
import { offerLetterPdfService } from "./offer-letter-pdf.service";

describe("OfferLetterPdfService", () => {
  it("generates a valid high-resolution canvas, JPEG and PDF matching the official format", () => {
    const data = {
      candidateId: "RA2431242020057",
      candidateName: "Mr. Jeeva.G",
      college: "SRM Institute of Science and Technology",
      courseName: "AI With Data Science",
      startDate: "28 September 2026",
      endDate: "23 October 2026",
      supervisorName: "PRIYATHARSHAN A / Program Manager",
      issueDate: "24/10/2026",
    };

    // 1. Canvas test
    const canvas = offerLetterPdfService.drawOfferLetterCanvas(data);
    expect(canvas.width).toBe(1240);
    expect(canvas.height).toBe(1754);

    // 2. JPEG buffer test
    const jpegBuf = offerLetterPdfService.generateOfferLetterJpeg(data);
    expect(jpegBuf).toBeInstanceOf(Buffer);
    expect(jpegBuf.length).toBeGreaterThan(10000);
    expect(jpegBuf[0]).toBe(0xff);
    expect(jpegBuf[1]).toBe(0xd8);

    // 3. PDF buffer test
    const pdfBuf = offerLetterPdfService.generateOfferLetterPdf(data);
    expect(pdfBuf).toBeInstanceOf(Buffer);
    expect(pdfBuf.length).toBeGreaterThan(10000);

    const pdfString = pdfBuf.toString("latin1");
    expect(pdfString).toContain("%PDF-1.4");
    expect(pdfString).toContain("%%EOF");
    expect(pdfString).toContain("/Type /XObject");
    expect(pdfString).toContain("/Subtype /Image");
    expect(pdfString).toContain("/Width 1240 /Height 1754");
  });
});
