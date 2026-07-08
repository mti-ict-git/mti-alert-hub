import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { Phase1BaselineImportPayload } from "../modules/organization/service/phase1-baseline-import.js";

const MOCK_LAST_NAMES = [
  "Wijaya",
  "Susanto",
  "Pratama",
  "Saputra",
  "Nugroho",
  "Hidayat",
  "Kurniawan",
  "Santoso",
  "Wibowo",
  "Setiawan",
  "Halim",
  "Tanujaya",
  "Ramadhan",
  "Utomo",
  "Firmansyah",
] as const;

const MOCK_DEPARTMENTS = ["ICT", "OHSE", "Security", "Operation", "Maintenance", "HR", "SCM"] as const;
const MOCK_SECTIONS: Record<string, string[]> = {
  ICT: ["Infrastructure", "Applications", "Support"],
  OHSE: ["Safety", "Environment", "Health"],
  Security: ["Patrol", "Access Control", "Investigation"],
  Operation: ["Production", "Logistics", "Quality"],
  Maintenance: ["Mechanical", "Electrical", "Instrumentation"],
  HR: ["Recruitment", "Payroll", "Training"],
  SCM: ["Procurement", "Warehouse", "Planning"],
};
const MOCK_POSITIONS = ["Manager", "Supervisor", "Engineer", "Technician", "Operator", "Officer", "Analyst"] as const;
const MOCK_SITES = ["Acid Plant", "Pyrite", "Chloride", "CCP", "Makarti", "Labota"] as const;

type EmployeeSeed = {
  employeeId: string;
  name: string;
  department: string;
  section: string;
  position: string;
  site: string;
  phone: string;
  email: string;
  adUsername: string;
  hasPc: boolean;
  fieldOfficer: boolean;
  status: "Active" | "Inactive";
};

type DeviceSeed = {
  deviceId: string;
  hostname: string;
  employeeId: string;
  employeeName: string;
  agentVersion: string;
  status: "Online" | "Offline" | "Stale";
};

async function main() {
  const outputArg = process.argv.slice(2).find((arg) => !arg.startsWith("--"));
  const outputPath = path.resolve(
    process.cwd(),
    outputArg ?? "backend/examples/phase1-baseline.from-mock.json",
  );

  const [referenceSource, employeeSource, deviceSource] = await Promise.all([
    readFile(path.resolve(process.cwd(), "src/data/reference.ts"), "utf8"),
    readFile(path.resolve(process.cwd(), "src/data/employees.ts"), "utf8"),
    readFile(path.resolve(process.cwd(), "src/data/devices.ts"), "utf8"),
  ]);

  const sites = extractConstArray(referenceSource, "SITES");
  const sectionsByDepartment = extractSectionsMap(referenceSource);
  const employees = extractEmployees(employeeSource);
  const devices = extractDevices(deviceSource);

  const payload = buildPayload({
    sites,
    sectionsByDepartment,
    employees,
    devices,
  });

  await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  console.log(
    JSON.stringify(
      {
        level: "info",
        message: "database.baseline_import.mock_export_completed",
        context: {
          outputPath,
          stats: {
            sites: payload.sites.length,
            areas: payload.areas.length,
            departments: payload.departments.length,
            sections: payload.sections.length,
            employees: payload.employees.length,
            devices: payload.devices.length,
          },
        },
      },
      null,
      2,
    ),
  );
}

