import type { PoolClient } from "pg";
import { z } from "zod";

const channelSchema = z.enum(["WindowsAgent", "WhatsApp", "Email", "DigitalSignage"]);

export const phase1BaselineImportSchema = z.object({
  sites: z
    .array(
      z.object({
        code: z.string().trim().min(1),
        name: z.string().trim().min(1),
        status: z.string().trim().default("Active"),
        sourceSystem: z.string().trim().optional(),
        externalReference: z.string().trim().optional(),
      }),
    )
    .default([]),
  areas: z
    .array(
      z.object({
        siteCode: z.string().trim().min(1),
        code: z.string().trim().optional(),
        name: z.string().trim().min(1),
        status: z.string().trim().default("Active"),
        sourceSystem: z.string().trim().optional(),
        externalReference: z.string().trim().optional(),
      }),
    )
    .default([]),
  departments: z
    .array(
      z.object({
        siteCode: z.string().trim().min(1),
        code: z.string().trim().optional(),
        name: z.string().trim().min(1),
        status: z.string().trim().default("Active"),
        sourceSystem: z.string().trim().optional(),
        externalReference: z.string().trim().optional(),
      }),
    )
    .default([]),
  sections: z
    .array(
      z.object({
        siteCode: z.string().trim().min(1),
        departmentName: z.string().trim().min(1),
        code: z.string().trim().optional(),
        name: z.string().trim().min(1),
        status: z.string().trim().default("Active"),
        sourceSystem: z.string().trim().optional(),
        externalReference: z.string().trim().optional(),
      }),
    )
    .default([]),
  employees: z
    .array(
      z.object({
        employeeNumber: z.string().trim().min(1),
        fullName: z.string().trim().min(1),
        email: z.string().trim().optional(),
        phoneNumber: z.string().trim().optional(),
        siteCode: z.string().trim().optional(),
        areaName: z.string().trim().optional(),
        departmentName: z.string().trim().optional(),
        sectionName: z.string().trim().optional(),
        jobRole: z.string().trim().optional(),
        employmentStatus: z.string().trim().default("Active"),
        hasWindowsAgent: z.boolean().default(false),
        hasWhatsApp: z.boolean().default(false),
        preferredPrimaryChannel: channelSchema.optional(),
        preferredSecondaryChannel: channelSchema.optional(),
        sourceSystem: z.string().trim().optional(),
        externalReference: z.string().trim().optional(),
      }),
    )
    .default([]),
  devices: z
    .array(
      z.object({
        hostname: z.string().trim().min(1),
        deviceIdentifier: z.string().trim().optional(),
        primaryEmployeeNumber: z.string().trim().optional(),
        siteCode: z.string().trim().min(1),
        areaName: z.string().trim().optional(),
        locationLabel: z.string().trim().optional(),
        ownershipMode: z.enum(["LocationOwned", "EmployeeAssigned", "Mixed"]).default("LocationOwned"),
        agentVersion: z.string().trim().optional(),
        osVersion: z.string().trim().optional(),
        status: z.enum(["Online", "Offline", "Stale"]).default("Offline"),
      }),
    )
    .default([]),
  audienceGroups: z
    .array(
      z.object({
        name: z.string().trim().min(1),
        description: z.string().trim().optional(),
        employeeNumbers: z.array(z.string().trim().min(1)).default([]),
      }),
    )
    .default([]),
});

export type Phase1BaselineImportPayload = z.infer<typeof phase1BaselineImportSchema>;

export type Phase1BaselineImportStats = {
  sites: number;
  areas: number;
  departments: number;
  sections: number;
  employees: number;
  devices: number;
  audienceGroups: number;
};

