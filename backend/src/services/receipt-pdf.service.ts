export interface ReceiptData {
  receiptNumber: string;
  candidateId: string;
  candidateName: string;
  courseName: string;
  totalFee: number;
  amountPaid: number;
  remainingBalance: number;
  paymentDate: string;
  transactionRef: string;
  issueDate: string;
  paymentStatus: string;
  signatoryName?: string;
}

export class ReceiptPdfService {
  generateReceiptPdf(data: ReceiptData): Buffer {
    const width = 595; // A4 portrait points
    const height = 842;
    const stream: string[] = [];

    function esc(s: string): string {
      return (s || "").replace(/[\\()]/g, "\\$&");
    }

    function text(font: string, size: number, x: number, y: number, str: string, r = 0.08, g = 0.15, b = 0.27): void {
      stream.push(`BT /${font} ${size} Tf ${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg 1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm (${esc(str)}) Tj ET`);
    }

    function textCenter(font: string, size: number, y: number, str: string, r = 0.08, g = 0.15, b = 0.27, charRatio = 0.52): void {
      const approxW = (str || "").length * size * charRatio;
      const x = Math.max(30, (width - approxW) / 2);
      text(font, size, x, y, str, r, g, b);
    }

    function strokeRect(x: number, y: number, w: number, h: number, lineWidth: number, r: number, g: number, b: number): void {
      stream.push(`${lineWidth} w ${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} RG ${x} ${y} ${w} ${h} re S`);
    }

    function fillRect(x: number, y: number, w: number, h: number, r: number, g: number, b: number): void {
      stream.push(`${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg ${x} ${y} ${w} ${h} re f`);
    }

    function drawLine(x1: number, y1: number, x2: number, y2: number, lineWidth: number, r: number, g: number, b: number): void {
      stream.push(`${lineWidth} w ${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} RG ${x1} ${y1} m ${x2} ${y2} l S`);
    }

    // 1. Background
    fillRect(15, 15, width - 30, height - 30, 0.985, 0.988, 0.992);

    // 2. Borders
    strokeRect(26, 26, width - 52, height - 52, 2.5, 0.05, 0.18, 0.38);
    strokeRect(32, 32, width - 64, height - 64, 1.0, 0.77, 0.60, 0.18);

    // 3. Header
    textCenter("F2", 24, 780, "TVK TECHNOLOGIES", 0.05, 0.18, 0.38, 0.60);
    textCenter("F1", 10, 762, "INSTITUTE OF ADVANCED IT TRAINING & PROFESSIONAL CERTIFICATION", 0.40, 0.45, 0.52, 0.50);
    drawLine(50, 750, width - 50, 750, 1.0, 0.77, 0.60, 0.18);

    // 4. Receipt Title & Badge
    fillRect(200, 715, 195, 26, 0.05, 0.18, 0.38);
    textCenter("F2", 13, 723, "OFFICIAL PAYMENT RECEIPT", 0.98, 0.85, 0.40, 0.55);

    // 5. Meta info banner (Receipt # & Date)
    fillRect(50, 665, width - 100, 36, 0.93, 0.95, 0.98);
    strokeRect(50, 665, width - 100, 36, 0.8, 0.80, 0.85, 0.90);
    text("F2", 11, 65, 678, `Receipt No: ${data.receiptNumber}`, 0.05, 0.18, 0.38);
    text("F1", 11, 380, 678, `Issue Date: ${data.issueDate}`, 0.25, 0.30, 0.38);

    // 6. Candidate Information Box
    const boxY = 560;
    const boxH = 90;
    strokeRect(50, boxY, width - 100, boxH, 0.8, 0.80, 0.85, 0.90);
    fillRect(50, boxY + boxH - 22, width - 100, 22, 0.05, 0.18, 0.38);
    text("F2", 10, 65, boxY + boxH - 16, "CANDIDATE & COURSE DETAILS", 1.0, 1.0, 1.0);

    text("F2", 10.5, 65, boxY + 48, "Candidate Name:", 0.30, 0.35, 0.42);
    text("F2", 11, 180, boxY + 48, (data.candidateName || "").toUpperCase(), 0.05, 0.18, 0.38);

    text("F2", 10.5, 65, boxY + 28, "Candidate ID:", 0.30, 0.35, 0.42);
    text("F1", 10.5, 180, boxY + 28, data.candidateId, 0.15, 0.20, 0.28);

    text("F2", 10.5, 65, boxY + 8, "Course Name:", 0.30, 0.35, 0.42);
    text("F2", 10.5, 180, boxY + 8, data.courseName || "IT Training Course", 0.05, 0.18, 0.38);

    // 7. Payment Breakdown Table
    const tableY = 370;
    strokeRect(50, tableY, width - 100, 170, 0.8, 0.80, 0.85, 0.90);

    // Table Header
    fillRect(50, tableY + 146, width - 100, 24, 0.05, 0.18, 0.38);
    text("F2", 10, 65, tableY + 153, "PAYMENT SUMMARY & BREAKDOWN", 1.0, 1.0, 1.0);

    // Row 1: Total Course Fee
    fillRect(50, tableY + 118, width - 100, 26, 0.97, 0.97, 0.98);
    text("F1", 11, 65, tableY + 126, "Total Course Fee", 0.20, 0.25, 0.32);
    text("F2", 11, 440, tableY + 126, `INR ${Number(data.totalFee || 0).toLocaleString("en-IN")}`, 0.05, 0.18, 0.38);
    drawLine(50, tableY + 118, width - 50, tableY + 118, 0.5, 0.85, 0.88, 0.92);

    // Row 2: Verified Amount Paid
    fillRect(50, tableY + 90, width - 100, 28, 0.90, 0.96, 0.90); // gentle green highlight
    text("F2", 12, 65, tableY + 98, "Verified Amount Received", 0.08, 0.45, 0.18);
    text("F2", 13, 440, tableY + 98, `INR ${Number(data.amountPaid || 0).toLocaleString("en-IN")}`, 0.08, 0.45, 0.18);
    drawLine(50, tableY + 90, width - 50, tableY + 90, 0.5, 0.85, 0.88, 0.92);

    // Row 3: Remaining Balance
    fillRect(50, tableY + 62, width - 100, 28, 0.97, 0.97, 0.98);
    text("F2", 11, 65, tableY + 70, "Remaining Balance Due", 0.20, 0.25, 0.32);
    text("F2", 11, 440, tableY + 70, `INR ${Number(data.remainingBalance || 0).toLocaleString("en-IN")}`, data.remainingBalance > 0 ? 0.70 : 0.08, data.remainingBalance > 0 ? 0.20 : 0.45, 0.18);
    drawLine(50, tableY + 62, width - 50, tableY + 62, 0.5, 0.85, 0.88, 0.92);

    // Row 4: Transaction Reference
    text("F1", 10.5, 65, tableY + 40, "Transaction Reference / UTR:", 0.35, 0.40, 0.48);
    text("F2", 10.5, 230, tableY + 40, data.transactionRef || "N/A", 0.10, 0.15, 0.22);

    // Row 5: Payment Date & Status
    text("F1", 10.5, 65, tableY + 18, `Payment Date: ${data.paymentDate}`, 0.35, 0.40, 0.48);
    text("F2", 10.5, 320, tableY + 18, `Status: ${data.paymentStatus || "Verified"}`, 0.08, 0.45, 0.18);

    // 8. Verification & Stamp section
    const stampY = 160;
    // Left Box: Security & Authenticity
    strokeRect(50, stampY, 210, 150, 0.8, 0.80, 0.85, 0.90);
    fillRect(50, stampY + 125, 210, 25, 0.05, 0.18, 0.38);
    text("F2", 9.5, 60, stampY + 132, "AUTHENTICITY & AUDIT TRAIL", 1.0, 1.0, 1.0);
    text("F1", 8.5, 60, stampY + 105, "This is a computer-generated official", 0.35, 0.40, 0.48);
    text("F1", 8.5, 60, stampY + 92, "payment receipt issued by TVK Technologies.", 0.35, 0.40, 0.48);
    text("F1", 8.5, 60, stampY + 74, `Receipt No: ${data.receiptNumber}`, 0.05, 0.18, 0.38);
    text("F1", 8.5, 60, stampY + 60, `Candidate ID: ${data.candidateId}`, 0.35, 0.40, 0.48);
    text("F1", 8.5, 60, stampY + 46, "Online Verification:", 0.35, 0.40, 0.48);
    text("F2", 8.5, 60, stampY + 32, "tvktechnologies.com/verify", 0.05, 0.18, 0.38);
    text("F1", 8, 60, stampY + 18, "Valid without physical signature.", 0.50, 0.55, 0.60);

    // Right Box: Authorized Finance Signatory
    const rightBoxX = 280;
    const rightBoxW = width - 50 - rightBoxX;
    strokeRect(rightBoxX, stampY, rightBoxW, 150, 0.8, 0.80, 0.85, 0.90);
    fillRect(rightBoxX, stampY + 125, rightBoxW, 25, 0.05, 0.18, 0.38);
    text("F2", 9.5, rightBoxX + 15, stampY + 132, "OFFICIAL VERIFICATION", 1.0, 1.0, 1.0);

    // Decorative Seal inside right box
    strokeRect(rightBoxX + (rightBoxW - 40) / 2, stampY + 62, 40, 40, 1.2, 0.77, 0.60, 0.18);
    fillRect(rightBoxX + (rightBoxW - 34) / 2, stampY + 65, 34, 34, 0.05, 0.18, 0.38);
    textCenter("F2", 8, stampY + 84, "VERIFIED", 0.98, 0.85, 0.40, 0.6);
    textCenter("F1", 6.5, stampY + 73, "ACCOUNTS", 0.98, 0.85, 0.40, 0.5);

    drawLine(rightBoxX + 25, stampY + 45, rightBoxX + rightBoxW - 25, stampY + 45, 1, 0.05, 0.18, 0.38);
    textCenter("F2", 10, stampY + 30, data.signatoryName || "Accounts & Finance Department", 0.05, 0.18, 0.38, 0.55);
    textCenter("F1", 8.5, stampY + 16, "TVK Technologies, Authorized Signatory", 0.35, 0.40, 0.48, 0.48);

    // 9. Footer Note
    textCenter("F1", 9, 70, "Thank you for choosing TVK Technologies for your professional IT career advancement.", 0.35, 0.40, 0.48, 0.5);
    textCenter("F1", 8, 55, "Support & Billing Queries: billing@tvktechnologies.com   |   +91 79047 22117", 0.45, 0.50, 0.58, 0.5);

    // Build standard PDF structure
    const streamContent = Buffer.from(stream.join("\n"), "utf8");
    const objects: string[] = [];
    objects.push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj");
    objects.push("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj");
    objects.push(
      `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>\nendobj`,
    );
    objects.push("4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj");
    objects.push("5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj");
    objects.push(`6 0 obj\n<< /Length ${streamContent.length} >>\nstream\n${streamContent.toString("latin1")}\nendstream\nendobj`);

    let pos = 15;
    const offsets: number[] = [];
    const parts: string[] = ["%PDF-1.4\n%\xE2\xE3\xCF\xD3\n"];
    for (const obj of objects) {
      offsets.push(pos);
      const str = obj + "\n";
      parts.push(str);
      pos += Buffer.byteLength(str, "latin1");
    }
    const startXref = pos;
    parts.push(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`);
    for (const off of offsets) {
      parts.push(String(off).padStart(10, "0") + " 00000 n \n");
    }
    parts.push(`trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${startXref}\n%%EOF\n`);

    return Buffer.from(parts.join(""), "latin1");
  }
}

export const receiptPdfService = new ReceiptPdfService();
