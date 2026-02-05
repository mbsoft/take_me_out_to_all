import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PlaceAutocomplete } from "../place-autocomplete";

describe("PlaceAutocomplete", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("renders input with placeholder", () => {
    const onChange = vi.fn();
    const onSelect = vi.fn();
    render(
      <PlaceAutocomplete
        value=""
        onChange={onChange}
        onSelect={onSelect}
        placeholder="Enter city"
      />
    );

    expect(screen.getByPlaceholderText("Enter city")).toBeInTheDocument();
  });

  it("renders with default placeholder when not provided", () => {
    const onChange = vi.fn();
    const onSelect = vi.fn();
    render(<PlaceAutocomplete value="" onChange={onChange} onSelect={onSelect} />);

    expect(screen.getByPlaceholderText("Search city or address...")).toBeInTheDocument();
  });

  it("calls onChange when typing", async () => {
    const onChange = vi.fn();
    const onSelect = vi.fn();
    render(<PlaceAutocomplete value="" onChange={onChange} onSelect={onSelect} />);

    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "New York" } });

    expect(onChange).toHaveBeenCalledWith("New York");
  });

  it("does not fetch suggestions for queries shorter than 2 characters", async () => {
    const onChange = vi.fn();
    const onSelect = vi.fn();
    const { rerender } = render(
      <PlaceAutocomplete value="N" onChange={onChange} onSelect={onSelect} />
    );

    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("debounces API calls", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      json: async () => ({ items: [] }),
    } as Response);

    const onChange = vi.fn();
    const onSelect = vi.fn();
    const { rerender } = render(
      <PlaceAutocomplete value="" onChange={onChange} onSelect={onSelect} />
    );

    // Simulate typing "New"
    rerender(<PlaceAutocomplete value="Ne" onChange={onChange} onSelect={onSelect} />);

    // Should not fetch immediately
    expect(global.fetch).not.toHaveBeenCalled();

    // Advance timers past debounce time (300ms)
    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining("/api/discover"));
  });

  it("displays suggestions when API returns results", async () => {
    vi.useRealTimers(); // Use real timers for this async test

    const mockSuggestions = [
      { label: "New York, NY", lat: 40.7128, lng: -74.006 },
      { label: "Newark, NJ", lat: 40.7357, lng: -74.1724 },
    ];

    vi.mocked(global.fetch).mockResolvedValue({
      json: async () => ({ items: mockSuggestions }),
    } as Response);

    const onChange = vi.fn();
    const onSelect = vi.fn();
    render(
      <PlaceAutocomplete value="New" onChange={onChange} onSelect={onSelect} />
    );

    await waitFor(() => {
      expect(screen.getByRole("listbox")).toBeInTheDocument();
    }, { timeout: 1000 });

    expect(screen.getByText("New York, NY")).toBeInTheDocument();
    expect(screen.getByText("Newark, NJ")).toBeInTheDocument();

    vi.useFakeTimers(); // Restore fake timers
  });

  it("calls onSelect when suggestion is clicked", async () => {
    vi.useRealTimers();

    const mockSuggestions = [
      { label: "New York, NY", lat: 40.7128, lng: -74.006 },
    ];

    vi.mocked(global.fetch).mockResolvedValue({
      json: async () => ({ items: mockSuggestions }),
    } as Response);

    const onChange = vi.fn();
    const onSelect = vi.fn();
    render(
      <PlaceAutocomplete value="New" onChange={onChange} onSelect={onSelect} />
    );

    await waitFor(() => {
      expect(screen.getByText("New York, NY")).toBeInTheDocument();
    }, { timeout: 1000 });

    fireEvent.mouseDown(screen.getByText("New York, NY"));

    expect(onSelect).toHaveBeenCalledWith({
      label: "New York, NY",
      lat: 40.7128,
      lng: -74.006,
    });
    expect(onChange).toHaveBeenCalledWith("New York, NY");

    vi.useFakeTimers();
  });

  it("shows loading indicator while fetching", async () => {
    let resolvePromise: (value: any) => void;
    const fetchPromise = new Promise((resolve) => {
      resolvePromise = resolve;
    });

    vi.mocked(global.fetch).mockReturnValue(fetchPromise as Promise<Response>);

    const onChange = vi.fn();
    const onSelect = vi.fn();
    const { rerender } = render(
      <PlaceAutocomplete value="New York" onChange={onChange} onSelect={onSelect} />
    );

    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    expect(screen.getByText("Searching...")).toBeInTheDocument();

    // Resolve the fetch
    await act(async () => {
      resolvePromise!({
        json: async () => ({ items: [] }),
      });
    });

    expect(screen.queryByText("Searching...")).not.toBeInTheDocument();
  });

  it("has proper ARIA attributes for accessibility", () => {
    const onChange = vi.fn();
    const onSelect = vi.fn();
    render(<PlaceAutocomplete value="" onChange={onChange} onSelect={onSelect} />);

    const input = screen.getByRole("combobox");
    expect(input).toHaveAttribute("aria-expanded", "false");
    expect(input).toHaveAttribute("aria-autocomplete", "list");
    expect(input).toHaveAttribute("aria-controls", "place-autocomplete-list");
  });

  it("disables input when disabled prop is true", () => {
    const onChange = vi.fn();
    const onSelect = vi.fn();
    render(
      <PlaceAutocomplete
        value=""
        onChange={onChange}
        onSelect={onSelect}
        disabled={true}
      />
    );

    expect(screen.getByRole("combobox")).toBeDisabled();
  });

  it("clears suggestions when input is emptied", async () => {
    vi.useRealTimers();

    const mockSuggestions = [
      { label: "New York, NY", lat: 40.7128, lng: -74.006 },
    ];

    vi.mocked(global.fetch).mockResolvedValue({
      json: async () => ({ items: mockSuggestions }),
    } as Response);

    const onChange = vi.fn();
    const onSelect = vi.fn();
    const { rerender } = render(
      <PlaceAutocomplete value="New" onChange={onChange} onSelect={onSelect} />
    );

    await waitFor(() => {
      expect(screen.getByRole("listbox")).toBeInTheDocument();
    }, { timeout: 1000 });

    // Clear the input
    rerender(<PlaceAutocomplete value="" onChange={onChange} onSelect={onSelect} />);

    await waitFor(() => {
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    });

    vi.useFakeTimers();
  });

  it("handles API errors gracefully", async () => {
    vi.mocked(global.fetch).mockRejectedValue(new Error("Network error"));

    const onChange = vi.fn();
    const onSelect = vi.fn();
    const { rerender } = render(
      <PlaceAutocomplete value="New" onChange={onChange} onSelect={onSelect} />
    );

    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    // Should not crash, just show no results
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });
});
