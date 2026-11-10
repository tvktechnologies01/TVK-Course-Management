import { Injectable, inject } from "@angular/core";
import { firstValueFrom } from "rxjs";
import { ApiService } from "./api.service";

@Injectable({ providedIn: "root" })
export class ResumeStorageService {
  private readonly api = inject(ApiService);
  private readonly blobCache = new Map<string, Blob>();

  async save(
    file: File,
    _folderType: "IR" | "EXTERNAL" = "IR",
  ): Promise<string> {
    if (file.size > 5 * 1024 * 1024) throw new Error("Resume files must be 5 MB or smaller.");
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      throw new Error("Only PDF resumes are accepted.");
    }
    const formData = new FormData();
    formData.append("resume", file, file.name);
    const uploaded = await firstValueFrom(this.api.upload<{ fileId: string; fileName: string; size: number }>("/resumes", formData));

    if (!uploaded.fileId?.trim()) {
      throw new Error("Resume upload did not return a file ID.");
    }

    return uploaded.fileId;
  }

  async get(id: string, fileName = "", candidateId = ""): Promise<Blob | null> {
    if (!id && !fileName) return null;

    const cacheKey = `${candidateId || id || fileName}|${id}|${fileName}`;
    const cached = this.blobCache.get(cacheKey);
    if (cached) return cached;

    const response = await firstValueFrom(
      this.api.blob(`/resumes/${encodeURIComponent(id)}`),
    );
    void fileName;
    void candidateId;
    const blob = response.type === "application/pdf" ? response : response.slice(0, response.size, "application/pdf");
    this.blobCache.set(cacheKey, blob);
    return blob;
  }
}