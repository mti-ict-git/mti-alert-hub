import { useState } from "react";
import type { AccessScope } from "@/services/access.service";
import type { SiteReference, AreaReference } from "@/services/reference.service";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  sites: SiteReference[];
  areas: AreaReference[];
  value: AccessScope[];
  onChange: (scopes: AccessScope[]) => void;
  disabled?: boolean;
};
export function AccessScopePicker({ sites, areas, value, onChange, disabled }: Props) {
  const [search, setSearch] = useState("");
  const query = search.trim().toLocaleLowerCase();
  const selected = (kind: string, id: string) =>
    value.some((s) => s.scopeType === kind && s.scopeValue === id);
  const toggleSite = (site: SiteReference, checked: boolean) => {
    const childIds = new Set(areas.filter((a) => a.siteId === site.id).map((a) => a.id));
    const remaining = value.filter(
      (s) =>
        s.scopeType !== "Global" &&
        !(s.scopeType === "Site" && s.scopeValue === site.id) &&
        !(s.scopeType === "Area" && childIds.has(s.scopeValue)),
    );
    onChange(checked ? [...remaining, { scopeType: "Site", scopeValue: site.id }] : remaining);
  };
  const toggleArea = (area: AreaReference, checked: boolean) => {
    const remaining = value.filter(
      (s) => s.scopeType !== "Global" && !(s.scopeType === "Area" && s.scopeValue === area.id),
    );
    onChange(checked ? [...remaining, { scopeType: "Area", scopeValue: area.id }] : remaining);
  };
  const visible = sites.filter(
    (site) =>
      site.name.toLocaleLowerCase().includes(query) ||
      areas.some((a) => a.siteId === site.id && a.name.toLocaleLowerCase().includes(query)),
  );
  return (
    <fieldset disabled={disabled} className="space-y-3">
      <legend className="mb-2 text-sm font-medium">Selected locations</legend>
      <Label htmlFor="access-location-search" className="sr-only">
        Search sites and areas
      </Label>
      <Input
        id="access-location-search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search sites and areas"
      />
      <p className="text-xs text-muted-foreground">
        A site includes all its areas. Choose individual areas for narrower access.
      </p>
      <div className="max-h-64 space-y-3 overflow-y-auto rounded-md border p-3">
        {!visible.length && (
          <p className="text-sm text-muted-foreground">No locations match your search.</p>
        )}
        {visible.map((site) => {
          const children = areas.filter((a) => a.siteId === site.id);
          const all = selected("Site", site.id),
            partial = children.some((a) => selected("Area", a.id));
          return (
            <div key={site.id} className="space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id={"access-site-" + site.id}
                  disabled={disabled}
                  checked={all ? true : partial ? "indeterminate" : false}
                  onCheckedChange={(checked) => toggleSite(site, checked === true)}
                />
                <Label htmlFor={"access-site-" + site.id}>
                  {site.name} <span className="font-normal text-muted-foreground">— all areas</span>
                </Label>
              </div>
              {children
                .filter(
                  (a) =>
                    site.name.toLocaleLowerCase().includes(query) ||
                    a.name.toLocaleLowerCase().includes(query),
                )
                .map((area) => (
                  <div key={area.id} className="ml-6 flex items-center gap-2">
                    <Checkbox
                      id={"access-area-" + area.id}
                      disabled={disabled || all}
                      checked={all || selected("Area", area.id)}
                      onCheckedChange={(checked) => toggleArea(area, checked === true)}
                    />
                    <Label htmlFor={"access-area-" + area.id}>{area.name}</Label>
                  </div>
                ))}
            </div>
          );
        })}
      </div>
      <p role="status" className="text-xs text-muted-foreground">
        {value.filter((s) => s.scopeType !== "Global").length} location grants selected
      </p>
    </fieldset>
  );
}
