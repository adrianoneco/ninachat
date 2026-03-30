import React from 'react';
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-lg font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 disabled:pointer-events-none disabled:opacity-50 active:scale-95",
  {
    variants: {
      variant: {
        primary: "bg-[hsl(var(--primary))] text-white hover:opacity-95 shadow-[0_8px_24px_rgba(30,95,116,0.18)] hover:shadow-[0_0_24px_rgba(30,95,116,0.36)] border border-transparent",
        secondary: "bg-gray-200 dark:bg-slate-800 text-gray-800 dark:text-slate-100 hover:bg-gray-300 dark:bg-slate-700 border border-gray-300 dark:border-slate-700",
        outline: "border border-gray-300 dark:border-slate-700 bg-transparent text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:bg-slate-800 hover:text-gray-900 dark:text-white hover:border-gray-300 dark:border-slate-600",
        ghost: "text-gray-500 dark:text-slate-400 hover:bg-gray-200/50 dark:bg-slate-800/50 hover:text-cyan-400",
        danger: "bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20",
        default: "bg-gray-200 dark:bg-slate-800 text-gray-800 dark:text-slate-100 hover:bg-gray-300 dark:bg-slate-700 border border-gray-300 dark:border-slate-700",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        md: "h-10 px-4 py-2 text-sm",
        lg: "h-12 px-8 text-base",
        icon: "h-10 w-10 p-2",
        default: "h-10 px-4 py-2 text-sm",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  className?: string;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ children, variant, size, className = '', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
