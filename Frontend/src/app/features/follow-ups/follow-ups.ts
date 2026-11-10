import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";
import { FollowUp } from "../../core/models/follow-up.model";
import { FollowUpService } from "../../core/services/follow-up.service";

@Component({
  selector: "app-follow-ups",
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./follow-ups.html",
  styleUrl: "./follow-ups.css",
})
export class FollowUpsComponent {
  followUps: FollowUp[] = [];

  constructor(private followUpService: FollowUpService) {
    this.load();
    void this.followUpService.loadFromBackend().then(() => this.load());
  }

  load(): void {
    this.followUps = this.followUpService
      .getAll()
      .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  }

  async complete(item: FollowUp): Promise<void> {
    await this.followUpService.complete(item.id);
    this.load();
  }

  get overdue(): FollowUp[] {
    return this.followUps.filter(
      (item) =>
        !item.completed && new Date(item.scheduledAt).getTime() < Date.now(),
    );
  }

  get upcoming(): FollowUp[] {
    return this.followUps.filter(
      (item) =>
        !item.completed && new Date(item.scheduledAt).getTime() >= Date.now(),
    );
  }
}
