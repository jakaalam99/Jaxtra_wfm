"use client";

import { InputHTMLAttributes, forwardRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className = "", label, error, type, ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(false);
    
    const isPasswordType = type === "password";
    const currentType = isPasswordType && showPassword ? "text" : type;

    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-slate-700 mb-1">
            {label}
          </label>
        )}
        <div className="relative">
          <input
            ref={ref}
            type={currentType}
            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)] transition-colors text-slate-900
              ${error ? "border-red-500 focus:ring-red-500" : "border-slate-300 focus:border-[var(--color-primary-500)]"} 
              ${isPasswordType ? "pr-10" : ""}
              ${className}`}
            {...props}
          />
          {isPasswordType && (
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? (
                <EyeOff className="w-5 h-5" />
              ) : (
                <Eye className="w-5 h-5" />
              )}
            </button>
          )}
        </div>
        {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
      </div>
    );
  }
);
Input.displayName = "Input";

export { Input };