function buildPayload(input: {
  sites: readonly string[];
  sectionsByDepartment: Record<string, string[]>;
  employees: EmployeeSeed[];
  devices: DeviceSeed[];
}): Phase1BaselineImportPayload {
  const siteCodeMap = new Map<string, string>();
  const siteRecords = input.sites.map((siteName) => {
    const siteCode = slugifyCode("SITE", siteName);
    siteCodeMap.set(siteName, siteCode);
    return {
      code: siteCode,
      name: siteName,
      status: "Active",
      sourceSystem: "FrontendMockSeed",
      externalReference: siteName,
    };
  });

  const areaRecords = input.sites.map((siteName) => ({
    siteCode: siteCodeMap.get(siteName) ?? slugifyCode("SITE", siteName),
    code: slugifyCode("AREA", siteName),
    name: siteName,
    status: "Active",
    sourceSystem: "FrontendMockSeed",
    externalReference: siteName,
  }));

  const departmentNames = [...new Set(input.employees.map((employee) => employee.department))];
  const departmentRecords = departmentNames.flatMap((departmentName) =>
    input.sites.map((siteName) => ({
      siteCode: siteCodeMap.get(siteName) ?? slugifyCode("SITE", siteName),
      code: slugifyCode("DEPT", departmentName),
      name: departmentName,
      status: "Active",
      sourceSystem: "FrontendMockSeed",
      externalReference: `${siteName}:${departmentName}`,
    })),
  );

  const sectionRecords = departmentNames.flatMap((departmentName) => {
    const sections = input.sectionsByDepartment[departmentName] ?? [];
    return input.sites.flatMap((siteName) =>
      sections.map((sectionName) => ({
        siteCode: siteCodeMap.get(siteName) ?? slugifyCode("SITE", siteName),
        departmentName,
        code: slugifyCode("SEC", `${departmentName}-${sectionName}`),
        name: sectionName,
        status: "Active",
        sourceSystem: "FrontendMockSeed",
        externalReference: `${siteName}:${departmentName}:${sectionName}`,
      })),
    );
  });

  const employeeRecords: Phase1BaselineImportPayload["employees"] = input.employees.map((employee) => ({
    employeeNumber: employee.employeeId,
    fullName: employee.name,
    email: employee.email,
    phoneNumber: employee.phone,
    siteCode: siteCodeMap.get(employee.site) ?? slugifyCode("SITE", employee.site),
    areaName: employee.site,
    departmentName: employee.department,
    sectionName: employee.section,
    jobRole: employee.position,
    employmentStatus: employee.status,
    hasWindowsAgent: employee.hasPc,
    hasWhatsApp: true,
    preferredPrimaryChannel: employee.hasPc ? "WindowsAgent" : "WhatsApp",
    preferredSecondaryChannel: employee.hasPc ? "WhatsApp" : "Email",
    sourceSystem: "FrontendMockSeed",
    externalReference: employee.adUsername,
  }));

  const employeeByNumber = new Map(employeeRecords.map((employee) => [employee.employeeNumber, employee]));
  const deviceRecords: Phase1BaselineImportPayload["devices"] = input.devices.map((device) => {
    const employee = employeeByNumber.get(device.employeeId);
    const siteCode = employee?.siteCode ?? siteCodeMap.get(input.sites[0] ?? "Unknown") ?? "SITE-UNKNOWN";
    const areaName = employee?.areaName;
    return {
      hostname: device.hostname,
      deviceIdentifier: device.deviceId,
      primaryEmployeeNumber: device.employeeId,
      siteCode,
      areaName,
      locationLabel: areaName ?? "Desktop Endpoint",
      ownershipMode: "EmployeeAssigned" as const,
      agentVersion: device.agentVersion,
      osVersion: "Windows 10/11",
      status: device.status,
    };
  });

  return {
    sites: siteRecords,
    areas: areaRecords,
    departments: departmentRecords,
    sections: sectionRecords,
    employees: employeeRecords,
    devices: deviceRecords,
    audienceGroups: [],
  };
}

function slugifyCode(prefix: string, value: string) {
  return `${prefix}-${value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)}`;
}

function extractConstArray(source: string, constName: string): string[] {
  const match = source.match(new RegExp(`const ${constName} = \\[([\\s\\S]*?)\\];`, "s"));
  if (!match?.[1]) {
    throw new Error(`Could not parse ${constName} from mock reference data.`);
  }

  return [...match[1].matchAll(/"([^"]+)"/g)].map((entry) => entry[1] ?? "").filter(Boolean);
}

