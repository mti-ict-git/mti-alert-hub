import { Client } from "ldapts";
import { z } from "zod";

import type { BackendEnv } from "../../../app/config/env.js";
import { AppError } from "../../../shared/errors/app-error.js";
import type { Logger } from "../../../shared/observability/logger.js";
import type { AuthenticatedDirectoryUser } from "../model/authenticated-directory-user.js";

const ldapConfigSchema = z.object({
  LDAP_URL: z.string().min(1),
  LDAP_BIND_DN: z.string().min(1),
  LDAP_BIND_PASSWORD: z.string().min(1),
  LDAP_SEARCH_BASE: z.string().min(1),
  LDAP_ALLOWED_GROUPS: z.string().optional(),
});

type LdapSearchEntry = {
  dn: string;
  cn?: string;
  displayName?: string;
  department?: string | string[];
  title?: string | string[];
  mail?: string | string[];
  memberOf?: string | string[];
  mobile?: string | string[];
  sAMAccountName?: string;
  userPrincipalName?: string;
  employeeID?: string | string[];
};

export type DirectoryUserProfile = {
  username: string;
  distinguishedName: string;
  fullName: string;
  email: string | null;
  employeeNumber: string | null;
  department: string | null;
  title: string | null;
  mobile: string | null;
};

export class LdapAuthenticator {
  constructor(
    private readonly env: BackendEnv,
    private readonly logger: Logger,
  ) {}

