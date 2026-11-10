import { ChangeDetectorRef, Component, ElementRef, inject, Optional, ViewChild } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { CandidateService } from "../../core/services/candidate.service";

export const LOOKING_FOR_OPTIONS = [
  "Internship",
  "Training",
  "Placements",
  "Projects",
  "Job",
] as const;

export const COURSE_OPTIONS = [
  "Full Stack Development with Java & Angular",
  "Cloud Engineering with AWS & Azure",
  "DevOps Engineering",
  "Python for Web Development & Automation",
  "C# & .NET Development",
  "IoT with Embedded C",
  "Digital Marketing",
  "AI with Machine Learning",
  "Python with Data Science",
  "Java with Automation Testing",
  "Java with ReactJS",
  "Hardware and Networking",
  "IoT (Internet of Things)",
  "Robotics",
  "Japanese Spoken",
  "AI & Data Science",
] as const;

export const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa",
  "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala",
  "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland",
  "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura",
  "Uttar Pradesh", "Uttarakhand", "West Bengal", "Andaman and Nicobar Islands",
  "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Jammu and Kashmir",
  "Ladakh", "Lakshadweep", "Puducherry",
] as const;

export const MODE_OF_COURSE_OPTIONS = ["Online", "Offline"] as const;

export const HOW_FOUND_OPTIONS = [
  "Employee Referral",
  "LinkedIn",
  "Instagram",
  "YouTube",
  "Referred by friends",
] as const;

export const COURSE_DURATION_OPTIONS = ["15 Days", "1 Month", "3 Months", "6 Months"] as const;

const MAX_RESUME_SIZE = 1 * 1024 * 1024; // 1 MB
const ALLOWED_EXTENSIONS = [".pdf", ".doc", ".docx"];

@Component({
  selector: "app-candidate-registration",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./candidate-registration.html",
  styleUrl: "./candidate-registration.css",
})
export class CandidateRegistrationComponent {
  private readonly candidateService: CandidateService;
  private readonly changeDetector?: ChangeDetectorRef;

  @ViewChild("fileInput") fileInputRef?: ElementRef<HTMLInputElement>;

  constructor(
    @Optional() candidateService?: CandidateService,
    @Optional() changeDetector?: ChangeDetectorRef,
  ) {
    this.candidateService = candidateService ?? inject(CandidateService);
    this.changeDetector = changeDetector;
  }

  readonly lookingForOptions = LOOKING_FOR_OPTIONS;
  readonly courseOptions = COURSE_OPTIONS;
  readonly indianStates = INDIAN_STATES;
  readonly modeOfCourseOptions = MODE_OF_COURSE_OPTIONS;
  readonly howFoundOptions = HOW_FOUND_OPTIONS;
  readonly courseDurationOptions = COURSE_DURATION_OPTIONS;

  // Form Fields
  name = "";
  email = "";
  phone = "";
  dateOfBirth = "";
  address = "";
  location = "";
  state = "";
  pincode = "";
  yearOfPassing = "";
  degree = "";
  college = "";
  lookingFor = "";
  programmingLanguage = "";
  modeOfCourse = "";
  primarySkills = "";
  secondarySkills = "";
  howDidYouFindUs = "";
  courseDuration = "";
  preferredStartDate = "";

  get isJobMode(): boolean {
    return this.lookingFor === "Job";
  }

  onLookingForChange(): void {
    this.validateField("lookingFor");
    if (this.lookingFor === "Job") {
      this.handleJobModeSelected();
    } else {
      this.clearSkillFields();
    }
  }

  onModeOfCourseChange(): void {
    this.validateField("modeOfCourse");
  }

  private handleJobModeSelected(): void {
    this.programmingLanguage = "";
    this.courseDuration = "";
    this.preferredStartDate = "";
    delete this.errors["programmingLanguage"];
    delete this.errors["courseDuration"];
    delete this.errors["preferredStartDate"];
  }

  private clearSkillFields(): void {
    this.primarySkills = "";
    this.secondarySkills = "";
    delete this.errors["primarySkills"];
    delete this.errors["secondarySkills"];
  }

  // Resume File
  resumeFile: File | null = null;
  resumeFileName = "";
  resumeFileSizeFormatted = "";
  resumeError = "";

  // Status & Validation
  submitting = false;
  submitError = "";
  submittedSuccessfully = false;
  registeredCandidateId = "";
  registeredCandidateName = "";
  errors: Record<string, string> = {};
  touched: Record<string, boolean> = {};

  markTouched(field: string): void {
    this.touched[field] = true;
    this.validateField(field);
  }

  onPhoneInput(value: string): void {
    this.phone = value.replace(/\D/g, "").slice(0, 10);
    this.validateField("phone");
  }

