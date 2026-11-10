import { CommonModule } from "@angular/common";
import { HttpClient } from "@angular/common/http";
import { Component, OnDestroy, OnInit, inject } from "@angular/core";
import { Router } from "@angular/router";

@Component({
  selector: "app-crm-stopped",
  standalone: true,
  imports: [CommonModule],
  template: `
    <main class="stopped-page">
      <section class="notice-panel">
        <div class="brand-mark" aria-hidden="true">RC</div>
        <span class="eyebrow">RECRUITMENT CRM</span>
        <h1>CRM is stopped</h1>
        <p class="notice-text">CRM is stopped. Please contact admin.</p>
      </section>
    </main>
  `,
  styles: [`
    :host {
      display: block;
      min-height: 100vh;
      color: #1c2933;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    .stopped-page {
      min-height: 100vh;
      display: grid;
      place-items: center;
      box-sizing: border-box;
      padding: 24px;
      background: radial-gradient(ellipse at 15% 10%, #fee2e2 0, transparent 44%), linear-gradient(135deg, #f8fafc, #f1f5f9);
    }
    .notice-panel {
      width: min(100%, 460px);
      padding: 42px 32px;
      box-sizing: border-box;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-top: 4px solid #ef4444;
      border-radius: 12px;
      box-shadow: 0 20px 50px rgba(15, 23, 42, 0.08);
      text-align: center;
    }
    .brand-mark {
      width: 44px;
      height: 44px;
      margin: 0 auto 16px;
      display: grid;
      place-items: center;
      border-radius: 10px;
      background: #ef4444;
      color: #ffffff;
      font-weight: 800;
      font-size: 16px;
    }
    .eyebrow {
      color: #ef4444;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 1.2px;
    }
    h1 {
      margin: 12px 0 8px;
      font-size: 26px;
      font-weight: 700;
      color: #0f172a;
    }
    .notice-text {
      color: #64748b;
      font-size: 15px;
      line-height: 1.6;
      margin: 10px 0 0;
    }
  `],
})
export class CrmStoppedComponent implements OnInit, OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private checkTimer: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    this.checkIfRunning();
    // Periodically check if admin starts the CRM, and auto-navigate to login
    this.checkTimer = setInterval(() => this.checkIfRunning(), 3000);
  }

  ngOnDestroy(): void {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
    }
  }

  private checkIfRunning(): void {
    this.http.get<{ data?: { status: string; crm?: string } }>("/api/health").subscribe({
      next: (res) => {
        if (res.data?.status === "ok" || res.data?.crm === "running") {
          if (this.checkTimer) clearInterval(this.checkTimer);
          this.router.navigateByUrl("/login");
        }
      },
      error: () => {
        // Still stopped/unavailable
      },
    });
  }
}
