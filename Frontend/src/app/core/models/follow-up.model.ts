export interface FollowUp {
  id: string;

  candidateId: string;
  candidateName: string;

  scheduledAt: string;

  notes: string;

  completed: boolean;

  createdBy: string;

  createdAt: string;
}
