import { Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";
import { FollowUp } from "../models/follow-up.model";
import { ApiPage, ApiService } from "./api.service";

@Injectable({ providedIn: "root" })
export class FollowUpService {
  private items: FollowUp[] = [];
  private loading?: Promise<FollowUp[]>;

  constructor(private readonly api: ApiService) {}

  getAll(): FollowUp[] { return this.items; }

  setCacheOwner(owner: string): void {
    void owner;
    this.items = [];
    this.loading = undefined;
  }

  clearCache(_owner?: string): void {
    this.items = [];
    this.loading = undefined;
  }

  loadFromBackend(): Promise<FollowUp[]> {
    if (this.loading) return this.loading;
    this.loading = (async () => {
      const pageSize = 100;
      const first = await firstValueFrom(this.api.get<ApiPage<FollowUp>>("/follow-ups", { page: 1, pageSize }));
      const records = [...first.items];
      for (let page = 2; page <= first.pagination.pageCount; page++) {
        const result = await firstValueFrom(this.api.get<ApiPage<FollowUp>>("/follow-ups", { page, pageSize }));
        records.push(...result.items);
      }
      this.items = records;
      return records;
    })()
      .finally(() => { this.loading = undefined; });
    return this.loading;
  }

  async add(item: FollowUp): Promise<void> {
    const created = await firstValueFrom(this.api.post<FollowUp>("/follow-ups", {
      candidateId: item.candidateId,
      scheduledAt: item.scheduledAt,
      notes: item.notes,
    }));
    this.items = [created, ...this.items.filter((existing) => existing.id !== created.id)];
  }

  async complete(id: string): Promise<void> {
    const item = this.items.find((entry) => entry.id === id);
    if (!item) return;
    const updated = await firstValueFrom(this.api.patch<FollowUp>(`/follow-ups/${encodeURIComponent(id)}/complete`, {}));
    this.items = this.items.map((entry) => entry.id === id ? updated : entry);
  }
}