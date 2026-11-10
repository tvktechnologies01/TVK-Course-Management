import { Injectable } from "@angular/core";
import { BehaviorSubject, firstValueFrom } from "rxjs";
import { ActivityLog } from "../models/activity-log.model";
import { ApiPage, ApiService } from "./api.service";

@Injectable({ providedIn: "root" })
export class ActivityLogService {
  private logs: ActivityLog[] = [];
  private readonly subject = new BehaviorSubject<ActivityLog[]>([]);
  readonly logs$ = this.subject.asObservable();
  private loading?: Promise<ActivityLog[]>;

  constructor(private readonly api: ApiService) {}

  getAll(): ActivityLog[] { return this.logs; }

  loadFromBackend(force = false): Promise<ActivityLog[]> {
    if (this.loading && !force) return this.loading;
    this.loading = (async () => {
      try {
        const pageSize = 100;
        const first = await firstValueFrom(this.api.get<ApiPage<ActivityLog>>("/activity-logs", { page: 1, pageSize }));
        const records = [...first.items];
        this.logs = records;
        this.subject.next(this.logs);

        if (first.pagination.pageCount > 1) {
          const promises = [];
          for (let page = 2; page <= first.pagination.pageCount; page++) {
            promises.push(firstValueFrom(this.api.get<ApiPage<ActivityLog>>("/activity-logs", { page, pageSize })));
          }
          const results = await Promise.all(promises);
          for (const res of results) {
            records.push(...res.items);
          }
          this.logs = records;
          this.subject.next(this.logs);
        }
        return this.logs;
      } catch (error) {
        console.error("Unable to load activity logs:", error);
        return this.logs;
      }
    })().finally(() => { this.loading = undefined; });
    return this.loading;
  }

  getByCandidate(candidateId: string): ActivityLog[] {
    return this.logs.filter((log) => log.candidateId === candidateId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  getByPerson(performedBy: string): ActivityLog[] {
    return this.logs.filter((log) => log.performedBy === performedBy)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  getByType(type: string): ActivityLog[] {
    return this.logs.filter((log) => log.type === type)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  search(searchText: string): ActivityLog[] {
    const value = searchText.trim().toLowerCase();
    if (!value) return this.getAll();
    return this.logs.filter((log) =>
      [log.candidateName, log.type, log.message, log.performedBy]
        .some((field) => field.toLowerCase().includes(value)),
    );
  }

}