export async function importPhase1Baseline(
  client: PoolClient,
  payload: Phase1BaselineImportPayload,
): Promise<Phase1BaselineImportStats> {
  const stats: Phase1BaselineImportStats = {
    sites: 0,
    areas: 0,
    departments: 0,
    sections: 0,
    employees: 0,
    devices: 0,
    audienceGroups: 0,
  };

  for (const site of payload.sites) {
    await upsertSite(client, site);
    stats.sites += 1;
  }

  for (const area of payload.areas) {
    await upsertArea(client, area);
    stats.areas += 1;
  }

  for (const department of payload.departments) {
    await upsertDepartment(client, department);
    stats.departments += 1;
  }

  for (const section of payload.sections) {
    await upsertSection(client, section);
    stats.sections += 1;
  }

  for (const employee of payload.employees) {
    await upsertEmployee(client, employee);
    stats.employees += 1;
  }

  for (const device of payload.devices) {
    await upsertDevice(client, device);
    stats.devices += 1;
  }

  for (const audienceGroup of payload.audienceGroups) {
    await upsertAudienceGroup(client, audienceGroup);
    stats.audienceGroups += 1;
  }

  return stats;
}

async function upsertSite(client: PoolClient, site: Phase1BaselineImportPayload["sites"][number]) {
  await client.query(
    `
      insert into public.sites (
        code,
        name,
        status,
        source_system,
        external_reference
      )
      values ($1, $2, $3, $4, $5)
      on conflict (code)
      do update set
        name = excluded.name,
        status = excluded.status,
        source_system = coalesce(excluded.source_system, public.sites.source_system),
        external_reference = coalesce(excluded.external_reference, public.sites.external_reference)
    `,
    [
      site.code,
      site.name,
      site.status,
      site.sourceSystem ?? null,
      site.externalReference ?? null,
    ],
  );
}

async function upsertArea(client: PoolClient, area: Phase1BaselineImportPayload["areas"][number]) {
  const siteId = await requireSiteIdByCode(client, area.siteCode);
  await client.query(
    `
      insert into public.areas (
        site_id,
        code,
        name,
        status,
        source_system,
        external_reference
      )
      values ($1::uuid, $2, $3, $4, $5, $6)
      on conflict (site_id, name)
      do update set
        code = coalesce(excluded.code, public.areas.code),
        status = excluded.status,
        source_system = coalesce(excluded.source_system, public.areas.source_system),
        external_reference = coalesce(excluded.external_reference, public.areas.external_reference)
    `,
    [
      siteId,
      area.code ?? null,
      area.name,
      area.status,
      area.sourceSystem ?? null,
      area.externalReference ?? null,
    ],
  );
}

async function upsertDepartment(
  client: PoolClient,
  department: Phase1BaselineImportPayload["departments"][number],
) {
  const siteId = await requireSiteIdByCode(client, department.siteCode);
  await client.query(
    `
      insert into public.departments (
        site_id,
        code,
        name,
        status,
        source_system,
        external_reference
      )
      values ($1::uuid, $2, $3, $4, $5, $6)
      on conflict (site_id, name)
      do update set
        code = coalesce(excluded.code, public.departments.code),
        status = excluded.status,
        source_system = coalesce(excluded.source_system, public.departments.source_system),
        external_reference = coalesce(excluded.external_reference, public.departments.external_reference)
    `,
    [
      siteId,
      department.code ?? null,
      department.name,
      department.status,
      department.sourceSystem ?? null,
      department.externalReference ?? null,
    ],
  );
}

async function upsertSection(
  client: PoolClient,
  section: Phase1BaselineImportPayload["sections"][number],
) {
  const departmentId = await requireDepartmentId(client, section.siteCode, section.departmentName);
  await client.query(
    `
      insert into public.sections (
        department_id,
        code,
        name,
        status,
        source_system,
        external_reference
      )
      values ($1::uuid, $2, $3, $4, $5, $6)
      on conflict (department_id, name)
      do update set
        code = coalesce(excluded.code, public.sections.code),
        status = excluded.status,
        source_system = coalesce(excluded.source_system, public.sections.source_system),
        external_reference = coalesce(excluded.external_reference, public.sections.external_reference)
    `,
    [
      departmentId,
      section.code ?? null,
      section.name,
      section.status,
      section.sourceSystem ?? null,
      section.externalReference ?? null,
    ],
  );
}

