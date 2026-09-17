import type { LdapAuthenticator } from "./ldap-authenticator.js";
import type { AccessDirectoryService } from "../../access/service/access-directory-service.js";
import type { DirectoryUserRepository } from "../../access/service/directory-user-repository.js";
import type { PersistentAccessSessionStore } from "../../access/service/persistent-access-session-store.js";
import { AppError } from "../../../shared/errors/app-error.js";

/** Database-backed authentication orchestrator; activate with the reviewed route policy cutover. */
export class PersistentAuthService {
  constructor(
    private readonly authenticator: Pick<LdapAuthenticator, "authenticate">,
    private readonly directory: Pick<AccessDirectoryService, "resolveAuthenticatedDn">,
    private readonly users: Pick<DirectoryUserRepository, "recordAuthenticatedIdentity">,
    private readonly sessions: Pick<
      PersistentAccessSessionStore,
      "create" | "get" | "rotate" | "revoke"
    >,
  ) {}
  async login(input: { username: string; password: string }) {
    const authenticated = await this.authenticator.authenticate(input.username, input.password);
    const identity = await this.directory.resolveAuthenticatedDn(authenticated.distinguishedName);
    if (
      !authenticated.directorySubjectId ||
      authenticated.directorySubjectId !== identity.directorySubjectId
    ) {
      throw new AppError({
        statusCode: 401,
        code: "DIRECTORY_IDENTITY_CHANGED",
        message: "Your directory identity changed during sign-in. Try again.",
      });
    }
    const id = await this.users.recordAuthenticatedIdentity(identity);
    return this.sessions.create(id);
  }
  getCurrentSession(token: string) {
    return this.sessions.get(token);
  }
  async rotateSession(token: string) {
    const session = await this.sessions.rotate(token);
    if (!session)
      throw new AppError({
        statusCode: 401,
        code: "ACCESS_CHANGED",
        message: "Your access has changed. Sign in again to continue.",
      });
    return session;
  }
  logout(token: string) {
    return this.sessions.revoke(token);
  }
}
