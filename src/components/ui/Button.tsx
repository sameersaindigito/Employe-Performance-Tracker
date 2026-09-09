import type { ReactNode, ButtonHTMLAttributes } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  leftIcon?: ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-[#6366F1] hover:bg-[#5254CC] text-white border-transparent',
  secondary: 'bg-[#1E1E2E] hover:bg-[#2a2a3e] text-[#F0F0F5] border-[#2E2E3E]',
  ghost: 'bg-transparent hover:bg-[#1E1E2E] text-[#8B8B9E] hover:text-[#F0F0F5] border-transparent',
  danger: 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/20',
};

const sizeClasses = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-base',
};

export function Button({ children, variant = 'primary', size = 'md', loading = false, leftIcon, className = '', disabled, ...props }: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={`inline-flex items-center gap-2 font-medium rounded-lg border transition-all duration-150
        focus:outline-none focus:ring-2 focus:ring-[#6366F1]/30
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
    >
      {loading ? (
        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : leftIcon}
      {children}
    </button>
  );
}
