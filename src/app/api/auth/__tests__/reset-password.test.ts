import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "../reset-password/route";

// Mock dependencies
vi.mock("@/lib/db", () => ({
  db: {
    from: vi.fn(),
  },
}));

import { db } from "@/lib/db";

describe("POST /api/auth/reset-password", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function createRequest(body: object): Request {
    return new Request("http://localhost:3000/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  describe("validation", () => {
    it("returns 400 if token is missing", async () => {
      const req = createRequest({ password: "newpassword123" });
      const res = await POST(req);

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("Token and password are required");
    });

    it("returns 400 if password is missing", async () => {
      const req = createRequest({ token: "reset-token-123" });
      const res = await POST(req);

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("Token and password are required");
    });

    it("returns 400 if password is too short", async () => {
      const req = createRequest({ token: "reset-token-123", password: "short" });
      const res = await POST(req);

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("Password must be at least 8 characters");
    });

    it("accepts password with exactly 8 characters", async () => {
      const mockSelect = vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({ data: null }),
        })),
      }));
      vi.mocked(db.from).mockImplementation(() => ({
        select: mockSelect,
      }) as ReturnType<typeof db.from>);

      const req = createRequest({ token: "reset-token-123", password: "12345678" });
      const res = await POST(req);

      // Should pass validation and fail on token lookup
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("Invalid or expired reset link");
    });
  });

  describe("token validation", () => {
    it("returns 400 for invalid token", async () => {
      const mockSelect = vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({ data: null }),
        })),
      }));
      vi.mocked(db.from).mockImplementation(() => ({
        select: mockSelect,
      }) as ReturnType<typeof db.from>);

      const req = createRequest({ token: "invalid-token", password: "newpassword123" });
      const res = await POST(req);

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("Invalid or expired reset link");
    });

    it("returns 400 for expired token", async () => {
      const expiredDate = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // 1 hour ago
      const mockSelect = vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: {
              id: "user-1",
              password_hash: "existing-hash",
              password_reset_token_expires: expiredDate,
            },
          }),
        })),
      }));
      vi.mocked(db.from).mockImplementation(() => ({
        select: mockSelect,
      }) as ReturnType<typeof db.from>);

      const req = createRequest({ token: "expired-token", password: "newpassword123" });
      const res = await POST(req);

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("This reset link has expired. Please request a new one.");
    });

    it("returns 400 for OAuth user without password", async () => {
      const validExpiry = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      const mockSelect = vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: {
              id: "user-1",
              password_hash: null, // OAuth user
              password_reset_token_expires: validExpiry,
            },
          }),
        })),
      }));
      vi.mocked(db.from).mockImplementation(() => ({
        select: mockSelect,
      }) as ReturnType<typeof db.from>);

      const req = createRequest({ token: "valid-token", password: "newpassword123" });
      const res = await POST(req);

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("This account uses Google sign-in and does not have a password to reset.");
    });
  });

  describe("successful password reset", () => {
    let mockUpdate: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      const validExpiry = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      const mockSelect = vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: {
              id: "user-1",
              password_hash: "old-hash",
              password_reset_token_expires: validExpiry,
            },
          }),
        })),
      }));
      mockUpdate = vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }));

      vi.mocked(db.from).mockImplementation(() => ({
        select: mockSelect,
        update: mockUpdate,
      }) as ReturnType<typeof db.from>);
    });

    it("returns success response", async () => {
      const req = createRequest({ token: "valid-token", password: "newpassword123" });
      const res = await POST(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
    });

    it("updates password hash and clears reset token", async () => {
      const req = createRequest({ token: "valid-token", password: "newpassword123" });
      await POST(req);

      expect(mockUpdate).toHaveBeenCalled();
      const updateCall = mockUpdate.mock.calls[0][0];
      expect(updateCall).toHaveProperty("password_hash");
      expect(updateCall.password_reset_token).toBeNull();
      expect(updateCall.password_reset_token_expires).toBeNull();
    });

    it("hashes the new password (not stored in plain text)", async () => {
      const req = createRequest({ token: "valid-token", password: "newpassword123" });
      await POST(req);

      const updateCall = mockUpdate.mock.calls[0][0];
      // bcrypt hashes start with $2a$ or $2b$
      expect(updateCall.password_hash).toMatch(/^\$2[ab]\$/);
      expect(updateCall.password_hash).not.toBe("newpassword123");
    });
  });
});
