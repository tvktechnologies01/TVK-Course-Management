import { Injectable } from "@angular/core";
import * as pdfjsLib from "pdfjs-dist";

export interface ParsedResume {
  name: string;
  email: string;
  phone: string;
  experience: string;
  location: string;
  position: string;
  skills: string[];
  resumeName: string;
  extractedText: string;
}

type ProgressCallback = (
  progress: number,
  message?: string
) => void;

@Injectable({
  providedIn: "root",
})
export class ResumeParserService {
  private workerConfigured = false;

  async parseSpreadsheet(file: File): Promise<ParsedResume[]> {
    const xlsx = await import("@e965/xlsx");
    const workbook = xlsx.read(await file.arrayBuffer(), { type: "array", cellDates: false });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!firstSheet) throw new Error("The workbook does not contain a worksheet.");

    const rows = xlsx.utils.sheet_to_json<Record<string, unknown>>(firstSheet, {
      defval: "",
      raw: false,
    });
    const fieldForHeader: Record<string, keyof ParsedResume> = {
      name: "name", fullname: "name", candidatename: "name", applicantname: "name",
      phone: "phone", mobilenumber: "phone", mobile: "phone", contactnumber: "phone", phonenumber: "phone",
      email: "email", emailaddress: "email",
      position: "position", jobtitle: "position", role: "position", designation: "position",
      experience: "experience", yearsofexperience: "experience", totalexperience: "experience", exp: "experience",
      location: "location", city: "location", currentlocation: "location",
      skills: "skills", keyskills: "skills", technicalskills: "skills",
    };

