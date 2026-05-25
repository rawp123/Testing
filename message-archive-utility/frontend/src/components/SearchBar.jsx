import React from "react";
import { Search } from "lucide-react";

export default function SearchBar({ value, onChange, disabled = false }) {
  return (
    <div className="search-block">
      <label className={`search-bar ${disabled ? "is-disabled" : ""}`}>
        <Search aria-hidden="true" size={18} />
        <input
          type="search"
          placeholder={disabled ? "Import messages to search" : "Search names, phone numbers, or message text"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          aria-label="Search local messages"
        />
      </label>
    </div>
  );
}
