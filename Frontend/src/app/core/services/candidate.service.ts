import { Injectable } from "@angular/core";
import { BehaviorSubject, firstValueFrom, Observable, tap } from "rxjs";

import {
  Candidate,
  CandidateCorrectionNotification,
  CandidateStatus,
  PaymentRecord,
} from "../models/candidate.model";
import { ApiPage, ApiService } from "./api.service";

@Injectable({
  providedIn: "root",
})
export class CandidateService {
  private readonly subject = new BehaviorSubject<Candidate[]>([]);

  readonly candidates$ = this.subject.asObservable();

  private loaded = false;
  private loadingPromise?: Promise<Candidate[]>;
  private cacheOwner = "anonymous";
  private lastFetchTime = 0;
  private autoRefreshTimer: any = null;
  private broadcastChannel?: BroadcastChannel;

  constructor(
    private readonly api: ApiService,
  ) {
    this.initCrossTabSync();
    this.startGlobalAutoRefresh();
  }

  private initCrossTabSync(): void {
    if (typeof window !== "undefined") {
      if ("BroadcastChannel" in window) {
        try {
          this.broadcastChannel = new BroadcastChannel("tvk_crm_candidates_channel");
          this.broadcastChannel.onmessage = (event) => {
            if (event.data?.type === "CANDIDATE_DATA_CHANGED") {
              void this.loadFromBackend(true);
            }
          };
        } catch (_) {}
      }

      window.addEventListener("storage", (event) => {
        if (event.key === "tvk_crm_candidate_sync_trigger") {
          void this.loadFromBackend(true);
        }
      });
    }
  }

  broadcastUpdate(action: string, detail?: string): void {
    if (typeof window !== "undefined") {
      try {
        this.broadcastChannel?.postMessage({
          type: "CANDIDATE_DATA_CHANGED",
          action,
          detail,
          timestamp: Date.now(),
        });
      } catch (_) {}
      try {
        localStorage.setItem("tvk_crm_candidate_sync_trigger", `${action}_${Date.now()}`);
      } catch (_) {}
    }
  }