    return rows.map((row) => {
      const record = this.emptySpreadsheetRecord(file.name);
      for (const [header, value] of Object.entries(row)) {
        const normalizedHeader = header.toLowerCase().replace(/[^a-z0-9]/g, "");
        const field = fieldForHeader[normalizedHeader];
        if (!field || value === null || value === undefined) continue;
        if (field === "skills") {
          record.skills = String(value).split(/[,;|]/).map((skill) => skill.trim()).filter(Boolean);
        } else if (field !== "resumeName" && field !== "extractedText") {
          record[field] = String(value).trim();
        }
      }
      return record;
    }).filter((record) =>
      Boolean(record.name || record.phone || record.email || record.position || record.experience || record.location || record.skills.length),
    );
  }

  private emptySpreadsheetRecord(resumeName: string): ParsedResume {
    return {
      name: "", phone: "", email: "", position: "", experience: "",
      location: "", skills: [], resumeName, extractedText: "",
    };
  }

  async parse(
    file: File,
    onProgress?: ProgressCallback
  ): Promise<ParsedResume> {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      throw new Error("Only PDF resumes are supported.");
    }

    this.updateProgress(
      onProgress,
      5,
      `Reading ${file.name}...`
    );

    try {
      const text = await this.extractPdfText(
        file,
        onProgress
      );

      if (!text.trim()) {
        throw new Error(
          "No readable text was found in this PDF. This may be a scanned or image-only PDF."
        );
      }

      this.updateProgress(
        onProgress,
        95,
        "Extracting candidate details..."
      );

      const parsed = this.extractFields(
        text,
        file.name
      );

      this.updateProgress(
        onProgress,
        100,
        "Resume processed successfully."
      );

      return parsed;
    } catch (error) {
      console.error(
        "Resume parsing failed:",
        file.name,
        error
      );

      throw error;
    }
  }

  private configureWorker(): void {
    if (this.workerConfigured) {
      return;
    }

    const workerPath = "/assets/pdfjs/pdf.worker.min.mjs";

    if (typeof window !== "undefined" && window.location?.origin) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = `${window.location.origin}${workerPath}`;
    } else {
      pdfjsLib.GlobalWorkerOptions.workerSrc = workerPath;
    }

    pdfjsLib.GlobalWorkerOptions.workerPort = null;
    this.workerConfigured = true;
  }

  private async extractPdfText(
    file: File,
    onProgress?: ProgressCallback
  ): Promise<string> {
    this.configureWorker();

    this.updateProgress(
      onProgress,
      10,
      `Opening ${file.name}...`
    );

    const buffer = await file.arrayBuffer();

    if (!buffer.byteLength) {
      throw new Error("The selected PDF is empty.");
    }

    this.updateProgress(
      onProgress,
      20,
      "Loading PDF..."
    );

    // Try loading in-memory worker handler if available
    try {
      if (typeof window !== "undefined" && !(window as any).pdfjsWorker) {
        // @ts-ignore
        await import("pdfjs-dist/build/pdf.worker.mjs");
      }
    } catch {}

    const docParams: any = {
      data: new Uint8Array(buffer),
      cMapUrl: "https://cdn.jsdelivr.net/npm/pdfjs-dist@6.3.289/cmaps/",
      cMapPacked: true,
      standardFontDataUrl: "https://cdn.jsdelivr.net/npm/pdfjs-dist@6.3.289/standard_fonts/",
    };

    const loadingTask = pdfjsLib.getDocument(docParams);

    let pdf;

    try {
      pdf = await this.withTimeout(
        loadingTask.promise,
        45000
      );
    } catch (error) {
      console.warn(
        "Primary PDF loading failed, trying fallback...",
        error
      );

      try {
        await loadingTask.destroy();
      } catch {}

      try {
        const fallbackTask = pdfjsLib.getDocument({
          data: new Uint8Array(buffer),
          cMapUrl: "https://cdn.jsdelivr.net/npm/pdfjs-dist@6.3.289/cmaps/",
          cMapPacked: true,
          standardFontDataUrl: "https://cdn.jsdelivr.net/npm/pdfjs-dist@6.3.289/standard_fonts/",
        });
        pdf = await this.withTimeout(
          fallbackTask.promise,
          30000
        );
      } catch (fallbackError) {
        console.error(
          "PDF loading error:",
          fallbackError
        );

        throw new Error(
          "Unable to read this PDF. The file may be corrupted, password protected, or unsupported."
        );
      }
    }

    this.updateProgress(
      onProgress,
      30,
      `PDF loaded. ${pdf.numPages} page(s) found.`
    );

    let text = "";

    for (
      let pageNumber = 1;
      pageNumber <= pdf.numPages;
      pageNumber++
    ) {
      const progress = this.calculatePageProgress(
        pageNumber,
        pdf.numPages
      );

      this.updateProgress(
        onProgress,
        progress,
        `Reading page ${pageNumber} of ${pdf.numPages}...`
      );

      const page = await pdf.getPage(
        pageNumber
      );

      const content =
        await page.getTextContent();

      const rawItems = (content.items as any[]).filter(
        item => typeof item?.str === "string" && item.str.trim().length > 0
      );

      // Sort items top-to-bottom (Y descending), left-to-right (X ascending)
      const sortedItems = [...rawItems].sort((a, b) => {
        const yA = Array.isArray(a.transform) ? a.transform[5] : 0;
        const yB = Array.isArray(b.transform) ? b.transform[5] : 0;
        const xA = Array.isArray(a.transform) ? a.transform[4] : 0;
        const xB = Array.isArray(b.transform) ? b.transform[4] : 0;

        if (Math.abs(yA - yB) > 3.5) {
          return yB - yA;
        }
        return xA - xB;
      });

      let pageText = "";
      let lastY: number | null = null;

      for (const item of sortedItems) {
        const y = Array.isArray(item.transform) ? item.transform[5] : null;
        const str = item.str.trim();
        if (!str) continue;

        if (lastY === null) {
          pageText += str;
          lastY = y;
        } else if (y !== null && Math.abs(y - lastY) > 3.5) {
          pageText += "\n" + str;
          lastY = y;
        } else if (item.hasEOL) {
          pageText += "\n" + str;
          lastY = y;
        } else {
          if (!pageText.endsWith(" ") && !pageText.endsWith("\n")) {
            pageText += " ";
          }
          pageText += str;
          lastY = y;
        }
      }

      text += `${pageText}\n`;
    }

    this.updateProgress(
      onProgress,
      90,
      "PDF text extracted."
    );

    return text.trim();
  }

  private calculatePageProgress(
    currentPage: number,
    totalPages: number
  ): number {
    if (totalPages <= 0) {
      return 30;
    }

    return Math.round(
      30 +
        (currentPage / totalPages) * 60
    );
  }

  private async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    let timeoutId:
      ReturnType<typeof setTimeout>;

    const timeoutPromise =
      new Promise<never>(
        (_, reject) => {
          timeoutId = setTimeout(() => {
            reject(
              new Error(
                `PDF processing timed out after ${
                  timeoutMs / 1000
                } seconds.`
              )
            );
          }, timeoutMs);
        }
      );

    try {
      return await Promise.race([
        promise,
        timeoutPromise,
      ]);
    } finally {
      clearTimeout(timeoutId!);
    }
  }

  private updateProgress(
    onProgress: ProgressCallback | undefined,
    progress: number,
    message?: string
  ): void {
    const safeProgress = Math.min(
      100,
      Math.max(0, progress)
    );

    onProgress?.(
      safeProgress,
      message
    );
  }

  private extractFields(
    text: string,
    fileName: string
  ): ParsedResume {
    const normalized = text
      .replace(/\s+/g, " ")
      .trim();

    const email = this.extractEmail(normalized);

    return {
      name: this.extractName(
        text,
        fileName,
        email
      ),
      email,
      phone: this.extractPhone(
        normalized
      ),
      experience:
        this.extractExperience(
          normalized
        ),
      location:
        this.extractLocation(
          normalized
        ),
      position:
        this.extractPosition(
          normalized
        ),
      skills:
        this.extractSkills(
          normalized
        ),
      resumeName: fileName,
      extractedText: text,
    };
  }

  private extractEmail(
    text: string
  ): string {
    const labelMatch = text.match(/(?:email|e-mail|mail)(?:\s*(?:id|address)?)?[:\s-]+([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i);
    if (labelMatch?.[1]) {
      return labelMatch[1].trim();
    }
    const match = text.match(
      /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i
    );

    return match?.[0] ?? "";
  }

  private extractPhone(
    text: string
  ): string {
    // 1. Look for labeled phone/mobile/contact numbers
    const labelMatch = text.match(/(?:phone|mobile|mob|contact|cell|tel|whatsapp)(?:\s*(?:no|num|number)?)?[:\s-]+([+\d\s().-]{7,25})/i);
    if (labelMatch?.[1]) {
      const cleaned = labelMatch[1].replace(/[^\d+]/g, "").trim();
      const digitsOnly = cleaned.replace(/\D/g, "");
      if (digitsOnly.length >= 10 && digitsOnly.length <= 13) {
        return cleaned;
      }
    }

    // 2. Look for Indian numbers with spaces or dashes (+91 98401 23456, 98401 23456, etc.)
    const indianMatches = text.match(/(?:(?:\+|0{0,2})91[\s.-]*)?[6-9]\d{2,4}[\s.-]*\d{3,4}[\s.-]*\d{2,4}/g);
    if (indianMatches?.length) {
      for (const m of indianMatches) {
        const cleaned = m.replace(/[^\d+]/g, "").trim();
        const digits = cleaned.replace(/\D/g, "");
        if (digits.length === 10 || (digits.length === 12 && digits.startsWith("91"))) {
          return cleaned;
        }
      }
    }

    // 3. Fallback: Any 10-consecutive-digit pattern
    const plainMatches = text.match(/(?:\+91[\s-]?)?[6-9]\d{9}/g);
    if (plainMatches?.length) {
      return plainMatches[0].replace(/[^\d+]/g, "").trim();
    }

    // 4. International format: e.g. +1 (555) 123-4567 or (555) 123-4567
    const intlMatches = text.match(/(?:\+\d{1,3}[\s.-]*)?\(?\d{3}\)?[\s.-]*\d{3}[\s.-]*\d{4}/g);
    if (intlMatches?.length) {
      return intlMatches[0].replace(/[^\d+]/g, "").trim();
    }

    return "";
  }

  private extractName(
    text: string,
    fileName: string,
    email?: string
  ): string {
    // 1. Explicit labeled name: e.g. "Name: John Doe", "Candidate Name: Priya Sharma"
    const labelMatch = text.match(/(?:^|\n|\b)(?:candidate\s*name|full\s*name|applicant\s*name|name)\s*[:\-]\s*([a-zA-Z\s.'-]{2,50})/i);
    if (labelMatch?.[1]) {
      const candidate = this.cleanCandidateName(labelMatch[1]);
      if (this.isValidPersonName(candidate)) {
        return candidate;
      }
    }

    // 2. Scan top lines of the resume
    const lines = text
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean);

    const nonNameHeaders = new Set([
      "resume", "curriculum vitae", "cv", "biodata", "profile",
      "summary", "objective", "career objective", "professional summary",
      "personal profile", "profile summary", "personal details",
      "personal information", "contact", "contact details", "contact info",
      "education", "work experience", "experience", "skills", "technical skills",
      "projects", "academic profile", "declaration", "about me"
    ]);

    // Check the first 12 lines
    for (const rawLine of lines.slice(0, 12)) {
      const lower = rawLine.toLowerCase().trim();
      const lowerClean = lower.replace(/[^a-z ]/g, "").trim();

      // Skip lines that are just section titles or page markers
      if (nonNameHeaders.has(lowerClean) || lowerClean.startsWith("page ") || lower.includes("page 1")) {
        continue;
      }

      // If the line has separators like "|", "-", "—", "•", "·", "//", test the first part
      // e.g. "Sujith S | Full Stack Developer" -> "Sujith S"
      // e.g. "John Doe - Software Engineer" -> "John Doe"
      const segments = rawLine.split(/[|•·\/\-–—]\s*/);
      for (const segment of segments) {
        const candidate = this.cleanCandidateName(segment);
        if (this.isValidPersonName(candidate)) {
          return candidate;
        }
      }

      // Also try cleaning the entire line directly
      const fullCandidate = this.cleanCandidateName(rawLine);
      if (this.isValidPersonName(fullCandidate)) {
        return fullCandidate;
      }
    }

    // 3. Fallback: match against email username if available
    if (email) {
      const emailName = this.extractNameFromEmail(email);
      if (emailName && this.isValidPersonName(emailName)) {
        // Look if the email name appears in the top lines of the resume
        for (const rawLine of lines.slice(0, 15)) {
          const cleaned = this.cleanCandidateName(rawLine);
          if (this.isValidPersonName(cleaned)) {
            const emailParts = emailName.toLowerCase().split(/\s+/);
            const lineLower = cleaned.toLowerCase();
            if (emailParts.some(p => p.length > 2 && lineLower.includes(p))) {
              return cleaned;
            }
          }
        }
        return emailName;
      }
    }

    // 4. Fallback: clean the filename intelligently (strip "Resume", "CV", dates, roles)
    const cleanedFile = this.cleanFilename(fileName);
    if (cleanedFile && this.isValidPersonName(cleanedFile)) {
      return cleanedFile;
    }

    // 5. If everything fails, return empty string so CRM doesn't label the candidate "Resume" or "CV"
    return "";
  }

  private cleanCandidateName(raw: string): string {
    let name = raw.trim();

    // Strip common honorifics: Mr., Mrs., Ms., Dr., Prof.
    name = name.replace(/^(?:mr\.|mrs\.|ms\.|dr\.|prof\.)\s+/i, "");

    // Strip parentheses e.g. "John Doe (Developer)" or "(Fresher)"
    name = name.replace(/\([^)]*\)/g, " ");

    // Strip inline email or url if present
    name = name.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, " ");
    name = name.replace(/https?:\/\/\S+/gi, " ");

    // Strip inline phone numbers or digits
    name = name.replace(/\+?\d[\d\s().-]{7,}/g, " ");

    // Remove any trailing job titles or section labels: e.g. "John Doe - Software Developer"
    name = name.replace(/\b(?:software|developer|engineer|full\s*stack|frontend|backend|web|designer|architect|analyst|intern|fresher|lead|manager|consultant)\b.*$/i, "");

    // Keep only letters, periods, hyphens, and apostrophes
    name = name.replace(/[^a-zA-Z .'-]/g, " ").replace(/\s+/g, " ").trim();

    // Remove trailing/leading periods or hyphens
    name = name.replace(/^[-.']+|[-.']+$/g, "").trim();

    // If all uppercase (e.g. "SUJITH KUMAR S") or all lowercase ("sujith kumar"), convert to Title Case
    if (name.length > 0 && (name === name.toUpperCase() || name === name.toLowerCase())) {
      name = this.toTitleCase(name);
    }

    return name;
  }

  private isValidPersonName(name: string): boolean {
    if (!name || name.length < 2 || name.length > 45) {
      return false;
    }

    const words = name.split(/\s+/).filter(Boolean);
    if (words.length < 1 || words.length > 5) {
      return false;
    }

    for (const word of words) {
      const alphaOnly = word.replace(/[^a-zA-Z]/g, "");
      if (alphaOnly.length === 0) return false;
      if (alphaOnly.length > 25) return false;
    }

    const lower = name.toLowerCase();
    const disallowedKeywords = [
      "resume", "curriculum vitae", "curriculum", "vitae", "cv", "biodata",
      "profile", "summary", "objective", "experience", "education", "skills",
      "contact", "phone", "email", "address", "developer", "engineer",
      "designer", "analyst", "manager", "intern", "fresher", "software",
      "frontend", "backend", "fullstack", "full stack", "technical",
      "technologies", "university", "college", "school", "bachelor",
      "master", "btech", "mtech", "bca", "mca", "chennai", "bangalore",
      "hyderabad", "mumbai", "delhi", "pune", "india", "page", "declaration",
      "project", "projects", "certifications", "work", "job", "career",
      "details", "information", "mobile", "linkedin", "github", "portfolio"
    ];

    if (disallowedKeywords.some(keyword => {
      const regex = new RegExp(`\\b${keyword}\\b`, "i");
      return regex.test(lower);
    })) {
      return false;
    }

    return true;
  }

  private extractNameFromEmail(email: string): string {
    const localPart = email.split("@")[0] || "";
    const cleaned = localPart
      .replace(/\d+$/g, "")
      .replace(/[._-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (cleaned.length >= 2 && cleaned.length <= 40) {
      const words = cleaned.split(/\s+/).filter(w => w.length > 1);
      if (words.length >= 1 && words.length <= 4) {
        return this.toTitleCase(cleaned);
      }
    }
    return "";
  }

  private cleanFilename(fileName: string): string {
    let name = fileName.replace(/\.[^/.]+$/, "");

    const noiseWords = [
      "resume", "curriculum vitae", "cv", "biodata", "profile",
      "updated", "latest", "final", "new", "v1", "v2", "v3",
      "draft", "copy", "doc", "document", "developer", "engineer",
      "frontend", "backend", "fullstack", "full stack", "software"
    ];

    for (const noise of noiseWords) {
      name = name.replace(new RegExp(`\\b${noise}\\b`, "gi"), " ");
    }

    name = name.replace(/\b20[12]\d\b/g, " ");
    name = name.replace(/[^a-zA-Z .'-]/g, " ").replace(/\s+/g, " ").trim();

    if (name.length > 0 && (name === name.toUpperCase() || name === name.toLowerCase())) {
      name = this.toTitleCase(name);
    }

    return name;
  }

  private toTitleCase(str: string): string {
    return str
      .split(/\s+/)
      .map(w => {
        if (w.length <= 1) return w.toUpperCase();
        return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
      })
      .join(" ");
  }

  private extractExperience(
    text: string
  ): string {
    const match = text.match(
      /(\d+(?:\.\d+)?)\s*\+?\s*(years?|yrs?)(?:\s+of\s+experience)?/i
    );

    return match
      ? `${match[1]} Years`
      : "";
  }

  private extractLocation(
    text: string
  ): string {
    const cities = [
      "Chennai",
      "Vellore",
      "Bangalore",
      "Bengaluru",
      "Hyderabad",
      "Coimbatore",
      "Pune",
      "Mumbai",
      "Delhi",
      "Noida",
      "Gurgaon",
      "Gurugram",
      "Kolkata",
      "Madurai",
      "Salem",
      "Trichy",
      "Tiruchirappalli",
    ];

    for (const city of cities) {
      const regex = new RegExp(
        `\\b${this.escapeRegex(city)}\\b`,
        "i"
      );

      if (regex.test(text)) {
        return city;
      }
    }

    return "";
  }

  private extractPosition(
    text: string
  ): string {
    const positions = [
      "Java Developer",
      "Python Developer",
      "Angular Developer",
      "React Developer",
      "Frontend Developer",
      "Backend Developer",
      "Full Stack Developer",
      "Software Developer",
      "Software Engineer",
      "Node.js Developer",
      "Technical Support Engineer",
      "Support Engineer",
      "Web Developer",
    ];

    const lowerText =
      text.toLowerCase();

    return (
      positions.find(position =>
        lowerText.includes(
          position.toLowerCase()
        )
      ) ?? ""
    );
  }

  private extractSkills(
    text: string
  ): string[] {
    const skills = [
      "Spring Boot",
      "React Native",
      "Tailwind CSS",
      "JavaScript",
      "TypeScript",
      "Node.js",
      "Express.js",
      "Next.js",
      "REST API",
      "GraphQL",
      "Bootstrap",
      "Angular",
      "React",
      "Java",
      "Spring",
      "HTML",
      "CSS",
      "Python",
      "Django",
      "Flask",
      "MySQL",
      "MongoDB",
      "PostgreSQL",
      "AWS",
      "Azure",
      "Docker",
      "GitHub",
      "Git",
      "Firebase",
      "Vue.js",
      "C++",
      "C#",
      "C",
    ];

    return skills.filter(skill => {
      const regex = new RegExp(
        `\\b${this.escapeRegex(skill)}\\b`,
        "i"
      );

      return regex.test(text);
    });
  }

  private escapeRegex(
    value: string
  ): string {
    return value.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&"
    );
  }
}