interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  className?: string;
}

export function Input({ className = '', ...props }: InputProps) {
  return (
    <input
      {...props}
      className={`bg-[#111118] border border-[#1E1E2E] text-[#F0F0F5] text-sm rounded-lg px-3 py-2
        placeholder-[#8B8B9E] focus:outline-none focus:border-[#6366F1] focus:ring-1 focus:ring-[#6366F1]/30
        transition-colors duration-150 ${className}`}
    />
  );
}
