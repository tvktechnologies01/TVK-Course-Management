/// <reference types="node" />
import * as bcrypt from "bcryptjs";
import { connectDatabase, disconnectDatabase } from "../src/config/database";
import { UserModel } from "../src/models/user.model";

function parseArgs(): Record<string, string> {
  const args = process.argv.slice(2);
  const result: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith("--")) {
        result[key] = next;
        i++;
      } else {
        result[key] = "true";
      }
    }
  }
  return result;
}
async function main() {
  await connectDatabase();
  const args = parseArgs();

  const newUsername = args["username"] || args["user"] || args["id"];
  const newPassword = args["password"] || args["pass"];
  const newEmail = args["email"];
  const newEmployeeId = args["employeeId"] || args["empId"];
  const forceUpdate = args["force"] === "true" || args["update"] === "true";

  const hasCustomInputs = Boolean(newUsername || newPassword || newEmail || newEmployeeId);
  const manager = await UserModel.findOne({ role: "MANAGER" }).select("+passwordHash");

  if (manager && !hasCustomInputs && !forceUpdate) {
    console.log(`\nManager account already exists:`);
    console.log(`-----------------------------------------------`);
    console.log(`  Username:    ${manager.username}`);
    console.log(`  Email:       ${manager.email}`);
    console.log(`  Role:        ${manager.role}`);
    console.log(`  Employee ID: ${manager.employeeId}`);
    console.log(`-----------------------------------------------`);
    console.log(`\nTo update credentials, run:`);
    console.log(`  npm run seed:manager -- --username <new_username> --password <new_password>`);
    console.log(`Or reset to defaults with:`);
    console.log(`  npm run seed:manager -- --force\n`);
    await disconnectDatabase();
    return;
  }

  const username = (newUsername || (manager ? manager.username : "Manager")).trim().toLowerCase();
  const password = newPassword || "Manager@12345678";
  const email = (newEmail || (manager ? manager.email : "manager@recruitment.com")).trim().toLowerCase();
  const employeeId = (newEmployeeId || (manager ? manager.employeeId : "MGR-001")).trim().toUpperCase();

  if (password.length < 12) {
    console.error("\n[Error] Password must be at least 12 characters long.\n");
    await disconnectDatabase();
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 12);

  if (manager) {
    manager.username = username;
    manager.email = email;
    manager.employeeId = employeeId;
    manager.passwordHash = passwordHash;
    manager.active = true;
    manager.mustChangePassword = false;
    await manager.save();
    console.log(`\nManager account updated successfully!`);
  } else {
    await UserModel.create({
      username,
      name: "Recruitment Manager",
      email,
      employeeId,
      phone: "+91 98765 43210",
      role: "MANAGER",
      active: true,
      passwordHash,
      mustChangePassword: false,
    });
    console.log(`\nManager account created successfully!`);
  }

  console.log(`-----------------------------------------------`);
  console.log(`  Username:    ${username}`);
  console.log(`  Password:    ${password}`);
  console.log(`  Role:        MANAGER`);
  console.log(`  Employee ID: ${employeeId}`);
  console.log(`-----------------------------------------------\n`);

  await disconnectDatabase();
}

main().catch((err) => {
  console.error("Manager operation failed:", err);
  process.exit(1);
});
