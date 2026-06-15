import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "relative inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-inner border border-transparent font-bold outline-none transition-[background-color,border-color,box-shadow,color,opacity] duration-200 ease-out focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:pointer-events-none disabled:opacity-60 data-[loading=true]:pointer-events-none aria-invalid:border-destructive aria-invalid:ring-destructive/20 motion-safe:transition-transform motion-safe:hover:-translate-y-px motion-safe:active:translate-y-0 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-ink text-surface shadow-[var(--shadow-btn-primary)] hover:shadow-[var(--shadow-btn-primary-hover)] night:bg-glow night:text-dusk-deep",
        destructive:
          "bg-clay text-surface shadow-[var(--shadow-btn-primary)] hover:bg-clay/90 focus-visible:ring-destructive/20",
        outline:
          "border-edge bg-surface text-ink shadow-[var(--shadow-btn-ghost)] hover:bg-canvas hover:shadow-[var(--shadow-btn-ghost-hover)]",
        secondary:
          "bg-sage-soft text-ink shadow-[var(--shadow-btn-ghost)] hover:bg-sand-soft hover:shadow-[var(--shadow-btn-ghost-hover)]",
        ghost:
          "border-edge bg-surface text-ink shadow-[var(--shadow-btn-ghost)] hover:bg-canvas hover:shadow-[var(--shadow-btn-ghost-hover)]",
        link: "rounded-inner text-ink-soft underline-offset-4 hover:text-ink hover:underline",
      },
      size: {
        default: "min-h-11 px-5 py-2 text-sm has-[>svg]:px-4",
        xs: "min-h-7 gap-1 px-2.5 py-1 text-xs has-[>svg]:px-2 [&_svg:not([class*='size-'])]:size-3",
        sm: "min-h-9 gap-1.5 px-4 py-1.5 text-sm has-[>svg]:px-3",
        lg: "min-h-12 px-7 py-2.5 text-base has-[>svg]:px-5",
        icon: "size-11 p-0",
        "icon-xs": "size-7 p-0 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-9 p-0",
        "icon-lg": "size-12 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  loading = false,
  disabled,
  children,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    loading?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "button";
  const isDisabled = disabled || loading;

  if (asChild) {
    return (
      <Comp
        data-slot="button"
        data-variant={variant}
        data-size={size}
        className={cn(buttonVariants({ variant, size, className }))}
        aria-disabled={isDisabled || undefined}
        {...props}
      >
        {children}
      </Comp>
    );
  }

  return (
    <button
      data-slot="button"
      data-variant={variant}
      data-size={size}
      data-loading={loading ? "true" : undefined}
      className={cn(buttonVariants({ variant, size, className }))}
      aria-busy={loading || undefined}
      disabled={isDisabled}
      {...props}
    >
      <span
        className={cn("inline-flex items-center gap-2", loading && "opacity-0")}
      >
        {children}
      </span>
      {loading ? (
        <span
          aria-hidden
          className="absolute h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent"
        />
      ) : null}
    </button>
  );
}

export { Button, buttonVariants };
