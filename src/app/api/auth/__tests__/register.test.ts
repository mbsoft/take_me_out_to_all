import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "../register/route";

// Mock dependencies
vi.mock("@/lib/db", () => ({
  db: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(),
        })),
      })),
      insert: vi.fn(),
    })),
  },
}));

vi.mock("@/lib/verification", () => ({
  createVerificationToken: vi.fn().mockResolvedValue("mock-token"),
}));

vi.mock("@/lib/email", () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/template-seeder", () => ({
  seedTemplatesForUser: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("uuid", () => ({
  v4: () => "mock-uuid-1234",
}));

import { db } from "@/lib/db";
import { createVerificationToken } from "@/lib/verification";
import { sendVerificationEmail } from "@/lib/email";
import { seedTemplatesForUser } from "@/lib/template-seeder";

describe("POST /api/auth/register", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function createRequest(body: object): Request {
    return new Request("http://localhost:3000/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  describe("validation", () => {
    it("returns 400 if email is missing", async () => {
      const req = createRequest({ password: "password123" });
      const res = await POST(req);

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("Email and password required");
    });

    it("returns 400 if password is missing", async () => {
      const req = createRequest({ email: "test@example.com" });
      const res = await POST(req);

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("Email and password required");
    });

    it("returns 400 if both email and password are missing", async () => {
      const req = createRequest({});
      const res = await POST(req);

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("Email and password required");
    });
  });

  describe("duplicate email check", () => {
    it("returns 409 if email already registered", async () => {
      const mockFrom = vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: { id: "existing-user" } }),
          })),
        })),
        insert: vi.fn(),
      }));
      vi.mocked(db.from).mockImplementation(mockFrom);

      const req = createRequest({ email: "existing@example.com", password: "password123" });
      const res = await POST(req);

      expect(res.status).toBe(409);
      const json = await res.json();
      expect(json.error).toBe("Email already registered");
    });
  });

  describe("successful registration", () => {
    beforeEach(() => {
      // Mock no existing user
      const mockSelect = vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({ data: null }),
        })),
      }));
      const mockInsert = vi.fn().mockResolvedValue({ error: null });

      vi.mocked(db.from).mockImplementation(() => ({
        select: mockSelect,
        insert: mockInsert,
      }) as ReturnType<typeof db.from>);
    });

    it("returns 201 with user data on success", async () => {
      const req = createRequest({ email: "new@example.com", password: "password123" });
      const res = await POST(req);

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json).toEqual({
        id: "mock-uuid-1234",
        email: "new@example.com",
        requiresVerification: true,
      });
    });

    it("creates verification token and sends email", async () => {
      const req = createRequest({ email: "new@example.com", password: "password123" });
      await POST(req);

      expect(createVerificationToken).toHaveBeenCalledWith("mock-uuid-1234");
      expect(sendVerificationEmail).toHaveBeenCalledWith("new@example.com", "mock-token");
    });

    it("seeds templates for new user", async () => {
      const req = createRequest({ email: "new@example.com", password: "password123" });
      await POST(req);

      expect(seedTemplatesForUser).toHaveBeenCalledWith("mock-uuid-1234");
    });

    it("still returns success if email sending fails", async () => {
      vi.mocked(sendVerificationEmail).mockRejectedValueOnce(new Error("SMTP error"));

      const req = createRequest({ email: "new@example.com", password: "password123" });
      const res = await POST(req);

      expect(res.status).toBe(201);
    });

    it("still returns success if template seeding fails", async () => {
      vi.mocked(seedTemplatesForUser).mockRejectedValueOnce(new Error("Seed error"));

      const req = createRequest({ email: "new@example.com", password: "password123" });
      const res = await POST(req);

      expect(res.status).toBe(201);
    });
  });

  describe("database errors", () => {
    it("returns 500 if insert fails", async () => {
      const mockSelect = vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({ data: null }),
        })),
      }));
      const mockInsert = vi.fn().mockResolvedValue({ error: { message: "DB error" } });

      vi.mocked(db.from).mockImplementation(() => ({
        select: mockSelect,
        insert: mockInsert,
      }) as ReturnType<typeof db.from>);

      const req = createRequest({ email: "new@example.com", password: "password123" });
      const res = await POST(req);

      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.error).toBe("Registration failed");
    });
  });
});
