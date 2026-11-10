import { describe, expect, it } from "vitest";
import { CandidateModel } from "../models/candidate.model";
import {
  candidateRegistrationSchema,
  LOOKING_FOR_OPTIONS,
  REGISTRATION_COURSES,
  MODE_OF_COURSE_OPTIONS,
  HOW_FOUND_OPTIONS,
  COURSE_DURATION_OPTIONS,
  outboundCandidateSchema,
} from "./candidate.validators";

describe("Candidate Registration Schema Validation", () => {
  const futureDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const validPayload = {
    name: "John Doe",
    email: "john.doe@example.com",
    phone: "9876543210",
    dateOfBirth: "2000-01-15",
    address: "123 Tech Street, Guindy",
    location: "Chennai",
    yearOfPassing: "2024",
    degree: "B.E. Computer Science",
    college: "Anna University",
    lookingFor: "Training",
    programmingLanguage: "Full Stack Development with Java & Angular",
    modeOfCourse: "Online",
    howDidYouFindUs: "LinkedIn",
    courseDuration: "3 Months",
    state: "Tamil Nadu",
    pincode: "600001",
    preferredStartDate: futureDate,
  };

  it("omits accountUsername when a candidate portal account has not been created", () => {
    const candidate = new CandidateModel({ _id: "CAN-test", source: "WEBSITE_APPLICATION" });

    expect(candidate.toObject()).not.toHaveProperty("accountUsername");
  });

  describe("Outbound Candidate Schema Validation", () => {
    const outboundCandidate = {
      name: "Asha Kumar",
      email: "asha@example.com",
      phone: "9876543210",
      position: "Java Developer",
    };

    it("accepts both supported outbound entry methods", () => {
      expect(outboundCandidateSchema.safeParse({
        ...outboundCandidate,
        entryMethod: "MANUAL_TYPING",
      }).success).toBe(true);
      expect(outboundCandidateSchema.safeParse({
        ...outboundCandidate,
        entryMethod: "RECEIVED_FROM_EMAIL",
      }).success).toBe(true);
    });

    it("continues accepting existing outbound API payloads without an entry method", () => {
      expect(outboundCandidateSchema.safeParse(outboundCandidate).success).toBe(true);
      expect(outboundCandidateSchema.safeParse({
        ...outboundCandidate,
        entryMethod: "UNSUPPORTED",
      }).success).toBe(false);
    });
  });

  it("should validate a complete and correct registration payload", () => {
    const result = candidateRegistrationSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("John Doe");
      expect(result.data.programmingLanguage).toBe("Full Stack Development with Java & Angular");
    }
  });

  it("should reject payload when name is missing", () => {
    const result = candidateRegistrationSchema.safeParse({ ...validPayload, name: "" });
    expect(result.success).toBe(false);
  });

  it("should reject invalid email format", () => {
    const result = candidateRegistrationSchema.safeParse({ ...validPayload, email: "not-an-email" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes("email"))).toBe(true);
    }
  });

  it("should reject invalid Indian mobile numbers", () => {
    const result = candidateRegistrationSchema.safeParse({ ...validPayload, phone: "5123456789" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes("phone"))).toBe(true);
    }
    expect(candidateRegistrationSchema.safeParse({ ...validPayload, phone: "987654321" }).success).toBe(false);
  });

  it("should validate all allowed Looking For options", () => {
    for (const option of LOOKING_FOR_OPTIONS) {
      const result = candidateRegistrationSchema.safeParse({ ...validPayload, lookingFor: option });
      expect(result.success).toBe(true);
    }
    const invalid = candidateRegistrationSchema.safeParse({ ...validPayload, lookingFor: "InvalidOption" });
    expect(invalid.success).toBe(false);
  });

  it("should validate all allowed Mode of Course options", () => {
    for (const mode of MODE_OF_COURSE_OPTIONS) {
      const result = candidateRegistrationSchema.safeParse({ ...validPayload, modeOfCourse: mode });
      expect(result.success).toBe(true);
    }
    const invalid = candidateRegistrationSchema.safeParse({ ...validPayload, modeOfCourse: "Hybrid" });
    expect(invalid.success).toBe(false);
  });

  it("validates registration payload when lookingFor is Job with primary and secondary skills and without course/duration/date", () => {
    const jobPayload = {
      ...validPayload,
      lookingFor: "Job",
      modeOfCourse: "Online",
      programmingLanguage: "",
      courseDuration: "",
      preferredStartDate: "",
      primarySkills: "Java, Spring Boot",
      secondarySkills: "Docker, Kubernetes",
    };
    const result = candidateRegistrationSchema.safeParse(jobPayload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.lookingFor).toBe("Job");
      expect(result.data.primarySkills).toBe("Java, Spring Boot");
      expect(result.data.secondarySkills).toBe("Docker, Kubernetes");
    }
  });

  it("should validate all allowed How Found Us options", () => {
    for (const option of HOW_FOUND_OPTIONS) {
      const result = candidateRegistrationSchema.safeParse({ ...validPayload, howDidYouFindUs: option });
      expect(result.success).toBe(true);
    }
  });

  it("should validate all available TVK courses", () => {
    for (const course of REGISTRATION_COURSES) {
      expect(candidateRegistrationSchema.safeParse({ ...validPayload, programmingLanguage: course }).success).toBe(true);
    }
    expect(candidateRegistrationSchema.safeParse({ ...validPayload, programmingLanguage: "Unlisted Course" }).success).toBe(false);
  });

  it("should validate all allowed Course Duration options", () => {
    for (const duration of COURSE_DURATION_OPTIONS) {
      const result = candidateRegistrationSchema.safeParse({ ...validPayload, courseDuration: duration });
      expect(result.success).toBe(true);
    }
  });

  it("should reject invalid Indian PIN codes and past course start dates", () => {
    expect(candidateRegistrationSchema.safeParse({ ...validPayload, pincode: "01234" }).success).toBe(false);
    expect(candidateRegistrationSchema.safeParse({ ...validPayload, preferredStartDate: "2000-01-01" }).success).toBe(false);
  });

  it("requires an address state and PIN code", () => {
    expect(candidateRegistrationSchema.safeParse({ ...validPayload, state: "" }).success).toBe(false);
    expect(candidateRegistrationSchema.safeParse({ ...validPayload, state: "Not a state" }).success).toBe(false);
    expect(candidateRegistrationSchema.safeParse({ ...validPayload, pincode: "" }).success).toBe(false);
  });
});
