export type TrainerEmploymentType = "FULL_TIME" | "PART_TIME" | "CONTRACT";
export type TrainerAvailabilityStatus = "AVAILABLE" | "ABSENT" | "ON_LEAVE" | "UNAVAILABLE" | "PRESENT" | "NOT_CHECKED_IN";
export type TrainerStatus = "ACTIVE" | "INACTIVE";

export interface Trainer {
  id: string;
  _id?: string;
  name: string;
  email: string;
  phone?: string;
  qualification?: string;
  specialization?: string;
  skills: string[];
  assignedCourses: string[];
  qualifiedCourses: string[];
  employmentType: TrainerEmploymentType;
  maxCapacity: number;
  currentStudentCount: number;
  remainingCapacity?: number;
  utilizationPercent?: number;
  availability: TrainerAvailabilityStatus;
  todayStatus?: "PRESENT" | "NOT_CHECKED_IN" | "ON_LEAVE" | "ABSENT" | string;
  checkInTime?: string | Date | null;
  status: TrainerStatus;
  absenceStartDate?: string | Date | null;
  expectedReturnDate?: string | Date | null;
  actualReturnDate?: string | Date | null;
  absenceReason?: string;
  hourlyRate?: number;
  contractTerms?: string;
  documents?: Array<{ name: string; url?: string; uploadedAt?: string | Date }>;
  averageRating?: number;
  totalRatings?: number;
  notes?: string;
  accountPassword?: string;
  mustChangePassword?: boolean;
  lastLoginAt?: string | Date | null;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface AbsentTrainerAlert {
  trainerId: string;
  trainerName: string;
  trainerEmail: string;
  availability: TrainerAvailabilityStatus;
  absenceReason?: string;
  absenceStartDate?: string | Date | null;
  expectedReturnDate?: string | Date | null;
  affectedStudentCount: number;
  qualifiedCourses: string[];
}

export interface TrainerOverview {
  totalTrainers: number;
  availableTrainers: number;
  absentTrainers: number;
  totalActiveStudents: number;
  unassignedStudents: number;
  coursesWithoutTrainers: number;
  trainerWorkloads: Trainer[];
  absentTrainersWithStudents?: AbsentTrainerAlert[];
}

export interface CourseAllocationItem {
  courseId: string;
  courseName: string;
  courseCode: string;
  category: string;
  duration: string;
  primaryTrainer: {
    id: string;
    name: string;
    email: string;
    currentCount: number;
    maxCapacity: number;
  } | null;
  backupTrainers: Array<{
    id: string;
    name: string;
    email: string;
  }>;
  enrolledStudentCount: number;
  qualifiedTrainers: Array<{
    id: string;
    name: string;
    email: string;
    availability: string;
    remainingCapacity: number;
  }>;
}

export interface EligibleStudent {
  id: string;
  name: string;
  email: string;
  phone: string;
  enrolledCourse: string;
  trainerId: string | null;
  trainerName: string | null;
  trainerEmail: string | null;
  trainerAssignedAt: string | Date | null;
  trainerAllocationStatus: string;
}

export interface AutoAllocationPreview {
  totalUnassigned: number;
  allocatableCount: number;
  unallocatableCount: number;
  proposedAllocations: Array<{
    studentId: string;
    studentName: string;
    courseName: string;
    proposedTrainerId: string;
    proposedTrainerName: string;
    trainerRemainingCapacity: number;
  }>;
  courseBreakdowns: Array<{
    courseName: string;
    unassignedCount: number;
    availableTrainersCount: number;
    allocatableCount: number;
  }>;
  warnings: string[];
}

export interface TrainerAllocationHistory {
  id: string;
  studentId: string;
  studentName: string;
  courseName: string;
  previousTrainerId: string | null;
  previousTrainerName: string | null;
  newTrainerId: string | null;
  newTrainerName: string | null;
  action: string;
  reason?: string;
  updatedBy: string;
  allocatedAt: string | Date;
}

export interface AbsenceImpactData {
  trainer: Trainer;
  affectedStudents: Array<{ id: string; name: string; courseName: string; email: string }>;
  eligibleReplacements: Array<{
    trainerId: string;
    trainerName: string;
    currentCount: number;
    maxCapacity: number;
    remainingCapacity: number;
    courses: string[];
  }>;
}

export interface TrainerBatch {
  id: string;
  batchName: string;
  courseId?: string;
  courseName: string;
  trainerId: string;
  trainerName: string;
  timeSlot: string;
  days: string[];
  meetingLink?: string;
  classroomLocation?: string;
  startDate: string | Date;
  endDate?: string | Date | null;
  totalSessions?: number;
  status: "UPCOMING" | "ACTIVE" | "COMPLETED";
  studentIds: string[];
  notes?: string;
  createdAt?: string | Date;
}

export interface InstitutionalHoliday {
  _id?: string;
  id?: string;
  date: string; // "YYYY-MM-DD"
  name: string;
  type: "GOVERNMENT" | "INSTITUTIONAL" | "FESTIVAL" | "OTHER";
  description?: string;
}

export interface BatchScheduleCalculation {
  startDate: string;
  endDate: string;
  totalSessions: number;
  calendarDaysSpan: number;
  sessionDates: Array<{ sessionNumber: number; date: string; dayOfWeek: string }>;
  skippedHolidays: Array<{ date: string; name: string }>;
  skippedWeekendDays: number;
}

export interface TrainerAttendance {
  id: string;
  batchId?: string;
  courseName: string;
  trainerId: string;
  trainerName: string;
  studentId: string;
  studentName: string;
  date: string;
  status: "PRESENT" | "ABSENT" | "LATE";
  topicCovered?: string;
  remarks?: string;
  markedBy?: string;
}

export interface StudentScorecard {
  id: string;
  studentId: string;
  studentName: string;
  courseName: string;
  trainerId: string;
  trainerName: string;
  technicalScore: number;
  problemSolvingScore: number;
  communicationScore: number;
  overallScore: number;
  readinessStatus: "READY" | "NEEDS_IMPROVEMENT" | "NOT_READY";
  feedback: string;
  recommendedRole?: string;
  evaluatedBy: string;
  assessedAt: string | Date;
}

export interface TrainerFeedback {
  id: string;
  trainerId: string;
  trainerName: string;
  studentId: string;
  studentName: string;
  courseName: string;
  rating: number;
  feedback: string;
  createdAt: string | Date;
}

export interface MonthlyStudentAttendanceRow {
  studentId: string;
  studentName: string;
  enrolledCourse: string;
  trainerId: string;
  trainerName: string;
  dayStatuses: Record<number, { status: "PRESENT" | "ABSENT" | "LATE"; topic?: string; remarks?: string; date: string }>;
  totalHeld: number;
  presentCount: number;
  lateCount: number;
  absentCount: number;
  convertedLeaveDays?: number;
  activeStrikes?: number;
  attendancePercent: number;
  consecutiveAbsents: number;
  isAtRisk: boolean;
}

export interface FacultyRegisterMatrixRow {
  trainerId: string;
  trainerName: string;
  email: string;
  assignedCourses: string[];
  courseTrackDisplay: string;
  batchNames: string[];
  batchDisplay: string;
  studentCount: number;
  dayStatuses: Record<number, {
    status: "PRESENT" | "ABSENT" | "ON_LEAVE" | "HOLIDAY" | "PENDING";
    checkInTime?: string;
    topic?: string;
    remarks?: string;
    date: string;
  }>;
  dateStatuses?: Record<string, {
    status: "PRESENT" | "ABSENT" | "ON_LEAVE" | "HOLIDAY" | "PENDING";
    checkInTime?: string;
    topic?: string;
    remarks?: string;
    date: string;
  }>;
  totalHeld: number;
  presentCount: number;
  leaveCount: number;
  absentCount: number;
  convertedLeaveDays?: number;
  activeStrikes?: number;
  attendancePercent: number;
  todayStatus: "PRESENT" | "ABSENT" | "ON_LEAVE" | "HOLIDAY" | "PENDING";
  todayCheckInTime?: string;
}