  onPincodeInput(value: string): void {
    this.pincode = value.replace(/\D/g, "").slice(0, 6);
    this.validateField("pincode");
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.resumeError = "";

    if (!input.files || input.files.length === 0) {
      return;
    }

    const file = input.files[0];
    const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();

    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      this.resumeError = "Unsupported file type. Please upload a PDF, DOC, or DOCX document.";
      this.clearFileInput();
      return;
    }

    if (file.size > MAX_RESUME_SIZE) {
      this.resumeError = `Resume file size exceeds the 1 MB limit (${(file.size / (1024 * 1024)).toFixed(2)} MB).`;
      this.clearFileInput();
      return;
    }

    this.resumeFile = file;
    this.resumeFileName = file.name;
    this.resumeFileSizeFormatted = this.formatFileSize(file.size);
    delete this.errors["resume"];
  }

  removeResume(): void {
    this.resumeFile = null;
    this.resumeFileName = "";
    this.resumeFileSizeFormatted = "";
    this.resumeError = "";
    if (this.fileInputRef?.nativeElement) {
      this.fileInputRef.nativeElement.value = "";
    }
  }

  private clearFileInput(): void {
    this.resumeFile = null;
    this.resumeFileName = "";
    this.resumeFileSizeFormatted = "";
    if (this.fileInputRef?.nativeElement) {
      this.fileInputRef.nativeElement.value = "";
    }
  }

  private formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  // Validation
  validateField(field: string): void {
    switch (field) {
      case "name":
        if (!this.name.trim()) {
          this.errors["name"] = "Name is required.";
        } else if (this.name.trim().length < 2) {
          this.errors["name"] = "Name must be at least 2 characters.";
        } else {
          delete this.errors["name"];
        }
        break;

      case "email":
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!this.email.trim()) {
          this.errors["email"] = "Email address is required.";
        } else if (!emailRegex.test(this.email.trim())) {
          this.errors["email"] = "Please enter a valid email address.";
        } else {
          delete this.errors["email"];
        }
        break;

      case "phone":
        if (!this.phone.trim()) {
          this.errors["phone"] = "Phone number is required.";
        } else if (!/^[6-9]\d{9}$/.test(this.phone)) {
          this.errors["phone"] = "Enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.";
        } else {
          delete this.errors["phone"];
        }
        break;

      case "dateOfBirth":
        if (!this.dateOfBirth) {
          this.errors["dateOfBirth"] = "Date of birth is required.";
        } else {
          delete this.errors["dateOfBirth"];
        }
        break;

      case "address":
        if (!this.address.trim()) {
          this.errors["address"] = "Address is required.";
        } else {
          delete this.errors["address"];
        }
        break;

      case "location":
        if (!this.location.trim()) {
          this.errors["location"] = "Location is required.";
        } else {
          delete this.errors["location"];
        }
        break;

      case "state":
        if (!this.state) {
          this.errors["state"] = "Please select your state.";
        } else {
          delete this.errors["state"];
        }
        break;

      case "pincode":
        if (!/^[1-9]\d{5}$/.test(this.pincode)) {
          this.errors["pincode"] = "Enter a valid 6-digit Indian PIN code.";
        } else {
          delete this.errors["pincode"];
        }
        break;

      case "yearOfPassing":
        if (!this.yearOfPassing.trim()) {
          this.errors["yearOfPassing"] = "Degree passout is required.";
        } else if (!/^\d{4}$/.test(this.yearOfPassing.trim())) {
          this.errors["yearOfPassing"] = "Please enter a valid 4-digit year (e.g. 2024).";
        } else {
          delete this.errors["yearOfPassing"];
        }
        break;

      case "degree":
        if (!this.degree.trim()) {
          this.errors["degree"] = "Name of Degree is required.";
        } else {
          delete this.errors["degree"];
        }
        break;

      case "college":
        if (!this.college.trim()) {
          this.errors["college"] = "College/University is required.";
        } else {
          delete this.errors["college"];
        }
        break;

      case "lookingFor":
        if (!this.lookingFor) {
          this.errors["lookingFor"] = "Please select an option for Looking For.";
        } else {
          delete this.errors["lookingFor"];
        }
        break;

      case "programmingLanguage":
        if (this.isJobMode) {
          delete this.errors["programmingLanguage"];
        } else if (!this.programmingLanguage) {
          this.errors["programmingLanguage"] = "Please choose a course.";
        } else {
          delete this.errors["programmingLanguage"];
        }
        break;

      case "modeOfCourse":
        if (!this.modeOfCourse) {
          this.errors["modeOfCourse"] = "Please select Mode of Course.";
        } else {
          delete this.errors["modeOfCourse"];
        }
        break;

      case "primarySkills":
        delete this.errors["primarySkills"];
        break;

      case "secondarySkills":
        delete this.errors["secondarySkills"];
        break;

      case "howDidYouFindUs":
        if (!this.howDidYouFindUs) {
          this.errors["howDidYouFindUs"] = "Please select how you found us.";
        } else {
          delete this.errors["howDidYouFindUs"];
        }
        break;

      case "courseDuration":
        if (this.isJobMode) {
          delete this.errors["courseDuration"];
        } else if (!this.courseDuration) {
          this.errors["courseDuration"] = "Please select Course Duration.";
        } else {
          delete this.errors["courseDuration"];
        }
        break;

      case "preferredStartDate":
        if (this.isJobMode) {
          delete this.errors["preferredStartDate"];
        } else if (!this.preferredStartDate) {
          this.errors["preferredStartDate"] = "Preferred start date is required.";
        } else if (this.preferredStartDate < this.minPreferredStartDate) {
          this.errors["preferredStartDate"] = "Choose today or a future date.";
        } else {
          delete this.errors["preferredStartDate"];
        }
        break;
    }
  }

  validateAll(): boolean {
    const fields = [
      "name",
      "email",
      "phone",
      "dateOfBirth",
      "address",
      "location",
      "state",
      "pincode",
      "yearOfPassing",
      "degree",
      "college",
      "lookingFor",
      "modeOfCourse",
      "howDidYouFindUs",
    ];

    if (!this.isJobMode) {
      fields.push("programmingLanguage", "courseDuration", "preferredStartDate");
    }

    for (const field of fields) {
      this.touched[field] = true;
      this.validateField(field);
    }

    if (this.resumeError) {
      return false;
    }

    return Object.keys(this.errors).length === 0;
  }

  async submitRegistration(): Promise<void> {
    if (this.submitting) return;

    this.submitError = "";

    if (!this.validateAll()) {
      this.submitError = "Please correct the highlighted errors before submitting.";
      const firstErrorEl = document.querySelector(".field-error, .input-error");
      if (firstErrorEl) {
        firstErrorEl.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }

    const formData = new FormData();
    formData.append("name", this.name.trim());
    formData.append("email", this.email.trim());
    formData.append("phone", this.phone.trim());
    formData.append("dateOfBirth", this.dateOfBirth);
    formData.append("address", this.address.trim());
    formData.append("location", this.location.trim());
    formData.append("state", this.state);
    formData.append("pincode", this.pincode);
    formData.append("yearOfPassing", this.yearOfPassing.trim());
    formData.append("degree", this.degree.trim());
    formData.append("college", this.college.trim());
    formData.append("lookingFor", this.lookingFor);
    formData.append("programmingLanguage", this.programmingLanguage);
    formData.append("modeOfCourse", this.modeOfCourse);
    formData.append("primarySkills", this.primarySkills.trim());
    formData.append("secondarySkills", this.secondarySkills.trim());
    formData.append("howDidYouFindUs", this.howDidYouFindUs);
    formData.append("courseDuration", this.courseDuration);
    formData.append("preferredStartDate", this.preferredStartDate);

    if (this.resumeFile) {
      formData.append("resume", this.resumeFile, this.resumeFile.name);
    }

    this.submitting = true;

    try {
      const response = await this.candidateService.register(formData);
      this.registeredCandidateId = response.id;
      this.registeredCandidateName = response.name || this.name;
      this.submittedSuccessfully = true;
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error: unknown) {
      if (error instanceof Error) {
        this.submitError = error.message;
      } else {
        this.submitError = "An unexpected error occurred while saving your registration. Please try again.";
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      this.submitting = false;
      this.changeDetector?.markForCheck();
    }
  }

  get minPreferredStartDate(): string {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${now.getFullYear()}-${month}-${day}`;
  }

  resetForm(): void {
    this.name = "";
    this.email = "";
    this.phone = "";
    this.dateOfBirth = "";
    this.address = "";
    this.location = "";
    this.state = "";
    this.pincode = "";
    this.yearOfPassing = "";
    this.degree = "";
    this.college = "";
    this.lookingFor = "";
    this.programmingLanguage = "";
    this.modeOfCourse = "";
    this.primarySkills = "";
    this.secondarySkills = "";
    this.howDidYouFindUs = "";
    this.courseDuration = "";
    this.preferredStartDate = "";

    this.removeResume();

    this.errors = {};
    this.touched = {};
    this.submitError = "";
    this.submittedSuccessfully = false;
    this.registeredCandidateId = "";
    this.registeredCandidateName = "";
  }
}
