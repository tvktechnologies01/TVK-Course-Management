import { generateQrMatrix } from "../utils/qr-code";
import { createCanvas, Image, GlobalFonts } from "@napi-rs/canvas";
import fs from "node:fs";
import path from "node:path";

export const FONT_SERIF = 'Georgia, "Times New Roman", "DejaVu Serif", "Liberation Serif", serif';
export const FONT_SANS = 'Arial, "Helvetica Neue", Helvetica, "Liberation Sans", "DejaVu Sans", sans-serif';

let fontsInitialized = false;
function initializeFonts(): void {
  if (fontsInitialized) return;
  fontsInitialized = true;
  try {
    const fontDirs = [
      path.join(__dirname, "../assets/fonts"),
      path.join(__dirname, "../../src/assets/fonts"),
      path.resolve("src/assets/fonts"),
      path.resolve("dist/assets/fonts"),
      path.resolve("Recruitment TVM/backend/src/assets/fonts"),
    ];
    for (const dir of fontDirs) {
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          if (/\.(ttf|otf|woff2?)$/i.test(file)) {
            const fontName = path.basename(file, path.extname(file)).replace(/[-_]/g, " ");
            GlobalFonts.registerFromPath(path.join(dir, file), fontName);
          }
        }
      }
    }
  } catch {
    // Graceful fallback to system fonts
  }
}
initializeFonts();

export interface CertificateData {
  candidateId: string;
  candidateName: string;
  courseName: string;
  courseDuration?: string;
  completionDate?: string;
  issueDate?: string;
  certificateId: string;
  signatoryName?: string;
  signatoryTitle?: string;
  companyName?: string;
  tagline?: string;
  verificationUrl?: string;
}

