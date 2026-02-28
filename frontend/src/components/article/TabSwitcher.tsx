"use client";

interface TabSwitcherProps {
  tabs: string[];
  active: string;
  onChange: (tab: string) => void;
}

export default function TabSwitcher({ tabs, active, onChange }: TabSwitcherProps) {
  return (
    <div className="flex border-b border-gray-800">
      {tabs.map((tab) => (
        <button
          key={tab}
          onClick={() => onChange(tab)}
          className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
            active === tab
              ? "text-teal-400 border-teal-400"
              : "text-gray-400 border-transparent hover:text-gray-300"
          }`}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}
