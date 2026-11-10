import "@angular/compiler";
import { describe, expect, it, beforeEach, vi } from "vitest";
import { of, throwError } from "rxjs";
import { CandidateLoginComponent } from "./candidate-login";

describe("CandidateLoginComponent", () => {
  let component: CandidateLoginComponent;
  let routerMock: { navigateByUrl: ReturnType<typeof vi.fn> };
  let portalServiceMock: {
    loginWithCredentials: ReturnType<typeof vi.fn>;
    setToken: ReturnType<typeof vi.fn>;
    isLoggedIn: ReturnType<typeof vi.fn>;
    contactManager: ReturnType<typeof vi.fn>;
    getPublicCourses: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    routerMock = { navigateByUrl: vi.fn().mockReturnValue(Promise.resolve(true)) };
    portalServiceMock = {
      loginWithCredentials: vi.fn().mockReturnValue(
        of({
          token: "mock-jwt-token",
          mustChangePassword: false,
          candidate: { id: "cand-1", name: "Rahul Sharma", email: "rahul@example.com" },
        })
      ),
      setToken: vi.fn(),
      isLoggedIn: vi.fn().mockReturnValue(false),
      contactManager: vi.fn().mockReturnValue(
        of({
          success: true,
          message: "Your request has been submitted successfully. The manager will review your issue and assist you.",
        })
      ),
      getPublicCourses: vi.fn().mockReturnValue(of(["Full Stack Development with Java & Angular", "DevOps Engineering"])),
    };

    component = new CandidateLoginComponent(
      routerMock as any,
      portalServiceMock as any
    );
  });

  it("should validate required username and password before login", () => {
    component.username = "";
    component.password = "";
    component.login();
    expect(component.errorMessage).toBe("Please enter both your Username / Email and Password.");
    expect(portalServiceMock.loginWithCredentials).not.toHaveBeenCalled();
  });

  it("should successfully authenticate and navigate directly to candidate portal using manager credentials", () => {
    component.username = "rahul.sharma";
    component.password = "TVK@MANAGER#123";
    component.login();

    expect(portalServiceMock.loginWithCredentials).toHaveBeenCalledWith(
      "rahul.sharma",
      "TVK@MANAGER#123"
    );
    expect(portalServiceMock.setToken).toHaveBeenCalledWith("mock-jwt-token");
    expect(routerMock.navigateByUrl).toHaveBeenCalledWith("/candidate-portal");
  });

  it("should navigate directly to candidate portal without opening any password change prompt", () => {
    portalServiceMock.loginWithCredentials.mockReturnValue(
      of({
        token: "manager-issued-token",
        mustChangePassword: true,
        candidate: { id: "cand-1", name: "Rahul Sharma", email: "rahul@example.com" },
      })
    );

    component.username = "rahul.sharma";
    component.password = "ManagerProvidedPass1";
    component.login();

    expect(portalServiceMock.setToken).toHaveBeenCalledWith("manager-issued-token");
    expect(routerMock.navigateByUrl).toHaveBeenCalledWith("/candidate-portal");
  });

  it("should display appropriate error message when login fails", () => {
    portalServiceMock.loginWithCredentials.mockReturnValue(
      throwError(() => ({
        error: { error: { message: "Invalid username or password." } },
      }))
    );

    component.username = "rahul.sharma";
    component.password = "wrong-pass";
    component.login();

    expect(component.errorMessage).toBe("Invalid username or password.");
    expect(routerMock.navigateByUrl).not.toHaveBeenCalled();
  });

  it("should toggle password visibility", () => {
    expect(component.showPassword).toBe(false);
    component.togglePasswordVisibility();
    expect(component.showPassword).toBe(true);
    component.togglePasswordVisibility();
    expect(component.showPassword).toBe(false);
  });

  it("should open and close the contact manager form", () => {
    expect(component.showContactManagerForm).toBe(false);
    component.openContactManager();
    expect(component.showContactManagerForm).toBe(true);
    component.closeContactManager();
    expect(component.showContactManagerForm).toBe(false);
  });

  it("should validate all required fields in the contact manager form", () => {
    component.openContactManager();

    // 1. Missing full name
    component.contactFullName = "";
    component.submitContactRequest();
    expect(component.contactError).toContain("full name");

    // 2. Invalid email
    component.contactFullName = "Deepak Kumar";
    component.contactEmail = "invalid-email";
    component.submitContactRequest();
    expect(component.contactError).toContain("valid registered email");

    // 3. Invalid phone number
    component.contactEmail = "deepak@example.com";
    component.contactPhone = "123";
    component.submitContactRequest();
    expect(component.contactError).toContain("phone number");

    // 4. Missing course
    component.contactPhone = "9876543210";
    component.contactCourse = "";
    component.submitContactRequest();
    expect(component.contactError).toContain("enrolled course");

    // 5. Short issue description
    component.contactCourse = "DevOps Engineering";
    component.contactIssue = "help";
    component.submitContactRequest();
    expect(component.contactError).toContain("describe your issue");
  });

  it("should submit contact manager request and display success message", () => {
    component.openContactManager();
    component.contactFullName = "Deepak Kumar";
    component.contactEmail = "deepak@example.com";
    component.contactPhone = "9876543210";
    component.contactCourse = "DevOps Engineering";
    component.contactIssue = "Unable to sign in with credentials provided by manager.";

    component.submitContactRequest();

    expect(portalServiceMock.contactManager).toHaveBeenCalledWith({
      name: "Deepak Kumar",
      email: "deepak@example.com",
      phone: "9876543210",
      courseName: "DevOps Engineering",
      issueDescription: "Unable to sign in with credentials provided by manager.",
    });

    expect(component.contactSubmitted).toBe(true);
    expect(component.contactSuccess).toBe(
      "Your request has been submitted successfully. The manager will review your issue and assist you."
    );
  });

  it("should prevent duplicate submissions while submitting", () => {
    component.submittingContact = true;
    component.submitContactRequest();
    expect(portalServiceMock.contactManager).not.toHaveBeenCalled();
  });
});
