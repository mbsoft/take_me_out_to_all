import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, PUT, DELETE } from "../[id]/route";

// Mock dependencies
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    from: vi.fn(),
  },
}));

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

describe("GET /api/itineraries/[id]", () => {
  const mockParams = Promise.resolve({ id: "itin-123" });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 if not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);

    const res = await GET(new Request("http://localhost:3000"), { params: mockParams });

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Unauthorized");
  });

  it("returns 404 if itinerary not found", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "user-1", role: "user" },
    } as any);

    const mockSelect = vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({ data: null, error: { code: "PGRST116" } }),
        })),
      })),
    }));
    vi.mocked(db.from).mockImplementation(() => ({
      select: mockSelect,
    }) as ReturnType<typeof db.from>);

    const res = await GET(new Request("http://localhost:3000"), { params: mockParams });

    expect(res.status).toBe(404);
  });

  it("returns 404 if user does not own itinerary", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "user-1", role: "user" },
    } as any);

    // Simulate no result when filtered by user_id
    const mockSelect = vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        })),
      })),
    }));
    vi.mocked(db.from).mockImplementation(() => ({
      select: mockSelect,
    }) as ReturnType<typeof db.from>);

    const res = await GET(new Request("http://localhost:3000"), { params: mockParams });

    expect(res.status).toBe(404);
  });
});

describe("PUT /api/itineraries/[id]", () => {
  const mockParams = Promise.resolve({ id: "itin-123" });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function createRequest(body: object): Request {
    return new Request("http://localhost:3000/api/itineraries/itin-123", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("returns 401 if not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);

    const req = createRequest({ name: "Updated" });
    const res = await PUT(req, { params: mockParams });

    expect(res.status).toBe(401);
  });

  it("updates itinerary successfully", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "user-1" },
    } as any);

    const mockUpdate = vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ error: null }),
      })),
    }));
    vi.mocked(db.from).mockImplementation(() => ({
      update: mockUpdate,
    }) as ReturnType<typeof db.from>);

    const req = createRequest({
      name: "Updated Trip",
      goal: "al",
      travel_mode: "drive",
    });
    const res = await PUT(req, { params: mockParams });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
  });

  it("clears custom_teams when goal is not custom", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "user-1" },
    } as any);

    let updateData: any = null;
    const mockUpdate = vi.fn((data) => {
      updateData = data;
      return {
        eq: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({ error: null }),
        })),
      };
    });
    vi.mocked(db.from).mockImplementation(() => ({
      update: mockUpdate,
    }) as ReturnType<typeof db.from>);

    const req = createRequest({
      name: "Trip",
      goal: "all", // Changed from custom to all
    });
    await PUT(req, { params: mockParams });

    expect(updateData.custom_teams).toBeNull();
  });

  it("stores segment_modes as JSON", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "user-1" },
    } as any);

    let updateData: any = null;
    const mockUpdate = vi.fn((data) => {
      updateData = data;
      return {
        eq: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({ error: null }),
        })),
      };
    });
    vi.mocked(db.from).mockImplementation(() => ({
      update: mockUpdate,
    }) as ReturnType<typeof db.from>);

    const req = createRequest({
      name: "Trip",
      goal: "all",
      segment_modes: ["car", "air", "car"],
    });
    await PUT(req, { params: mockParams });

    expect(updateData.segment_modes).toBe('["car","air","car"]');
  });

  it("returns 500 on database error", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "user-1" },
    } as any);

    const mockUpdate = vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ error: { message: "DB error" } }),
      })),
    }));
    vi.mocked(db.from).mockImplementation(() => ({
      update: mockUpdate,
    }) as ReturnType<typeof db.from>);

    const req = createRequest({ name: "Trip" });
    const res = await PUT(req, { params: mockParams });

    expect(res.status).toBe(500);
  });
});

describe("DELETE /api/itineraries/[id]", () => {
  const mockParams = Promise.resolve({ id: "itin-123" });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 if not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);

    const res = await DELETE(new Request("http://localhost:3000"), { params: mockParams });

    expect(res.status).toBe(401);
  });

  it("deletes itinerary successfully", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "user-1" },
    } as any);

    const mockDelete = vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ error: null }),
      })),
    }));
    vi.mocked(db.from).mockImplementation(() => ({
      delete: mockDelete,
    }) as ReturnType<typeof db.from>);

    const res = await DELETE(new Request("http://localhost:3000"), { params: mockParams });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
  });

  it("returns 500 on database error", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "user-1" },
    } as any);

    const mockDelete = vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ error: { message: "DB error" } }),
      })),
    }));
    vi.mocked(db.from).mockImplementation(() => ({
      delete: mockDelete,
    }) as ReturnType<typeof db.from>);

    const res = await DELETE(new Request("http://localhost:3000"), { params: mockParams });

    expect(res.status).toBe(500);
  });
});
