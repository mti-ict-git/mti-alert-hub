import type { AccessProfile } from "../../access/model/admin-access.js";

export type AuthenticatedAdminUser = {
  id: string;
  username: string;
  fullName: string;
  email: string | null;
};

export type AdminSession = {
  sessionToken: string;
  user: AuthenticatedAdminUser;
  accessProfile: AccessProfile;
  expiresAt: string;
};
