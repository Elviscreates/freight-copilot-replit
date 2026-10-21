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
  const base = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
  const res = await fetch(`${base}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw new Error("Invalid credentials");
  const { token } = await res.json();
  setToken(token);
}

export const logout = (): void => {
  clearToken();
  window.location.reload();
};