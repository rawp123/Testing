import { Calendar, Image, Tag, Users } from "lucide-react";

const filters = [
  { label: "Date", icon: Calendar },
  { label: "Participants", icon: Users },
  { label: "Attachments", icon: Image },
  { label: "Tags", icon: Tag },
];

export default function Filters() {
  return (
    <div className="filters" aria-label="Filter placeholders">
      {filters.map(({ label, icon: Icon }) => (
        <button className="filter-button" key={label} type="button">
          <Icon aria-hidden="true" size={16} />
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}
