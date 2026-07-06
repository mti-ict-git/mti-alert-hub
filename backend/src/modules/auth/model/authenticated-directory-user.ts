export type AuthenticatedDirectoryUser = {
  username: string;
  distinguishedName: string;
  fullName: string;
  email: string | null;
  memberOf: string[];
};
