import { Routes } from "@angular/router";
import { LayoutComponent } from "./layout/layout/layout";
import { DashboardComponent } from "./features/dashboard/dashboard";
import { ResumeImportComponent } from "./features/candidates/resume-import/resume-import";
import { CandidatesComponent } from "./features/candidates/candidates/candidates";
import { CandidateDetailsComponent } from "./features/candidates/candidate-details/candidate-details";
import { ArchivedCandidatesComponent } from "./features/candidates/archived/archived";
import { AssignmentsComponent } from "./features/assignments/assignments";
import { MyCandidatesComponent } from "./features/my-candidates/my-candidates";
import { FollowUpsComponent } from "./features/follow-ups/follow-ups";
import { ActivityLogsComponent } from "./features/activity-logs/activity-logs";
import { CrmStoppedComponent } from "./features/crm-stopped/crm-stopped";
import { CrmControlComponent } from "./features/crm-control/crm-control";
import { crmEnabledGuard } from "./core/guards/crm-enabled.guard";
import { authGuard, roleGuard } from "./core/guards/auth.guard";
import { trainerAuthGuard } from "./core/guards/trainer-portal.guard";
import { LoginComponent } from "./features/login/login";

export const routes: Routes = [
  { path: "login", component: LoginComponent, canActivate: [crmEnabledGuard] },
  {
    path: "accept-invitation",
    canActivate: [crmEnabledGuard],
    loadComponent: () => import("./features/accept-invitation/accept-invitation").then((module) => module.AcceptInvitationComponent),
  },
  {
    path: "candidate-registration",
    canActivate: [crmEnabledGuard],
    loadComponent: () => import("./features/candidate-registration/candidate-registration").then((module) => module.CandidateRegistrationComponent),
  },
  {
    path: "candidate-login",
    canActivate: [crmEnabledGuard],
    loadComponent: () => import("./features/candidate-login/candidate-login").then((module) => module.CandidateLoginComponent),
  },
  {
    path: "trainer-login",
    canActivate: [crmEnabledGuard],
    loadComponent: () => import("./features/trainer-login/trainer-login").then((module) => module.TrainerLoginComponent),
  },
  {
    path: "trainer-portal",
    canActivate: [crmEnabledGuard, trainerAuthGuard],
    loadComponent: () => import("./features/trainer-portal/trainer-portal").then((module) => module.TrainerPortalComponent),
  },
  {
    path: "payment/:token",
    canActivate: [crmEnabledGuard],
    loadComponent: () => import("./features/candidate-payment/candidate-payment").then((module) => module.CandidatePaymentComponent),
  },
  {
    path: "candidate-portal",
    canActivate: [crmEnabledGuard],
    loadComponent: () => import("./features/candidate-portal/candidate-portal").then((module) => module.CandidatePortalComponent),
  },
  {
    path: "verify-certificate",
    canActivate: [crmEnabledGuard],
    loadComponent: () => import("./features/certificate-verify/certificate-verify").then((module) => module.CertificateVerifyComponent),
  },
  {
    path: "verify-certificate/:id",
    canActivate: [crmEnabledGuard],
    loadComponent: () => import("./features/certificate-verify/certificate-verify").then((module) => module.CertificateVerifyComponent),
  },
  {
    path: "",
    component: LayoutComponent,
    canActivate: [crmEnabledGuard, authGuard],
    canActivateChild: [roleGuard],
    children: [
      {
        path: "",
        pathMatch: "full",
        redirectTo: "dashboard",
      },

      {
        path: "dashboard",
        component: DashboardComponent,
        data: { roles: ["MANAGER"] },
      },

      {
        path: "candidates/import",
        component: ResumeImportComponent,
        data: { roles: ["MANAGER"] },
      },

      {
        path: "candidates",
        component: CandidatesComponent,
        data: { roles: ["MANAGER"] },
      },

      {
        path: "candidates/archived",
        component: ArchivedCandidatesComponent,
        data: { roles: ["MANAGER"] },
      },

      {
        path: "candidates/:id",
        component: CandidateDetailsComponent,
        data: { roles: ["MANAGER", "HR"] },
      },

      {
        path: "assignments",
        component: AssignmentsComponent,
        data: { roles: ["MANAGER"] },
      },

      {
        path: "hr-workload",
        loadComponent: () => import("./features/hr-workload/hr-workload").then((module) => module.HrWorkloadComponent),
        data: { roles: ["MANAGER"] },
      },

      {
        path: "trainer-management",
        loadComponent: () => import("./features/trainer-management/trainer-management").then((module) => module.TrainerManagementComponent),
        data: { roles: ["MANAGER"] },
      },

      {
        path: "hr-management",
        loadComponent: () => import("./features/hr-management/hr-management").then((module) => module.HrManagementComponent),
        data: { roles: ["MANAGER"] },
      },

      {
        path: "my-candidates",
        component: MyCandidatesComponent,
        data: { roles: ["HR"] },
      },

      {
        path: "inbound",
        loadComponent: () => import("./features/external-resumes/external-resumes").then((module) => module.ExternalResumesComponent),
        data: { roles: ["HR", "MANAGER"] },
      },

      {
        path: "external-resumes",
        loadComponent: () => import("./features/external-resumes/external-resumes").then((module) => module.ExternalResumesComponent),
        data: { roles: ["HR", "MANAGER"] },
      },

      {
        path: "payments",
        loadComponent: () => import("./features/payments/payments").then((module) => module.PaymentsComponent),
        data: { roles: ["HR", "MANAGER"] },
      },

      {
        path: "follow-ups",
        component: FollowUpsComponent,
        data: { roles: ["HR"] },
      },

      {
        path: "courses",
        loadComponent: () => import("./features/courses/course-management").then((module) => module.CourseManagementComponent),
        data: { roles: ["HR", "MANAGER"] },
      },

      {
        path: "certificates",
        redirectTo: "courses",
        pathMatch: "full",
      },

      {
        path: "activity-logs",
        component: ActivityLogsComponent,
        data: { roles: ["MANAGER"] },
      },
    ],
  },

  {
    path: "crm-control",
    component: CrmControlComponent,
  },

  {
    path: "crm-start",
    component: CrmControlComponent,
    data: { action: "start" },
  },

  {
    path: "crm-stop",
    component: CrmControlComponent,
    data: { action: "stop" },
  },

  {
    path: "crm-stopped",
    component: CrmStoppedComponent,
  },

  {
    path: "**",
    redirectTo: "login",
  },
];