  private startGlobalAutoRefresh(): void {
    if (typeof window === "undefined") return;

    // Background auto-refresh polling every 10 seconds when tab is active
    this.autoRefreshTimer = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        void this.loadFromBackend(true);
      }
    }, 10000);

    // Refresh immediately when window or tab regains focus
    window.addEventListener("focus", () => {
      void this.loadFromBackend(true);
    });

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
          void this.loadFromBackend(true);
        }
      });
    }
  }

  getAll(): Candidate[] {
    return this.subject.value;
  }

  getById(id: string): Candidate | undefined {
    return this.getAll().find((candidate) => candidate.id === id);
  }

  getActive(): Candidate[] {
    return this.getAll().filter(
      (candidate) => candidate.status !== "ARCHIVED",
    );
  }

  getArchived(): Candidate[] {
    return this.getAll().filter(
      (candidate) => candidate.status === "ARCHIVED",
    );
  }

  /**
   * Set the current user's cache.
   * Each user has a separate cache to prevent candidate data
   * from one account appearing in another account.
   */
  setCacheOwner(owner: string): void {
    const nextOwner = owner.trim() || "anonymous";
    if (nextOwner === this.cacheOwner) return;
    this.cacheOwner = nextOwner;
    this.loaded = false;
    this.lastFetchTime = 0;
    this.subject.next([]);
  }

  clearCache(owner = this.cacheOwner): void {
    if (owner === this.cacheOwner) {
      this.subject.next([]);
      this.loaded = false;
      this.lastFetchTime = 0;
      this.loadingPromise = undefined;
    }
  }

  /**
   * Load candidates from the backend.
   *
   * - Returns already-loaded data when a refresh is not required (cache < 8s).
   * - Reuses an in-progress request.
   * - Restores cached candidates if the current list is empty.
   * - Refreshes data from the backend.
   */
  async loadFromBackend(force = false): Promise<Candidate[]> {
    const now = Date.now();
    const cacheExpired = now - this.lastFetchTime > 8000;
    if (this.loaded && !force && !cacheExpired) {
      return this.getAll();
    }

    // Prevent concurrent calls from sending duplicate requests.
    if (this.loadingPromise) {
      return this.loadingPromise;
    }

    this.loadingPromise = this.fetchAllCandidates();

    try {
      return await this.loadingPromise;
    } finally {
      this.loadingPromise = undefined;
    }
  }

  private async fetchAllCandidates(): Promise<Candidate[]> {
    const pageSize = 100;
    const firstPage = await firstValueFrom(this.api.get<ApiPage<Candidate>>("/candidates", { page: 1, pageSize }));
    const candidates = [...firstPage.items];
    for (let page = 2; page <= firstPage.pagination.pageCount; page++) {
      const result = await firstValueFrom(this.api.get<ApiPage<Candidate>>("/candidates", { page, pageSize }));
      candidates.push(...result.items);
    }
    this.publish(candidates);
    this.loaded = true;
    this.lastFetchTime = Date.now();
    return candidates;
  }

  async add(candidate: Candidate): Promise<boolean> {
    await this.loadFromBackend();

    if (this.findDuplicate(candidate.email, candidate.phone)) {
      return false;
    }

    const created = await firstValueFrom(this.api.post<Candidate>("/candidates", this.createPayload(candidate)));

    const updated = [
      created,
      ...this.getAll().filter((item) => item.id !== created.id),
    ];

    this.publish(updated);
    this.broadcastUpdate("candidate_added", created.id);

    return true;
  }

  async register(formData: FormData): Promise<Candidate> {
    const candidate = await firstValueFrom(this.api.upload<Candidate>("/candidates/register", formData));
    if (candidate) {
      const current = this.getAll();
      this.publish([candidate, ...current.filter((c) => c.id !== candidate.id)]);
      this.broadcastUpdate("candidate_registered", candidate.id);
    }
    return candidate;
  }

  getInbound(params?: Record<string, string | number | boolean>): Observable<ApiPage<Candidate>> {
    return this.api.get<ApiPage<Candidate>>("/candidates/inbound", params);
  }

  getOutbound(params?: Record<string, string | number | boolean>): Observable<ApiPage<Candidate>> {
    return this.api.get<ApiPage<Candidate>>("/candidates/outbound", params);
  }

  getCandidateById(id: string): Observable<{ success: boolean; data: Candidate }> {
    return this.api.get<{ success: boolean; data: Candidate }>(`/candidates/${encodeURIComponent(id)}`);
  }

  createOutbound(formData: FormData): Observable<Candidate> {
    return this.api.upload<Candidate>("/candidates/outbound", formData).pipe(
      tap((candidate) => {
        if (candidate) {
          const current = this.getAll();
          if (!current.some((c) => c.id === candidate.id)) {
            this.publish([candidate, ...current]);
          }
          this.broadcastUpdate("candidate_outbound_created", candidate.id);
        }
      }),
    );
  }

  updateCourseDetails(id: string, details: {
    joiningDate?: string | null;
    courseDate?: string | null;
    courseStartDate?: string | null;
    courseName?: string;
    courseDuration?: string;
    totalFee: number;
    amountPaid: number;
    paymentStatus: string;
    paymentInstructions?: string;
  }): Observable<Candidate> {
    return this.api.patch<Candidate>(`/candidates/${encodeURIComponent(id)}/course-details`, details);
  }

  getCommonPaymentQr(): Observable<{ qrCode: string }> {
    return this.api.get<{ qrCode: string }>("/candidates/payment-qr");
  }

  getCorrectionRequests(): Observable<CandidateCorrectionNotification[]> {
    return this.api.get<CandidateCorrectionNotification[]>("/candidates/correction-requests");
  }

  updateCorrectionRequestStatus(candidateId: string, requestId: string, status: "Pending" | "In Progress" | "Resolved" | "Completed"): Observable<any> {
    return this.api.patch(`/candidates/${encodeURIComponent(candidateId)}/correction-requests/${encodeURIComponent(requestId)}`, { status });
  }

  fetchById(id: string): Observable<Candidate> {
    return this.api.get<Candidate>(`/candidates/${encodeURIComponent(id)}`);
  }

  updateDetails(id: string, changes: Partial<Candidate> & { completedCorrectionRequestId?: string }): Observable<Candidate> {
    return this.api.patch<Candidate>(`/candidates/${encodeURIComponent(id)}`, changes);
  }

  uploadCommonPaymentQr(file: File): Observable<{ qrCode: string; message?: string }> {
    const formData = new FormData();
    formData.append("qrCode", file, file.name);
    return this.api.upload<{ qrCode: string; message?: string }>("/candidates/payment-qr", formData);
  }

  uploadPaymentQr(id: string, file: File): Observable<Candidate> {
    const formData = new FormData();
    formData.append("qrCode", file, file.name);
    return this.api.upload<Candidate>(`/candidates/${encodeURIComponent(id)}/payment-qr`, formData);
  }

  getPaymentToken(id: string): Observable<{ paymentToken: string; expiresAt: string; candidateId: string; name: string }> {
    return this.api.get<{ paymentToken: string; expiresAt: string; candidateId: string; name: string }>(`/candidates/${encodeURIComponent(id)}/payment-token`);
  }

  getCandidatePayments(id: string): Observable<PaymentRecord[]> {
    return this.api.get<PaymentRecord[]>(`/candidates/${encodeURIComponent(id)}/payments`);
  }

  getAllPayments(params?: Record<string, string | number | boolean>): Observable<ApiPage<PaymentRecord>> {
    return this.api.get<ApiPage<PaymentRecord>>("/candidates/payments", params);
  }

  verifyPayment(candidateId: string, paymentId: string, verifiedAmount: number, notes?: string): Observable<{ payment: PaymentRecord; candidate: Candidate }> {
    return this.api.post<{ payment: PaymentRecord; candidate: Candidate }>(
      `/candidates/${encodeURIComponent(candidateId)}/payments/${encodeURIComponent(paymentId)}/verify`,
      { verifiedAmount, notes },
    );
  }

  rejectPayment(candidateId: string, paymentId: string, rejectionReason: string): Observable<{ payment: PaymentRecord; candidate: Candidate }> {
    return this.api.post<{ payment: PaymentRecord; candidate: Candidate }>(
      `/candidates/${encodeURIComponent(candidateId)}/payments/${encodeURIComponent(paymentId)}/reject`,
      { rejectionReason },
    );
  }

  downloadReceipt(receiptNumber: string): Observable<Blob> {
    return this.api.blob(`/candidates/receipts/${encodeURIComponent(receiptNumber)}/download`);
  }

  downloadOfferLetter(candidateId: string): Observable<Blob> {
    return this.api.blob(`/candidates/${encodeURIComponent(candidateId)}/offer-letter`);
  }

  previewOfferLetter(candidateId: string, format: "png" | "pdf" = "png"): Observable<Blob> {
    return this.api.blob(`/candidates/${encodeURIComponent(candidateId)}/offer-letter?format=${format}&disposition=inline`);
  }

  createCandidateAccount(
    candidateId: string,
    username?: string,
    temporaryPassword?: string,
    attachOfferLetter?: boolean,
  ): Observable<{ success: boolean; username: string; emailSent: boolean; offerLetterAttached?: boolean }> {
    return this.api.post<{ success: boolean; username: string; emailSent: boolean; offerLetterAttached?: boolean }>(
      `/candidates/${encodeURIComponent(candidateId)}/create-account`,
      { username, temporaryPassword, attachOfferLetter },
    );
  }

  resetCandidatePassword(candidateId: string): Observable<{ success: boolean; emailSent: boolean }> {
    return this.api.post<{ success: boolean; emailSent: boolean }>(
      `/candidates/${encodeURIComponent(candidateId)}/reset-account-password`,
      {},
    );
  }

  updateAccountCredentials(
    candidateId: string,
    username: string,
    newPassword: string,
    attachOfferLetter?: boolean,
  ): Observable<{ success: boolean; username: string; password?: string; emailSent: boolean; offerLetterAttached?: boolean; message: string }> {
    return this.api.post<{ success: boolean; username: string; password?: string; emailSent: boolean; offerLetterAttached?: boolean; message: string }>(
      `/candidates/${encodeURIComponent(candidateId)}/update-credentials`,
      { username, newPassword, attachOfferLetter },
    );
  }

  getCertificates(params?: Record<string, string | number | boolean>): Observable<ApiPage<Candidate>> {
    return this.api.get<ApiPage<Candidate>>("/candidates/certificates", params);
  }

  markCourseCompletion(id: string, courseCompleted: boolean, completionDate?: string | null): Observable<Candidate> {
    return this.api.post<Candidate>(`/candidates/${encodeURIComponent(id)}/course-completion`, {
      courseCompleted,
      completionDate,
    });
  }

  generateCertificate(id: string, regenerate = false): Observable<Candidate> {
    return this.api.post<Candidate>(`/candidates/${encodeURIComponent(id)}/certificate/generate`, { regenerate });
  }

  revokeCertificate(id: string, reason: string): Observable<Candidate> {
    return this.api.post<Candidate>(`/candidates/${encodeURIComponent(id)}/certificate/revoke`, { reason });
  }

  verifyCertificatePublic(certificateId: string): Observable<any> {
    return this.api.get<any>(`/candidates/certificates/verify/${encodeURIComponent(certificateId)}`);
  }

  downloadCertificate(id: string, format: "png" | "pdf" = "png"): Observable<Blob> {
    return this.api.blob(`/candidates/${encodeURIComponent(id)}/certificate/download?format=${format}`);
  }

  previewCertificate(id: string, format: "png" | "pdf" = "png"): Observable<Blob> {
    return this.api.blob(`/candidates/${encodeURIComponent(id)}/certificate/preview?format=${format}`);
  }

  async addMany(candidates: Candidate[]): Promise<Candidate[]> {
    await this.loadFromBackend();

    const accepted: Candidate[] = [];

    for (const candidate of candidates) {
      if (
        !this.findDuplicate(
          candidate.email,
          candidate.phone,
          [...this.getAll(), ...accepted],
        )
      ) {
        accepted.push(candidate);
      }
    }

    if (!accepted.length) return [];

    const imported: Candidate[] = [];

    for (let offset = 0; offset < accepted.length; offset += 100) {
      const chunk = accepted.slice(offset, offset + 100);

      const created = await firstValueFrom(this.api.post<Candidate[]>("/candidates/bulk", chunk.map((candidate) => this.createPayload(candidate))));

      imported.push(...created);
      this.publish([...created, ...this.getAll()]);
    }

    if (imported.length > 0) {
      this.broadcastUpdate("candidates_bulk_imported", imported.length.toString());
    }

    return imported;
  }

  async update(
    id: string,
    changes: Partial<Candidate>,
    log = true,
  ): Promise<void> {
    const current = await this.findCandidateForMutation(id);

    if (!current) throw new Error("Candidate not found.");

    // Optimistically update the UI while the backend saves.
    const optimistic = {
      ...current,
      ...changes,
      updatedAt: new Date().toISOString(),
    };

    this.publish(
      this.getAll().map((candidate) =>
        candidate.id === id ? optimistic : candidate,
      ),
    );

    try {
      const updatedCandidate = await firstValueFrom(this.api.patch<Candidate>(`/candidates/${encodeURIComponent(id)}`, changes));

      this.publish(
        this.getAll().map((candidate) =>
          candidate.id === id
            ? { ...candidate, ...updatedCandidate }
            : candidate,
        ),
      );
    } catch (error: unknown) {
      // Restore the previous data if the backend update fails.
      this.publish(
        this.getAll().map((candidate) =>
          candidate.id === id ? current : candidate,
        ),
      );

      throw error;
    }

    void log;
  }

  async updateStatus(
    id: string,
    status: CandidateStatus,
    message: string,
    performedBy: string,
  ): Promise<void> {
    const current = await this.findCandidateForMutation(id);

    if (!current || current.status === status) {
      return;
    }

    const updated = await firstValueFrom(this.api.patch<Candidate>(`/candidates/${encodeURIComponent(id)}/status`, { status, message }));
    this.publish(this.getAll().map((candidate) => candidate.id === id ? updated : candidate));
  }

  async sendEmail(
    id: string,
    payload: { to: string; subject: string; message: string },
  ): Promise<{ result: unknown; candidate: Candidate }> {
    const res = await firstValueFrom(
      this.api.post<{ result: unknown; candidate: Candidate }>(
        `/candidates/${encodeURIComponent(id)}/email`,
        payload,
      ),
    );
    if (res.candidate) {
      this.publish(
        this.getAll().map((candidate) =>
          candidate.id === id ? { ...candidate, ...res.candidate } : candidate,
        ),
      );
    }
    return res;
  }

  async getEmailStatus(): Promise<{ configured: boolean; host: string | null; user: string | null; from: string | null }> {
    return firstValueFrom(
      this.api.get<{ configured: boolean; host: string | null; user: string | null; from: string | null }>(
        "/candidates/email-status",
      ),
    );
  }

  async sendWhatsApp(
    id: string,
    payload: {
      phone?: string;
      message: string;
      templateKey?: string;
      candidateName?: string;
      candidatePosition?: string;
    },
  ): Promise<{ result: unknown; candidate: Candidate }> {
    const res = await firstValueFrom(
      this.api.post<{ result: unknown; candidate: Candidate }>(
        `/candidates/${encodeURIComponent(id)}/whatsapp`,
        payload,
      ),
    );
    if (res.candidate) {
      this.publish(
        this.getAll().map((candidate) =>
          candidate.id === id ? { ...candidate, ...res.candidate } : candidate,
        ),
      );
    }
    return res;
  }

  async getWhatsAppStatus(): Promise<{ configured: boolean; phoneId: string | null; displayPhone?: string | null; fullPhoneId?: string | null }> {
    return firstValueFrom(
      this.api.get<{ configured: boolean; phoneId: string | null; displayPhone?: string | null; fullPhoneId?: string | null }>(
        "/candidates/whatsapp-status",
      ),
    );
  }

  async assign(id: string, employeeId: string, employeeName?: string): Promise<void> {
    await this.assignMany([id], employeeId, employeeName);
  }

  async assignMany(ids: string[], employeeId: string, employeeName?: string): Promise<void> {
    if (!ids.length) return;
    await this.loadFromBackend();

    const result = await firstValueFrom(
      this.api.post<{ items: Candidate[] }>("/assignments", {
        candidateIds: ids,
        employeeId,
      }),
    );

    const updatedMap = new Map(result.items.map((item) => [item.id, item]));
    this.publish(
      this.getAll().map((candidate) => updatedMap.get(candidate.id) ?? candidate),
    );
    void employeeName;
  }

  async addNote(id: string, note: string): Promise<void> {
    await this.loadFromBackend();

    const current = this.getById(id);
    const value = note.trim();

    if (!current || !value) {
      return;
    }

    const result = await firstValueFrom(this.api.post<{ candidate: Candidate }>(`/candidates/${encodeURIComponent(id)}/notes`, { note: value }));
    this.publish(this.getAll().map((candidate) => candidate.id === id ? result.candidate : candidate));
  }

  async archive(id: string): Promise<void> {
    const current = await this.findCandidateForMutation(id);

    if (!current || current.status === "ARCHIVED") {
      return;
    }

    const updated = await firstValueFrom(this.api.post<Candidate>(`/candidates/${encodeURIComponent(id)}/archive`, {}));
    this.publish(this.getAll().map((candidate) => candidate.id === id ? updated : candidate));
  }

  async restore(id: string): Promise<void> {
    const current = await this.findCandidateForMutation(id);

    if (!current || current.status !== "ARCHIVED") {
      return;
    }

    const updated = await firstValueFrom(this.api.post<Candidate>(`/candidates/${encodeURIComponent(id)}/restore`, {}));
    this.publish(this.getAll().map((candidate) => candidate.id === id ? updated : candidate));
  }

  async permanentDelete(id: string): Promise<void> {
    const current = await this.findCandidateForMutation(id);

    if (!current || current.status !== "ARCHIVED") {
      return;
    }

    const previousCandidates = this.getAll();
    const previousIndex = previousCandidates.findIndex(
      (candidate) => candidate.id === id,
    );

    // Remove from the UI immediately.
    this.publish(
      previousCandidates.filter((candidate) => candidate.id !== id),
    );

    try {
      await firstValueFrom(this.api.delete<void>(`/candidates/${encodeURIComponent(id)}`));
    } catch (error: unknown) {
      // Restore the candidate if permanent deletion fails.
      const latest = this.getAll();

      if (!latest.some((candidate) => candidate.id === id)) {
        latest.splice(Math.min(previousIndex, latest.length), 0, current);
        this.publish(latest);
      }

      throw error;
    }
  }

  private async findCandidateForMutation(
    id: string,
  ): Promise<Candidate | undefined> {
    let candidate = this.getById(id);

    if (!candidate && !this.loaded) {
      await this.loadFromBackend();
      candidate = this.getById(id);
    }

    return candidate;
  }

  findDuplicate(
    email: string,
    phone: string,
    candidates: Candidate[] = this.getAll(),
  ): Candidate | undefined {
    const normalizedEmail = this.normalizeEmail(email);
    const normalizedPhone = this.normalizePhone(phone);

    return candidates.find((candidate) => {
      const emailMatches =
        normalizedEmail !== "" &&
        this.normalizeEmail(candidate.email) === normalizedEmail;

      const phoneMatches =
        normalizedPhone !== "" &&
        this.normalizePhone(candidate.phone) === normalizedPhone;

      return emailMatches || phoneMatches;
    });
  }

  isDuplicate(email: string, phone: string): boolean {
    return Boolean(this.findDuplicate(email, phone));
  }

  private normalizeEmail(email: string | null | undefined): string {
    return (email || "").trim().toLowerCase();
  }

  private normalizePhone(phone: string | null | undefined): string {
    return (phone || "").replace(/\D/g, "");
  }

  private createPayload(candidate: Candidate) {
    return {
      id: candidate.id,
      name: candidate.name,
      phone: candidate.phone,
      email: candidate.email,
      position: candidate.position,
      experience: candidate.experience,
      location: candidate.location,
      skills: candidate.skills,
      source: candidate.source,
      resumeName: candidate.resumeName,
      resumeFileId: candidate.resumeFileId,
      status: candidate.status,
      appliedDate: candidate.appliedDate,
      notes: candidate.notes,
    };
  }

  private publish(candidates: Candidate[]): void {
    this.subject.next(candidates);
  }
}