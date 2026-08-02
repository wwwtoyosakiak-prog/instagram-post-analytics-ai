export const DEFAULT_DATA_OWNER = "owner";
const authenticatedUserHeader = "x-app-authenticated-user";
const authenticatedRoleHeader = "x-app-authenticated-role";

export function getAuthenticatedUser(request: Request) {
  const value = request.headers.get(authenticatedUserHeader)?.trim();
  return value || DEFAULT_DATA_OWNER;
}

export function getAuthenticatedRole(request: Request) {
  return request.headers.get(authenticatedRoleHeader) === "admin" ? "admin" as const : "member" as const;
}

export function isAuthenticatedAdmin(request: Request) {
  return getAuthenticatedRole(request) === "admin";
}
