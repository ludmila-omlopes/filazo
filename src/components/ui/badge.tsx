import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-pill border border-edge px-2.5 py-0.5 text-caption font-bold lowercase whitespace-nowrap transition-[background-color,border-color,box-shadow,color] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas aria-invalid:border-destructive aria-invalid:ring-destructive/20 [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      variant: {
        default: "bg-sage-soft text-ink [a&]:hover:bg-sage-soft/80",
        secondary: "bg-sand-soft text-ink [a&]:hover:bg-sand-soft/80",
        destructive:
          "bg-clay-soft text-ink focus-visible:ring-destructive/20 [a&]:hover:bg-clay-soft/80",
        outline: "bg-surface text-ink-soft [a&]:hover:bg-canvas",
        ghost: "border-transparent bg-transparent text-ink-soft [a&]:hover:bg-canvas",
        link: "border-transparent bg-transparent text-ink-soft underline-offset-4 [a&]:hover:text-ink [a&]:hover:underline",
        sky: "bg-sky-soft text-ink [a&]:hover:bg-sky-soft/80",
        lavender:
          "bg-dusk-lavender-soft text-ink [a&]:hover:bg-dusk-lavender-soft/80",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span";

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
