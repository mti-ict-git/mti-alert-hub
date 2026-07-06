export type AdminRoleType = "CentralAdmin" | "LocalOperator" | "ManagementViewer";
export type AdminScopeType = "Global" | "Site" | "Area" | "Department" | "Section";

export type AdminScope = {
  scopeType: AdminScopeType;
  scopeValue: string;
};

export type AccessProfile = {
  roleType: AdminRoleType;
  scopes: AdminScope[];
};
