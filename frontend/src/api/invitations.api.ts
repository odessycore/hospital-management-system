import { api } from '../lib/api';

export interface InvitationInfo {
  email: string;
  fullName: string;
  valid: boolean;
}

export const invitationsApi = {
  describe: (token: string) =>
    api.get<InvitationInfo>(`/auth/invitation/${token}`).then((r) => r.data),
  setPassword: (token: string, password: string) =>
    api
      .post<{ email: string }>('/auth/set-password', { token, password })
      .then((r) => r.data),
};
