import { createServer } from "node:http";
import { app } from "./app";
import { connectDatabase, disconnectDatabase } from "./config/database";
import { env } from "./config/env";

import * as bcrypt from "bcryptjs";
import { UserModel } from "./models/user.model";
import { healCandidateAccountPasswords } from "./services/candidate.service";
import { facultyAttendanceCronService } from "./services/faculty-attendance-cron.service";

async function ensureDefaultManager(): Promise<void> {
  try {
    const count = await UserModel.countDocuments({ role: "MANAGER" });
    if (count === 0) {
      const passwordHash = await bcrypt.hash("Manager@12345678", 12);
      await UserModel.create({
        username: "manager",
        name: "TVK Manager",
        email: "manager@tvktechnologies.com",
        employeeId: "MGR-001",
        phone: "+91 98765 43210",
        role: "MANAGER",
        active: true,
        passwordHash,
        mustChangePassword: false,
      });
      console.info("Default manager account auto-seeded: manager / Manager@12345678");
    }
  } catch (err) {
    console.warn("Could not check/seed default manager:", err);
  }
}

async function start(): Promise<void> {
  await connectDatabase();
  await ensureDefaultManager();
  await healCandidateAccountPasswords();
  facultyAttendanceCronService.startScheduler();
  const server = createServer(app);

  server.listen(env.port, "0.0.0.0", () => {
    console.info(`Recruitment CRM API listening on http://127.0.0.1:${env.port}.`);
  });

  const shutdown = (signal: string): void => {
    console.info(`${signal} received; shutting down API.`);
    facultyAttendanceCronService.stopScheduler();
    server.close(() => {
      void disconnectDatabase().finally(() => process.exit(0));
    });
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

void start().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
