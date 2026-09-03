import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Device } from "@/types";

type WellnessDeviceAudiencePickerProps = {
  devices: Device[];
  selectedDeviceIds: string[];
  onChange: (deviceIds: string[]) => void;
};

export function WellnessDeviceAudiencePicker(props: WellnessDeviceAudiencePickerProps) {
  const [search, setSearch] = useState("");

  const filteredDevices = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return props.devices;
    }

    return props.devices.filter((device) => {
      const fields = [
        device.deviceId,
        device.hostname,
        device.siteName,
        device.areaName,
        device.currentDisplayName,
        device.currentUsername,
        device.currentDepartment,
      ];

      return fields.some((value) => value?.toLowerCase().includes(query));
    });
  }, [props.devices, search]);

  const selectedSet = useMemo(() => new Set(props.selectedDeviceIds), [props.selectedDeviceIds]);
  const visibleSelectedCount = filteredDevices.filter((device) => selectedSet.has(device.deviceId)).length;

  function toggleDevice(deviceId: string, checked: boolean) {
    if (checked) {
      props.onChange([...new Set([...props.selectedDeviceIds, deviceId])]);
      return;
    }

    props.onChange(props.selectedDeviceIds.filter((item) => item !== deviceId));
  }

  function selectVisible() {
    props.onChange([
      ...new Set([...props.selectedDeviceIds, ...filteredDevices.map((device) => device.deviceId)]),
    ]);
  }

  function clearVisible() {
    const visibleIds = new Set(filteredDevices.map((device) => device.deviceId));
    props.onChange(props.selectedDeviceIds.filter((deviceId) => !visibleIds.has(deviceId)));
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label>Target Devices</Label>
        <p className="text-xs text-muted-foreground">
          Search, bulk-select, and assign the same routine to multiple approved Windows Agent devices.
        </p>
      </div>

      <div className="rounded-xl border">
        <div className="space-y-3 border-b bg-muted/20 p-3">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search device ID, hostname, user, or department"
          />

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" onClick={selectVisible}>
                Select Visible
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={clearVisible}>
                Clear Visible
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => props.onChange([])}
                disabled={props.selectedDeviceIds.length === 0}
              >
                Clear All
              </Button>
            </div>
            <div className="text-xs text-muted-foreground">
              {props.selectedDeviceIds.length} selected · {visibleSelectedCount}/{filteredDevices.length} visible
            </div>
          </div>
        </div>

        <ScrollArea className="h-72">
          <div className="divide-y">
            {filteredDevices.map((device) => {
              const isSelected = selectedSet.has(device.deviceId);

              return (
                <label
                  key={device.id}
                  className="flex cursor-pointer items-start gap-3 px-3 py-3 transition-colors hover:bg-muted/20"
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={(checked) => toggleDevice(device.deviceId, checked === true)}
                    className="mt-1"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{device.deviceId}</span>
                      <span className="text-sm text-muted-foreground">{device.hostname}</span>
                      <Badge variant="outline">{device.status}</Badge>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>Site: {device.siteName ?? device.siteId}</span>
                      {device.areaName && <span>Area: {device.areaName}</span>}
                      <span>
                        User: {device.currentDisplayName ?? device.currentUsername ?? device.lastActiveUserIdentifier ?? "Unknown"}
                      </span>
                      <span>Department: {device.currentDepartment ?? "Unknown"}</span>
                    </div>
                  </div>
                </label>
              );
            })}

            {filteredDevices.length === 0 && (
              <div className="px-3 py-10 text-center text-sm text-muted-foreground">
                No devices match the current search.
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {props.selectedDeviceIds.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {props.selectedDeviceIds.slice(0, 8).map((deviceId) => (
            <Badge key={deviceId} variant="secondary">
              {deviceId}
            </Badge>
          ))}
          {props.selectedDeviceIds.length > 8 && (
            <Badge variant="secondary">+{props.selectedDeviceIds.length - 8} more</Badge>
          )}
        </div>
      )}
    </div>
  );
}