async function upsertEmployee(
  client: PoolClient,
  employee: Phase1BaselineImportPayload["employees"][number],
) {
  const siteId = employee.siteCode ? await requireSiteIdByCode(client, employee.siteCode) : null;
  const areaId =
    employee.siteCode && employee.areaName
      ? await requireAreaId(client, employee.siteCode, employee.areaName)
      : null;
  const departmentId =
    employee.siteCode && employee.departmentName
      ? await requireDepartmentId(client, employee.siteCode, employee.departmentName)
      : null;
  const sectionId =
    employee.siteCode && employee.departmentName && employee.sectionName
      ? await requireSectionId(client, employee.siteCode, employee.departmentName, employee.sectionName)
      : null;

  await client.query(
    `
      insert into public.employees (
        employee_number,
        full_name,
        email,
        phone_number,
        site_id,
        area_id,
        department_id,
        section_id,
        job_role,
        employment_status,
        has_windows_agent,
        has_whatsapp,
        preferred_primary_channel,
        preferred_secondary_channel,
        source_system,
        external_reference
      )
      values ($1, $2, $3, $4, $5::uuid, $6::uuid, $7::uuid, $8::uuid, $9, $10, $11, $12, $13, $14, $15, $16)
      on conflict (employee_number)
      do update set
        full_name = excluded.full_name,
        email = excluded.email,
        phone_number = excluded.phone_number,
        site_id = excluded.site_id,
        area_id = excluded.area_id,
        department_id = excluded.department_id,
        section_id = excluded.section_id,
        job_role = excluded.job_role,
        employment_status = excluded.employment_status,
        has_windows_agent = excluded.has_windows_agent,
        has_whatsapp = excluded.has_whatsapp,
        preferred_primary_channel = excluded.preferred_primary_channel,
        preferred_secondary_channel = excluded.preferred_secondary_channel,
        source_system = coalesce(excluded.source_system, public.employees.source_system),
        external_reference = coalesce(excluded.external_reference, public.employees.external_reference)
    `,
    [
      employee.employeeNumber,
      employee.fullName,
      employee.email ?? null,
      employee.phoneNumber ?? null,
      siteId,
      areaId,
      departmentId,
      sectionId,
      employee.jobRole ?? null,
      employee.employmentStatus,
      employee.hasWindowsAgent,
      employee.hasWhatsApp,
      employee.preferredPrimaryChannel ?? null,
      employee.preferredSecondaryChannel ?? null,
      employee.sourceSystem ?? null,
      employee.externalReference ?? null,
    ],
  );
}

async function upsertDevice(
  client: PoolClient,
  device: Phase1BaselineImportPayload["devices"][number],
) {
  const siteId = await requireSiteIdByCode(client, device.siteCode);
  const areaId = device.areaName ? await requireAreaId(client, device.siteCode, device.areaName) : null;
  const primaryEmployeeId = device.primaryEmployeeNumber
    ? await requireEmployeeIdByNumber(client, device.primaryEmployeeNumber)
    : null;

  await client.query(
    `
      insert into public.devices (
        primary_employee_id,
        device_identifier,
        hostname,
        site_id,
        area_id,
        location_label,
        ownership_mode,
        agent_version,
        os_version,
        status
      )
      values ($1::uuid, $2, $3, $4::uuid, $5::uuid, $6, $7, $8, $9, $10)
      on conflict (hostname)
      do update set
        primary_employee_id = excluded.primary_employee_id,
        device_identifier = coalesce(excluded.device_identifier, public.devices.device_identifier),
        site_id = excluded.site_id,
        area_id = excluded.area_id,
        location_label = excluded.location_label,
        ownership_mode = excluded.ownership_mode,
        agent_version = coalesce(excluded.agent_version, public.devices.agent_version),
        os_version = coalesce(excluded.os_version, public.devices.os_version),
        status = excluded.status
    `,
    [
      primaryEmployeeId,
      device.deviceIdentifier ?? null,
      device.hostname,
      siteId,
      areaId,
      device.locationLabel ?? null,
      device.ownershipMode,
      device.agentVersion ?? null,
      device.osVersion ?? null,
      device.status,
    ],
  );
}

