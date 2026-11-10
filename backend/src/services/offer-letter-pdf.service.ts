import { createCanvas, Image, GlobalFonts } from "@napi-rs/canvas";
import fs from "node:fs";
import path from "node:path";

export const FONT_SERIF = '"Times New Roman", Georgia, "DejaVu Serif", "Liberation Serif", serif';
export const FONT_SANS = 'Arial, "Helvetica Neue", Helvetica, "Liberation Sans", "DejaVu Sans", sans-serif';

function resolveAssetPath(filename: string): string {
  const candidates = [
    path.join(__dirname, "../assets/offer-letter", filename),
    path.join(__dirname, "../../src/assets/offer-letter", filename),
    path.resolve("src/assets/offer-letter", filename),
    path.resolve("dist/assets/offer-letter", filename),
    path.resolve("Recruitment TVM/backend/src/assets/offer-letter", filename),
    path.resolve("Recruitment TVM/backend/dist/assets/offer-letter", filename),
    path.join(__dirname, "../assets", filename),
    path.resolve("src/assets", filename),
    path.resolve("Recruitment TVM/backend/src/assets", filename),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return "";
}

let preloadedLogo: Image | null = null;
let preloadedSeal: Image | null = null;
let preloadedMsme: Image | null = null;
let preloadedManagerSig: any = null;

export async function preloadOfferAssets(): Promise<void> {
  if (preloadedLogo && preloadedSeal && preloadedManagerSig) return;
  try {
    const logoP =
      resolveAssetPath("offer-tvk-logo.png") ||
      resolveAssetPath("tvk-logo.png") ||
      resolveAssetPath("offer-tvk-logo.jpg");
    if (logoP) {
      const img = new Image();
      img.src = fs.readFileSync(logoP);
      await img.decode();
      preloadedLogo = img;
    }
  } catch {}

  try {
    const sealP =
      resolveAssetPath("offer-seal.png") ||
      resolveAssetPath("tvk-seal.png") ||
      resolveAssetPath("offer-seal.jpg");
    if (sealP) {
      const img = new Image();
      img.src = fs.readFileSync(sealP);
      await img.decode();
      preloadedSeal = img;
    }
  } catch {}

  try {
    const sigP = resolveAssetPath("offer-manager-signature.jpg");
    if (sigP) {
      const img = new Image();
      img.src = fs.readFileSync(sigP);
      await img.decode();

      // Transform white-on-black signature into crisp dark-navy on transparent
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

// Preload assets asynchronously at module evaluation
preloadOfferAssets().catch(() => {});

function loadAssetImage(filename: string): Image | null {
  if (filename.includes("logo") && preloadedLogo) return preloadedLogo;
  if (filename.includes("seal") && preloadedSeal) return preloadedSeal;
  if (filename.includes("msme") && preloadedMsme) return preloadedMsme;
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

export interface OfferLetterData {
  candidateId: string;
  candidateName: string;
  college?: string;
  courseName?: string;
  startDate?: string;
  endDate?: string;
  supervisorName?: string;
  supervisorTitle?: string;
  issueDate?: string;
  gender?: string;
}

export function formatOfferLetterShortDate(dateInput?: string | Date | null): string {
  if (!dateInput) {
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, "0");
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    return `${dd}/${mm}/${now.getFullYear()}`;
  }
  if (typeof dateInput === "string" && /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateInput.trim())) {
    return dateInput.trim();
  }
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return String(dateInput);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

export function formatOfferLetterLongDate(dateInput?: string | Date | null, fallback = ""): string {
  if (!dateInput) return fallback;
  if (typeof dateInput === "string" && /^[0-9]{1,2}\s+[A-Za-z]+\s+[0-9]{4}$/.test(dateInput.trim())) {
    return dateInput.trim();
  }
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return String(dateInput);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export class OfferLetterPdfService {
  private getTvkLogo(): Image | null {
    if (preloadedLogo) return preloadedLogo;
    return (
      loadAssetImage("offer-tvk-logo.png") ||
      loadAssetImage("tvk-logo.png") ||
      loadAssetImage("offer-tvk-logo.jpg")
    );
  }
  private getMsmeEmblem(): Image | null {
    if (preloadedMsme) return preloadedMsme;
    return loadAssetImage("offer-msme-emblem.jpg");
  }
  private getManagerSig(): Image | null {
    if (preloadedManagerSig) return preloadedManagerSig;
    return loadAssetImage("offer-manager-signature.jpg");
  }
  private getSeal(): Image | null {
    if (preloadedSeal) return preloadedSeal;
    return (
      loadAssetImage("offer-seal.png") ||
      loadAssetImage("tvk-seal.png") ||
      loadAssetImage("offer-seal.jpg")
    );
  }

  /**
   * Renders the complete, authentic TVK Technologies Offer Letter with a formal,
   * elegant, and professional corporate appearance.
   * Rendered at 1240 x 1754 px (A4 portrait high-resolution canvas).
   */
  drawOfferLetterCanvas(data: OfferLetterData) {
    const width = 1240;
    const height = 1754;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    // Palette: Sophisticated Royal Blue and Navy Blue Theme
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

    // 2. Double-Line Blue Border Around All Four Sides (Equal 36px/48px Margin on all sides)
    // Outer Primary Navy Blue Border
    ctx.strokeStyle = colorNavy;
    ctx.lineWidth = 5;
    ctx.strokeRect(36, 36, width - 72, height - 72);

    // Inner Secondary Royal Blue Border
    ctx.strokeStyle = colorRoyal;
    ctx.lineWidth = 2;
    ctx.strokeRect(48, 48, width - 96, height - 96);

    // 3. Formal Decorative Corner Patterns with Subtle Blue Detailing
    const corners: [number, number, number, number][] = [
      [48, 48, 1, 1],
      [width - 48, 48, -1, 1],
      [48, height - 48, 1, -1],
      [width - 48, height - 48, -1, -1],
    ];

    for (const [cx, cy, dx, dy] of corners) {
      ctx.save();
      ctx.strokeStyle = colorLightBlue;
      ctx.lineWidth = 1.5;

      // Formal stepped corner return
      ctx.beginPath();
      ctx.moveTo(cx + dx * 28, cy);
      ctx.lineTo(cx + dx * 28, cy + dy * 28);
      ctx.lineTo(cx, cy + dy * 28);
      ctx.stroke();

      // Corner accent diamond
      ctx.fillStyle = colorNavy;
      const dmx = cx + dx * 14;
      const dmy = cy + dy * 14;
      ctx.beginPath();
      ctx.moveTo(dmx, dmy - 5);
      ctx.lineTo(dmx + 5, dmy);
      ctx.lineTo(dmx, dmy + 5);
      ctx.lineTo(dmx - 5, dmy);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    }

    // Helper: Draw small diamond accent
    const drawAccentDiamond = (x: number, y: number, s = 4, fill = colorRoyal) => {
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
    const tvkLogo = this.getTvkLogo();
    const logoW = 290;
    const logoH = Math.round(logoW * (140 / 308)); // ~132px
    const logoX = (width - logoW) / 2;
    const logoY = 68;

    if (tvkLogo) {
      if (tvkLogo.width === 500 && tvkLogo.height === 500) {
        ctx.drawImage(tvkLogo, 97, 169, 308, 140, logoX, logoY, logoW, logoH);
      } else {
        ctx.drawImage(tvkLogo, logoX, logoY, logoW, logoH);
      }
    } else {
      ctx.font = `bold 44px ${FONT_SANS}`;
      ctx.fillStyle = colorRoyal;
      ctx.textAlign = "center";
      ctx.fillText("TVK TECHNOLOGIES", width / 2, logoY + 65);
    }

    // 5. Company Name & Subtitle (Centre-Aligned, with 52px clean formal breathing room below logo)
    const compNameY = logoY + logoH + 52;
    ctx.fillStyle = colorNavy;
    ctx.font = `bold 28px ${FONT_SERIF}`;
    ctx.textAlign = "center";
    ctx.fillText("TVK Technologies Edu Private Limited", width / 2, compNameY);

    ctx.fillStyle = colorRoyal;
    ctx.font = `bold 14px ${FONT_SANS}`;
    ctx.fillText("ISO 9001:2015 CERTIFIED ORGANIZATION  •  EMPOWERING CAREER GROWTH", width / 2, compNameY + 23);

    // Symmetrical Decorative Header Divider Rule
    const divY = compNameY + 40;
    const divWidth = 380;
    ctx.strokeStyle = colorRoyal;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(width / 2 - divWidth, divY);
    ctx.lineTo(width / 2 - 16, divY);
    ctx.moveTo(width / 2 + 16, divY);
    ctx.lineTo(width / 2 + divWidth, divY);
    ctx.stroke();
    drawAccentDiamond(width / 2, divY, 5, colorNavy);

    // 6. Prominent Document Title: "OFFER LETTER" (Centre-Aligned with consistent spacing)
    const titleY = divY + 48;
    ctx.fillStyle = colorNavy;
    ctx.font = `bold 42px ${FONT_SERIF}`;
    ctx.textAlign = "center";
    ctx.fillText("OFFER LETTER", width / 2, titleY);

    ctx.fillStyle = colorMuted;
    ctx.font = `italic 18px ${FONT_SERIF}`;
    ctx.fillText("Official Internship Appointment & Formal Employment Offer", width / 2, titleY + 26);

    // Date & Document Reference Metadata Bar (Centre-Aligned)
    const metaY = titleY + 56;
    const dateFormatted = formatOfferLetterShortDate(data.issueDate);
    const candidateId = data.candidateId || "TVK-26-00001";
    ctx.font = `bold 16px ${FONT_SANS}`;
    ctx.fillStyle = colorNavy;
    ctx.fillText(
      `Issue Date: ${dateFormatted}     |     Ref. No: TVK/OFFER/2026/${candidateId}`,
      width / 2,
      metaY,
    );

    // 7. Resolve Candidate and Employment Variables
    const rawName = (data.candidateName || "Candidate").trim();
    const isFemale =
      (data.gender && /^f/i.test(data.gender)) ||
      /\b(Ms\.|Mrs\.|Miss)\b/i.test(rawName);
    const hasPrefix = /^(Mr\.|Ms\.|Mrs\.|Dr\.)\s/i.test(rawName);
    const nameWithPrefix = hasPrefix ? rawName : (isFemale ? `Ms. ${rawName}` : `Mr. ${rawName}`);

    const pronounSubject = isFemale ? "she" : "he";
    const pronounSubjectCap = isFemale ? "She" : "He";
    const pronounObject = isFemale ? "her" : "him";
    const pronounPossessive = isFemale ? "her" : "his";
    const pronounPossessiveCap = isFemale ? "Her" : "His";

    const college = (data.college || "SRM Institute of Science and Technology").trim();
    const courseName = (data.courseName || "AI With Data Science").trim();
    const startDate = formatOfferLetterLongDate(data.startDate, "28 September 2026");
    const endDate = formatOfferLetterLongDate(data.endDate, "23 October 2026");
    const supervisor = (data.supervisorName || "PRIYATHARSHAN A / Program Manager").trim();

    // 8. Highlight Important Details: Candidate Information Section (Centre-Aligned & Balanced)
    const cardY = metaY + 20;
    const cardW = 1040;
    const cardH = 130;
    const cardX = (width - cardW) / 2;

    // Highlighted Blue Information Box Container
    ctx.fillStyle = colorBgHighlight;
    ctx.fillRect(cardX, cardY, cardW, cardH);
    ctx.strokeStyle = colorRoyal;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(cardX, cardY, cardW, cardH);

    // Inner subtle hairline
    ctx.strokeStyle = colorBorderLight;
    ctx.lineWidth = 1;
    ctx.strokeRect(cardX + 4, cardY + 4, cardW - 8, cardH - 8);

    // Row 1: Candidate's Full Name (Prominently highlighted in large, bold, dark-navy font, centre-aligned)
    ctx.font = `bold 30px ${FONT_SERIF}`;
    ctx.fillStyle = colorNavy;
    ctx.textAlign = "center";
    ctx.fillText(nameWithPrefix, width / 2, cardY + 36);

    // Row 2: Candidate ID in highlighted blue information box (Centre-aligned)
    const pillW = 280;
    const pillH = 30;
    const pillX = width / 2 - pillW / 2;
    const pillY = cardY + 48;

    ctx.fillStyle = "#e0f2fe";
    ctx.fillRect(pillX, pillY, pillW, pillH);
    ctx.strokeStyle = colorLightBlue;
    ctx.lineWidth = 1.2;
    ctx.strokeRect(pillX, pillY, pillW, pillH);

    ctx.font = `bold 15px ${FONT_SANS}`;
    ctx.fillStyle = "#0369a1";
    ctx.fillText(`Candidate ID: ${candidateId}`, width / 2, pillY + 20);

    // Row 3: Uniformly formatted and aligned details (Designation & Joining Period)
    const detailsY = cardY + 110;
    ctx.font = `bold 15px ${FONT_SANS}`;

    // Left aligned: Job Designation
    ctx.textAlign = "left";
    ctx.fillStyle = colorNavy;
    ctx.fillText("Job Designation: ", cardX + 24, detailsY);
    const desLabelW = ctx.measureText("Job Designation: ").width;
    ctx.fillStyle = colorRoyal;
    ctx.fillText(courseName, cardX + 24 + desLabelW, detailsY);

    // Right aligned: Internship Period
    ctx.textAlign = "right";
    ctx.fillStyle = colorNavy;
    ctx.fillText(`Internship Period: ${startDate} – ${endDate}`, cardX + cardW - 24, detailsY);

    // 9. Letter Body Content (Justified Alignment with Clean Margins)
    const regularFont = `21px ${FONT_SERIF}`;
    const boldFont = `bold 21px ${FONT_SERIF}`;
    const leftMargin = 100;
    const rightMargin = width - 100;
    const maxWidth = rightMargin - leftMargin;
    const lineHeight = 35;
    const paragraphGap = 18;

    function renderRichParagraph(
      segments: Array<{ text: string; bold: boolean; highlight?: boolean }>,
      startY: number,
      justify = true,
    ): number {
      const words: Array<{ text: string; isSpace: boolean; bold: boolean; highlight?: boolean }> = [];
      for (const seg of segments) {
        const segWords = seg.text.split(/(\s+)/);
        for (const w of segWords) {
          if (!w) continue;
          if (/^\s+$/.test(w)) {
            words.push({ text: " ", isSpace: true, bold: seg.bold, highlight: seg.highlight });
          } else {
            words.push({ text: w, isSpace: false, bold: seg.bold, highlight: seg.highlight });
          }
        }
      }

      const lines: Array<Array<{ text: string; isSpace: boolean; bold: boolean; highlight?: boolean }>> = [];
      let currentLine: Array<{ text: string; isSpace: boolean; bold: boolean; highlight?: boolean }> = [];
      let currentW = 0;

      for (let i = 0; i < words.length; i++) {
        const item = words[i];
        ctx.font = item.bold ? boldFont : regularFont;
        const w = ctx.measureText(item.text).width;

        if (item.isSpace) {
          if (currentLine.length > 0) {
            currentLine.push(item);
            currentW += w;
          }
        } else {
          if (currentW + w > maxWidth && currentLine.length > 0) {
            if (currentLine[currentLine.length - 1]?.isSpace) {
              currentLine.pop();
            }
            lines.push(currentLine);
            currentLine = [item];
            currentW = w;
          } else {
            currentLine.push(item);
            currentW += w;
          }
        }
      }
      if (currentLine.length > 0) {
        if (currentLine[currentLine.length - 1]?.isSpace) currentLine.pop();
        lines.push(currentLine);
      }

      ctx.textAlign = "left";
      ctx.font = regularFont;
      const normalSpaceW = ctx.measureText(" ").width;

      let y = startY;
      for (let l = 0; l < lines.length; l++) {
        const line = lines[l];
        const isLastLine = l === lines.length - 1;

        let totalWordsW = 0;
        let spaceSlots = 0;
        for (const item of line) {
          if (item.isSpace) {
            spaceSlots++;
          } else {
            ctx.font = item.bold ? boldFont : regularFont;
            totalWordsW += ctx.measureText(item.text).width;
          }
        }

        // Justify text across the full width for intermediate lines
        let spaceWidth = normalSpaceW;
        if (justify && !isLastLine && spaceSlots > 0) {
          const extraSpace = maxWidth - totalWordsW;
          spaceWidth = Math.min(normalSpaceW * 2.8, extraSpace / spaceSlots);
        }

        let x = leftMargin;
        for (const item of line) {
          if (item.isSpace) {
            x += spaceWidth;
          } else {
            ctx.font = item.bold ? boldFont : regularFont;
            ctx.fillStyle = item.highlight ? colorRoyal : (item.bold ? colorNavy : colorTextDark);
            ctx.fillText(item.text, x, y);
            x += ctx.measureText(item.text).width;
          }
        }
        y += lineHeight;
      }
      return y - lineHeight + paragraphGap;
    }

    let curY = cardY + cardH + 28;

    // Paragraph 1: Formal Certification & Joining Citation (Justified)
    curY = renderRichParagraph([
      { text: "This is to certify that ", bold: false },
      { text: `${nameWithPrefix} (${candidateId})`, bold: true, highlight: true },
      { text: ", a student of ", bold: false },
      { text: college, bold: true },
      { text: " has successfully completed the internship in ", bold: false },
      { text: courseName, bold: true, highlight: true },
      { text: " at ", bold: false },
      { text: "TVK Technologies", bold: true },
      { text: " from ", bold: false },
      { text: `${startDate} to ${endDate}`, bold: true },
      { text: " under the supervision of ", bold: false },
      { text: supervisor, bold: true },
      { text: ".", bold: false },
    ], curY, true);

    // Paragraph 2: Project Performance & Contribution (Justified)
    curY = renderRichParagraph([
      { text: `During the internship period, ${pronounSubject} worked on the project titled `, bold: false },
      { text: `\u201C${courseName}\u201D`, bold: true, highlight: true },
      { text: ` and demonstrated sincerity, dedication, and a strong willingness to learn. ${pronounSubjectCap} actively contributed to project development, task execution, documentation, and team collaboration throughout the internship.`, bold: false },
    ], curY, true);

    // Paragraph 3: Work Quality & Professional Conduct (Justified)
    curY = renderRichParagraph([
      { text: `${pronounPossessiveCap} performance was professional, punctual, and well-structured. ${pronounSubjectCap} displayed good problem-solving abilities, adaptability, and teamwork skills, which were appreciated by the organization.`, bold: false },
    ], curY, true);

    // Paragraph 4: Future Support & Well Wishes (Justified)
    curY = renderRichParagraph([
      { text: `We wish ${pronounObject} continued success in all future endeavors and look forward to supporting ${pronounPossessive} career journey.`, bold: false },
    ], curY, true);

    // Formal Sign-off (Aligned with text block)
    ctx.font = regularFont;
    ctx.fillStyle = colorTextDark;
    ctx.textAlign = "left";
    ctx.fillText("Best wishes,", leftMargin, curY + 6);

    // 10. Signatures & Official Seal Row (Neatly Aligned at the Bottom)
    const sigRowY = 1270;

    // Left Column: Official TVK Seal & CEO / Founder Signature
    const seal = this.getSeal();
    const sealCenterX = 280;
    if (seal) {
      const sealW = 195;
      const sealH = Math.round(sealW * (431 / 424));
      if (seal.width === 500 && seal.height === 500) {
        ctx.drawImage(seal, 30, 44, 424, 431, sealCenterX - sealW / 2, sigRowY + 10, sealW, sealH);
      } else {
        ctx.drawImage(seal, sealCenterX - sealW / 2, sigRowY + 10, sealW, sealH);
      }
    }

    // CEO Signature Line
    const sigLineW = 250;
    ctx.strokeStyle = colorRoyal;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(sealCenterX - sigLineW / 2, sigRowY + 215);
    ctx.lineTo(sealCenterX + sigLineW / 2, sigRowY + 215);
    ctx.stroke();

    ctx.font = `bold 22px ${FONT_SERIF}`;
    ctx.textAlign = "center";
    ctx.fillStyle = colorNavy;
    ctx.fillText("CEO / FOUNDER", sealCenterX, sigRowY + 242);
    ctx.font = `15px ${FONT_SANS}`;
    ctx.fillStyle = colorMuted;
    ctx.fillText("Authorized Signatory • TVK Technologies", sealCenterX, sigRowY + 264);

    // Center: Official Corporate Verification & MSME Accreditation Badge
    const centerBadgeX = width / 2;
    const badgeY = sigRowY + 130;
    ctx.strokeStyle = colorBorderLight;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(centerBadgeX - 80, badgeY);
    ctx.lineTo(centerBadgeX - 12, badgeY);
    ctx.moveTo(centerBadgeX + 12, badgeY);
    ctx.lineTo(centerBadgeX + 80, badgeY);
    ctx.stroke();
    drawAccentDiamond(centerBadgeX, badgeY, 4, colorRoyal);

    ctx.font = `bold 14px ${FONT_SANS}`;
    ctx.textAlign = "center";
    ctx.fillStyle = colorRoyal;
    ctx.fillText("★ MSME REGISTERED ENTERPRISE ★", centerBadgeX, badgeY + 28);
    ctx.font = `13px ${FONT_SANS}`;
    ctx.fillStyle = colorMuted;
    ctx.fillText("Government of India Accredited", centerBadgeX, badgeY + 48);
    ctx.font = `italic 13px ${FONT_SERIF}`;
    ctx.fillText("Verified Official Credential", centerBadgeX, badgeY + 68);

    // Right Column: Program Manager Signature
    const managerSig = this.getManagerSig();
    const mgrCenterX = width - 280;
    if (managerSig) {
      const sigImgW = 220;
      const sigImgH = 115;
      ctx.drawImage(managerSig, mgrCenterX - sigImgW / 2, sigRowY + 80, sigImgW, sigImgH);
    }

    // Program Manager Signature Line
    ctx.strokeStyle = colorRoyal;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(mgrCenterX - sigLineW / 2, sigRowY + 215);
    ctx.lineTo(mgrCenterX + sigLineW / 2, sigRowY + 215);
    ctx.stroke();

    ctx.font = `bold 22px ${FONT_SERIF}`;
    ctx.textAlign = "center";
    ctx.fillStyle = colorNavy;
    ctx.fillText("PROGRAM MANAGER", mgrCenterX, sigRowY + 242);
    ctx.font = `15px ${FONT_SANS}`;
    ctx.fillStyle = colorMuted;
    ctx.fillText("Academic & Talent Division", mgrCenterX, sigRowY + 264);

    // 11. Footer & Company Contact Information (Centre-Aligned)
    const footerDividerY = height - 120;
    ctx.strokeStyle = colorBorderLight;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(80, footerDividerY);
    ctx.lineTo(width - 80, footerDividerY);
    ctx.stroke();
    drawAccentDiamond(width / 2, footerDividerY, 4, colorRoyal);

    // Contact Information Line (Centre-Aligned)
    const contactY = footerDividerY + 34;
    ctx.font = `bold 18px ${FONT_SERIF}`;
    ctx.fillStyle = colorNavy;
    ctx.textAlign = "center";
    ctx.fillText(
      "Phone: +91 94439 38850     •     Website: www.tvktechs.com     •     Email: hr@tvktechs.com",
      width / 2,
      contactY,
    );

    // Official Corporate Identification Line (Centre-Aligned)
    ctx.font = `14px ${FONT_SANS}`;
    ctx.fillStyle = colorMuted;
    ctx.fillText(
      "TVK Technologies Edu Private Limited  •  Official Corporate Offer Letter & Internship Certificate  •  tvktechnologies.com",
      width / 2,
      contactY + 26,
    );

    return canvas;
  }

  generateOfferLetterJpeg(data: OfferLetterData): Buffer {
    const canvas = this.drawOfferLetterCanvas(data);
    return canvas.toBuffer("image/jpeg", 95);
  }

  generateOfferLetterPng(data: OfferLetterData): Buffer {
    const canvas = this.drawOfferLetterCanvas(data);
    return canvas.toBuffer("image/png");
  }

  /**
   * Generates a single-page PDF wrapping the exact un-editable high-resolution flattened image.
   * Matches the official standard A4 portrait format (595.28 x 841.89 pt).
   */
  generateOfferLetterPdf(data: OfferLetterData): Buffer {
    const jpegBuf = this.generateOfferLetterJpeg(data);
    const pdfWidth = 595.28;
    const pdfHeight = 841.89;

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
    const imgHeader = `4 0 obj\n<< /Type /XObject /Subtype /Image /Width 1240 /Height 1754 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBuf.length} >>\nstream\n`;
    write(imgHeader);
    write(jpegBuf);
    write("\nendstream\nendobj\n");

    // Object 5: Content stream placing the flattened image over the single page
    offsets.push(byteOffset);
    const contentStream = `q\n${pdfWidth} 0 0 ${pdfHeight} 0 0 cm\n/Im1 Do\nQ\n`;
    write(`5 0 obj\n<< /Length ${contentStream.length} >>\nstream\n${contentStream}endstream\nendobj\n`);

    // XRef table & Trailer
    const xrefOffset = byteOffset;
    write(`xref\n0 ${offsets.length + 1}\n0000000000 65535 f \n`);
    for (const off of offsets) {
      write(`${String(off).padStart(10, "0")} 00000 n \n`);
    }
    write(`trailer\n<< /Size ${offsets.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);

    return Buffer.concat(chunks);
  }
}

export const offerLetterPdfService = new OfferLetterPdfService();
