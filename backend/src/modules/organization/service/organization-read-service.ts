import type { DatabaseClient } from "../../../infrastructure/db/connection.js";
import { createPageMeta } from "../../../shared/http/list-query.js";

type PagedReadOptions = {
  page: number;
  pageSize: number;
  search?: string;
};

type AreaReadOptions = PagedReadOptions & {
  siteId?: string;
};

type DepartmentReadOptions = PagedReadOptions & {
  siteId?: string;
};

type SectionReadOptions = PagedReadOptions & {
  departmentId?: string;
};

type EmployeeReadOptions = PagedReadOptions & {
  siteId?: string;
  areaId?: string;
  departmentId?: string;
  sectionId?: string;
};

type SiteRow = {
  id: string;
  code: string;
  name: string;
};

type AreaRow = {
  id: string;
  code: string | null;
  name: string;
  siteId: string;
};

type DepartmentRow = {
  id: string;
  code: string | null;
  name: string;
  siteId: string | null;
};

type SectionRow = {
  id: string;
  code: string | null;
  name: string;
  departmentId: string | null;
};

type EmployeeRow = {
  id: string;
  employeeNumber: string;
  fullName: string;
  siteId: string | null;
  areaId: string | null;
  departmentId: string | null;
  sectionId: string | null;
  whatsappNumber: string | null;
  email: string | null;
  preferredPrimaryChannel: string | null;
  preferredSecondaryChannel: string | null;
};

export class OrganizationReadService {
  constructor(private readonly database: DatabaseClient) {}

  async getOrganizationReference() {
    const [sites, areas, departments, sections] = await Promise.all([
      this.listAllSites(),
      this.listAllAreas(),
      this.listAllDepartments(),
      this.listAllSections(),
    ]);

    return {
      sites,
      areas,
      departments,
      sections,
    };
  }

  async listSites(options: PagedReadOptions) {
    const result = await this.queryPagedSites(options);
    return {
      items: result.items,
      page: createPageMeta({
        page: options.page,
        pageSize: options.pageSize,
        totalItems: result.totalItems,
      }),
    };
  }

  async listAreas(options: AreaReadOptions) {
    const result = await this.queryPagedAreas(options);
    return {
      items: result.items,
      page: createPageMeta({
        page: options.page,
        pageSize: options.pageSize,
        totalItems: result.totalItems,
      }),
    };
  }

  async listDepartments(options: DepartmentReadOptions) {
    const result = await this.queryPagedDepartments(options);
    return {
      items: result.items,
      page: createPageMeta({
        page: options.page,
        pageSize: options.pageSize,
        totalItems: result.totalItems,
      }),
    };
  }

  async listSections(options: SectionReadOptions) {
    const result = await this.queryPagedSections(options);
    return {
      items: result.items,
      page: createPageMeta({
        page: options.page,
        pageSize: options.pageSize,
        totalItems: result.totalItems,
      }),
    };
  }

  async listEmployees(options: EmployeeReadOptions) {
    const result = await this.queryPagedEmployees(options);
    return {
      items: result.items,
      page: createPageMeta({
        page: options.page,
        pageSize: options.pageSize,
        totalItems: result.totalItems,
      }),
    };
  }

  private async listAllSites() {
    return this.database.maybeQuery<SiteRow>(
      "sites",
      `
        select
          id::text as id,
          code::text as code,
          name::text as name
        from public.sites
        where coalesce(status::text, 'Active') != 'Inactive'
        order by name asc
      `,
    );
  }

  private async listAllAreas() {
    return this.database.maybeQuery<AreaRow>(
      "areas",
      `
        select
          id::text as id,
          code::text as code,
          name::text as name,
          site_id::text as "siteId"
        from public.areas
        where coalesce(status::text, 'Active') != 'Inactive'
        order by name asc
      `,
    );
  }

  private async listAllDepartments() {
    return this.database.maybeQuery<DepartmentRow>(
      "departments",
      `
        select
          id::text as id,
          code::text as code,
          name::text as name,
          site_id::text as "siteId"
        from public.departments
        where coalesce(status::text, 'Active') != 'Inactive'
        order by name asc
      `,
    );
  }

