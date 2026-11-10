import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Candidate, CandidateSource } from '../../../core/models/candidate.model';
import { CandidateService } from '../../../core/services/candidate.service';
import {
  ParsedResume,
  ResumeParserService
} from '../../../core/services/resume-parser.service';
import { ResumeStorageService } from '../../../core/services/resume-storage.service';

type ReviewMode = 'AUTO' | 'MANUAL' | 'NEEDS_REVIEW';
type ImportStatus = 'READY' | 'IMPORTED' | 'DUPLICATE' | 'FAILED';

interface ReviewResume extends ParsedResume {
  file?: File;
  source: CandidateSource;
  mode: ReviewMode;
  importStatus: ImportStatus;
  errorMessage?: string;
}

function generateCandidateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return `CAN-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    } catch {}
  }
  const randomPart = Math.random().toString(36).substring(2, 10);
  return `CAN-${Date.now()}-${randomPart}`;
}

@Component({
  selector: 'app-resume-import',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './resume-import.html',
  styleUrl: './resume-import.css'
})
export class ResumeImportComponent {
  files: File[] = [];
  resumes: ReviewResume[] = [];

  manualOpen = false;
  manual: ReviewResume = this.createEmptyManual();
  manualFile: File | null = null;

  processing = false;
  importing = false;

  progress = 0;
  currentFileIndex = 0;

  error = '';
  message = '';

  importedCount = 0;
  reviewCount = 0;
  duplicateCount = 0;
  failedCount = 0;

  constructor(
    private parser: ResumeParserService,
    private candidates: CandidateService,
    private resumeStorage: ResumeStorageService,
    private cdr: ChangeDetectorRef
  ) {}

  selectFiles(event: Event): void {
    const input = event.target as HTMLInputElement;

    if (!input.files?.length) {
      return;
    }

    this.setFiles(Array.from(input.files));
    input.value = '';
  }

  private setFiles(selectedFiles: File[]): void {
    const pdfFiles = selectedFiles.filter(
      file =>
        file.type === 'application/pdf' ||
        file.name.toLowerCase().endsWith('.pdf')
    );

    this.files = pdfFiles;
    this.resumes = [];

    this.progress = 0;
    this.currentFileIndex = 0;

    this.importedCount = 0;
    this.reviewCount = 0;
    this.duplicateCount = 0;
    this.failedCount = 0;

    this.error = '';

    if (!pdfFiles.length) {
      this.message = 'Please select PDF resumes.';
      this.cdr.detectChanges();
      return;
    }

    this.message =
      `${pdfFiles.length} PDF resume${pdfFiles.length === 1 ? '' : 's'} selected. Extraction will start automatically.`;

    this.cdr.detectChanges();
    void this.autoExtract();
  }

  async autoExtract(): Promise<void> {
    if (
      !this.files.length ||
      this.processing ||
      this.importing
    ) {
      return;
    }

    this.processing = true;
    this.progress = 0;
    this.currentFileIndex = 0;

    this.error = '';
    this.message = 'Starting resume processing...';

    this.resumes = [];

    this.importedCount = 0;
    this.reviewCount = 0;
    this.duplicateCount = 0;
    this.failedCount = 0;

    this.cdr.detectChanges();

    try {
      const candidatesLoaded = this.candidates.loadFromBackend(true);
      for (
        let index = 0;
        index < this.files.length;
        index++
      ) {
        const file = this.files[index];

        this.currentFileIndex = index;

        const startProgress =
          (index / this.files.length) * 100;

        const fileProgressRange =
          100 / this.files.length;

        this.message =
          `Reading ${file.name}...`;

        this.progress =
          Math.round(startProgress);

        this.cdr.detectChanges();

        try {
          const parsed = await this.parser.parse(
            file,
            (parserProgress, parserMessage) => {
              const overallProgress =
                startProgress +
                (parserProgress / 100) *
                  fileProgressRange;

              this.progress = Math.min(
                99,
                Math.round(overallProgress)
              );

              this.message =
                parserMessage ||
                `Reading ${file.name}...`;

              this.cdr.detectChanges();
            }
          );

          const duplicateName =
            this.findDuplicateResume(parsed);

          if (duplicateName) {
            this.resumes.push({
              ...parsed,
              file,
              source: 'IR_RESUME',
              mode: 'NEEDS_REVIEW',
              importStatus: 'DUPLICATE',
              errorMessage:
                `Duplicate candidate found: ${duplicateName}`
            });

            this.duplicateCount++;
          } else if (
            this.hasRequiredDetails(parsed)
          ) {
            this.resumes.push({
              ...parsed,
              file,
              source: 'IR_RESUME',
              mode: 'AUTO',
              importStatus: 'READY'
            });
          } else {
            this.resumes.push({
              ...parsed,
              file,
              source: 'IR_RESUME',
              mode: 'NEEDS_REVIEW',
              importStatus: 'READY',
              errorMessage:
                parsed.name
                  ? 'Candidate name detected. Phone or email is recommended.'
                  : 'Candidate name not found in resume. Please enter candidate name.'
            });

            this.reviewCount++;
          }
        } catch (error) {
          console.error(
            'Resume parsing failed:',
            file.name,
            error
          );

          let defaultName = file.name
            .replace(/\.[^/.]+$/, '')
            .replace(/\b(resume|cv|biodata|profile|updated|latest|20[12]\d)\b/gi, '')
            .replace(/[_-]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

          this.resumes.push({
            ...this.createEmptyParsed(file.name),
            name: defaultName,
            file,
            source: 'IR_RESUME',
            mode: 'NEEDS_REVIEW',
            importStatus: 'READY',
            errorMessage:
              defaultName
                ? 'Automatic text reading incomplete. Suggested name from file; please verify.'
                : 'Automatic text reading incomplete. Please enter candidate name, phone and email.'
          });

          this.reviewCount++;
        }

        this.progress =
          Math.round(
            ((index + 1) / this.files.length) * 100
          );

        this.message =
          `${file.name} processed.`;

        this.cdr.detectChanges();

        await this.waitForUiUpdate();
      }

      await candidatesLoaded;
      this.recheckResumeDuplicates();

      this.progress = 100;

      this.message =
        'Resume extraction completed. Saving unique candidates...';

      this.cdr.detectChanges();
      this.processing = false;
      await this.importCandidates();
    } catch (error) {
      console.error(
        'Resume extraction error:',
        error
      );

      this.error =
        'Something went wrong while processing the resumes.';

      this.message =
        'Resume processing failed.';

      this.cdr.detectChanges();
    } finally {
      this.processing = false;

      this.cdr.detectChanges();
    }
  }

  private recheckResumeDuplicates(): void {
    const seen: ReviewResume[] = [];
    for (const resume of this.resumes) {
      if (resume.importStatus === 'FAILED') continue;
      const duplicateName = this.findDuplicateResume(resume, seen);
      if (duplicateName) {
        resume.importStatus = 'DUPLICATE';
        resume.mode = 'NEEDS_REVIEW';
        resume.errorMessage = `Duplicate candidate found: ${duplicateName}`;
      } else if (resume.importStatus !== 'DUPLICATE') {
        seen.push(resume);
      }
    }
    this.duplicateCount = this.resumes.filter((resume) => resume.importStatus === 'DUPLICATE').length;
  }

  async importExcel(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []).filter((file) => /\.xlsx?$/i.test(file.name));
    input.value = '';
    if (!files.length || this.processing || this.importing) return;

    this.processing = true;
    this.error = '';
    this.message = 'Reading Excel workbook...';
    this.cdr.detectChanges();
    try {
      await this.candidates.loadFromBackend(true);
      const batch: Candidate[] = [];
      const rowsToShow: ReviewResume[] = [];
      for (const file of files) {
        const rows = await this.parser.parseSpreadsheet(file);
        for (const row of rows) {
          const duplicate = this.candidates.findDuplicate(
            row.email,
            row.phone,
            [...this.candidates.getAll(), ...batch],
          );
          const displayRow: ReviewResume = {
            ...row,
            source: 'EXCEL_IMPORT',
            mode: duplicate ? 'NEEDS_REVIEW' : 'AUTO',
            importStatus: duplicate ? 'DUPLICATE' : 'READY',
            errorMessage: duplicate ? `Duplicate candidate found: ${duplicate.name}` : undefined,
          };
          rowsToShow.push(displayRow);
          if (duplicate) {
            this.duplicateCount++;
            continue;
          }

          const now = new Date().toISOString();
          batch.push({
            id: generateCandidateId(),
            name: row.name, phone: row.phone, email: row.email,
            position: row.position, experience: row.experience, location: row.location,
            skills: row.skills, source: 'EXCEL_IMPORT', resumeName: '',
            status: 'NEW', assignedToId: null, assignedToName: null,
            appliedDate: now, lastContactedAt: null, nextFollowUpAt: null,
            notes: '', createdAt: now, updatedAt: now,
          });
        }
      }

      const saved = await this.candidates.addMany(batch);
      const savedRows = new Set(saved.map((candidate) => `${candidate.name}|${candidate.email}|${candidate.phone}`));
      for (const row of rowsToShow) {
        if (row.importStatus !== 'READY') continue;
        if (savedRows.has(`${row.name}|${row.email}|${row.phone}`)) {
          row.importStatus = 'IMPORTED';
        } else {
          row.importStatus = 'DUPLICATE';
          row.mode = 'NEEDS_REVIEW';
          row.errorMessage = 'A matching candidate was saved by another import.';
          this.duplicateCount++;
        }
      }
      this.resumes = [...rowsToShow, ...this.resumes];
      this.importedCount += saved.length;
      this.message = rowsToShow.length
        ? `${saved.length} Excel candidate${saved.length === 1 ? '' : 's'} saved. Duplicate rows are shown below.`
        : 'No candidate rows were found in the selected workbook.';
    } catch (error) {
      console.error('Excel import failed:', error);
      this.error = error instanceof Error ? error.message : 'The workbook could not be imported.';
    } finally {
      this.processing = false;
      this.progress = 100;
      this.cdr.detectChanges();
    }
  }

  private findDuplicateResume(
    resume: ParsedResume,
    currentBatch: ReviewResume[] = this.resumes,
  ): string | undefined {
    const existingDuplicate =
      this.candidates.findDuplicate(
        resume.email,
        resume.phone
      );

    if (existingDuplicate) {
      return existingDuplicate.name;
    }

    const currentDuplicate =
      currentBatch.find(existing => {
        if (
          existing.importStatus === 'DUPLICATE' ||
          existing.importStatus === 'FAILED'
        ) {
          return false;
        }

        const resumeEmail =
          resume.email.trim().toLowerCase();

        const existingEmail =
          existing.email.trim().toLowerCase();

        const resumePhone =
          this.normalizePhone(resume.phone);

        const existingPhone =
          this.normalizePhone(existing.phone);

        const emailMatch =
          Boolean(
            resumeEmail &&
            existingEmail &&
            resumeEmail === existingEmail
          );

        const phoneMatch =
          Boolean(
            resumePhone &&
            existingPhone &&
            resumePhone === existingPhone
          );

        return emailMatch || phoneMatch;
      });

    return currentDuplicate?.name;
  }

  private normalizePhone(
    phone: string
  ): string {
    return phone
      .replace(/\D/g, '')
      .slice(-10);
  }

  private waitForUiUpdate(): Promise<void> {
    return new Promise(resolve => {
      setTimeout(resolve, 0);
    });
  }

  openManual(): void {
    if (
      this.processing ||
      this.importing
    ) {
      return;
    }

    this.error = '';
    this.message = '';

    this.manual =
      this.createEmptyManual();

    this.manualFile = null;
    this.manualOpen = true;

    this.cdr.detectChanges();
  }

  closeManual(): void {
    this.manualOpen = false;
    this.manualFile = null;
    this.error = '';

    this.cdr.detectChanges();
  }

  selectManualFile(event: Event): void {
    const input =
      event.target as HTMLInputElement;

    this.manualFile =
      input.files?.[0] ?? null;

    if (!this.manualFile) {
      return;
    }

    const isPdf =
      this.manualFile.type ===
        'application/pdf' ||
      this.manualFile.name
        .toLowerCase()
        .endsWith('.pdf');

    if (!isPdf) {
      this.manualFile = null;

      this.error =
        'Please select a PDF resume.';

      return;
    }

    this.error = '';

    this.manual.resumeName =
      this.manualFile.name;

    this.cdr.detectChanges();
  }

  updateSkills(
    resume: ReviewResume,
    value: string
  ): void {
    resume.skills = value
      .split(',')
      .map(skill => skill.trim())
      .filter(Boolean);
  }

  onCandidateFieldChange(resume: ReviewResume): void {
    if (resume.importStatus === 'DUPLICATE') return;

    if (resume.name.trim()) {
      resume.importStatus = 'READY';
      if (this.hasRequiredDetails(resume)) {
        resume.errorMessage = undefined;
      } else {
        resume.errorMessage = 'Phone or email recommended for contact.';
      }
    } else {
      resume.errorMessage = 'Candidate name is required.';
    }
    this.cdr.detectChanges();
  }

  async addManual(): Promise<void> {
    if (
      this.processing ||
      this.importing
    ) {
      return;
    }

    this.error = '';

    await this.candidates.loadFromBackend(true);

    if (!this.manualFile) {
      this.error =
        'Please choose the candidate resume PDF.';

      return;
    }

    if (!this.manual.name.trim()) {
      this.error =
        'Candidate name is required.';

      return;
    }

    if (!this.manual.phone.trim() && !this.manual.email.trim()) {
      this.error =
        'Candidate phone number or email is required.';

      return;
    }

    const existingDuplicate =
      this.candidates.findDuplicate(
        this.manual.email,
        this.manual.phone
      );

    if (existingDuplicate) {
      this.error =
        `A candidate already exists with this email or phone: ${existingDuplicate.name}`;

      return;
    }

    const batchDuplicate =
      this.findDuplicateResume(
        this.manual
      );

    if (batchDuplicate) {
      this.error =
        `This candidate already exists in the current import list: ${batchDuplicate}`;

      return;
    }

    const manualCandidate: ReviewResume = {
      ...this.manual,
      file: this.manualFile,
      source: 'IR_RESUME',
      mode: 'MANUAL',
      importStatus: 'READY',
      skills: [...this.manual.skills]
    };

    this.resumes = [
      manualCandidate,
      ...this.resumes
    ];

    this.closeManual();

    this.message = 'Saving candidate and resume...';

    this.cdr.detectChanges();
    void this.importCandidates();
  }

  remove(index: number): void {
    if (
      this.processing ||
      this.importing
    ) {
      return;
    }

    const removed =
      this.resumes[index];

    if (removed) {
      if (
        removed.importStatus === 'DUPLICATE'
      ) {
        this.duplicateCount =
          Math.max(
            0,
            this.duplicateCount - 1
          );
      }

      if (
        removed.importStatus === 'FAILED'
      ) {
        this.failedCount =
          Math.max(
            0,
            this.failedCount - 1
          );
      }

      if (
        removed.mode === 'NEEDS_REVIEW' &&
        removed.importStatus === 'READY'
      ) {
        this.reviewCount =
          Math.max(
            0,
            this.reviewCount - 1
          );
      }
    }

    this.resumes =
      this.resumes.filter(
        (_, itemIndex) =>
          itemIndex !== index
      );

    if (!this.resumes.length) {
      this.message =
        'No candidates are currently ready for import.';
    }

    this.cdr.detectChanges();
  }

  async importCandidates(): Promise<void> {
    if (
      !this.resumes.length ||
      this.processing ||
      this.importing
    ) {
      return;
    }

    const importable =
      this.resumes.filter(
        resume =>
          resume.importStatus === 'READY' &&
          Boolean(resume.name.trim())
      );

    if (!importable.length) {
      this.error =
        'There are no valid candidates ready for import. Review the highlighted resumes first.';

      return;
    }

    this.importing = true;
    this.error = '';
    this.message =
      'Saving candidates...';

    this.cdr.detectChanges();

    try {
      const newCandidates: Candidate[] = [];

      for (const item of importable) {
        const duplicate =
          this.candidates.findDuplicate(
            item.email,
            item.phone
          );

        if (duplicate) {
          item.importStatus =
            'DUPLICATE';

          item.mode =
            'NEEDS_REVIEW';

          item.errorMessage =
            `Duplicate candidate: ${duplicate.name}`;

          this.duplicateCount++;

          continue;
        }

        const duplicateInBatch =
          newCandidates.find(candidate => {
            const emailMatch =
              Boolean(
                item.email.trim() &&
                candidate.email.trim() &&
                item.email
                  .trim()
                  .toLowerCase() ===
                  candidate.email
                    .trim()
                    .toLowerCase()
              );

            const phoneMatch =
              Boolean(
                this.normalizePhone(item.phone) &&
                this.normalizePhone(candidate.phone) &&
                this.normalizePhone(item.phone) ===
                  this.normalizePhone(candidate.phone)
              );

            return emailMatch || phoneMatch;
          });

        if (duplicateInBatch) {
          item.importStatus =
            'DUPLICATE';

          item.mode =
            'NEEDS_REVIEW';

          item.errorMessage =
            `Duplicate candidate in this import: ${duplicateInBatch.name}`;

          this.duplicateCount++;

          continue;
        }

        let resumeFileId: string | undefined;
        if (item.file && item.source !== 'EXCEL_IMPORT') {
          try {
            resumeFileId = await this.resumeStorage.save(item.file);
          } catch (uploadErr) {
            console.warn('Failed to upload resume file to storage, proceeding with candidate save:', uploadErr);
          }
        }

        const now =
          new Date().toISOString();

        const candidate: Candidate = {
          id: generateCandidateId(),
          name:
            item.name.trim(),
          phone:
            item.phone.trim(),
          email:
            item.email.trim(),
          position:
            item.position.trim(),
          experience:
            item.experience.trim(),
          location:
            item.location.trim(),
          skills:
            [...item.skills],
          source: item.source,
          resumeName:
            item.resumeName,
          resumeFileId,
          status:
            'NEW',
          assignedToId:
            null,
          assignedToName:
            null,
          appliedDate:
            now,
          lastContactedAt:
            null,
          nextFollowUpAt:
            null,
          notes:
            '',
          createdAt:
            now,
          updatedAt:
            now
        };

        newCandidates.push(candidate);
      }

      const savedCandidates = newCandidates.length
        ? await this.candidates.addMany(newCandidates)
        : [];

      for (const candidate of savedCandidates) {
        const resume =
          this.resumes.find(
            item =>
              item.name.trim() ===
                candidate.name.trim() &&
              item.email.trim().toLowerCase() === candidate.email.trim().toLowerCase() &&
              this.normalizePhone(item.phone) === this.normalizePhone(candidate.phone)
          );

        if (resume) {
          resume.importStatus =
            'IMPORTED';

          resume.mode =
            'AUTO';
        }
      }

      this.importedCount +=
        savedCandidates.length;

      this.message =
        `${savedCandidates.length} candidate${savedCandidates.length === 1 ? '' : 's'} imported successfully.`;

      this.cdr.detectChanges();

      await this.waitForUiUpdate();

    } catch (error) {
      console.error(
        'Candidate import failed:',
        error
      );

      this.error = error instanceof Error
        ? error.message
        : 'Candidates could not be imported. Please try again.';

      this.message =
        'Candidate import failed.';

      this.cdr.detectChanges();
    } finally {
      this.importing = false;

      this.cdr.detectChanges();
    }
  }

  get readyCount(): number {
    return this.resumes.filter(
      resume =>
        resume.importStatus === 'READY' &&
        Boolean(resume.name.trim())
    ).length;
  }

  get totalProcessed(): number {
    return this.resumes.length;
  }

  get currentFileName(): string {
    return (
      this.files[
        this.currentFileIndex
      ]?.name || ''
    );
  }

  private hasRequiredDetails(
    resume: ParsedResume
  ): boolean {
    return Boolean(
      resume.name.trim() &&
      (resume.phone.trim() || resume.email.trim())
    );
  }

  private createEmptyParsed(
    resumeName = ''
  ): ParsedResume {
    return {
      name: '',
      email: '',
      phone: '',
      experience: '',
      location: '',
      position: '',
      skills: [],
      resumeName,
      extractedText: ''
    };
  }

  private createEmptyManual(): ReviewResume {
    return {
      ...this.createEmptyParsed(),
      source: 'IR_RESUME',
      mode: 'MANUAL',
      importStatus: 'READY'
    };
  }
}