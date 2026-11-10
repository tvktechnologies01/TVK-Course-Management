import { CommonModule } from "@angular/common";
import { HttpClient } from "@angular/common/http";
import { ChangeDetectorRef, Component, OnInit, inject } from "@angular/core";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";

interface CrmStatusResponse {
  success: boolean;
  data: {
    crm: "running" | "stopped";
    timestamp: string;
    message?: string;
  };
}

@Component({
  selector: "app-crm-control",
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <main class="control-page">
      <section class="control-card">
        <div class="brand-row">
          <div class="brand-mark">RC</div>
          <div>
            <span class="eyebrow">ADMIN ONLY</span>
            <h1>CRM Control Panel</h1>
          </div>
        </div>

        <p class="intro">
          This link is private to the admin. Click <strong>Start CRM</strong> to open the CRM
          or <strong>Stop CRM</strong> to close the CRM. When stopped, all users visiting the portal will only see
          <em>"CRM is stopped. Please contact admin."</em>
        </p>

        <div class="status-box" [class.running]="status === 'running'" [class.stopped]="status === 'stopped'">
          <div class="status-indicator">
            <span class="dot"></span>
            <div>
              <strong>CRM Status: {{ status === 'running' ? 'RUNNING' : status === 'stopped' ? 'STOPPED' : 'CHECKING...' }}</strong>
              <small>{{ status === 'running' ? 'CRM is online. Login page is open to users.' : status === 'stopped' ? 'CRM is stopped. Portal is completely locked.' : 'Checking operational status...' }}</small>
            </div>
          </div>
          <button type="button" class="btn-refresh" (click)="checkStatus()" [disabled]="busy" title="Refresh status">
            ↻
          </button>
        </div>

        <div *ngIf="message" class="alert-success" role="status">
          {{ message }}
        </div>

        <div *ngIf="error" class="alert-error" role="alert">
          {{ error }}
        </div>

        <div class="actions">
          <button
            type="button"
            class="btn-start"
            [disabled]="busy"
            (click)="startCrm()"
          >
            ▶ Start CRM
          </button>

          <button
            type="button"
            class="btn-stop"
            [disabled]="busy"
            (click)="stopCrm()"
          >
            ⏹ Stop CRM
          </button>
        </div>

        <div class="footer-links">
          <a *ngIf="status === 'running'" routerLink="/login" class="link-portal">
            Go to Login Page &rarr;
          </a>
          <span *ngIf="status === 'stopped'" class="stopped-badge">
            CRM is currently stopped
          </span>
        </div>
      </section>
    </main>
  `,
  styles: [`
    :host {
      display: block;
      min-height: 100vh;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: #1e293b;
      background: #0f172a;
    }

    .control-page {
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 24px;
      box-sizing: border-box;
      background: radial-gradient(circle at 50% 20%, #1e293b 0%, #0f172a 100%);
    }

    .control-card {
      width: min(500px, 100%);
      padding: 36px 32px;
      box-sizing: border-box;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.4);
    }

    .brand-row {
      display: flex;
      align-items: center;
      gap: 14px;
      margin-bottom: 8px;
    }

    .brand-mark {
      width: 44px;
      height: 44px;
      border-radius: 10px;
      background: #1677ed;
      color: #ffffff;
      font-size: 16px;
      font-weight: 800;
      display: grid;
      place-items: center;
      flex-shrink: 0;
    }

    .eyebrow {
      display: block;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 1.2px;
      color: #ef4444;
      text-transform: uppercase;
    }

    h1 {
      margin: 2px 0 0;
      font-size: 22px;
      font-weight: 700;
      color: #0f172a;
    }

    .intro {
      margin: 14px 0 22px;
      color: #64748b;
      font-size: 13.5px;
      line-height: 1.55;
    }

    .status-box {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px;
      border-radius: 10px;
      border: 1px solid #e2e8f0;
      background: #f8fafc;
      margin-bottom: 22px;
      transition: all 0.25s ease;
    }

    .status-box.running {
      border-color: #86efac;
      background: #f0fdf4;
    }

    .status-box.stopped {
      border-color: #fca5a5;
      background: #fef2f2;
    }

    .status-indicator {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .dot {
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: #94a3b8;
    }

    .status-box.running .dot {
      background: #16a34a;
      box-shadow: 0 0 0 4px rgba(22, 163, 74, 0.25);
    }

    .status-box.stopped .dot {
      background: #dc2626;
      box-shadow: 0 0 0 4px rgba(220, 38, 38, 0.25);
    }

    .status-indicator strong {
      display: block;
      font-size: 14px;
      font-weight: 700;
      color: #0f172a;
    }

    .status-box.running .status-indicator strong {
      color: #15803d;
    }

    .status-box.stopped .status-indicator strong {
      color: #b91c1c;
    }

    .status-indicator small {
      display: block;
      color: #64748b;
      font-size: 12px;
      margin-top: 2px;
    }

    .btn-refresh {
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 6px 10px;
      font-size: 15px;
      cursor: pointer;
      color: #475569;
    }

    .btn-refresh:hover:not(:disabled) {
      background: #f1f5f9;
      color: #0f172a;
    }

    .alert-success {
      padding: 12px 14px;
      border-radius: 7px;
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      color: #166534;
      font-size: 13.5px;
      margin-bottom: 18px;
    }

    .alert-error {
      padding: 12px 14px;
      border-radius: 7px;
      background: #fef2f2;
      border: 1px solid #fecaca;
      color: #991b1b;
      font-size: 13.5px;
      margin-bottom: 18px;
    }

    .actions {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
      margin-top: 10px;
    }

    .actions button {
      min-height: 48px;
      padding: 12px 18px;
      border: 0;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      transition: all 0.2s;
    }

    .btn-start {
      background: #16a34a;
      color: #ffffff;
    }

    .btn-start:hover:not(:disabled) {
      background: #15803d;
    }

    .btn-stop {
      background: #dc2626;
      color: #ffffff;
    }

    .btn-stop:hover:not(:disabled) {
      background: #b91c1c;
    }

    .actions button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .footer-links {
      margin-top: 24px;
      padding-top: 18px;
      border-top: 1px solid #f1f5f9;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .link-portal {
      color: #1677ed;
      text-decoration: none;
      font-size: 13.5px;
      font-weight: 600;
    }

    .link-portal:hover {
      text-decoration: underline;
    }

    .stopped-badge {
      color: #dc2626;
      font-size: 12px;
      font-weight: 600;
    }
  `],
})
export class CrmControlComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);

  status: "running" | "stopped" | "checking" = "checking";
  busy = false;
  message = "";
  error = "";

  ngOnInit(): void {
    const action =
      this.route.snapshot.data["action"] ||
      this.route.snapshot.queryParamMap.get("action");
    if (action === "start") {
      this.startCrm();
    } else if (action === "stop") {
      this.stopCrm();
    } else {
      this.checkStatus();
    }
  }

  checkStatus(): void {
    this.busy = true;
    this.error = "";
    this.http.get<CrmStatusResponse>("/api/system/crm/status").subscribe({
      next: (res) => {
        this.status = res.data?.crm || "running";
        this.busy = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.http.get<{ data: { status: string; crm?: string } }>("/api/health").subscribe({
          next: (res) => {
            this.status = res.data?.crm === "stopped" || res.data?.status === "stopped" ? "stopped" : "running";
            this.busy = false;
            this.cdr.markForCheck();
          },
          error: (err) => {
            this.status = err.status === 503 ? "stopped" : "stopped";
            this.busy = false;
            this.cdr.markForCheck();
          },
        });
      },
    });
  }

  startCrm(): void {
    if (this.busy) return;
    this.busy = true;
    this.error = "";
    this.message = "";

    this.http.get<CrmStatusResponse>("/api/system/crm/start").subscribe({
      next: (res) => {
        this.status = "running";
        this.message = res.data?.message || "CRM application started successfully! The login page is now open.";
        this.busy = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.error = err.error?.error?.message || "Failed to start CRM.";
        this.busy = false;
        this.cdr.markForCheck();
      },
    });
  }

  stopCrm(): void {
    if (this.busy) return;
    this.busy = true;
    this.error = "";
    this.message = "";

    this.http.get<CrmStatusResponse>("/api/system/crm/stop").subscribe({
      next: (res) => {
        this.status = "stopped";
        this.message = res.data?.message || "CRM application stopped successfully! Users will only see: 'CRM is stopped. Please contact admin.'";
        this.busy = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.error = err.error?.error?.message || "Failed to stop CRM.";
        this.busy = false;
        this.cdr.markForCheck();
      },
    });
  }
}
