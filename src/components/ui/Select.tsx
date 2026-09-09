interface SelectProps {
  value: string;
  onChange: (val: string) => void;
  options: { label: string; value: string }[];
  placeholder?: string;
  className?: string;
}

export function Select({ value, onChange, options, placeholder = 'All', className = '' }: SelectProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`bg-[#111118] border border-[#1E1E2E] text-[#F0F0F5] text-sm rounded-lg px-3 py-2 
        focus:outline-none focus:border-[#6366F1] focus:ring-1 focus:ring-[#6366F1]/30
        transition-colors duration-150 cursor-pointer ${className}`}
    >
      <option value="">{placeholder}</option>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  );
}
