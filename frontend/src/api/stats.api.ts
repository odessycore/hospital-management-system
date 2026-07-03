import { api } from '../lib/api';
import type { HospitalStats } from '../types';

export const statsApi = {
  hospital: () =>
    api.get<HospitalStats>('/stats/hospital').then((r) => r.data),
};
