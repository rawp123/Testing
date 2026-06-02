/// <reference types="vite/client" />

import type { CarCareLogApi } from '../../shared/api';

declare global {
  interface Window {
    carCareLog: CarCareLogApi;
    __CAR_CARE_LOG_BROWSER_PREVIEW__?: boolean;
  }
}
