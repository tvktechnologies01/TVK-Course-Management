import { HydratedDocument, Model, Schema, model, models } from "mongoose";

export type UserRole = "MANAGER" | "HR";

export interface UserRecord {
  username: string;
  name: string;
  email: string;
  employeeId: string;
  phone: string;
  role: UserRole;
  active: boolean;
  passwordHash: string;
  mustChangePassword: boolean;
  invitationTokenHash?: string;
  invitationExpiresAt?: Date;
  currentPassword?: string;
}

export type UserDocument = HydratedDocument<UserRecord>;

const userSchema = new Schema<UserRecord>({
  username: { type: String, required: true, trim: true, lowercase: true, maxlength: 80 },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
  employeeId: { type: String, required: true, trim: true, uppercase: true, maxlength: 40 },
  phone: { type: String, default: "", trim: true, maxlength: 40 },
  role: { type: String, required: true, enum: ["MANAGER", "HR"] },
  active: { type: Boolean, default: true, required: true },
  passwordHash: { type: String, required: true, select: false },
  mustChangePassword: { type: Boolean, default: false, required: true },
  invitationTokenHash: { type: String, select: false },
  invitationExpiresAt: { type: Date, select: false },
  currentPassword: { type: String, default: "" },
}, { timestamps: true, versionKey: false });

userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ username: 1 }, { unique: true });
userSchema.index({ employeeId: 1 }, { unique: true });
userSchema.index({ role: 1, active: 1, name: 1 });

export const UserModel: Model<UserRecord> = models["User"] as Model<UserRecord> ?? model<UserRecord>("User", userSchema);

export interface AuthenticatedAccount {
  id: string;
  username: string;
  name: string;
  email: string;
  employeeId: string;
  role: UserRole;
  active: boolean;
  mustChangePassword: boolean;
}

export function toAuthenticatedAccount(user: UserDocument): AuthenticatedAccount {
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    email: user.email,
    employeeId: user.employeeId,
    role: user.role,
    active: user.active,
    mustChangePassword: user.mustChangePassword,
  };
}
