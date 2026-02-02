"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface PlaceResult {
  label: string;
  lat: number;
  lng: number;
}

interface PlaceAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (place: PlaceResult) => void;
  placeholder?: string;
  id?: string;
  name?: string;
  className?: string;
  disabled?: boolean;
}

const DEBOUNCE_MS = 300;

export function PlaceAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = "Search city or address...",
  id,
  name,
  className,
  disabled,
}: PlaceAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<PlaceResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  /** When user selects an item we set value to the label; skip the follow-up search. */
  const justSelectedRef = useRef<string | null>(null);

  const fetchSuggestions = useCallback(async (query: string) => {
    if (query.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({ q: query.trim(), limit: "8" });
      const res = await fetch(`/api/discover?${params}`);
      const data = await res.json();
      setSuggestions(data.items ?? []);
      setOpen(true);
    } catch {
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value.trim()) {
      setSuggestions([]);
      setOpen(false);
      justSelectedRef.current = null;
      return;
    }
    if (justSelectedRef.current === value) {
      justSelectedRef.current = null;
      return;
    }
    debounceRef.current = setTimeout(() => fetchSuggestions(value), DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value, fetchSuggestions]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (place: PlaceResult) => {
    justSelectedRef.current = place.label;
    onChange(place.label);
    onSelect(place);
    setOpen(false);
    setSuggestions([]);
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <Input
        id={id}
        name={name}
        type="text"
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        aria-controls="place-autocomplete-list"
      />
      {loading && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
          Searching...
        </span>
      )}
      {open && suggestions.length > 0 && (
        <ul
          id="place-autocomplete-list"
          className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-md border bg-popover py-1 text-popover-foreground shadow-md"
          role="listbox"
        >
          {suggestions.map((item, i) => (
            <li
              key={`${item.label}-${i}`}
              role="option"
              className="cursor-pointer px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
              onMouseDown={() => handleSelect(item)}
            >
              {item.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