  private async listAllSections() {
    return this.database.maybeQuery<SectionRow>(
      "sections",
      `
        select
          id::text as id,
          code::text as code,
          name::text as name,
          department_id::text as "departmentId"
        from public.sections
        where coalesce(status::text, 'Active') != 'Inactive'
        order by name asc
      `,
    );
  }

  private async queryPagedSites(options: PagedReadOptions) {
    const where = buildSearchWhereClause(options.search, ["code", "name"]);
    const params = buildPaginationParams(options, where.params);

    const [items, totalRows] = await Promise.all([
      this.database.maybeQuery<SiteRow>(
        "sites",
        `
          select
            id::text as id,
            code::text as code,
            name::text as name
          from public.sites
          ${where.clause}
          order by name asc
          limit $${params.limitIndex}
          offset $${params.offsetIndex}
        `,
        params.values,
      ),
      this.database.maybeQuery<{ totalItems: number }>(
        "sites",
        `
          select count(*)::int as "totalItems"
          from public.sites
          ${where.clause}
        `,
        where.params,
      ),
    ]);

    return {
      items,
      totalItems: totalRows[0]?.totalItems ?? 0,
    };
  }

  private async queryPagedAreas(options: AreaReadOptions) {
    const where = buildStructuredWhereClause([
      options.siteId
        ? {
            sql: `site_id::text = $PLACEHOLDER`,
            value: options.siteId,
          }
        : undefined,
      ...buildSearchConditions(options.search, ["code", "name"]),
    ]);

    const params = buildPaginationParams(options, where.params);

    const [items, totalRows] = await Promise.all([
      this.database.maybeQuery<AreaRow>(
        "areas",
        `
          select
            id::text as id,
            code::text as code,
            name::text as name,
            site_id::text as "siteId"
          from public.areas
          ${where.clause}
          order by name asc
          limit $${params.limitIndex}
          offset $${params.offsetIndex}
        `,
        params.values,
      ),
      this.database.maybeQuery<{ totalItems: number }>(
        "areas",
        `
          select count(*)::int as "totalItems"
          from public.areas
          ${where.clause}
        `,
        where.params,
      ),
    ]);

    return {
      items,
      totalItems: totalRows[0]?.totalItems ?? 0,
    };
  }

  private async queryPagedDepartments(options: DepartmentReadOptions) {
    const where = buildStructuredWhereClause([
      options.siteId
        ? {
            sql: `site_id::text = $PLACEHOLDER`,
            value: options.siteId,
          }
        : undefined,
      ...buildSearchConditions(options.search, ["code", "name"]),
    ]);

    const params = buildPaginationParams(options, where.params);

    const [items, totalRows] = await Promise.all([
      this.database.maybeQuery<DepartmentRow>(
        "departments",
        `
          select
            id::text as id,
            code::text as code,
            name::text as name,
            site_id::text as "siteId"
          from public.departments
          ${where.clause}
          order by name asc
          limit $${params.limitIndex}
          offset $${params.offsetIndex}
        `,
        params.values,
      ),
      this.database.maybeQuery<{ totalItems: number }>(
        "departments",
        `
          select count(*)::int as "totalItems"
          from public.departments
          ${where.clause}
        `,
        where.params,
      ),
    ]);

    return {
      items,
      totalItems: totalRows[0]?.totalItems ?? 0,
    };
  }

  private async queryPagedSections(options: SectionReadOptions) {
    const where = buildStructuredWhereClause([
      options.departmentId
        ? {
            sql: `department_id::text = $PLACEHOLDER`,
            value: options.departmentId,
          }
        : undefined,
      ...buildSearchConditions(options.search, ["code", "name"]),
    ]);

    const params = buildPaginationParams(options, where.params);

    const [items, totalRows] = await Promise.all([
      this.database.maybeQuery<SectionRow>(
        "sections",
        `
          select
            id::text as id,
            code::text as code,
            name::text as name,
            department_id::text as "departmentId"
          from public.sections
          ${where.clause}
          order by name asc
          limit $${params.limitIndex}
          offset $${params.offsetIndex}
        `,
        params.values,
      ),
      this.database.maybeQuery<{ totalItems: number }>(
        "sections",
        `
          select count(*)::int as "totalItems"
          from public.sections
          ${where.clause}
        `,
        where.params,
      ),
    ]);

    return {
      items,
      totalItems: totalRows[0]?.totalItems ?? 0,
    };
  }

