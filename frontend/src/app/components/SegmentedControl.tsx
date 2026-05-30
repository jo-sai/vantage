interface SegmentedControlProps {
  options: string[];
  value: string;
  onChange: (value: string) => void;
}

export function SegmentedControl({ options, value, onChange }: SegmentedControlProps) {
  return (
    <div className="inline-flex rounded-lg bg-white/5 border border-[var(--glass-border)] p-1">
      {options.map((option) => (
        <button
          key={option}
          onClick={() => onChange(option)}
          className={`px-6 py-2 rounded transition-all ${
            value === option
              ? 'bg-[var(--action-blue)] text-white shadow-lg'
              : 'text-[var(--cool-gray)] hover:text-white'
          }`}
        >
          {option}
        </button>
      ))}
    </div>
  );
}
