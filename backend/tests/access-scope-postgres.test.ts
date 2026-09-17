import { checkAccessReadiness } from "../src/modules/access/service/access-readiness.js";
import { CommunicationDraftService } from "../src/modules/communications/service/communication-draft-service.js";
import { AuditLogService } from "../src/modules/audit/service/audit-log-service.js";
import { WorkflowDefinitionService } from "../src/modules/workflows/service/workflow-definition-service.js";
import type { AgentService } from "../src/modules/agent/service/agent-service.js";
import { createContextualDatabase } from "../src/infrastructure/db/contextual-database.js";
import { createHttpServer } from "../src/app/http/create-server.js";
import { createLogger } from "../src/shared/observability/logger.js";
import { protectAdministrativeRoutes } from "../src/modules/access/service/administrative-route-policy.js";
import { createAccessResourceEnforcer } from "../src/modules/access/service/access-resource-enforcer.js";
import { PersistentAccessSessionStore } from "../src/modules/access/service/persistent-access-session-store.js";
import { registerDeviceRoutes } from "../src/modules/devices/controller/register-device-routes.js";
import { DevicePlacementService } from "../src/modules/devices/service/device-placement-service.js";
import { DeviceActionService } from "../src/modules/devices/service/device-action-service.js";
import { AudiencePreviewService } from "../src/modules/communications/service/audience-preview-service.js";
import { CommunicationTemplateService } from "../src/modules/communications/service/communication-template-service.js";
import { DashboardReadService } from "../src/modules/dashboard/service/dashboard-read-service.js";
import {
  communicationJobSql,
  JobAuthorizationService,
} from "../src/modules/access/service/job-authorization.js";
import {
  CommunicationAccessService,
  communicationScopeSql,
  communicationReportScopeSql,
} from "../src/modules/access/service/communication-access-service.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { Pool, type PoolClient, type QueryResultRow } from "pg";
import type { DatabaseClient, TransactionClient } from "../src/infrastructure/db/connection.js";
import { withAccess, type RequestAccess } from "../src/modules/access/service/access-context.js";
import { OrganizationReadService } from "../src/modules/organization/service/organization-read-service.js";
import { DeviceReadService } from "../src/modules/devices/service/device-read-service.js";

