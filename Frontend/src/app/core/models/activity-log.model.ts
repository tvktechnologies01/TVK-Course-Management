export interface ActivityLog {
  id: string;

  candidateId: string;
  candidateName: string;

  type: string;

  message: string;

  performedBy: string;

  createdAt: string;
}