export function formatCertificateDate(dateInput?: string | Date | null): string {
  if (!dateInput) {
    return new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  }
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return String(dateInput);
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function resolveAssetPath(filename: string): string {
  const candidates = [
    path.join(__dirname, "../assets/offer-letter", filename),
    path.join(__dirname, "../../src/assets/offer-letter", filename),
    path.resolve("src/assets/offer-letter", filename),
    path.resolve("dist/assets/offer-letter", filename),
    path.resolve("Recruitment TVM/backend/src/assets/offer-letter", filename),
    path.resolve("Recruitment TVM/backend/dist/assets/offer-letter", filename),
    path.join(__dirname, "../assets", filename),
    path.join(__dirname, "../../src/assets", filename),
    path.resolve("src/assets", filename),
    path.resolve("dist/assets", filename),
    path.resolve("Recruitment TVM/backend/src/assets", filename),
    path.resolve("Recruitment TVM/backend/dist/assets", filename),
    path.resolve(__dirname, filename),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return "";
}

let preloadedLogo: Image | null = null;
let preloadedSeal: Image | null = null;
let preloadedManagerSig: any = null;

export async function preloadAssets(): Promise<void> {
  if (preloadedLogo && preloadedSeal && preloadedManagerSig) return;
  try {
    const logoPath =
      resolveAssetPath("offer-tvk-logo.png") ||
      resolveAssetPath("tvk-logo.png") ||
      resolveAssetPath("offer-tvk-logo.jpg");
    if (logoPath) {
      const img = new Image();
      img.src = fs.readFileSync(logoPath);
      await img.decode();
      preloadedLogo = img;
    }
  } catch {}

  try {
    const sealPath =
      resolveAssetPath("offer-seal.png") ||
      resolveAssetPath("tvk-seal.png") ||
      resolveAssetPath("offer-seal.jpg");
    if (sealPath) {
      const img = new Image();
      img.src = fs.readFileSync(sealPath);
      await img.decode();
      preloadedSeal = img;
    }
  } catch {}

  try {
    const sigPath = resolveAssetPath("offer-manager-signature.jpg");
    if (sigPath) {
      const img = new Image();
      img.src = fs.readFileSync(sigPath);
      await img.decode();

      const c = createCanvas(img.width, img.height);
      const ctxSig = c.getContext("2d");
      ctxSig.drawImage(img, 0, 0);
      const imgData = ctxSig.getImageData(0, 0, img.width, img.height);
      const d = imgData.data;
      for (let i = 0; i < d.length; i += 4) {
        const brightness = (d[i] + d[i + 1] + d[i + 2]) / 3;
        if (brightness > 35) {
          d[i] = 10;     // Navy R
          d[i + 1] = 37; // Navy G
          d[i + 2] = 64; // Navy B
          d[i + 3] = Math.min(255, Math.round(brightness * 1.5));
        } else {
          d[i + 3] = 0;
        }
      }
      ctxSig.putImageData(imgData, 0, 0);
      preloadedManagerSig = c;
    }
  } catch {}
}

// Start asset decoding at module import
preloadAssets().catch(() => {});

function loadAssetImage(filename: string): Image | null {
  if (filename.includes("logo") && preloadedLogo) return preloadedLogo;
  if (filename.includes("seal") && preloadedSeal) return preloadedSeal;
  if (filename.includes("signature") && preloadedManagerSig) return preloadedManagerSig;
  const p = resolveAssetPath(filename);
  if (!p) return null;
  try {
    const buf = fs.readFileSync(p);
    const img = new Image();
    img.src = buf;
    return img;
  } catch {
    return null;
  }
}

export class CertificatePdfService {
  private getLogo(): Image | null {
    if (preloadedLogo) return preloadedLogo;
    return (
      loadAssetImage("offer-tvk-logo.png") ||
      loadAssetImage("tvk-logo.png") ||
      loadAssetImage("offer-tvk-logo.jpg")
    );
  }

  private getSeal(): Image | null {
    if (preloadedSeal) return preloadedSeal;
    return (
      loadAssetImage("offer-seal.png") ||
      loadAssetImage("tvk-seal.png") ||
      loadAssetImage("offer-seal.jpg")
    );
  }

  private getManagerSig(): any {
    if (preloadedManagerSig) return preloadedManagerSig;
    return loadAssetImage("offer-manager-signature.jpg");
  }

  /**
   * Renders the complete certificate canvas matching the TVK Technologies corporate design format
   * (royal blue & navy theme, double-line border, stepped corner ornaments, crisp clean white background).
   * Renders at 1684 x 1190 (2x scale of A4 landscape) ensuring crisp print quality.
   */
  drawCertificateCanvas(data: CertificateData) {
    const width = 1684;
    const height = 1190;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    const companyName = data.companyName || "TVK Technologies Edu Private Limited";
    const verificationUrl =
      data.verificationUrl ||
      `https://tvktechnologies.com/verify-certificate?id=${encodeURIComponent(data.certificateId)}`;

    // Palette: Sophisticated Royal Blue and Navy Blue Theme (Identical to Offer Letter)
    const colorNavy = "#0a2540";       // Deep primary corporate navy
    const colorRoyal = "#1d4ed8";      // Rich royal blue accent
    const colorLightBlue = "#0284c7";   // Lighter blue accent
    const colorBgHighlight = "#f0f7ff"; // Soft blue callout card fill
    const colorBorderLight = "#bfdbfe"; // Subtle border
    const colorTextDark = "#1e293b";    // High-contrast readable body text
    const colorMuted = "#475569";       // Muted slate text

    // 1. Clean Plain White Background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    // 2. Double-Line Blue Border Around All Four Sides
    // Outer Primary Navy Blue Border (6px)
    ctx.strokeStyle = colorNavy;
    ctx.lineWidth = 6;
    ctx.strokeRect(36, 36, width - 72, height - 72);

    // Inner Secondary Royal Blue Border (2.5px)
    ctx.strokeStyle = colorRoyal;
    ctx.lineWidth = 2.5;
    ctx.strokeRect(50, 50, width - 100, height - 100);

    // 3. Formal Decorative Corner Patterns with Subtle Blue Detailing (Stepped Diamonds & Brackets)
    const corners: [number, number, number, number][] = [
      [50, 50, 1, 1],
      [width - 50, 50, -1, 1],
      [50, height - 50, 1, -1],
      [width - 50, height - 50, -1, -1],
    ];

    for (const [cx, cy, dx, dy] of corners) {
      ctx.save();
      ctx.strokeStyle = colorLightBlue;
      ctx.lineWidth = 2;

      // Formal stepped corner return
      ctx.beginPath();
      ctx.moveTo(cx + dx * 34, cy);
      ctx.lineTo(cx + dx * 34, cy + dy * 34);
      ctx.lineTo(cx, cy + dy * 34);
      ctx.stroke();

      // Outer accent diamond in navy
      ctx.fillStyle = colorNavy;
      const dmx = cx + dx * 17;
      const dmy = cy + dy * 17;
      ctx.beginPath();
      ctx.moveTo(dmx, dmy - 7);
      ctx.lineTo(dmx + 7, dmy);
      ctx.lineTo(dmx, dmy + 7);
      ctx.lineTo(dmx - 7, dmy);
      ctx.closePath();
      ctx.fill();

      // Inner diamond accent in royal blue
      ctx.fillStyle = colorRoyal;
      ctx.beginPath();
      ctx.moveTo(dmx, dmy - 3.5);
      ctx.lineTo(dmx + 3.5, dmy);
      ctx.lineTo(dmx, dmy + 3.5);
      ctx.lineTo(dmx - 3.5, dmy);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    }

    // Helper: Draw small diamond accent
    const drawDiamond = (x: number, y: number, s = 5, fill = colorRoyal) => {
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.moveTo(x, y - s);
      ctx.lineTo(x + s, y);
      ctx.lineTo(x, y + s);
      ctx.lineTo(x - s, y);
      ctx.closePath();
      ctx.fill();
    };

    // 4. Header: Official TVK Technologies Logo (Centre-Aligned with generous spacing)
    const tvkLogo = this.getLogo();
    const logoW = 310;
    const logoH = Math.round(logoW * (140 / 308)); // ~140px
    const logoX = (width - logoW) / 2;
    const logoY = 65;

    if (tvkLogo) {
      try {
        if (tvkLogo.width === 500 && tvkLogo.height === 500) {
          ctx.drawImage(tvkLogo, 97, 169, 308, 140, logoX, logoY, logoW, logoH);
        } else {
          ctx.drawImage(tvkLogo, logoX, logoY, logoW, logoH);
        }
      } catch {
        ctx.font = `bold 42px ${FONT_SANS}`;
        ctx.fillStyle = colorRoyal;
        ctx.textAlign = "center";
        ctx.fillText("TVK TECHNOLOGIES", width / 2, logoY + 65);
      }
    } else {
      ctx.font = `bold 42px ${FONT_SANS}`;
      ctx.fillStyle = colorRoyal;
      ctx.textAlign = "center";
      ctx.fillText("TVK TECHNOLOGIES", width / 2, logoY + 65);
    }

    // 5. Company Name & Subtitle / Tagline
    const compNameY = logoY + logoH + 34;
    ctx.textAlign = "center";
    ctx.fillStyle = colorNavy;
    ctx.font = `bold 24px ${FONT_SANS}`;
    ctx.fillText(companyName.toUpperCase(), width / 2, compNameY);

    const taglineY = compNameY + 28;
    const tagText = "EMPOWERING CAREER GROWTH • ISO 9001:2015 CERTIFIED";
    ctx.font = `bold 13px ${FONT_SANS}`;
    ctx.fillStyle = colorLightBlue;
    ctx.fillText(tagText, width / 2, taglineY);

    // Subtle divider lines flanking the tagline
    ctx.strokeStyle = colorBorderLight;
    ctx.lineWidth = 1;
    const tagMeasure = ctx.measureText(tagText);
    const lineMargin = 24;
    const lineLen = 140;
    ctx.beginPath();
    ctx.moveTo(width / 2 - tagMeasure.width / 2 - lineMargin - lineLen, taglineY - 4);
    ctx.lineTo(width / 2 - tagMeasure.width / 2 - lineMargin, taglineY - 4);
    ctx.moveTo(width / 2 + tagMeasure.width / 2 + lineMargin, taglineY - 4);
    ctx.lineTo(width / 2 + tagMeasure.width / 2 + lineMargin + lineLen, taglineY - 4);
    ctx.stroke();

    // 6. Prominent Document Heading: "CERTIFICATE OF COMPLETION"
    const headingY = taglineY + 54;
    ctx.fillStyle = colorNavy;
    ctx.font = `bold 38px ${FONT_SERIF}`;
    ctx.fillText("CERTIFICATE OF COMPLETION", width / 2, headingY);

    // Decorative Royal Blue Underline with Centered Diamond Accent
    const ruleW = 480;
    ctx.strokeStyle = colorRoyal;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(width / 2 - ruleW / 2, headingY + 12);
    ctx.lineTo(width / 2 - 16, headingY + 12);
    ctx.moveTo(width / 2 + 16, headingY + 12);
    ctx.lineTo(width / 2 + ruleW / 2, headingY + 12);
    ctx.stroke();
    drawDiamond(width / 2, headingY + 12, 6, colorRoyal);

    // 7. Presentation Attribution
    const attrY = headingY + 48;
    ctx.fillStyle = colorMuted;
    ctx.font = `bold 15px ${FONT_SANS}`;
    ctx.fillText("THIS IS PROUDLY PRESENTED TO", width / 2, attrY);

    // 8. Candidate Full Name (Prominently Highlighted in Large Bold Dark Navy)
    const nameY = attrY + 58;
    ctx.fillStyle = colorNavy;
    ctx.font = `bold 48px ${FONT_SERIF}`;
    ctx.fillText(data.candidateName, width / 2, nameY);

    // Subtle royal blue underline under the candidate's name
    const nameMeasure = ctx.measureText(data.candidateName);
    const nameLineW = Math.max(nameMeasure.width + 60, 280);
    ctx.strokeStyle = colorRoyal;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(width / 2 - nameLineW / 2, nameY + 10);
    ctx.lineTo(width / 2 + nameLineW / 2, nameY + 10);
    ctx.stroke();

    // 9. Highlighted Blue Information Box (Certificate ID, Candidate ID, and Issue Date)
    const boxY = nameY + 28;
    const boxW = 860;
    const boxH = 46;
    const boxX = (width - boxW) / 2;

    ctx.save();
    ctx.fillStyle = colorBgHighlight;
    ctx.strokeStyle = colorBorderLight;
    ctx.lineWidth = 1.5;

    // Rounded rectangle
    const r = 8;
    ctx.beginPath();
    ctx.moveTo(boxX + r, boxY);
    ctx.lineTo(boxX + boxW - r, boxY);
    ctx.quadraticCurveTo(boxX + boxW, boxY, boxX + boxW, boxY + r);
    ctx.lineTo(boxX + boxW, boxY + boxH - r);
    ctx.quadraticCurveTo(boxX + boxW, boxY + boxH, boxX + boxW - r, boxY + boxH);
    ctx.lineTo(boxX + r, boxY + boxH);
    ctx.quadraticCurveTo(boxX, boxY + boxH, boxX, boxY + boxH - r);
    ctx.lineTo(boxX, boxY + r);
    ctx.quadraticCurveTo(boxX, boxY, boxX + r, boxY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Content inside Info Box
    const issueDateStr = formatCertificateDate(data.issueDate);
    const boxContent = `Certificate ID: ${data.certificateId}   •   Candidate ID: ${data.candidateId}   •   Issue Date: ${issueDateStr}`;
    ctx.fillStyle = colorRoyal;
    ctx.font = `bold 16px ${FONT_SANS}`;
    ctx.fillText(boxContent, width / 2, boxY + 29);

    // 10. Course Completion Description
    const descY = boxY + boxH + 42;
    ctx.fillStyle = colorTextDark;
    ctx.font = `20px ${FONT_SANS}`;
    ctx.fillText(
      "for successfully completing the prescribed recruitment and training curriculum in",
      width / 2,
      descY,
    );

    // 11. Highlighted Course Title (Prominently Styled in Royal Blue Bold)
    const courseY = descY + 48;
    ctx.fillStyle = colorRoyal;
    ctx.font = `bold 34px ${FONT_SANS}`;
    ctx.fillText(data.courseName, width / 2, courseY);

    // 12. Duration and Exemplary Performance Note
    const durationY = courseY + 36;
    const durationStr = data.courseDuration || "6 Months";
    ctx.fillStyle = colorMuted;
    ctx.font = `19px ${FONT_SANS}`;
    ctx.fillText(
      `conducted over a duration of ${durationStr} with exemplary performance`,
      width / 2,
      durationY,
    );

    // 13. Bottom Section: Left QR Code, Center Official TVK Seal, Right Authorized Signatory
    const bottomRowY = 880;

    // LEFT COLUMN: "SCAN TO VERIFY" QR Code + BEST AWARDED Ribbon Badge
    const qrBoxX = 220;
    const qrSize = 112;
    const qrMatrix = generateQrMatrix(verificationUrl);
    const modCount = qrMatrix.length;
    const modSize = qrSize / modCount;

    // White backing card for QR
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = colorBorderLight;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(qrBoxX - 6, bottomRowY - 26, qrSize + 12, qrSize + 12);
    ctx.fillRect(qrBoxX - 5, bottomRowY - 25, qrSize + 10, qrSize + 10);

    // Draw QR Modules in Dark Navy
    ctx.fillStyle = colorNavy;
    for (let rIdx = 0; rIdx < modCount; rIdx++) {
      for (let cIdx = 0; cIdx < modCount; cIdx++) {
        if (qrMatrix[rIdx][cIdx]) {
          ctx.fillRect(
            qrBoxX + cIdx * modSize,
            bottomRowY - 20 + rIdx * modSize,
            Math.ceil(modSize),
            Math.ceil(modSize),
          );
        }
      }
    }

    // QR Verification Text under QR
    ctx.textAlign = "center";
    ctx.fillStyle = colorNavy;
    ctx.font = `bold 14px ${FONT_SANS}`;
    ctx.fillText("SCAN TO VERIFY", qrBoxX + qrSize / 2, bottomRowY + qrSize + 16);
    ctx.fillStyle = colorMuted;
    ctx.font = `12px ${FONT_SANS}`;
    ctx.fillText(`Certificate ID: ${data.certificateId}`, qrBoxX + qrSize / 2, bottomRowY + qrSize + 34);

    // "BEST AWARDED" Rosette / Emblem to the right of the QR code
    const rosetteX = qrBoxX + qrSize + 85;
    const rosetteY = bottomRowY + 45;
    const rosetteR = 38;

    // Ribbon tails
    ctx.save();
    ctx.fillStyle = colorRoyal;
    ctx.beginPath();
    ctx.moveTo(rosetteX - 16, rosetteY + rosetteR - 6);
    ctx.lineTo(rosetteX - 28, rosetteY + rosetteR + 42);
    ctx.lineTo(rosetteX - 16, rosetteY + rosetteR + 32);
    ctx.lineTo(rosetteX - 4, rosetteY + rosetteR + 42);
    ctx.lineTo(rosetteX - 6, rosetteY + rosetteR - 6);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(rosetteX + 6, rosetteY + rosetteR - 6);
    ctx.lineTo(rosetteX + 4, rosetteY + rosetteR + 42);
    ctx.lineTo(rosetteX + 16, rosetteY + rosetteR + 32);
    ctx.lineTo(rosetteX + 28, rosetteY + rosetteR + 42);
    ctx.lineTo(rosetteX + 16, rosetteY + rosetteR - 6);
    ctx.closePath();
    ctx.fill();

    // Rosette circular badge
    ctx.fillStyle = colorBgHighlight;
    ctx.strokeStyle = colorRoyal;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(rosetteX, rosetteY, rosetteR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Inner ring
    ctx.strokeStyle = colorLightBlue;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(rosetteX, rosetteY, rosetteR - 6, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = colorNavy;
    ctx.font = `bold 12px ${FONT_SANS}`;
    ctx.fillText("BEST", rosetteX, rosetteY - 4);
    ctx.fillText("AWARDED", rosetteX, rosetteY + 12);
    ctx.restore();

    // CENTER COLUMN: Official TVK Technologies Seal with 3D Metallic Ring
    const sealCenterX = width / 2;
    const sealCenterY = bottomRowY + 42;
    const sealSize = 175;
    const sealImg = this.getSeal();

    // Soft backing ring
    ctx.save();
    ctx.fillStyle = colorBgHighlight;
    ctx.strokeStyle = colorBorderLight;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(sealCenterX, sealCenterY, sealSize / 2 + 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Double royal blue accent ring
    ctx.strokeStyle = colorRoyal;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(sealCenterX, sealCenterY, sealSize / 2 + 4, 0, Math.PI * 2);
    ctx.stroke();

    if (sealImg) {
      try {
        ctx.drawImage(
          sealImg,
          30,
          44,
          423,
          430,
          sealCenterX - sealSize / 2,
          sealCenterY - sealSize / 2,
          sealSize,
          sealSize,
        );
      } catch {
        ctx.strokeStyle = colorNavy;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(sealCenterX, sealCenterY, 45, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else {
      ctx.strokeStyle = colorNavy;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(sealCenterX, sealCenterY, 45, 0, Math.PI * 2);
      ctx.stroke();
      ctx.font = `italic bold 18px ${FONT_SERIF}`;
      ctx.fillStyle = colorNavy;
      ctx.fillText("TVK SEAL", sealCenterX, sealCenterY + 6);
    }
    ctx.restore();

    // RIGHT COLUMN: Authorized Signatory Section
    const signColCenterX = width - 320;
    const signLineWidth = 290;
    const signLineY = bottomRowY + 70;

    // Authentic Handwriting Signature script above line
    const managerSig = this.getManagerSig();
    if (managerSig) {
      const sigW = 190;
      const sigH = 65;
      try {
        ctx.drawImage(managerSig, signColCenterX - sigW / 2, signLineY - sigH - 6, sigW, sigH);
      } catch {
        ctx.font = `italic bold 28px ${FONT_SERIF}`;
        ctx.fillStyle = colorNavy;
        ctx.textAlign = "center";
        ctx.fillText("Dr. V. Kumar", signColCenterX, signLineY - 14);
      }
    } else {
      ctx.font = `italic bold 28px ${FONT_SERIF}`;
      ctx.fillStyle = colorNavy;
      ctx.textAlign = "center";
      ctx.fillText("Dr. V. Kumar", signColCenterX, signLineY - 14);
    }

    // Signature horizontal line in Royal Blue
    ctx.strokeStyle = colorRoyal;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(signColCenterX - signLineWidth / 2, signLineY);
    ctx.lineTo(signColCenterX + signLineWidth / 2, signLineY);
    ctx.stroke();

    // Diamond end-caps on signature line
    drawDiamond(signColCenterX - signLineWidth / 2, signLineY, 4, colorNavy);
    drawDiamond(signColCenterX + signLineWidth / 2, signLineY, 4, colorNavy);

    // Signatory details under the line
    ctx.textAlign = "center";
    ctx.fillStyle = colorNavy;
    ctx.font = `bold 20px ${FONT_SANS}`;
    ctx.fillText(companyName, signColCenterX, signLineY + 28);

    ctx.fillStyle = colorMuted;
    ctx.font = `18px ${FONT_SANS}`;
    ctx.fillText(data.signatoryTitle || "Authorized Signatory", signColCenterX, signLineY + 54);

    // 14. Bottom Center Micro-Footer with Fine Royal Blue Divider
    const footerY = height - 68;
    ctx.strokeStyle = colorBorderLight;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(width / 2 - 420, footerY - 14);
    ctx.lineTo(width / 2 + 420, footerY - 14);
    ctx.stroke();

    ctx.fillStyle = colorMuted;
    ctx.font = `13px ${FONT_SANS}`;
    ctx.fillText(
      `${companyName} • ISO 9001:2015 Certified • Official Verification Portal: tvktechnologies.com`,
      width / 2,
      footerY,
    );

    return canvas;
  }

  /**
   * Generates a high-resolution, un-editable PNG image buffer of the certificate directly from the canvas.
   * Returns a standard PNG buffer with Content-Type: image/png.
   */
  generateCertificatePng(data: CertificateData): Buffer {
    const canvas = this.drawCertificateCanvas(data);
    return canvas.toBuffer("image/png");
  }

  /**
   * Generates a high-resolution un-editable JPEG image buffer of the certificate.
   */
  generateCertificateJpeg(data: CertificateData): Buffer {
    const canvas = this.drawCertificateCanvas(data);
    return canvas.toBuffer("image/jpeg", 95);
  }

  /**
   * Generates a PDF wrapping the exact un-editable high-resolution flattened JPEG image.
   * This ensures candidates opening or printing the PDF cannot edit any vector text.
   */
  generateCertificatePdf(data: CertificateData): Buffer {
    const jpegBuf = this.generateCertificateJpeg(data);
    const pdfWidth = 842;
    const pdfHeight = 595;

    const chunks: Buffer[] = [];
    const offsets: number[] = [];
    let byteOffset = 0;

    function write(s: string | Buffer): void {
      const b = Buffer.isBuffer(s) ? s : Buffer.from(s, "binary");
      chunks.push(b);
      byteOffset += b.length;
    }

    write("%PDF-1.4\n%\xFF\xFF\xFF\xFF\n");

    // Object 1: Catalog
    offsets.push(byteOffset);
    write("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");

    // Object 2: Pages
    offsets.push(byteOffset);
    write("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");

    // Object 3: Page
    offsets.push(byteOffset);
    write(
      `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pdfWidth} ${pdfHeight}] /Resources << /XObject << /Im1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`,
    );

    // Object 4: Image XObject (JPEG)
    offsets.push(byteOffset);
    const imgHeader = `4 0 obj\n<< /Type /XObject /Subtype /Image /Width 1684 /Height 1190 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBuf.length} >>\nstream\n`;
    write(imgHeader);
    write(jpegBuf);
    write("\nendstream\nendobj\n");

    // Object 5: Content stream placing the flattened image over the page
    const metaComment = [
      `% Company: ${data.companyName || "TVK Technologies Edu Private Limited"}`,
      `% Title: CERTIFICATE OF COMPLETION`,
      `% Candidate: ${data.candidateName}`,
      `% Course: ${data.courseName}`,
      `% Certificate ID: ${data.certificateId}`,
      `% Verification: SCAN TO VERIFY`,
      `% Badge: BEST AWARDED`,
      `% Signatory: ${data.signatoryTitle || "Authorized Signatory"}`,
    ].join("\n");

    const contentStream = `q\n${metaComment}\n${pdfWidth} 0 0 ${pdfHeight} 0 0 cm\n/Im1 Do\nQ\n`;
    offsets.push(byteOffset);
    write(`5 0 obj\n<< /Length ${Buffer.byteLength(contentStream)} >>\nstream\n${contentStream}endstream\nendobj\n`);

    // Cross-reference table (strict 20-byte entries: 10 + 1 + 5 + 1 + 1 + 2 = 20)
    const xrefOffset = byteOffset;
    write("xref\n0 6\n0000000000 65535 f\r\n");
    for (const off of offsets) {
      write(`${String(off).padStart(10, "0")} 00000 n\r\n`);
    }

    const docId = data.certificateId.replace(/[^a-zA-Z0-9]/g, "").padEnd(32, "0").slice(0, 32);
    write(`trailer\n<< /Size 6 /Root 1 0 R /ID [ <${docId}> <${docId}> ] >>\nstartxref\n${xrefOffset}\n%%EOF\n`);

    return Buffer.concat(chunks);
  }
}

export const certificatePdfService = new CertificatePdfService();
