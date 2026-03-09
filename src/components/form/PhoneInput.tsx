"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { COUNTRY_CODES, type CountryCode } from "@/data/country-codes";

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  disabled?: boolean;
  error?: boolean;
}

export function PhoneInput({
  value,
  onChange,
  onBlur,
  disabled,
  error,
}: PhoneInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Parse value into selectedCode + phoneNumber
  // H-06 fix: For ambiguous dial codes (+1 = US/CA), prefer US as default
  const parseValue = useCallback(
    (val: string): { code: CountryCode | null; phone: string } => {
      if (!val) return { code: null, phone: "" };
      let match: CountryCode | null = null;
      for (const cc of COUNTRY_CODES) {
        if (val.startsWith(cc.dialCode + " ")) {
          if (!match || cc.dialCode.length > match.dialCode.length) {
            match = cc;
          } else if (cc.dialCode === match.dialCode && cc.code === "US") {
            // Prefer US over CA for ambiguous +1
            match = cc;
          }
        }
      }
      if (match) {
        return { code: match, phone: val.slice(match.dialCode.length + 1) };
      }
      return { code: null, phone: val };
    },
    [],
  );

  const { code: selectedCode, phone: phoneNumber } = parseValue(value);

  const filtered = COUNTRY_CODES.filter((cc) => {
    const term = searchTerm.toLowerCase();
    return (
      cc.name.toLowerCase().includes(term) ||
      cc.dialCode.includes(term) ||
      cc.code.toLowerCase().includes(term)
    );
  });

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (isOpen && listRef.current) {
      const item = listRef.current.children[highlightedIndex] as HTMLElement;
      if (item) item.scrollIntoView({ block: "nearest" });
    }
  }, [highlightedIndex, isOpen]);

  const selectCode = (cc: CountryCode) => {
    const digits = phoneNumber.replace(/\D/g, "");
    onChange(digits ? `${cc.dialCode} ${digits}` : cc.dialCode + " ");
    setIsOpen(false);
    setSearchTerm("");
    setHighlightedIndex(0);
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, "");
    if (selectedCode) {
      onChange(digits ? `${selectedCode.dialCode} ${digits}` : "");
    } else {
      onChange(digits);
    }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((i) => Math.min(i + 1, filtered.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((i) => Math.max(i - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (filtered[highlightedIndex]) selectCode(filtered[highlightedIndex]);
        break;
      case "Escape":
        setIsOpen(false);
        setSearchTerm("");
        break;
    }
  };

  const borderClass = error
    ? "border-[var(--color-warning)]"
    : "border-[var(--color-border)]";

  return (
    <div ref={containerRef} className="relative flex gap-2">
      {/* Country code selector */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          setIsOpen(!isOpen);
          setSearchTerm("");
          setHighlightedIndex(0);
        }}
        className={`flex items-center gap-1 rounded-lg border ${borderClass} px-3 py-3 text-sm whitespace-nowrap hover:bg-[var(--color-bg-secondary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)] transition-colors shrink-0`}
      >
        <span>{selectedCode ? selectedCode.flag : "\u{1F30D}"}</span>
        <span className="text-[var(--color-text-secondary)]">
          {selectedCode ? selectedCode.dialCode : "Code"}
        </span>
        <svg
          className={`h-3 w-3 text-[var(--color-text-muted)] transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Phone number input */}
      <input
        type="tel"
        value={phoneNumber}
        onChange={handlePhoneChange}
        onBlur={onBlur}
        disabled={disabled}
        placeholder="Phone number"
        className={`block w-full rounded-lg border ${borderClass} px-4 py-3 focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)] transition-colors`}
      />

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 min-w-[260px] rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] shadow-lg">
          <div className="p-2 border-b border-[var(--color-border)]">
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setHighlightedIndex(0);
              }}
              onKeyDown={handleSearchKeyDown}
              placeholder="Search country or code..."
              className="w-full rounded-md border border-[var(--color-border)] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
            />
          </div>
          <ul
            ref={listRef}
            className="max-h-52 overflow-y-auto py-1"
            role="listbox"
          >
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-[var(--color-text-muted)]">
                No results found
              </li>
            ) : (
              filtered.map((cc, idx) => (
                <li
                  key={cc.code}
                  role="option"
                  aria-selected={selectedCode?.code === cc.code}
                  className={`flex items-center gap-2 px-3 py-2 text-sm cursor-pointer ${
                    idx === highlightedIndex
                      ? "bg-[var(--color-bg-secondary)]"
                      : ""
                  } hover:bg-[var(--color-bg-secondary)]`}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  onClick={() => selectCode(cc)}
                >
                  <span>{cc.flag}</span>
                  <span className="text-[var(--color-text-primary)] truncate">
                    {cc.name}
                  </span>
                  <span className="ms-auto text-[var(--color-text-muted)]">
                    {cc.dialCode}
                  </span>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
