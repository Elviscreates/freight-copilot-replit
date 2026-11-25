const TOKEN_KEY = "fc_auth_token";

export const getToken = (): string | null =>
  localStorage.getItem(TOKEN_KEY);

export const setToken = (token: string): void =>
  localStorage.setItem(TOKEN_KEY, token);

export const clearToken = (): void =>
  localStorage.removeItem(TOKEN_KEY);

export const isAuthenticated = (): boolean =>
  !!getToken();

export async function login(
  username: string,
  password: string
): Promise<void> {
  const configuredBase = import.meta.env.VITE_API_URL?.trim();
  if (import.meta.env.PROD && !configuredBase) {
    throw new Error("Login API is not configured. Set VITE_API_URL to the production backend origin.");
  }
  const base = configuredBase?.replace(/\/+$/, "") ?? "";
  const res = await fetch(`${base}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: username.trim(), password }),
  });

  if (!res.ok) {
    const errorData = (await res.json().catch(() => null)) as
      | { detail?: unknown; message?: unknown }
      | null;
    const message =
      typeof errorData?.detail === "string"
        ? errorData.detail
        : typeof errorData?.message === "string"
          ? errorData.message
          : `Login failed (HTTP ${res.status})`;
    throw new Error(message);
  }

  let data: { access_token?: unknown };
  try {
    data = (await res.json()) as { access_token?: unknown };
  } catch {
    throw new Error("Login succeeded but returned an invalid response.");
  }

  if (typeof data.access_token !== "string" || !data.access_token) {
    throw new Error("Login response did not include an access token");
  }
  setToken(data.access_token);
}

export const logout = (): void => {
  clearToken();
  window.location.reload();
};