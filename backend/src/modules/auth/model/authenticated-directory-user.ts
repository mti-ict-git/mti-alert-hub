export type AuthenticatedDirectoryUser = {
  username: string;
  directorySubjectId?: string;
  distinguishedName: string;
  fullName: string;
  email: string | null;
  memberOf: string[];
};
