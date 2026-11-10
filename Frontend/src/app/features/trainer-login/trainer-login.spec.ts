import "@angular/compiler";
import { describe, expect, it, beforeEach, vi } from "vitest";
import { of, throwError } from "rxjs";
import { TrainerLoginComponent } from "./trainer-login";

describe("TrainerLoginComponent", () => {
  let component: TrainerLoginComponent;
  let routerMock: { navigateByUrl: ReturnType<typeof vi.fn> };
  let portalServiceMock: {
    login: ReturnType<typeof vi.fn>;
    setToken: ReturnType<typeof vi.fn>;
    setCurrentTrainer: ReturnType<typeof vi.fn>;
    isLoggedIn: ReturnType<typeof vi.fn>;
    changePassword: ReturnType<typeof vi.fn>;
  };
  let cdrMock: { markForCheck: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    routerMock = { navigateByUrl: vi.fn().mockReturnValue(Promise.resolve(true)) };
    portalServiceMock = {
      login: vi.fn().mockReturnValue(
        of({
          token: "mock-trainer-token",
          mustChangePassword: false,
          trainer: {
            id: "TRN-001",
            name: "Vignesh Kumar",
            email: "vignesh@tvktech.com",
            phone: "9876543210",
            specialization: "Full Stack Development",
            employmentType: "FULL_TIME",
            availability: "AVAILABLE",
          },
        })
      ),
      setToken: vi.fn(),
      setCurrentTrainer: vi.fn(),
      isLoggedIn: vi.fn().mockReturnValue(false),
      changePassword: vi.fn().mockReturnValue(of({ success: true, message: "Password updated successfully." })),
    };
    cdrMock = { markForCheck: vi.fn() };

    component = new TrainerLoginComponent(
      routerMock as any,
      portalServiceMock as any,
      cdrMock as any
    );
  });

  it("should validate required identifier and password before login", () => {
    component.identifier = "";
    component.password = "";
    component.login();
    expect(component.errorMessage).toBe("Please enter both your Trainer ID / Email and Password.");
    expect(portalServiceMock.login).not.toHaveBeenCalled();
  });

  it("should successfully authenticate and navigate directly to /trainer-portal when mustChangePassword is false", () => {
    component.identifier = "TRN-001";
    component.password = "TVK@Trainer2026";
    component.login();

    expect(portalServiceMock.login).toHaveBeenCalledWith("TRN-001", "TVK@Trainer2026");
    expect(portalServiceMock.setToken).toHaveBeenCalledWith("mock-trainer-token");
    expect(portalServiceMock.setCurrentTrainer).toHaveBeenCalled();
    expect(routerMock.navigateByUrl).toHaveBeenCalledWith("/trainer-portal");
  });

  it("should open password change modal when mustChangePassword is true", () => {
    portalServiceMock.login.mockReturnValue(
      of({
        token: "mock-trainer-token",
        mustChangePassword: true,
        trainer: { id: "TRN-001", name: "Vignesh Kumar", email: "vignesh@tvktech.com" },
      })
    );

    component.identifier = "TRN-001";
    component.password = "TVK@Trainer2026";
    component.login();

    expect(component.showPasswordChangeModal).toBe(true);
    expect(component.currentPasswordForChange).toBe("TVK@Trainer2026");
    expect(routerMock.navigateByUrl).not.toHaveBeenCalled();
  });

  it("should validate new password match before changing password", () => {
    component.newPassword = "NewSecretPassword1";
    component.confirmNewPassword = "MismatchPassword";
    component.submitNewPassword();

    expect(component.passwordChangeError).toBe("Passwords do not match.");
    expect(portalServiceMock.changePassword).not.toHaveBeenCalled();
  });

  it("should submit new password and navigate to portal upon success", () => {
    component.currentPasswordForChange = "TVK@Trainer2026";
    component.newPassword = "NewSecurePassword123";
    component.confirmNewPassword = "NewSecurePassword123";
    component.submitNewPassword();

    expect(portalServiceMock.changePassword).toHaveBeenCalledWith(
      "TVK@Trainer2026",
      "NewSecurePassword123"
    );
    expect(routerMock.navigateByUrl).toHaveBeenCalledWith("/trainer-portal");
  });

  it("should display error message when login fails", () => {
    portalServiceMock.login.mockReturnValue(
      throwError(() => ({
        error: { error: { message: "Invalid credentials." } },
      }))
    );

    component.identifier = "TRN-001";
    component.password = "WrongPassword";
    component.login();

    expect(component.errorMessage).toBe("Invalid credentials.");
    expect(routerMock.navigateByUrl).not.toHaveBeenCalled();
  });

  it("should toggle password visibility", () => {
    expect(component.showPassword).toBe(false);
    component.togglePasswordVisibility();
    expect(component.showPassword).toBe(true);
  });
});
