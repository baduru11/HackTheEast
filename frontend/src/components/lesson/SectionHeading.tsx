"use client";

interface SectionHeadingProps {
  number: string;
  title: string;
}

export default function SectionHeading({ number, title }: SectionHeadingProps) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <span className="text-xs font-bold text-teal-400 tracking-wider bg-teal-400/10 px-2.5 py-1 rounded-md">
        {number}
      </span>
      <h2 className="text-lg font-semibold text-white">{title}</h2>
    </div>
  );
}
