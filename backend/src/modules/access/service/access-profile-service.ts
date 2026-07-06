import type { AccessProfile } from "../model/admin-access.js";
import type { AuthenticatedDirectoryUser } from "../../auth/model/authenticated-directory-user.js";

export class AccessProfileService {
  resolveAccessProfile(_user: AuthenticatedDirectoryUser): AccessProfile {
    return {
      roleType: "CentralAdmin",
      scopes: [
        {
          scopeType: "Global",
          scopeValue: "*",
        },
      ],
    };
  }
}
