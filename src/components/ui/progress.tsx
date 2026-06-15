"use client";

import * as React from "react";
import { Progress as ProgressPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

function Progress({
  className,
  value,
  label,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root> & {
  label?: string;
}) {
  const normalizedValue = value ?? 0;

  return (
    <div className={cn("grid gap-1.5", className)}>
      {label ? (
        <div className="text-caption font-bold lowercase text-ink-soft">
          {label}
        </div>
      ) : null}
      <ProgressPrimitive.Root
        data-slot="progress"
        className="relative h-2 w-full overflow-hidden rounded-pill bg-edge"
        value={value}
        {...props}
      >
        <ProgressPrimitive.Indicator
          data-slot="progress-indicator"
          className="h-full w-full flex-1 rounded-pill bg-sage motion-safe:transition-transform motion-safe:duration-[250ms] motion-safe:ease-out"
          style={{ transform: `translateX(-${100 - normalizedValue}%)` }}
        />
      </ProgressPrimitive.Root>
    </div>
  );
}

export { Progress };
