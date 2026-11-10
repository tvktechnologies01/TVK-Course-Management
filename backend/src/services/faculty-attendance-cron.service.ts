import { trainerService } from "./trainer.service";
import { facultyNotificationService } from "./faculty-notification.service";
import { FacultyAttendanceModel } from "../models/faculty-attendance.model";
import { TrainerModel } from "../models/trainer.model";
import { HolidayModel } from "../models/holiday.model";

export class FacultyAttendanceCronService {
  private lastExecutedDate: string | null = null;
  private intervalTimer: NodeJS.Timeout | null = null;
  private cutOffHour = 10;
  private cutOffMinute = 15;

  constructor() {
    const customCutoff = process.env.FACULTY_CHECKIN_CUTOFF; // e.g. "10:15"
    if (customCutoff && customCutoff.includes(":")) {
      const [h, m] = customCutoff.split(":").map(Number);
      if (!isNaN(h) && !isNaN(m)) {
        this.cutOffHour = h;
        this.cutOffMinute = m;
      }
    }
  }

  startScheduler(): void {
    if (this.intervalTimer) return;

    console.log(`[FACULTY_CRON] ⏰ Faculty Attendance Daily Cut-Off Scheduler started (Cut-Off: ${String(this.cutOffHour).padStart(2, "0")}:${String(this.cutOffMinute).padStart(2, "0")} daily).`);

    // Check once immediately on startup
    void this.checkAndRunCutOff();

    // Check every 60 seconds
    this.intervalTimer = setInterval(() => {
      void this.checkAndRunCutOff();
    }, 60000);
  }

  stopScheduler(): void {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
  }

  async checkAndRunCutOff(): Promise<boolean> {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);

    // If already executed for today, skip
    if (this.lastExecutedDate === today) {
      return false;
    }

    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    // Check if current time is past cutoff
    if (
      currentHour > this.cutOffHour ||
      (currentHour === this.cutOffHour && currentMinute >= this.cutOffMinute)
    ) {
      this.lastExecutedDate = today;
      return await this.executeCutOffCheck(today);
    }

    return false;
  }

  async executeCutOffCheck(dateStr?: string): Promise<boolean> {
    const today = dateStr || new Date().toISOString().slice(0, 10);
    console.log(`[FACULTY_CRON] 🔍 Executing Faculty Daily Cut-Off Scan for ${today}...`);

    try {
      const targetDate = new Date(`${today}T00:00:00.000Z`);
      if (targetDate.getUTCDay() === 0) {
        console.log(`[FACULTY_CRON] 🏖️ Today (${today}) is Sunday (Weekly Off). Skipping cut-off check.`);
        return false;
      }

      const holiday = await HolidayModel.findOne({ date: today }).lean();
      if (holiday) {
        console.log(`[FACULTY_CRON] 🏛️ Today (${today}) is an institutional holiday (${holiday.name}). Skipping cut-off check.`);
        return false;
      }

      const activeTrainers = await TrainerModel.find({ status: "ACTIVE" }).exec();
      const existingRecords = await FacultyAttendanceModel.find({ date: today }).exec();
      const recordMap = new Map(existingRecords.map((r) => [r.trainerId, r]));

      const missingTrainers: Array<{ trainerId: string; trainerName: string; affectedStudentsCount: number }> = [];

      for (const trainer of activeTrainers) {
        const record = recordMap.get(trainer.id);

        if (!record) {
          // Trainer has neither checked in nor applied for leave: record as UNINFORMED ABSENT
          await FacultyAttendanceModel.create({
            _id: `${trainer.id}_${today}`,
            trainerId: trainer.id,
            trainerName: trainer.name,
            trainerEmail: trainer.email,
            date: today,
            status: "ABSENT",
            isCutoffMissed: true,
            isLateCheckIn: true,
            leaveReason: "Uninformed absence (Missed morning cut-off without check-in)",
            managerAcknowledged: false,
          });

          missingTrainers.push({
            trainerId: trainer.id,
            trainerName: trainer.name,
            affectedStudentsCount: trainer.currentStudentCount || 0,
          });
        } else if (record.status === "ABSENT") {
          missingTrainers.push({
            trainerId: trainer.id,
            trainerName: trainer.name,
            affectedStudentsCount: trainer.currentStudentCount || 0,
          });
        }
      }

      if (missingTrainers.length > 0) {
        console.log(`[FACULTY_CRON] 🚨 Found ${missingTrainers.length} missing trainer(s). Sending manager cut-off alert...`);
        await facultyNotificationService.notifyManagerOnDailyAbsenceDigest(missingTrainers, today);
      } else {
        console.log(`[FACULTY_CRON] ✓ All active trainers checked in or on approved leave for ${today}.`);
      }

      return true;
    } catch (err) {
      console.error("[FACULTY_CRON] Error running attendance cut-off scan:", err);
      return false;
    }
  }
}

export const facultyAttendanceCronService = new FacultyAttendanceCronService();
