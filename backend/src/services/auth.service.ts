import { randomBytes, createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import { UserDocument, UserModel } from "../models/user.model";
import { HttpError } from "../middleware/error-handler";

const bcryptRounds = 12;

export class AuthService {
  async authenticate(username: string, password: string): Promise<UserDocument> {
    const normalizedUsername = username.trim().toLowerCase();
    const user = await UserModel.findOne({
      $or: [{ username: normalizedUsername }, { email: normalizedUsername }],
    }).select("+passwordHash");

    if (!user) {
      await bcrypt.hash(password, bcryptRounds);
      throw new HttpError(401, "INVALID_CREDENTIALS", "Invalid username or password.");
    }
    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!user.active || !validPassword) {
      throw new HttpError(401, "INVALID_CREDENTIALS", "Invalid username or password.");
    }
    return user;
  }

  async changePassword(userId: string, password: string): Promise<void> {
    const user = await UserModel.findById(userId).select("+passwordHash");
    if (!user || !user.active) throw new HttpError(401, "UNAUTHENTICATED", "Sign in to continue.");
    user.passwordHash = await bcrypt.hash(password, bcryptRounds);
    user.currentPassword = password;
    user.mustChangePassword = false;
    user.invitationTokenHash = undefined;
    user.invitationExpiresAt = undefined;
    await user.save();
  }

  async acceptInvitation(token: string, password: string): Promise<void> {
    const invitationTokenHash = this.hashToken(token);
    const user = await UserModel.findOne({
      invitationTokenHash,
      invitationExpiresAt: { $gt: new Date() },
      active: true,
    }).select("+invitationTokenHash +invitationExpiresAt");
    if (!user) throw new HttpError(400, "INVITATION_INVALID", "This invitation is invalid or has expired.");

    user.passwordHash = await bcrypt.hash(password, bcryptRounds);
    user.currentPassword = password;
    user.mustChangePassword = false;
    user.invitationTokenHash = undefined;
    user.invitationExpiresAt = undefined;
    await user.save();
  }

  async createInvitation(): Promise<{ token: string; tokenHash: string; passwordHash: string; expiresAt: Date }> {
    const token = randomBytes(32).toString("base64url");
    return {
      token,
      tokenHash: this.hashToken(token),
      passwordHash: await bcrypt.hash(randomBytes(32).toString("hex"), bcryptRounds),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    };
  }

  private hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }
}

export const authService = new AuthService();