import { CommonModule } from "@angular/common";
import { ChangeDetectorRef, Component, OnInit, inject } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, RouterModule } from "@angular/router";
import { CandidateService } from "../../core/services/candidate.service";

export interface CertificateVerificationResult {
  valid: boolean;
  status: "AUTHENTIC" | "REVOKED";
  certificateId: string;
  candidateName: string;
  candidateId?: string;
  courseName?: string;
  courseDuration?: string;
  completionDate?: string;
  issuedAt?: string;
  revokedAt?: string;
  revocationReason?: string;
  signatory?: string;
  issuer?: string;
  tagline?: string;
}

@Component({
  selector: "app-certificate-verify",
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: "./certificate-verify.html",
  styleUrl: "./certificate-verify.css",
})
export class CertificateVerifyComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly candidateService = inject(CandidateService);
  private readonly cdr = inject(ChangeDetectorRef);

  searchId = "";
  loading = false;
  hasSearched = false;
  error = "";
  result: CertificateVerificationResult | null = null;

  ngOnInit(): void {
    const queryId = this.route.snapshot.queryParamMap.get("id");
    const paramId = this.route.snapshot.paramMap.get("id");
    const certId = (queryId || paramId || "").trim();

    if (certId) {
      this.searchId = certId;
      this.verifyCertificate(certId);
    }
  }

  onSubmitSearch(): void {
    const id = this.searchId.trim();
    if (id) {
      this.verifyCertificate(id);
    }
  }

  verifyCertificate(certificateId: string): void {
    this.loading = true;
    this.error = "";
    this.result = null;
    this.hasSearched = true;
    this.cdr.markForCheck();

    this.candidateService.verifyCertificatePublic(certificateId).subscribe({
      next: (data) => {
        this.result = data;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err: unknown) => {
        this.result = null;
        this.loading = false;
        this.error =
          err instanceof Error
            ? err.message
            : "Certificate not found or invalid Certificate ID.";
        this.cdr.markForCheck();
      },
    });
  }
}
