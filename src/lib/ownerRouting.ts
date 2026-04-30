export function ownerAwarePath(currentPath: string, targetPath: string): string {
  const normalized = targetPath.startsWith("/") ? targetPath : `/${targetPath}`;

  if (!currentPath.startsWith("/owner")) {
    return normalized;
  }

  if (normalized === "/") {
    return "/owner";
  }

  if (normalized.startsWith("/?")) {
    return `/owner${normalized.slice(1)}`;
  }

  return normalized.startsWith("/owner") ? normalized : `/owner${normalized}`;
}
