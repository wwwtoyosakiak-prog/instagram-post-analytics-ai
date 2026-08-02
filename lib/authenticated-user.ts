export const DEFAULT_DATA_OWNER = "owner";
const authenticatedUserHeader = "x-app-authenticated-user";

export function getAuthenticatedUser(request: Request) {
  const value = request.headers.get(authenticatedUserHeader)?.trim();
  return value || DEFAULT_DATA_OWNER;
}
