import { describe, it, expect, beforeEach, vi } from "vitest";
import { api } from "../services/api";
import * as authStore from "../stores/authAtom";

describe("API Client & Seam Interceptor (Cypress RWA Pattern)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("automatically attaches Bearer token header when token is present in auth store", async () => {
    vi.spyOn(authStore, "getStoredToken").mockReturnValue("test-jwt-token-xyz");

    // Test the request interceptor handler directly
    const requestInterceptor = (api.interceptors.request as any).handlers[0];
    const config = await requestInterceptor.fulfilled({ headers: {} });

    expect(config.headers.Authorization).toBe("Bearer test-jwt-token-xyz");
  });

  it("unwraps standard backend data envelope { data: { id: 1 } } to { id: 1 }", () => {
    const responseInterceptor = (api.interceptors.response as any).handlers[0];
    const simulatedResponse = {
      status: 200,
      data: {
        data: {
          id: "session-123",
          status: "active",
        },
      },
    };

    const unwrapped = responseInterceptor.fulfilled(simulatedResponse);
    expect(unwrapped.data).toEqual({ id: "session-123", status: "active" });
  });

  it("passes through flat response payloads that do not have envelope wrapping", () => {
    const responseInterceptor = (api.interceptors.response as any).handlers[0];
    const flatResponse = {
      status: 200,
      data: {
        token: "jwt-token-abc",
        user: { role: "assessor" },
      },
    };

    const result = responseInterceptor.fulfilled(flatResponse);
    expect(result.data.token).toBe("jwt-token-abc");
    expect(result.data.user.role).toBe("assessor");
  });
});
