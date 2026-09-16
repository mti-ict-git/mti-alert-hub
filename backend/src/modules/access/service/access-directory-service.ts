import { z } from "zod";
import type { BackendEnv } from "../../../app/config/env.js";
import { AppError } from "../../../shared/errors/app-error.js";
import {
  createLdapClient,
  escapeLdapFilter,
  normalizeGroupValues,
  normalizeOptionalScalar,
  enforceAllowedGroups,
} from "../../auth/service/ldap-authenticator.js";
import { decodeDirectoryGuid, encodeDirectoryGuid } from "./directory-identity.js";
import type { VerifiedDirectoryIdentity } from "./directory-user-repository.js";

const configSchema = z.object({
  LDAP_URL: z.string().min(1),
  LDAP_BIND_DN: z.string().min(1),
  LDAP_BIND_PASSWORD: z.string().min(1),
  LDAP_SEARCH_BASE: z.string().min(1),
});
type Entry = {
  dn: string;
  objectGUID?: Buffer;
  cn?: string;
  displayName?: string;
  sAMAccountName?: string;
  userPrincipalName?: string;
  mail?: string | string[];
  memberOf?: string | string[];
};
const enabledUser =
  "(&(objectCategory=person)(objectClass=user)(!(userAccountControl:1.2.840.113556.1.4.803:=2))";
export class AccessDirectoryService {
  private readonly requests = new Map<string, { count: number; reset: number }>();
  constructor(private readonly env: BackendEnv) {}
  private config() {
    return configSchema.parse(this.env);
  }
  private identity(entry: Entry): VerifiedDirectoryIdentity {
    enforceAllowedGroups(this.env.LDAP_ALLOWED_GROUPS, normalizeGroupValues(entry.memberOf));
    const username = entry.sAMAccountName ?? entry.userPrincipalName;
    if (!username)
      throw new AppError({
        statusCode: 503,
        code: "DIRECTORY_IDENTITY_UNAVAILABLE",
        message: "Directory identity is incomplete.",
      });
    return {
      directoryId: this.config().LDAP_SEARCH_BASE.trim().toLowerCase(),
      directorySubjectId: decodeDirectoryGuid(entry.objectGUID),
      username,
      fullName: entry.displayName ?? entry.cn ?? username,
      email: normalizeOptionalScalar(entry.mail),
    };
  }
  private async lookup(filter: string, base?: string) {
    const config = this.config(),
      client = createLdapClient(config.LDAP_URL, this.env);
    try {
      await client.bind(config.LDAP_BIND_DN, config.LDAP_BIND_PASSWORD);
      const result = await client.search(base ?? config.LDAP_SEARCH_BASE, {
        scope: base ? "base" : "sub",
        filter,
        sizeLimit: 20,
        timeLimit: 10,
        attributes: [
          "objectGUID",
          "cn",
          "displayName",
          "sAMAccountName",
          "userPrincipalName",
          "mail",
          "memberOf",
        ],
        explicitBufferAttributes: ["objectGUID"],
      });
      const identities: VerifiedDirectoryIdentity[] = [];
      for (const entry of result.searchEntries) {
        try {
          identities.push(this.identity(entry as Entry));
        } catch (error) {
          if (error instanceof AppError && error.statusCode === 403) continue;
          throw error;
        }
      }
      return identities;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError({
        statusCode: 503,
        code: "DIRECTORY_UNAVAILABLE",
        message: "Directory lookup is unavailable. Try again.",
      });
    } finally {
      await client.unbind().catch(() => undefined);
    }
  }
  async search(actorId: string, search: string) {
    const input = z.string().trim().min(3).max(100).parse(search);
    const now = Date.now();
    for (const [key, value] of this.requests) if (value.reset <= now) this.requests.delete(key);
    const window = this.requests.get(actorId) ?? { count: 0, reset: now + 60000 };
    if (window.count >= 30)
      throw new AppError({
        statusCode: 429,
        code: "DIRECTORY_RATE_LIMIT",
        message: "Too many searches. Try again in a minute.",
      });
    window.count++;
    this.requests.set(actorId, window);
    const escaped = escapeLdapFilter(input);
    return this.lookup(
      enabledUser +
        "(|(sAMAccountName=*" +
        escaped +
        "*)(userPrincipalName=*" +
        escaped +
        "*)(displayName=*" +
        escaped +
        "*)))",
    );
  }
  async resolve(directoryId: string, guid: string) {
    if (directoryId !== this.config().LDAP_SEARCH_BASE.trim().toLowerCase())
      throw new AppError({
        statusCode: 422,
        code: "INVALID_DIRECTORY",
        message: "Choose a user from the configured directory.",
      });
    const entries = await this.lookup(
      enabledUser + "(objectGUID=" + encodeDirectoryGuid(guid) + "))",
    );
    if (entries.length !== 1)
      throw new AppError({
        statusCode: 422,
        code: "DIRECTORY_USER_UNAVAILABLE",
        message: "This directory user is unavailable or no longer eligible.",
      });
    return entries[0]!;
  }
  async resolveAuthenticatedDn(dn: string) {
    const entries = await this.lookup(enabledUser + ")", dn);
    if (entries.length !== 1)
      throw new AppError({
        statusCode: 403,
        code: "DIRECTORY_USER_UNAVAILABLE",
        message: "This directory user is no longer eligible.",
      });
    return entries[0]!;
  }
}
