import { CommonModule } from "@angular/common";
import { ChangeDetectorRef, Component, OnDestroy, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouterLink } from "@angular/router";
import { Subscription } from "rxjs";
import { Candidate } from "../../../core/models/candidate.model";
import { CandidateService } from "../../../core/services/candidate.service";

@Component({
  selector: "app-archived-candidates",
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
  ],
  templateUrl: "./archived.html",
  styleUrl: "./archived.css",
})
export class ArchivedCandidatesComponent implements OnInit, OnDestroy {
  candidates: Candidate[] = [];
  search = "";
  deletingId = "";
  deleteError = "";
  loading = false;
  loadError = "";

  private readonly subscriptions = new Subscription();

  constructor(
    private candidateService: CandidateService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.subscriptions.add(this.candidateService.candidates$.subscribe(
      (candidates) => {
        this.candidates =
          candidates.filter(
            (candidate) =>
              candidate.status === "ARCHIVED",
          );
        this.cdr.markForCheck();
      },
    ));
    this.loading = this.candidateService.getAll().length === 0;
    void this.loadCandidates();
  }

  async loadCandidates(): Promise<void> {
    this.loadError = "";
    try {
      await this.candidateService.loadFromBackend();
    } catch (error: unknown) {
      console.error("Unable to load archived candidates:", error);
      this.loadError = "Archived candidates could not be loaded. Please retry.";
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  get filtered(): Candidate[] {
    const query =
      this.search
        .trim()
        .toLowerCase();

    if (!query) {
      return this.candidates;
    }

    return this.candidates.filter(
      (candidate) =>
        [
          candidate.name,
          candidate.phone,
          candidate.email,
          candidate.position,
          candidate.location,
        ]
          .join(" ")
          .toLowerCase()
          .includes(query),
    );
  }

  async restore(
    candidate: Candidate,
  ): Promise<void> {
    if (
      !confirm(
        `Restore ${candidate.name}?`,
      )
    ) {
      return;
    }

    this.deleteError = "";
    try {
      await this.candidateService.restore(candidate.id);
    } catch (error: unknown) {
      console.error("Failed to restore candidate:", error);
      this.deleteError = "Unable to restore the candidate. Please try again.";
    }
  }

  async permanentDelete(
    candidate: Candidate,
  ): Promise<void> {
    if (
      !confirm(
        `Permanently delete ${candidate.name}? This action cannot be undone.`,
      )
    ) {
      return;
    }

    this.deletingId =
      candidate.id;
    this.deleteError = "";

    try {
      await this.candidateService.permanentDelete(
        candidate.id,
      );
    } catch (error: unknown) {
      console.error("Failed to permanently delete candidate:", error);
      this.deleteError =
        error instanceof Error
          ? `Permanent deletion failed: ${error.message}`
          : "Permanent deletion failed. The candidate is still archived. Please try again.";
    } finally {
      this.deletingId = "";
      this.cdr.markForCheck();
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }
}