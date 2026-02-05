import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "../forgot-password/route";

// Mock dependencies
vi.mock("@/lib/db", () => ({
  db: {
    from: vi.fn(),
  },
}));

vi.mock("@/lib/email", () => ({
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
}));

import { db } from "@/lib/db";
import { sendPasswordResetEmail } from "@/lib/email";

describe("POST /api/auth/forgot-password", () => {
  const GENERIC_MESSAGE = "If an account exists with that email, a reset link has been sent.";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function createRequest(body: object): Request {
    return new Request("http://localhost:3000/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  describe("validation", () => {
    it("returns 400 if email is missing", async () => {
      const req = createRequest({});
      const res = await POST(req);

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("Email is required");
    });
  });

  describe("anti-enumeration", () => {
    it("returns same message for non-existent user", async () => {
      const mockSelect = vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({ data: null }),
        })),
      }));
      vi.mocked(db.from).mockImplementation(() => ({
        select: mockSelect,
      }) as ReturnType<typeof db.from>);

      const req = createRequest({ email: "nonexistent@example.com" });
      const res = await POST(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.message).toBe(GENERIC_MESSAGE);
      expect(sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it("returns same message for OAuth-only user (no password_hash)", async () => {
      const mockSelect = vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: { id: "user-1", password_hash: null, is_active: true },
          }),
        })),
      }));
      vi.mocked(db.from).mockImplementation(() => ({
        select: mockSelect,
      }) as ReturnType<typeof db.from>);

      const req = createRequest({ email: "oauth@example.com" });
      const res = await POST(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.message).toBe(GENERIC_MESSAGE);
      expect(sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it("returns same message for inactive user", async () => {
      const mockSelect = vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: { id: "user-1", password_hash: "hash", is_active: false },
          }),
        })),
      }));
      vi.mocked(db.from).mockImplementation(() => ({
        select: mockSelect,
      }) as ReturnType<typeof db.from>);

      const req = createRequest({ email: "inactive@example.com" });
      const res = await POST(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.message).toBe(GENERIC_MESSAGE);
      expect(sendPasswordResetEmail).not.toHaveBeenCalled();
    });
  });

  describe("successful reset request", () => {
    let mockUpdate: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      const mockSelect = vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: { id: "user-1", password_hash: "existing-hash", is_active: true },
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

    it("returns generic success message", async () => {
      const req = createRequest({ email: "valid@example.com" });
      const res = await POST(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.message).toBe(GENERIC_MESSAGE);
    });

    it("stores reset token in database", async () => {
      const req = createRequest({ email: "valid@example.com" });
      await POST(req);

      expect(mockUpdate).toHaveBeenCalled();
      const updateCall = mockUpdate.mock.calls[0][0];
      expect(updateCall).toHaveProperty("password_reset_token");
      expect(updateCall).toHaveProperty("password_reset_token_expires");
      // Token should be 64 characters hex (32 bytes)
      expect(updateCall.password_reset_token).toMatch(/^[a-f0-9]{64}$/);
    });

    it("sends password reset email", async () => {
      const req = createRequest({ email: "valid@example.com" });
      await POST(req);

      expect(sendPasswordResetEmail).toHaveBeenCalledWith(
        "valid@example.com",
        expect.stringMatching(/^[a-f0-9]{64}$/)
      );
    });

    it("still returns success if email sending fails", async () => {
      vi.mocked(sendPasswordResetEmail).mockRejectedValueOnce(new Error("SMTP error"));

      const req = createRequest({ email: "valid@example.com" });
      const res = await POST(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.message).toBe(GENERIC_MESSAGE);
    });
  });
});
