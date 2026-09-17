import { cloneElement, type ReactElement } from "react";
import { useAuth } from "@/hooks/useAuth";
import { can } from "@/lib/access";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
export function PermissionAction({
  permission,
  children,
}: {
  permission: string;
  children: ReactElement<{ disabled?: boolean; tabIndex?: number; "aria-disabled"?: boolean }>;
}) {
  const { user } = useAuth();
  if (can(user, permission)) return children;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          className="inline-flex"
          onClickCapture={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
        >
          {cloneElement(children, { disabled: true, tabIndex: -1, "aria-disabled": true })}
        </span>
      </TooltipTrigger>
      <TooltipContent>
        Your role cannot perform this action. Contact your administrator.
      </TooltipContent>
    </Tooltip>
  );
}
