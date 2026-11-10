
import { ApplicationConfig } from "@angular/core";
import {
  provideHttpClient,
  withFetch,
  withInterceptors,
} from "@angular/common/http";
import { provideRouter } from "@angular/router";

import { routes } from "./app.routes";
import { apiInterceptor } from "./core/interceptors/api.interceptor";

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(
      withFetch(),
      withInterceptors([apiInterceptor]),
    ),
  ],
};
