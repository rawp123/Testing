import React from "react";
import { Search } from "lucide-react";

export default function SearchBar({ value, onChange }) {
  return (
    <label className="search-bar">
      <Search aria-hidden="true" size={18} />
      <input
        type="search"
        placeholder="Search messages"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
