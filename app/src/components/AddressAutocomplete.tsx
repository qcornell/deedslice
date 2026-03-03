"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface Suggestion {
  mapboxId: string;
  name: string;
  fullAddress: string;
  placeFormatted: string;
}

interface RetrievedAddress {
  fullAddress: string;
  streetAddress: string;
  city: string;
  state: string;
  stateCode: string;
  zip: string;
  coordinates?: [number, number];
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  onAddressSelect?: (address: RetrievedAddress) => void;
  placeholder?: string;
  className?: string;
}

export default function AddressAutocomplete({
  value,
  onChange,
  onAddressSelect,
  placeholder = "Start typing an address...",
  className = "",
}: Props) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sessionToken] = useState(() => crypto.randomUUID());
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced search
  const search = useCallback(
    (query: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (query.length < 3) {
        setSuggestions([]);
        setOpen(false);
        return;
      }
      debounceRef.current = setTimeout(async () => {
        setLoading(true);
        try {
          const res = await fetch(
            `/api/address-suggest?q=${encodeURIComponent(query)}&session=${sessionToken}`
          );
          const data = await res.json();
          setSuggestions(data.suggestions || []);
          setOpen((data.suggestions || []).length > 0);
          setSelectedIndex(-1);
        } catch {
          setSuggestions([]);
        } finally {
          setLoading(false);
        }
      }, 250);
    },
    [sessionToken]
  );

  // Handle input change
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    onChange(v);
    search(v);
  }

  // Handle suggestion selection
  async function handleSelect(suggestion: Suggestion) {
    onChange(suggestion.fullAddress);
    setOpen(false);
    setSuggestions([]);

    // Retrieve full structured address
    if (onAddressSelect) {
      try {
        const res = await fetch(
          `/api/address-retrieve?id=${encodeURIComponent(suggestion.mapboxId)}&session=${sessionToken}`
        );
        const data = await res.json();
        if (!data.error) {
          onAddressSelect(data);
        }
      } catch {
        // Silent fail — we already set the text
      }
    }
  }

  // Keyboard navigation
  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open || suggestions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && selectedIndex >= 0) {
      e.preventDefault();
      handleSelect(suggestions[selectedIndex]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  // Close on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          placeholder={placeholder}
          className={className}
          autoComplete="off"
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-ds-accent/40 border-t-ds-accent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {open && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-ds-border rounded-xl shadow-lg overflow-hidden">
          {suggestions.map((s, i) => (
            <button
              key={s.mapboxId}
              type="button"
              onClick={() => handleSelect(s)}
              className={`w-full text-left px-4 py-3 text-sm transition-colors flex items-start gap-3 ${
                i === selectedIndex
                  ? "bg-ds-accent/5 text-ds-text"
                  : "hover:bg-ds-bg text-ds-text"
              } ${i > 0 ? "border-t border-ds-border/50" : ""}`}
            >
              <span className="text-ds-muted mt-0.5 shrink-0">📍</span>
              <div className="min-w-0">
                <div className="font-medium truncate">{s.name}</div>
                <div className="text-xs text-ds-muted truncate">{s.placeFormatted || s.fullAddress}</div>
              </div>
            </button>
          ))}
          <div className="px-4 py-1.5 text-[9px] text-ds-muted/50 bg-ds-bg/50 text-right">
            Powered by Mapbox
          </div>
        </div>
      )}
    </div>
  );
}
