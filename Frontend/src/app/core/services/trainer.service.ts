import { Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";
import { ApiService } from "./api.service";
import {
  Trainer,
  TrainerOverview,
  CourseAllocationItem,
  EligibleStudent,
  AutoAllocationPreview,
  TrainerAllocationHistory,
  AbsenceImpactData,
  TrainerAvailabilityStatus,
  TrainerStatus,
  TrainerBatch,
  TrainerAttendance,
  StudentScorecard,
  TrainerFeedback,
  InstitutionalHoliday,
  BatchScheduleCalculation,
} from "../models/trainer.model";

@Injectable({
  providedIn: "root",
})
export class TrainerService {
  constructor(private readonly api: ApiService) {}

  async getOverview(): Promise<TrainerOverview> {
    return firstValueFrom(this.api.get<TrainerOverview>("/trainers/overview"));
  }

  async getTrainers(filters?: {
    search?: string;
    status?: string;
    availability?: string;
    employmentType?: string;
    course?: string;
  }): Promise<Trainer[]> {
    const queryParams: Record<string, string> = {};
    if (filters?.search) queryParams["search"] = filters.search;
    if (filters?.status) queryParams["status"] = filters.status;
    if (filters?.availability) queryParams["availability"] = filters.availability;
    if (filters?.employmentType) queryParams["employmentType"] = filters.employmentType;
    if (filters?.course) queryParams["course"] = filters.course;

    return firstValueFrom(this.api.get<Trainer[]>("/trainers", queryParams));
  }

  async getTrainerById(trainerId: string): Promise<{
    trainer: Trainer;
    assignedStudents: any[];
    assignedCoursesDetails: any[];
  }> {
    return firstValueFrom(
      this.api.get<{ trainer: Trainer; assignedStudents: any[]; assignedCoursesDetails: any[] }>(
        `/trainers/${encodeURIComponent(trainerId)}`
      )
    );
  }

  async createTrainer(data: Partial<Trainer>): Promise<Trainer> {
    return firstValueFrom(this.api.post<Trainer>("/trainers", data));
  }

  async updateTrainer(trainerId: string, data: Partial<Trainer>): Promise<Trainer> {
    return firstValueFrom(this.api.put<Trainer>(`/trainers/${encodeURIComponent(trainerId)}`, data));
  }

  async toggleTrainerStatus(trainerId: string, status: TrainerStatus): Promise<Trainer> {
    return firstValueFrom(
      this.api.patch<Trainer>(`/trainers/${encodeURIComponent(trainerId)}/status`, { status })
    );
  }

  async resetTrainerPassword(trainerId: string): Promise<{ defaultPassword: string }> {
    return firstValueFrom(
      this.api.post<{ defaultPassword: string }>(`/trainers/${encodeURIComponent(trainerId)}/reset-password`, {})
    );
  }

  async getCourseAllocations(): Promise<CourseAllocationItem[]> {
    return firstValueFrom(this.api.get<CourseAllocationItem[]>("/trainers/courses/allocations"));
  }

  async setCourseAllocation(
    courseId: string,
    data: {
      primaryTrainerId: string | null;
      backupTrainerIds?: string[];
      notes?: string;
    }
  ): Promise<any> {
    return firstValueFrom(
      this.api.post<any>(`/trainers/courses/${encodeURIComponent(courseId)}/allocation`, data)
    );
  }

  async removeCourseAllocation(courseId: string): Promise<any> {
    return firstValueFrom(
      this.api.delete<any>(`/trainers/courses/${encodeURIComponent(courseId)}/allocation`)
    );
  }

  async getEligibleStudents(filters?: {
    search?: string;
    course?: string;
    trainerId?: string;
    allocationStatus?: "ALL" | "ASSIGNED" | "UNASSIGNED";
  }): Promise<EligibleStudent[]> {
    const queryParams: Record<string, string> = {};
    if (filters?.search) queryParams["search"] = filters.search;
    if (filters?.course) queryParams["course"] = filters.course;
    if (filters?.trainerId) queryParams["trainerId"] = filters.trainerId;
    if (filters?.allocationStatus) queryParams["allocationStatus"] = filters.allocationStatus;

    return firstValueFrom(this.api.get<EligibleStudent[]>("/trainers/students/eligible", queryParams));
  }

  async allocateStudent(studentId: string, targetTrainerId: string, reason?: string): Promise<any> {
    return firstValueFrom(
      this.api.post<any>(`/trainers/students/${encodeURIComponent(studentId)}/allocate`, {
        targetTrainerId,
        reason,
      })
    );
  }

  async allocateBulkStudents(
    studentIds: string[],
    targetTrainerId: string,
    reason?: string
  ): Promise<{ allocatedCount: number }> {
    return firstValueFrom(
      this.api.post<{ allocatedCount: number }>("/trainers/students/bulk-allocate", {
        studentIds,
        targetTrainerId,
        reason,
      })
    );
  }

  async updateAvailability(
    trainerId: string,
    data: {
      availability: TrainerAvailabilityStatus;
      absenceStartDate?: string | Date | null;
      expectedReturnDate?: string | Date | null;
      actualReturnDate?: string | Date | null;
      absenceReason?: string;
    }
  ): Promise<any> {
    return firstValueFrom(
      this.api.patch<any>(`/trainers/${encodeURIComponent(trainerId)}/availability`, data)
    );
  }

  async getAbsenceImpact(trainerId: string): Promise<AbsenceImpactData> {
    return firstValueFrom(
      this.api.get<AbsenceImpactData>(`/trainers/${encodeURIComponent(trainerId)}/absence-impact`)
    );
  }

  async reassignAbsenceStudents(
    sourceTrainerId: string,
    assignments: Array<{ studentId: string; targetTrainerId: string }>,
    reason?: string
  ): Promise<{ reassignedCount: number }> {
    return firstValueFrom(
      this.api.post<{ reassignedCount: number }>(
        `/trainers/${encodeURIComponent(sourceTrainerId)}/absence-reassign`,
        {
          assignments,
          reason,
        }
      )
    );
  }

  async previewAutoAllocation(): Promise<AutoAllocationPreview> {
    return firstValueFrom(this.api.get<AutoAllocationPreview>("/trainers/auto-allocate/preview"));
  }

  async applyAutoAllocation(
    assignments: Array<{ studentId: string; targetTrainerId: string }>
  ): Promise<{ allocatedCount: number }> {
    return firstValueFrom(
      this.api.post<{ allocatedCount: number }>("/trainers/auto-allocate/apply", { assignments })
    );
  }

  async getAllocationHistory(filters?: {
    studentId?: string;
    trainerId?: string;
    courseName?: string;
    action?: string;
    limit?: number;
  }): Promise<TrainerAllocationHistory[]> {
    const queryParams: Record<string, string> = {};
    if (filters?.studentId) queryParams["studentId"] = filters.studentId;
    if (filters?.trainerId) queryParams["trainerId"] = filters.trainerId;
    if (filters?.courseName) queryParams["courseName"] = filters.courseName;
    if (filters?.action) queryParams["action"] = filters.action;
    if (filters?.limit) queryParams["limit"] = String(filters.limit);

    return firstValueFrom(this.api.get<TrainerAllocationHistory[]>("/trainers/history/list", queryParams));
  }

  // Batches
  async getBatches(filters?: { trainerId?: string; courseName?: string; status?: string }): Promise<TrainerBatch[]> {
    const queryParams: Record<string, string> = {};
    if (filters?.trainerId) queryParams["trainerId"] = filters.trainerId;
    if (filters?.courseName) queryParams["courseName"] = filters.courseName;
    if (filters?.status) queryParams["status"] = filters.status;
    return firstValueFrom(this.api.get<TrainerBatch[]>("/trainers/batches", queryParams));
  }

  async createBatch(data: Partial<TrainerBatch>): Promise<TrainerBatch> {
    return firstValueFrom(this.api.post<TrainerBatch>("/trainers/batches", data));
  }

  async updateBatch(id: string, data: Partial<TrainerBatch>): Promise<TrainerBatch> {
    return firstValueFrom(this.api.put<TrainerBatch>(`/trainers/batches/${encodeURIComponent(id)}`, data));
  }

  async deleteBatch(id: string): Promise<any> {
    return firstValueFrom(this.api.delete<any>(`/trainers/batches/${encodeURIComponent(id)}`));
  }

  // Attendance
  async markAttendance(records: any[]): Promise<any> {
    return firstValueFrom(this.api.post<any>("/trainers/attendance", { records }));
  }

  async getAttendance(filters?: {
    batchId?: string;
    studentId?: string;
    trainerId?: string;
    date?: string;
    month?: string;
    courseName?: string;
  }): Promise<TrainerAttendance[]> {
    const queryParams: Record<string, string> = {};
    if (filters?.batchId) queryParams["batchId"] = filters.batchId;
    if (filters?.studentId) queryParams["studentId"] = filters.studentId;
    if (filters?.trainerId) queryParams["trainerId"] = filters.trainerId;
    if (filters?.date) queryParams["date"] = filters.date;
    if (filters?.month) queryParams["month"] = filters.month;
    if (filters?.courseName) queryParams["courseName"] = filters.courseName;
    return firstValueFrom(this.api.get<TrainerAttendance[]>("/trainers/attendance", queryParams));
  }

  async getStudentTrainingSummary(studentId: string): Promise<{
    student: any;
    attendanceStats: {
      totalSessions: number;
      presentCount: number;
      lateCount: number;
      absentCount: number;
      attendancePercent: number;
    };
    recentAttendance: TrainerAttendance[];
    scorecards: StudentScorecard[];
    assignedTrainer: Trainer | null;
  }> {
    return firstValueFrom(
      this.api.get<any>(`/trainers/students/${encodeURIComponent(studentId)}/summary`)
    );
  }

  // Scorecards
  async saveStudentScorecard(data: {
    studentId: string;
    technicalScore: number;
    problemSolvingScore: number;
    communicationScore: number;
    readinessStatus: "READY" | "NEEDS_IMPROVEMENT" | "NOT_READY";
    feedback: string;
    recommendedRole?: string;
  }): Promise<StudentScorecard> {
    return firstValueFrom(this.api.post<StudentScorecard>("/trainers/scorecards", data));
  }

  async getStudentScorecards(studentId?: string, courseName?: string): Promise<StudentScorecard[]> {
    const queryParams: Record<string, string> = {};
    if (studentId) queryParams["studentId"] = studentId;
    if (courseName) queryParams["courseName"] = courseName;
    return firstValueFrom(this.api.get<StudentScorecard[]>("/trainers/scorecards", queryParams));
  }

  // Trainer Feedback
  async submitTrainerFeedback(data: {
    trainerId: string;
    studentId: string;
    studentName: string;
    courseName: string;
    rating: number;
    feedback: string;
  }): Promise<TrainerFeedback> {
    return firstValueFrom(this.api.post<TrainerFeedback>("/trainers/feedback", data));
  }

  async getTrainerFeedback(trainerId: string): Promise<TrainerFeedback[]> {
    return firstValueFrom(this.api.get<TrainerFeedback[]>(`/trainers/feedback/${encodeURIComponent(trainerId)}`));
  }

  // CSV Exports
  async downloadTrainersCsv(): Promise<Blob> {
    return firstValueFrom(this.api.blob("/trainers/export/trainers"));
  }

  async downloadAllocationsCsv(): Promise<Blob> {
    return firstValueFrom(this.api.blob("/trainers/export/allocations"));
  }

  async downloadHistoryCsv(): Promise<Blob> {
    return firstValueFrom(this.api.blob("/trainers/export/history"));
  }

  // Faculty Daily Attendance & Manager Absence Alerts
  async getFacultyDailyAttendance(date?: string): Promise<{
    date: string;
    totalActiveTrainers: number;
    presentCount: number;
    onLeaveCount: number;
    absentOrNotCheckedInCount: number;
    stats?: { totalFaculty: number; present: number; onLeave: number; absent: number };
    records: any[];
    alerts: Array<{
      trainerId: string;
      trainerName: string;
      trainerEmail: string;
      status: "ON_LEAVE" | "NOT_CHECKED_IN";
      leaveReason?: string;
      leaveType?: string;
      expectedReturnDate?: Date | string | null;
      affectedStudentCount: number;
      scheduledBatches: string[];
      qualifiedBackupTrainers: Array<{ id: string; name: string; email: string; availability: string }>;
    }>;
  }> {
    const params: Record<string, string> = {};
    if (date) params["date"] = date;
    return firstValueFrom(this.api.get<any>("/trainers/faculty-attendance/overview", params));
  }

  async acknowledgeFacultyAbsence(trainerId: string, date: string, backupTrainerId?: string): Promise<{ success: boolean; message: string }> {
    return firstValueFrom(
      this.api.post<{ success: boolean; message: string }>("/trainers/faculty-attendance/acknowledge", {
        trainerId,
        date,
        backupTrainerId,
      })
    );
  }

  async markFacultyAbsent(trainerId: string, date: string, backupTrainerId?: string): Promise<{ success: boolean; message: string }> {
    return this.acknowledgeFacultyAbsence(trainerId, date, backupTrainerId);
  }

  async managerCheckInTrainer(trainerId: string): Promise<{ success: boolean; message: string; record: any }> {
    return firstValueFrom(
      this.api.post<{ success: boolean; message: string; record: any }>("/trainers/faculty-attendance/check-in", {
        trainerId,
      })
    );
  }

  async getFacultyAttendanceHistory(filters: {
    startDate?: string;
    endDate?: string;
    month?: string;
    trainerId?: string;
  }): Promise<{
    stats: {
      totalDays: number;
      presentDays: number;
      leaveDays: number;
      absentDays: number;
      attendancePercentage: number;
    };
    records: any[];
  }> {
    const params: Record<string, string> = {};
    if (filters.startDate) params["startDate"] = filters.startDate;
    if (filters.endDate) params["endDate"] = filters.endDate;
    if (filters.month) params["month"] = filters.month;
    if (filters.trainerId) params["trainerId"] = filters.trainerId;
    return firstValueFrom(this.api.get<any>("/trainers/faculty-attendance/history", params));
  }

  async downloadFacultyAttendanceCsv(filters: {
    startDate?: string;
    endDate?: string;
    month?: string;
    trainerId?: string;
  }): Promise<Blob> {
    const search = new URLSearchParams();
    if (filters.startDate) search.set("startDate", filters.startDate);
    if (filters.endDate) search.set("endDate", filters.endDate);
    if (filters.month) search.set("month", filters.month);
    if (filters.trainerId) search.set("trainerId", filters.trainerId);
    const qs = search.toString() ? `?${search.toString()}` : "";
    return firstValueFrom(this.api.blob(`/trainers/faculty-attendance/export-csv${qs}`));
  }

  // Institutional Holidays & Scheduling Engine
  async getHolidays(): Promise<InstitutionalHoliday[]> {
    return firstValueFrom(this.api.get<InstitutionalHoliday[]>("/trainers/holidays"));
  }

  async createHoliday(data: {
    date: string;
    name: string;
    type?: string;
    description?: string;
  }): Promise<InstitutionalHoliday> {
    return firstValueFrom(this.api.post<InstitutionalHoliday>("/trainers/holidays", data));
  }

  async deleteHoliday(id: string): Promise<void> {
    await firstValueFrom(this.api.delete(`/trainers/holidays/${encodeURIComponent(id)}`));
  }

  async calculateBatchSchedule(data: {
    startDate: string;
    totalSessions: number;
    days?: string[];
  }): Promise<BatchScheduleCalculation> {
    return firstValueFrom(this.api.post<BatchScheduleCalculation>("/trainers/batches/calculate-schedule", data));
  }
}
