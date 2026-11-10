export interface CourseTrack {
  duration: string; // "15 Days" | "1 Month" | "3 Months" | "6 Months"
  fees: number;
  curriculumFileId?: string | null;
  curriculumFileName?: string;
  curriculumFileType?: string;
  curriculumFileSize?: number;
  curriculumUploadedAt?: string | null;
  curriculumUploadedBy?: string;
}

export interface Course {
  id: string;
  name: string;
  code: string;
  category: string;
  duration: string;
  mode: string;
  fees: number;
  description: string;
  keyTopics: string[];
  status: "ACTIVE" | "INACTIVE";
  tracks?: CourseTrack[];
  curriculumFileId?: string | null;
  curriculumFileName?: string;
  curriculumFileType?: string;
  curriculumFileSize?: number;
  curriculumUploadedAt?: string | null;
  lastModifiedBy?: string;
  lastModifiedByUserId?: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}
