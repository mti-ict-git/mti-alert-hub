import type { AccessProfileService } from "../../access/service/access-profile-service.js";
import type { Logger } from "../../../shared/observability/logger.js";
import type { AdminSession } from "../model/admin-session.js";
import type { AdminSessionStore } from "./admin-session-store.js";
import type { LdapAuthenticator } from "./ldap-authenticator.js";

type LoginOptions = {
  username: string;
  password: string;
};

export class AuthService {
  constructor(
    private readonly ldapAuthenticator: LdapAuthenticator,
    private readonly accessProfileService: AccessProfileService,
    private readonly adminSessionStore: AdminSessionStore,
    private readonly logger: Logger,
  ) {}

  async login(options: LoginOptions): Promise<AdminSession> {
    const directoryUser = await this.ldapAuthenticator.authenticate(
      options.username,
      options.password,
    );

    const accessProfile = this.accessProfileService.resolveAccessProfile(directoryUser);
    const session = this.adminSessionStore.createSession({
      user: directoryUser,
      accessProfile,
    });

    this.logger.info("auth.login.succeeded", {
      username: directoryUser.username,
      roleType: accessProfile.roleType,
    });

    return session;
  }

  getCurrentSession(sessionToken: string): AdminSession | undefined {
    return this.adminSessionStore.getSession(sessionToken);
  }

  logout(sessionToken: string): void {
    this.adminSessionStore.deleteSession(sessionToken);
    this.logger.info("auth.logout.completed", {
      sessionToken,
    });
  }
}