function extractSectionsMap(source: string): Record<string, string[]> {
  const match = source.match(/export const SECTIONS: Record<string, string\[]> = \{([\s\S]*?)\};/);
  if (!match?.[1]) {
    throw new Error("Could not parse SECTIONS from mock reference data.");
  }

  const sections: Record<string, string[]> = {};
  for (const entry of match[1].matchAll(/([A-Za-z0-9_]+): \[([^\]]*)\]/g)) {
    const departmentName = entry[1];
    if (!departmentName) {
      continue;
    }
    const values = [...(entry[2] ?? "").matchAll(/"([^"]+)"/g)]
      .map((value) => value[1] ?? "")
      .filter(Boolean);
    sections[departmentName] = values;
  }

  return sections;
}

function extractEmployees(source: string): EmployeeSeed[] {
  const names = extractConstArray(source, "firstNames");
  if (names.length === 0) {
    throw new Error("Could not parse mock employees source.");
  }

  return names.map((firstName, index) => {
    const department = MOCK_DEPARTMENTS[index % MOCK_DEPARTMENTS.length] ?? "ICT";
    const sectionList = MOCK_SECTIONS[department] ?? ["General"];
    const lastName = MOCK_LAST_NAMES[(index * 3) % MOCK_LAST_NAMES.length] ?? "User";
    return {
      employeeId: `MTI${String(1001 + index).padStart(5, "0")}`,
      name: `${firstName} ${lastName}`,
      department,
      section: sectionList[index % sectionList.length] ?? sectionList[0] ?? "General",
      position: MOCK_POSITIONS[index % MOCK_POSITIONS.length] ?? "Officer",
      site: MOCK_SITES[index % MOCK_SITES.length] ?? MOCK_SITES[0] ?? "Unknown",
      phone: `+62812${String(1000000 + index * 137).slice(0, 8)}`,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@mti.co.id`,
      adUsername: `${firstName.toLowerCase()}.${lastName.toLowerCase()}`,
      hasPc: index % 3 !== 0,
      fieldOfficer: index % 3 === 0 || index % 5 === 0,
      status: index % 17 === 0 ? "Inactive" : "Active",
    };
  });
}

function extractDevices(source: string): DeviceSeed[] {
  const versionMatch = source.match(/const versions = \[(.*?)\];/s);
  const versions = versionMatch?.[1]
    ? [...versionMatch[1].matchAll(/"([^"]+)"/g)].map((entry) => entry[1] ?? "").filter(Boolean)
    : ["1.5.0"];
  const employees = extractEmployees(sourceForEmployeeNames());

  return employees
    .filter((employee) => employee.hasPc)
    .slice(0, 18)
    .map((employee, index) => ({
      deviceId: `DSK-${String(2001 + index).padStart(4, "0")}`,
      hostname: `MTI-PC-${String(101 + index).padStart(3, "0")}`,
      employeeId: employee.employeeId,
      employeeName: employee.name,
      agentVersion: versions[index % versions.length] ?? versions[0] ?? "1.0.0",
      status: index % 4 === 0 ? "Offline" : "Online",
    }));
}

function sourceForEmployeeNames() {
  return `
    const firstNames = [
      "Andi", "Budi", "Citra", "Dewi", "Eko", "Fitri", "Gilang", "Hana", "Indra", "Joko",
      "Kartika", "Lukman", "Maya", "Nanda", "Omar", "Putri", "Rizky", "Sinta", "Tomi", "Ulfa",
      "Vino", "Widya", "Xena", "Yusuf", "Zahra", "Arif", "Bella", "Cahyo", "Dini", "Edo",
      "Farah", "Guntur", "Hesti", "Iwan", "Jihan", "Kevin", "Laras", "Mario", "Nia", "Oscar"
    ];
  `;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
