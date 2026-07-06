export const SITES = ["Acid Plant", "Pyrite", "Chloride", "CCP", "Makarti", "Labota"] as const;

export const DEPARTMENTS = ["ICT", "OHSE", "Security", "Operation", "Maintenance", "HR", "SCM"] as const;

export const SECTIONS: Record<string, string[]> = {
  ICT: ["Infrastructure", "Applications", "Support"],
  OHSE: ["Safety", "Environment", "Health"],
  Security: ["Patrol", "Access Control", "Investigation"],
  Operation: ["Production", "Logistics", "Quality"],
  Maintenance: ["Mechanical", "Electrical", "Instrumentation"],
  HR: ["Recruitment", "Payroll", "Training"],
  SCM: ["Procurement", "Warehouse", "Planning"],
};

export const POSITIONS = [
  "Manager",
  "Supervisor",
  "Engineer",
  "Technician",
  "Operator",
  "Officer",
  "Analyst",
];
