type PackageOrderFields = {
  version: string | null;
  lastModifiedAt: string;
  fileName: string;
};

function versionParts(version: string | null): number[] | null {
  if (!version || !/^\d+\.\d+\.\d+(?:\.\d+)?$/.test(version)) return null;
  const parts = version.split(".").map(Number);
  return parts.every(Number.isSafeInteger) ? parts : null;
}

/** Highest MSI product version first, independent of upload filename or transport. */
export function comparePublishedPackages(left: PackageOrderFields, right: PackageOrderFields) {
  const a = versionParts(left.version);
  const b = versionParts(right.version);
  if (a && b) {
    for (let index = 0; index < 4; index++) {
      const difference = (b[index] ?? 0) - (a[index] ?? 0);
      if (difference !== 0) return difference;
    }
  } else if (a || b) {
    return a ? -1 : 1;
  }
  const timestamp = (value: string) => {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  return (
    timestamp(right.lastModifiedAt) - timestamp(left.lastModifiedAt) ||
    left.fileName.localeCompare(right.fileName)
  );
}