  private async queryPagedEmployees(options: EmployeeReadOptions) {
    const where = buildStructuredWhereClause([
      options.siteId
        ? {
            sql: `site_id::text = $PLACEHOLDER`,
            value: options.siteId,
          }
        : undefined,
      options.areaId
        ? {
            sql: `area_id::text = $PLACEHOLDER`,
            value: options.areaId,
          }
        : undefined,
      options.departmentId
        ? {
            sql: `department_id::text = $PLACEHOLDER`,
            value: options.departmentId,
          }
        : undefined,
      options.sectionId
        ? {
            sql: `section_id::text = $PLACEHOLDER`,
            value: options.sectionId,
          }
        : undefined,
      ...buildSearchConditions(options.search, ["employee_number", "full_name", "email", "phone_number"]),
    ]);

    const params = buildPaginationParams(options, where.params);

    const [rows, totalRows] = await Promise.all([
      this.database.maybeQuery<EmployeeRow>(
        "employees",
        `
          select
            id::text as id,
            employee_number::text as "employeeNumber",
            full_name::text as "fullName",
            site_id::text as "siteId",
            area_id::text as "areaId",
            department_id::text as "departmentId",
            section_id::text as "sectionId",
            phone_number::text as "whatsappNumber",
            email::text as email,
            preferred_primary_channel::text as "preferredPrimaryChannel",
            preferred_secondary_channel::text as "preferredSecondaryChannel"
          from public.employees
          ${where.clause}
          order by full_name asc
          limit $${params.limitIndex}
          offset $${params.offsetIndex}
        `,
        params.values,
      ),
      this.database.maybeQuery<{ totalItems: number }>(
        "employees",
        `
          select count(*)::int as "totalItems"
          from public.employees
          ${where.clause}
        `,
        where.params,
      ),
    ]);

    return {
      items: rows.map((row) => ({
        id: row.id,
        employeeNumber: row.employeeNumber,
        fullName: row.fullName,
        siteId: row.siteId,
        areaId: row.areaId,
        departmentId: row.departmentId,
        sectionId: row.sectionId,
        whatsappNumber: row.whatsappNumber,
        email: row.email,
        preferredChannels: compactChannels([
          row.preferredPrimaryChannel,
          row.preferredSecondaryChannel,
        ]),
      })),
      totalItems: totalRows[0]?.totalItems ?? 0,
    };
  }
}

function compactChannels(channels: Array<string | null>) {
  return channels.filter((channel): channel is string => Boolean(channel));
}

function buildSearchWhereClause(search: string | undefined, columns: string[]) {
  if (!search) {
    return {
      clause: "",
      params: [] as unknown[],
    };
  }

  const term = `%${search}%`;
  return {
    clause: `where (${columns
      .map((columnName, index) => `${columnName}::text ilike $${index + 1}`)
      .join(" or ")})`,
    params: columns.map(() => term),
  };
}

function buildSearchConditions(search: string | undefined, columns: string[]) {
  if (!search) {
    return [];
  }

  return [
    {
      sql: `(${columns.map((column) => `${column}::text ilike $PLACEHOLDER`).join(" or ")})`,
      value: `%${search}%`,
      repeatValueCount: columns.length,
    },
  ];
}

function buildStructuredWhereClause(
  conditions: Array<
    | {
        sql: string;
        value: unknown;
        repeatValueCount?: number;
      }
    | undefined
  >,
) {
  const values: unknown[] = [];
  const normalizedConditions = conditions.flatMap((condition) => {
    if (!condition) {
      return [];
    }

    const repeatValueCount = condition.repeatValueCount ?? 1;
    let sql = condition.sql;
    for (let index = 0; index < repeatValueCount; index += 1) {
      values.push(condition.value);
      sql = sql.replace("$PLACEHOLDER", `$${values.length}`);
    }

    return [sql];
  });

  return {
    clause: normalizedConditions.length > 0 ? `where ${normalizedConditions.join(" and ")}` : "",
    params: values,
  };
}

function buildPaginationParams(
  options: {
    page: number;
    pageSize: number;
  },
  baseParams: unknown[],
) {
  const values = [...baseParams, options.pageSize, (options.page - 1) * options.pageSize];

  return {
    values,
    limitIndex: baseParams.length + 1,
    offsetIndex: baseParams.length + 2,
  };
}