test(
  "Scoped production read queries use actual PostgreSQL before counting and pagination",
  { skip: !process.env.USER_ACCESS_TEST_DATABASE_URL },
  async () => {
    const pool = new Pool({ connectionString: process.env.USER_ACCESS_TEST_DATABASE_URL });
    const schema = "scope_test_" + randomUUID().replaceAll("-", "");
    assert.match(schema, /^scope_test_[a-f0-9]{32}$/);
    const rewrite = (sql: string) =>
      sql.replaceAll("public.", schema + ".").replaceAll("'public'", `'${schema}'`);
    const wrap = (client: Pool | PoolClient) => ({
      query: async <T extends QueryResultRow>(sql: string, params?: unknown[]) =>
        (await client.query<T>(rewrite(sql), params)).rows,
      maybeQuery: async <T extends QueryResultRow>(_: string, sql: string, params?: unknown[]) =>
        (await client.query<T>(rewrite(sql), params)).rows,
      tableExists: async () => true,
      ping: async () => {},
    });
    const db: DatabaseClient = {
      ...wrap(pool),
      async withTransaction<T>(run: (tx: TransactionClient) => Promise<T>) {
        const c = await pool.connect();
        try {
          await c.query("begin");
          const result = await run(wrap(c));
          await c.query("commit");
          return result;
        } catch (e) {
          await c.query("rollback");
          throw e;
        } finally {
          c.release();
        }
      },
    };
    try {
      await pool.query("create schema " + schema);
      const folder = new URL("../migrations/", import.meta.url);
      for (const file of (await readdir(folder)).filter((f) => f.endsWith(".up.sql")).sort())
        await db.query(await readFile(new URL(file, folder), "utf8"));
      await assert.rejects(checkAccessReadiness(db), /No verified Active Global Administrator/);
      const bootstrapId = randomUUID();
      await db.query(
        "insert into public.users(id,username,full_name,role_type,status,directory_id,directory_subject_id) values($1,'verified-admin','Verified Administrator','CentralAdmin','Active','fixture-directory',$2)",
        [bootstrapId, randomUUID()],
      );
      await db.query(
        "insert into public.user_scopes(user_id,scope_type,scope_value) values($1,'Global','*')",
        [bootstrapId],
      );
      assert.equal((await checkAccessReadiness(db)).verifiedAdministrators, 1);
      const siteA = randomUUID(),
        siteB = randomUUID(),
        areaA = randomUUID(),
        areaOther = randomUUID(),
        areaB = randomUUID();
      await db.query(
        "insert into public.sites(id,code,name) values($1,'A','Site A'),($2,'B','Site B')",
        [siteA, siteB],
      );
      await db.query(
        "insert into public.areas(id,site_id,name) values($1,$2,'Area A'),($3,$2,'Area Other'),($4,$5,'Area B')",
        [areaA, siteA, areaOther, areaB, siteB],
      );
      const deptA = randomUUID(),
        deptB = randomUUID();
      await db.query(
        "insert into public.departments(id,site_id,name) values($1,$2,'Department A'),($3,$4,'Department B')",
        [deptA, siteA, deptB, siteB],
      );
      await db.query(
        "insert into public.employees(employee_number,full_name,site_id,area_id,department_id) values('1','Person A',$1,$2,$3),('2','Person Other',$1,$4,$3),('3','Person B',$5,$6,$7),('4','Unassigned',null,null,null)",
        [siteA, areaA, deptA, areaOther, siteB, areaB, deptB],
      );
      await db.query(
        "insert into public.devices(hostname,site_id,area_id,ownership_mode) values('Device A',$1,$2,'LocationOwned'),('Device Other',$1,$3,'LocationOwned'),('Device B',$4,$5,'LocationOwned')",
        [siteA, areaA, areaOther, siteB, areaB],
      );
      const org = new OrganizationReadService(db),
        devices = new DeviceReadService(db, { onlineSeconds: 60, staleSeconds: 300 });
      const actor: RequestAccess = {
        userId: randomUUID(),
        role: "ITOperator",
        authorizationVersion: 1,
        scopes: [{ scopeType: "Area", scopeValue: areaA }],
      };
      const publisher = randomUUID(),
        communication = randomUUID(),
        schedule = randomUUID();
      await db.query(
        "insert into public.users(id,username,full_name,role_type,status) values($1,'publisher','Publisher','CommunicationOperator','Active')",
        [publisher],
      );
      await db.query(
        "insert into public.user_scopes(user_id,scope_type,scope_value) values($1,'Site',$2)",
        [publisher, siteA],
      );
      await db.query(
        "insert into public.communications(id,communication_type,priority,title,body,status,channel_selections_json) values($1,'Alert','Info','Private body title','Private body','Draft','[\"WindowsAgent\"]')",
        [communication],
      );
      await withAccess(
        {
          ...actor,
          userId: publisher,
          role: "CommunicationOperator",
          scopes: [{ scopeType: "Site", scopeValue: siteA }],
        },
        async () => {
          await new CommunicationAccessService(db).recordDraft(communication);
          await new CommunicationAccessService(db).authorizePublication(communication);
        },
      );
      await db.query(
        "insert into public.communication_schedules(id,communication_id,schedule_type,is_active) values($1,$2,'Immediate',true)",
        [schedule, communication],
      );
      await db.query(
        "insert into public.communication_recipients(communication_id,communication_schedule_id,recipient_type,device_id,site_id,area_id) select $1,$2,'Device',id,site_id,area_id from public.devices where site_id=$3",
        [communication, schedule, siteA],
      );
      await withAccess(actor, async () => {
        assert.equal(
          (await db.query(`select id from public.communications where ${communicationScopeSql()}`))
            .length,
          0,
        );
        assert.equal(
          (
            await db.query(
              `select id from public.communications where ${communicationReportScopeSql()}`,
            )
          ).length,
          1,
        );
        assert.equal(
          (await new CommunicationAccessService(db).reportDetail(communication))?.title,
          "Restricted communication",
        );
        const dashboard = new DashboardReadService(db);
        await dashboard.getOverview();
        await dashboard.getContentTypeRollups();
      });
      let allowed = await db.query(
        `select c.id from public.communications c,public.devices auth_device where c.id=$1 and auth_device.hostname='Device A' and ${communicationJobSql()}`,
        [communication],
      );
      assert.equal(allowed.length, 1);
      await db.query(
        "update public.users set authorization_version=authorization_version+1 where id=$1",
        [publisher],
      );
      allowed = await db.query(
        `select c.id from public.communications c,public.devices auth_device where c.id=$1 and auth_device.hostname='Device A' and ${communicationJobSql()}`,
        [communication],
      );
      assert.equal(allowed.length, 0);
      const [testDevice] = await db.query<{ id: string }>(
        "select id from public.devices where hostname='Device A'",
      );
      await new JobAuthorizationService(db).deactivateUnauthorizedPolicies(testDevice!.id);
      assert.equal(
        (
          await db.query(
            "select authorization_state from public.communication_access where communication_id=$1",
            [communication],
          )
        )[0]?.authorization_state,
        "BlockedAuthorization",
      );
      assert.equal(
        (
          await db.query(
            "select id from public.audit_logs where action_type='AuthorizationBlocked' and entity_id=$1",
            [communication],
          )
        ).length,
        1,
      );
      await new JobAuthorizationService(db).deactivateUnauthorizedPolicies(testDevice!.id);
      assert.equal(
        (
          await db.query(
            "select id from public.audit_logs where action_type='AuthorizationBlocked' and entity_id=$1",
            [communication],
          )
        ).length,
        1,
      );
      const guardedDb = createContextualDatabase(db);
      const placement = new DevicePlacementService(guardedDb);
      await db.query(
        "insert into public.users(id,username,full_name,role_type,status) values($1,'scoped-it','Scoped IT','ITOperator','Active')",
        [actor.userId],
      );
      await db.query(
        "insert into public.user_scopes(user_id,scope_type,scope_value) values($1,'Area',$2)",
        [actor.userId, areaA],
      );
      const sessions = new PersistentAccessSessionStore(guardedDb, 60000);
      const issued = await sessions.create(actor.userId);
      const routes = registerDeviceRoutes({
        deviceReadService: new DeviceReadService(guardedDb, {
          onlineSeconds: 60,
          staleSeconds: 300,
        }),
        deviceActionService: {
          getPlacement: placement.get.bind(placement),
          updatePlacement: placement.update.bind(placement),
        } as DeviceActionService,
      } as Parameters<typeof registerDeviceRoutes>[0]);
      const http = createHttpServer({
        logger: createLogger("error"),
        resolveSession: (t) => sessions.get(t),
        routes: protectAdministrativeRoutes(routes, createAccessResourceEnforcer(guardedDb)),
      });
      await new Promise<void>((r) => http.listen(0, "127.0.0.1", r));
      const root = "http://127.0.0.1:" + (http.address() as { port: number }).port;
      const request = (path: string, method = "GET", body?: unknown) =>
        fetch(root + path, {
          method,
          headers: {
            Authorization: "Bearer " + issued.sessionToken,
            "Content-Type": "application/json",
          },
          body: body ? JSON.stringify(body) : undefined,
        });
      try {
        const response = await request("/devices?page=1&pageSize=10");
        assert.equal(response.status, 200);
        const payload = await response.json();
        assert.equal(payload.page.totalItems, 1);
        assert.equal(payload.items[0].hostname, "Device A");
        const [foreign] = await db.query<{ id: string }>(
          "select id from public.devices where hostname='Device B'",
        );
        assert.equal((await request("/devices/" + foreign!.id + "/placement")).status, 404);
        const original = await (await request("/devices/" + testDevice!.id + "/placement")).json();
        const expected = {
          siteId: original.siteId,
          areaId: original.areaId,
          locationLabel: original.locationLabel,
          ownershipMode: original.ownershipMode,
        };
        assert.equal(
          (
            await request("/devices/" + testDevice!.id + "/placement", "PATCH", {
              expected,
              changes: { siteId: siteB, areaId: areaB },
            })
          ).status,
          404,
        );
        assert.equal(
          (
            await request("/devices/" + testDevice!.id + "/placement", "PATCH", {
              expected,
              changes: { locationLabel: "Reviewed" },
            })
          ).status,
          200,
        );
        await sessions.revoke(issued.sessionToken);
        assert.equal((await request("/devices")).status, 401);
      } finally {
        http.closeAllConnections();
        await new Promise<void>((r, j) => http.close((e) => (e ? j(e) : r())));
      }
      const templates = new CommunicationTemplateService(guardedDb);
      const audience = new AudiencePreviewService(guardedDb, templates);
      const drafts = new CommunicationDraftService(
        guardedDb,
        templates,
        audience,
        {} as AgentService,
        new AuditLogService(guardedDb),
        new WorkflowDefinitionService(guardedDb),
        ["WindowsAgent"],
      );
      await withAccess(actor, () =>
        guardedDb.withTransaction(async () => {
          const input = {
            communicationType: "Alert" as const,
            priority: "Info" as const,
            title: "Test access draft",
            body: "Scoped body",
            channelSelections: ["WindowsAgent" as const],
            targets: [{ targetType: "Device" as const, targetValue: testDevice!.id }],
          };
          const draft = await drafts.createDraft(input);
          assert.equal(draft.title, input.title);
          const list = await drafts.listCommunications({ page: 1, pageSize: 10, view: "report" });
          assert.ok(list.items.some((row) => row.title === "Restricted communication"));
          const hiddenSearch = await drafts.listCommunications({
            page: 1,
            pageSize: 10,
            view: "report",
            search: "Private body",
          });
          assert.equal(hiddenSearch.items.length, 0);
          await drafts.listWellnessProgramRollups();
          await assert.rejects(
            drafts.createDraft({ ...input, priority: "Critical" }),
            (e: unknown) => (e as { statusCode: number }).statusCode === 403,
          );
          await withAccess({ ...actor, role: "EmergencyOfficer" }, async () => {
            const critical = await drafts.createDraft({ ...input, priority: "Critical" });
            let resolved = await audience.resolveExecutionAudience(critical.id);
            await assert.rejects(
              audience.requireEmergencyPreview(critical.id, resolved),
              (e: unknown) => (e as { code: string }).code === "PREVIEW_REQUIRED",
            );
            await audience.previewCommunicationAudience(critical.id);
            await audience.requireEmergencyPreview(critical.id, resolved);
            await guardedDb.query(
              "update public.communications set body='Changed emergency' where id=$1",
              [critical.id],
            );
            resolved = await audience.resolveExecutionAudience(critical.id);
            await assert.rejects(
              audience.requireEmergencyPreview(critical.id, resolved),
              (e: unknown) => (e as { code: string }).code === "PREVIEW_REQUIRED",
            );
            await withAccess(actor, async () => {
              await assert.rejects(
                drafts.duplicateDraft(critical.id),
                (e: unknown) => (e as { statusCode: number }).statusCode === 403,
              );
              await assert.rejects(
                drafts.updateDraft(critical.id, { priority: "Info" }),
                (e: unknown) => (e as { statusCode: number }).statusCode === 403,
              );
            });
          });
        }),
      );
      await withAccess(actor, async () => {
        const preview = new AudiencePreviewService(
          guardedDb,
          new CommunicationTemplateService(guardedDb),
        );
        await preview.validateTargetAccess([{ targetType: "Device", targetValue: testDevice!.id }]);
        await assert.rejects(
          preview.validateTargetAccess([
            { targetType: "Device", targetValue: testDevice!.id },
            { targetType: "Site", targetValue: siteB },
          ]),
          (e: unknown) => (e as { statusCode: number }).statusCode === 404,
        );
      });
      await withAccess(actor, async () => {
        const ref = await org.getOrganizationReference();
        assert.deepEqual(
          ref.sites.map((s) => s.id),
          [siteA],
        );
        assert.deepEqual(
          ref.areas.map((a) => a.id),
          [areaA],
        );
        assert.deepEqual(
          ref.departments.map((d) => d.id),
          [deptA],
        );
        const people = await org.listEmployees({ page: 1, pageSize: 10 });
        assert.deepEqual(
          people.items.map((e) => e.employeeNumber),
          ["1"],
        );
        assert.equal(people.page.totalItems, 1);
        const list = await devices.listDevices({ page: 1, pageSize: 10 });
        assert.deepEqual(
          list.items.map((d) => d.hostname),
          ["Device A"],
        );
        assert.equal(list.page.totalItems, 1);
        assert.equal(
          (await devices.listDevices({ page: 1, pageSize: 10, siteId: siteB })).page.totalItems,
          0,
        );
        assert.equal(
          (await org.listEmployees({ page: 1, pageSize: 10, search: "Person B" })).page.totalItems,
          0,
        );
        assert.equal((await org.listSites({ page: 1, pageSize: 10 })).page.totalItems, 1);
        assert.equal((await org.listAreas({ page: 1, pageSize: 10 })).page.totalItems, 1);
      });
      await withAccess(
        { ...actor, scopes: [{ scopeType: "Site", scopeValue: siteA }] },
        async () => {
          const list = await devices.listDevices({ page: 1, pageSize: 1 });
          assert.equal(list.items.length, 1);
          assert.equal(list.page.totalItems, 2);
          assert.equal((await org.listEmployees({ page: 1, pageSize: 1 })).page.totalItems, 2);
        },
      );
      await withAccess({ ...actor, scopes: [] }, async () => {
        assert.equal((await devices.listDevices({ page: 1, pageSize: 10 })).page.totalItems, 0);
        assert.equal((await org.getOrganizationReference()).sites.length, 0);
      });
      await withAccess(
        { ...actor, scopes: [{ scopeType: "Global", scopeValue: "*" }] },
        async () => {
          assert.equal((await devices.listDevices({ page: 1, pageSize: 10 })).page.totalItems, 3);
          assert.equal((await org.listEmployees({ page: 1, pageSize: 10 })).page.totalItems, 4);
        },
      );
    } finally {
      await pool.query("drop schema " + schema + " cascade");
      await pool.end();
    }
  },
);
