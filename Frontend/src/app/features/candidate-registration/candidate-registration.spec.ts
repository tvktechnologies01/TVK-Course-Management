import "@angular/compiler";
import { afterEach, describe, expect, it, beforeEach, vi } from "vitest";
import { ChangeDetectorRef } from "@angular/core";
import { CandidateRegistrationComponent } from "./candidate-registration";
import { CandidateService } from "../../core/services/candidate.service";

describe("CandidateRegistrationComponent", () => {
  let component: CandidateRegistrationComponent;
  let candidateServiceMock: { register: ReturnType<typeof vi.fn> };
  let changeDetectorMock: { markForCheck: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    candidateServiceMock = {
      register: vi.fn(),
    };
    changeDetectorMock = {
      markForCheck: vi.fn(),
    };

    // Inject service mock
    component = new CandidateRegistrationComponent(
      candidateServiceMock as unknown as CandidateService,
      changeDetectorMock as unknown as ChangeDetectorRef,
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("should initialize with default state", () => {
    expect(component.name).toBe("");
    expect(component.email).toBe("");
    expect(component.phone).toBe("");
    expect(component.lookingFor).toBe("");
    expect(component.programmingLanguage).toBe("");
    expect(component.submitting).toBe(false);
    expect(component.submittedSuccessfully).toBe(false);
  });

  it("accepts only 10-digit Indian mobile numbers", () => {
    component.onPhoneInput("98765abc43210");
    expect(component.phone).toBe("9876543210");
    expect(component.errors["phone"]).toBeUndefined();

    component.onPhoneInput("5123456789");
    expect(component.errors["phone"]).toContain("Indian mobile number");
    expect(component.phone).toBe("5123456789");

    component.onPhoneInput("98765432109");
    expect(component.phone).toBe("9876543210");
  });

  it("shows successful registration after the request completes", async () => {
    Object.assign(component, {
      name: "Jane Doe",
      email: "jane@example.com",
      phone: "9876543210",
      dateOfBirth: "2000-01-15",
      address: "123 Tech Street",
      location: "Chennai",
      state: "Tamil Nadu",
      pincode: "600001",
      yearOfPassing: "2024",
      degree: "B.E. Computer Science",
      college: "Anna University",
      lookingFor: "Training",
      programmingLanguage: "Java",
      modeOfCourse: "Online",
      howDidYouFindUs: "LinkedIn",
      courseDuration: "3 Months",
      preferredStartDate: component.minPreferredStartDate,
    });

    candidateServiceMock.register.mockResolvedValue({ id: "CAN-123", name: "Jane Doe" });
    vi.stubGlobal("window", { scrollTo: vi.fn() });

    await component.submitRegistration();

    expect(component.submitting).toBe(false);
    expect(component.submittedSuccessfully).toBe(true);
    expect(component.registeredCandidateId).toBe("CAN-123");
    expect(changeDetectorMock.markForCheck).toHaveBeenCalled();
  });

  it("does not allow a course start date before today", () => {
    component.preferredStartDate = "2000-01-01";
    component.validateField("preferredStartDate");

    expect(component.errors["preferredStartDate"]).toBe("Choose today or a future date.");

    component.preferredStartDate = component.minPreferredStartDate;
    component.validateField("preferredStartDate");
    expect(component.errors["preferredStartDate"]).toBeUndefined();
  });

  describe("Validation", () => {
    it("should flag invalid name", () => {
      component.name = "";
      component.validateField("name");
      expect(component.errors["name"]).toBe("Name is required.");

      component.name = "A";
      component.validateField("name");
      expect(component.errors["name"]).toBe("Name must be at least 2 characters.");

      component.name = "Valid Name";
      component.validateField("name");
      expect(component.errors["name"]).toBeUndefined();
    });

    it("should flag invalid degree with 'Name of Degree is required.'", () => {
      component.degree = "";
      component.validateField("degree");
      expect(component.errors["degree"]).toBe("Name of Degree is required.");

      component.degree = "B.Tech Computer Science";
      component.validateField("degree");
      expect(component.errors["degree"]).toBeUndefined();
    });

    it("should flag invalid email", () => {
      component.email = "notanemail";
      component.validateField("email");
      expect(component.errors["email"]).toBe("Please enter a valid email address.");

      component.email = "test@example.com";
      component.validateField("email");
      expect(component.errors["email"]).toBeUndefined();
    });

    it("should flag invalid phone number", () => {
      component.phone = "123";
      component.validateField("phone");
      expect(component.errors["phone"]).toContain("10-digit Indian mobile number");

      component.phone = "9876543210";
      component.validateField("phone");
      expect(component.errors["phone"]).toBeUndefined();
    });

    it("should validate all required fields when submitting", () => {
      const isValid = component.validateAll();
      expect(isValid).toBe(false);
      expect(Object.keys(component.errors).length).toBeGreaterThan(0);
    });

    it("ensures Choose Course option is available for Internship, Training, Placements, and Projects", () => {
      const options = ["Internship", "Training", "Placements", "Projects"] as const;
      for (const opt of options) {
        component.lookingFor = opt;
        component.modeOfCourse = "Online";
        expect(component.isJobMode).toBe(false);

        // programmingLanguage is required and validated for each option
        component.programmingLanguage = "";
        component.validateField("programmingLanguage");
        expect(component.errors["programmingLanguage"]).toBe("Please choose a course.");

        component.programmingLanguage = "Full Stack Development with Java & Angular";
        component.validateField("programmingLanguage");
        expect(component.errors["programmingLanguage"]).toBeUndefined();
      }
    });

    it("handles Job mode when selected under lookingFor by disabling course fields and opening skills fields", () => {
      // 1. When clicking Job under Looking For
      component.modeOfCourse = "Online";
      component.lookingFor = "Job";
      component.programmingLanguage = "Java";
      component.courseDuration = "3 Months";
      component.preferredStartDate = "2026-12-01";
      component.errors["programmingLanguage"] = "Error";
      component.errors["courseDuration"] = "Error";
      component.errors["preferredStartDate"] = "Error";

      component.onLookingForChange();

      expect(component.isJobMode).toBe(true);
      expect(component.programmingLanguage).toBe("");
      expect(component.courseDuration).toBe("");
      expect(component.preferredStartDate).toBe("");
      expect(component.errors["programmingLanguage"]).toBeUndefined();
      expect(component.errors["courseDuration"]).toBeUndefined();
      expect(component.errors["preferredStartDate"]).toBeUndefined();

      // 2. For non-Job modes, course fields are required
      component.lookingFor = "Training";
      component.modeOfCourse = "Online";
      expect(component.isJobMode).toBe(false);
      component.validateField("programmingLanguage");
      expect(component.errors["programmingLanguage"]).toBe("Please choose a course.");
      component.validateField("courseDuration");
      expect(component.errors["courseDuration"]).toBe("Please select Course Duration.");
      component.validateField("preferredStartDate");
      expect(component.errors["preferredStartDate"]).toBe("Preferred start date is required.");
    });

    it("successfully submits registration in Job mode with Primary and Secondary Skills and Referred by friends", async () => {
      Object.assign(component, {
        name: "Jane Jobseeker",
        email: "jane.job@example.com",
        phone: "9876543210",
        dateOfBirth: "1998-05-20",
        address: "456 Career Road",
        location: "Bengaluru",
        state: "Karnataka",
        pincode: "560001",
        yearOfPassing: "2023",
        degree: "B.E. Information Technology",
        college: "VTU",
        lookingFor: "Job",
        modeOfCourse: "Online",
        primarySkills: "Angular, TypeScript",
        secondarySkills: "Node.js, Docker",
        howDidYouFindUs: "Referred by friends",
      });

      candidateServiceMock.register.mockResolvedValue({ id: "CAN-JOB-001", name: "Jane Jobseeker" });
      vi.stubGlobal("window", { scrollTo: vi.fn() });

      await component.submitRegistration();

      expect(component.submitting).toBe(false);
      expect(component.submittedSuccessfully).toBe(true);
      expect(component.registeredCandidateId).toBe("CAN-JOB-001");
      expect(candidateServiceMock.register).toHaveBeenCalled();

      const passedFormData = candidateServiceMock.register.mock.calls[0][0] as FormData;
      expect(passedFormData.get("modeOfCourse")).toBe("Online");
      expect(passedFormData.get("primarySkills")).toBe("Angular, TypeScript");
      expect(passedFormData.get("secondarySkills")).toBe("Node.js, Docker");
      expect(passedFormData.get("degree")).toBe("B.E. Information Technology");
      expect(passedFormData.get("howDidYouFindUs")).toBe("Referred by friends");
    });
  });

  describe("Reset Form", () => {
    it("should reset all fields and clear errors", () => {
      component.name = "John";
      component.email = "john@example.com";
      component.state = "Tamil Nadu";
      component.pincode = "600001";
      component.errors = { name: "Error" };
      component.submittedSuccessfully = true;

      component.resetForm();

      expect(component.name).toBe("");
      expect(component.email).toBe("");
      expect(component.state).toBe("");
      expect(component.pincode).toBe("");
      expect(component.errors).toEqual({});
      expect(component.submittedSuccessfully).toBe(false);
    });
  });
});
