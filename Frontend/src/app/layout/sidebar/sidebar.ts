import { Component } from "@angular/core";
import { CommonModule } from "@angular/common";
import { Router, RouterLink, RouterLinkActive } from "@angular/router";
import { AuthService } from "../../core/services/auth.service";

interface SidebarLink {
  label: string;
  icon: string;
  route: string;
  exact?: boolean;
  queryParams?: Record<string, string>;
}

@Component({
  selector: "app-sidebar",
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: "./sidebar.html",
  styleUrl: "./sidebar.css",
})
export class SidebarComponent {
  private readonly managerLinks: SidebarLink[] = [
    { label: "Dashboard", icon: "▦", route: "/dashboard", exact: true },
    { label: "Candidates", icon: "♙", route: "/candidates", exact: true },
    { label: "External Resumes", icon: "📥", route: "/external-resumes" },
    { label: "Payment Management", icon: "💳", route: "/payments" },
    {
      label: "Import Resumes",
      icon: "↑",
      route: "/candidates/import",
      exact: true,
    },
    { label: "Assignments", icon: "⇄", route: "/assignments" },
    { label: "HR Workload Management", icon: "👥", route: "/hr-workload" },
    { label: "Trainer Management", icon: "👨‍🏫", route: "/trainer-management" },
    { label: "Course Management", icon: "📚", route: "/courses" },
    { label: "HR Management", icon: "♙", route: "/hr-management" },
    { label: "Activity Logs", icon: "≡", route: "/activity-logs" },
  ];

  private readonly hrLinks: SidebarLink[] = [
    { label: "My Candidates", icon: "☰", route: "/my-candidates" },
    { label: "External Resumes", icon: "📥", route: "/external-resumes" },
    { label: "Payment Management", icon: "💳", route: "/payments" },
    { label: "Follow-ups", icon: "◷", route: "/follow-ups" },
    { label: "Course Management", icon: "📚", route: "/courses" },
  ];

  constructor(readonly auth: AuthService, private readonly router: Router) {}

  get links(): SidebarLink[] {
    return this.auth.role === "HR" ? this.hrLinks : this.managerLinks;
  }

  logout(): void {
    this.auth.logout();
    void this.router.navigateByUrl("/login");
  }
}
