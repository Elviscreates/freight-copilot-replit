import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LoginForm } from "@/components/ui/login-form";
import { login } from "@/lib/auth";

describe("LoginForm", () => {
  it("submits current form values when browser autofill did not trigger React changes", () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<LoginForm onSubmit={onSubmit} />);

    const username = screen.getByLabelText(/email address/i) as HTMLInputElement;
    const password = screen.getByLabelText(/^password$/i) as HTMLInputElement;
    username.value = " admin ";
    password.value = "admin123";

    fireEvent.submit(username.closest("form")!);

    expect(onSubmit).toHaveBeenCalledWith("admin", "admin123");
  });
});

describe("login API", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("posts normalized credentials to the login endpoint and stores the access token", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ access_token: "test-token" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await login(" admin ", "admin123");

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/login$/),
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "admin", password: "admin123" }),
      }),
    );
    expect(localStorage.setItem).toHaveBeenCalledWith("fc_auth_token", "test-token");
  });

  it("surfaces the backend error detail for rejected credentials", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ detail: "Invalid username or password" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    await expect(login("admin", "wrong")).rejects.toThrow("Invalid username or password");
  });

  it("explains fetch failures as a connection or CORS problem", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    await expect(login("admin", "admin123")).rejects.toThrow(
      "Unable to reach the login service. Check the backend connection and CORS configuration.",
    );
  });
});
