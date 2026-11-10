import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { ApiService } from "./api.service";
import { Course } from "../models/course.model";

@Injectable({
  providedIn: "root",
})
export class CourseService {
  constructor(private readonly api: ApiService) {}

  list(params?: Record<string, string | number | boolean>): Observable<Course[]> {
    return this.api.get<Course[]>("/courses", params);
  }

  get(id: string): Observable<Course> {
    return this.api.get<Course>(`/courses/${encodeURIComponent(id)}`);
  }

  create(course: Partial<Course>): Observable<Course> {
    return this.api.post<Course>("/courses", course);
  }

  update(id: string, changes: Partial<Course>): Observable<Course> {
    return this.api.patch<Course>(`/courses/${encodeURIComponent(id)}`, changes);
  }

  delete(id: string): Observable<{ success: boolean; deletedId: string }> {
    return this.api.delete<{ success: boolean; deletedId: string }>(`/courses/${encodeURIComponent(id)}`);
  }

  uploadCurriculum(id: string, file: File): Observable<Course> {
    const formData = new FormData();
    formData.append("curriculum", file, file.name);
    return this.api.upload<Course>(`/courses/${encodeURIComponent(id)}/curriculum`, formData);
  }

  deleteCurriculum(id: string): Observable<Course> {
    return this.api.delete<Course>(`/courses/${encodeURIComponent(id)}/curriculum`);
  }

  downloadCurriculum(id: string, duration?: string): Observable<Blob> {
    const query = duration ? `?duration=${encodeURIComponent(duration)}` : "";
    return this.api.blob(`/courses/${encodeURIComponent(id)}/curriculum/download${query}`);
  }

  updateTrackFee(id: string, duration: string, fees: number): Observable<Course> {
    return this.api.patch<Course>(`/courses/${encodeURIComponent(id)}/tracks/${encodeURIComponent(duration)}`, { fees });
  }

  uploadTrackCurriculum(id: string, duration: string, file: File): Observable<Course> {
    const formData = new FormData();
    formData.append("curriculum", file, file.name);
    return this.api.upload<Course>(`/courses/${encodeURIComponent(id)}/tracks/${encodeURIComponent(duration)}/curriculum`, formData);
  }

  deleteTrackCurriculum(id: string, duration: string): Observable<Course> {
    return this.api.delete<Course>(`/courses/${encodeURIComponent(id)}/tracks/${encodeURIComponent(duration)}/curriculum`);
  }

  downloadTrackCurriculum(id: string, duration: string): Observable<Blob> {
    return this.api.blob(`/courses/${encodeURIComponent(id)}/tracks/${encodeURIComponent(duration)}/curriculum/download`);
  }

  getCandidateCurriculum(courseName?: string): Observable<{
    available: boolean;
    courseName: string;
    courseId?: string;
    curriculumFileName?: string;
    curriculumFileType?: string;
    curriculumFileSize?: number;
    curriculumUploadedAt?: string | null;
  }> {
    const params: Record<string, string> = {};
    if (courseName) params["courseName"] = courseName;
    return this.api.get("/courses/candidate-curriculum", params);
  }
}