async function upsertAudienceGroup(
  client: PoolClient,
  audienceGroup: Phase1BaselineImportPayload["audienceGroups"][number],
) {
  const result = await client.query<{ id: string }>(
    `
      insert into public.audience_groups (
        name,
        description
      )
      values ($1, $2)
      on conflict (name)
      do update set
        description = excluded.description
      returning id::text as id
    `,
    [audienceGroup.name, audienceGroup.description ?? null],
  );

  const audienceGroupId = result.rows[0]?.id;
  if (!audienceGroupId) {
    throw new Error(`Audience group "${audienceGroup.name}" could not be stored.`);
  }

  await client.query(
    `
      delete from public.audience_group_members
      where audience_group_id::text = $1
    `,
    [audienceGroupId],
  );

  for (const employeeNumber of audienceGroup.employeeNumbers) {
    const employeeId = await requireEmployeeIdByNumber(client, employeeNumber);
    await client.query(
      `
        insert into public.audience_group_members (
          audience_group_id,
          employee_id
        )
        values ($1::uuid, $2::uuid)
        on conflict (audience_group_id, employee_id) do nothing
      `,
      [audienceGroupId, employeeId],
    );
  }
}

async function requireSiteIdByCode(client: PoolClient, siteCode: string) {
  const result = await client.query<{ id: string }>(
    `
      select id::text as id
      from public.sites
      where code::text = $1
      limit 1
    `,
    [siteCode],
  );
  const siteId = result.rows[0]?.id;
  if (!siteId) {
    throw new Error(`Site with code "${siteCode}" was not found during baseline import.`);
  }

  return siteId;
}

async function requireAreaId(client: PoolClient, siteCode: string, areaName: string) {
  const result = await client.query<{ id: string }>(
    `
      select a.id::text as id
      from public.areas a
      inner join public.sites s on s.id = a.site_id
      where s.code::text = $1
        and a.name::text = $2
      limit 1
    `,
    [siteCode, areaName],
  );
  const areaId = result.rows[0]?.id;
  if (!areaId) {
    throw new Error(`Area "${areaName}" for site "${siteCode}" was not found during baseline import.`);
  }

  return areaId;
}

async function requireDepartmentId(client: PoolClient, siteCode: string, departmentName: string) {
  const result = await client.query<{ id: string }>(
    `
      select d.id::text as id
      from public.departments d
      inner join public.sites s on s.id = d.site_id
      where s.code::text = $1
        and d.name::text = $2
      limit 1
    `,
    [siteCode, departmentName],
  );
  const departmentId = result.rows[0]?.id;
  if (!departmentId) {
    throw new Error(
      `Department "${departmentName}" for site "${siteCode}" was not found during baseline import.`,
    );
  }

  return departmentId;
}

async function requireSectionId(
  client: PoolClient,
  siteCode: string,
  departmentName: string,
  sectionName: string,
) {
  const result = await client.query<{ id: string }>(
    `
      select sec.id::text as id
      from public.sections sec
      inner join public.departments d on d.id = sec.department_id
      inner join public.sites s on s.id = d.site_id
      where s.code::text = $1
        and d.name::text = $2
        and sec.name::text = $3
      limit 1
    `,
    [siteCode, departmentName, sectionName],
  );
  const sectionId = result.rows[0]?.id;
  if (!sectionId) {
    throw new Error(
      `Section "${sectionName}" for department "${departmentName}" and site "${siteCode}" was not found during baseline import.`,
    );
  }

  return sectionId;
}

async function requireEmployeeIdByNumber(client: PoolClient, employeeNumber: string) {
  const result = await client.query<{ id: string }>(
    `
      select id::text as id
      from public.employees
      where employee_number::text = $1
      limit 1
    `,
    [employeeNumber],
  );
  const employeeId = result.rows[0]?.id;
  if (!employeeId) {
    throw new Error(
      `Employee "${employeeNumber}" was not found during baseline import for device linkage.`,
    );
  }

  return employeeId;
}
