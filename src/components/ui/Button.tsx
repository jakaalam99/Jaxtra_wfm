import { ButtonHTMLAttributes, forwardRef } from "react";
import { Loader2 } from "lucide-react";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  isLoading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = "", variant = "primary", isLoading, children, disabled, ...props }, ref) => {
    
    const baseStyles = "inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none text-sm px-4 py-2";
    
    const variants = {
      primary: "bg-[var(--color-primary-500)] hover:bg-[var(--color-primary-600)] text-white focus:ring-[var(--color-primary-500)]",
      secondary: "bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 focus:ring-slate-500",
      danger: "bg-red-500 hover:bg-red-600 text-white focus:ring-red-500",
      ghost: "bg-transparent hover:bg-slate-100 text-slate-700 focus:ring-slate-500",
    };

    return (
      <button
        ref={ref}
        className={`${baseStyles} ${variants[variant]} ${className}`}
        disabled={isLoading || disabled}
        {...props}
      >
        {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";

export { Button };