  async authenticate(username: string, password: string): Promise<AuthenticatedDirectoryUser> {
    const config = ldapConfigSchema.parse(this.env);
    const client = createLdapClient(config.LDAP_URL, this.env);

    try {
      await client.bind(config.LDAP_BIND_DN, config.LDAP_BIND_PASSWORD);

      const searchFilter = [
        "(|",
        `(sAMAccountName=${escapeLdapFilter(username)})`,
        `(userPrincipalName=${escapeLdapFilter(username)})`,
        `(mail=${escapeLdapFilter(username)})`,
        `(cn=${escapeLdapFilter(username)})`,
        ")",
      ].join("");

      const searchResult = await client.search(config.LDAP_SEARCH_BASE, {
        scope: "sub",
        filter: searchFilter,
        attributes: ["cn", "displayName", "mail", "memberOf", "sAMAccountName", "userPrincipalName"],
      });

      const firstEntry = searchResult.searchEntries.at(0) as LdapSearchEntry | undefined;
      if (!firstEntry) {
        throw new AppError({
          statusCode: 401,
          code: "AUTHENTICATION_FAILED",
          message: "Invalid username or password.",
        });
      }

      await client.bind(firstEntry.dn, password);

      const memberOf = normalizeGroupValues(firstEntry.memberOf);
      enforceAllowedGroups(config.LDAP_ALLOWED_GROUPS, memberOf);

      const resolvedUsername =
        firstEntry.sAMAccountName ?? firstEntry.userPrincipalName ?? username;

      return {
        username: resolvedUsername,
        distinguishedName: firstEntry.dn,
        fullName: firstEntry.displayName ?? firstEntry.cn ?? resolvedUsername,
        email: normalizeOptionalScalar(firstEntry.mail),
        memberOf,
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      this.logger.warn("auth.ldap.authentication_failed", {
        username,
        error: error instanceof Error ? error.message : "Unknown LDAP authentication error",
      });

      throw new AppError({
        statusCode: 401,
        code: "AUTHENTICATION_FAILED",
        message: "Invalid username or password.",
      });
    } finally {
      await client.unbind().catch(() => undefined);
    }
  }

  async lookupUserProfile(username: string): Promise<DirectoryUserProfile | null> {
    const trimmedUsername = username.trim();
    if (!trimmedUsername) {
      return null;
    }

    const config = ldapConfigSchema.parse(this.env);
    const client = createLdapClient(config.LDAP_URL, this.env);

    try {
      await client.bind(config.LDAP_BIND_DN, config.LDAP_BIND_PASSWORD);
      const firstEntry = await findFirstDirectoryEntry(client, config.LDAP_SEARCH_BASE, trimmedUsername);
      if (!firstEntry) {
        return null;
      }

      const resolvedUsername =
        firstEntry.sAMAccountName ?? firstEntry.userPrincipalName ?? trimmedUsername;

      return {
        username: resolvedUsername,
        distinguishedName: firstEntry.dn,
        fullName: firstEntry.displayName ?? firstEntry.cn ?? resolvedUsername,
        email: normalizeOptionalScalar(firstEntry.mail),
        employeeNumber: normalizeOptionalScalar(firstEntry.employeeID),
        department: normalizeOptionalScalar(firstEntry.department),
        title: normalizeOptionalScalar(firstEntry.title),
        mobile: normalizeOptionalScalar(firstEntry.mobile),
      };
    } catch (error) {
      this.logger.warn("auth.ldap.lookup_failed", {
        username: trimmedUsername,
        error: error instanceof Error ? error.message : "Unknown LDAP lookup error",
      });
      throw error;
    } finally {
      await client.unbind().catch(() => undefined);
    }
  }
}

function createLdapClient(url: string, env: BackendEnv) {
  return new Client({
    url,
    timeout: 5000,
    connectTimeout: 5000,
    tlsOptions: {
      rejectUnauthorized: env.NODE_ENV === "production" ? !env.LDAP_SKIP_TLS_VERIFY : false,
    },
  });
}

async function findFirstDirectoryEntry(
  client: Client,
  searchBase: string,
  username: string,
) {
  const searchResult = await client.search(searchBase, {
    scope: "sub",
    filter: buildDirectoryUserSearchFilter(username),
    attributes: [
      "cn",
      "displayName",
      "department",
      "title",
      "mail",
      "mobile",
      "memberOf",
      "sAMAccountName",
      "userPrincipalName",
      "employeeID",
    ],
  });

  return searchResult.searchEntries.at(0) as LdapSearchEntry | undefined;
}

function buildDirectoryUserSearchFilter(username: string) {
  return [
    "(|",
    `(sAMAccountName=${escapeLdapFilter(username)})`,
    `(userPrincipalName=${escapeLdapFilter(username)})`,
    `(mail=${escapeLdapFilter(username)})`,
    `(cn=${escapeLdapFilter(username)})`,
    ")",
  ].join("");
}

function normalizeGroupValues(value: string | string[] | undefined): string[] {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function normalizeOptionalScalar(value: string | string[] | undefined): string | null {
  if (!value) {
    return null;
  }

  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value;
}

function enforceAllowedGroups(rawAllowedGroups: string | undefined, memberOf: string[]): void {
  if (!rawAllowedGroups) {
    return;
  }

  const allowedGroups = parseAllowedGroups(rawAllowedGroups);

  if (allowedGroups.length === 0) {
    return;
  }

  const normalizedMemberGroups = new Set(memberOf.map(normalizeDnValue));
  const isAllowed = allowedGroups.some((allowedGroup) =>
    normalizedMemberGroups.has(normalizeDnValue(allowedGroup)),
  );

  if (!isAllowed) {
    throw new AppError({
      statusCode: 403,
      code: "GROUP_ACCESS_DENIED",
      message: "The authenticated account is not allowed to access MTI Alert.",
    });
  }
}

function parseAllowedGroups(rawAllowedGroups: string): string[] {
  const trimmedValue = rawAllowedGroups.trim();
  if (!trimmedValue) {
    return [];
  }

  if (trimmedValue.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmedValue) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.filter((value): value is string => typeof value === "string").map((value) => value.trim()).filter(Boolean);
      }
    } catch {
      // Fall through to the delimiter-based parsing rules below.
    }
  }

  if (/[;\r\n]/.test(trimmedValue)) {
    return trimmedValue
      .split(/[;\r\n]+/)
      .map((group) => group.trim())
      .filter(Boolean);
  }

  // A single LDAP DN contains commas, so comma-separated parsing is unsafe here.
  return [trimmedValue];
}

function normalizeDnValue(value: string) {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function escapeLdapFilter(value: string): string {
  return value.replace(/[\\()*\0]/g, (character) => {
    switch (character) {
      case "\\":
        return "\\5c";
      case "*":
        return "\\2a";
      case "(":
        return "\\28";
      case ")":
        return "\\29";
      case "\0":
        return "\\00";
      default:
        return character;
    }
  });
}
