import type { AppRoute } from "../../../app/http/create-server.js";
import { baseListQuerySchema, parseListQuery } from "../../../shared/http/list-query.js";
import type { WorkflowDefinitionService } from "../service/workflow-definition-service.js";

type RegisterWorkflowRoutesOptions = {
  workflowDefinitionService: WorkflowDefinitionService;
};

export function registerWorkflowRoutes(options: RegisterWorkflowRoutesOptions): AppRoute[] {
  return [
    {
      method: "GET",
      path: "/workflows",
      requiresAuth: true,
      async handler({ url }) {
        const query = parseListQuery(baseListQuerySchema, url);
        return {
          statusCode: 200,
          body: await options.workflowDefinitionService.listWorkflowDefinitions(query),
        };
      },
    },
  ];
}
