import { CrmControlModel } from "../models/crm-control.model";

class CrmControlService {
  private inMemoryRunning = true;
  private initialized = false;

  async isRunning(): Promise<boolean> {
    if (!this.initialized) {
      await this.init();
    }
    return this.inMemoryRunning;
  }

  isCurrentStatusRunning(): boolean {
    return this.inMemoryRunning;
  }

  private async init(): Promise<void> {
    try {
      const record = await CrmControlModel.findOne({ key: "crm_status" });
      if (record) {
        this.inMemoryRunning = record.isRunning;
      } else {
        await CrmControlModel.create({
          key: "crm_status",
          isRunning: true,
          updatedBy: "INIT",
        });
        this.inMemoryRunning = true;
      }
      this.initialized = true;
    } catch {
      // In case MongoDB is still connecting during boot
    }
  }

  async setRunning(running: boolean, updatedBy = "MANAGER"): Promise<boolean> {
    this.inMemoryRunning = running;
    this.initialized = true;
    try {
      await CrmControlModel.findOneAndUpdate(
        { key: "crm_status" },
        { key: "crm_status", isRunning: running, updatedBy },
        { upsert: true, new: true },
      );
    } catch {
      // Keep memory state even if database write encounters temporary issue
    }
    return this.inMemoryRunning;
  }
}

export const crmControlService = new CrmControlService();
