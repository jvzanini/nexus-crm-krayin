"use client"

import * as React from "react"
import { Popover as PopoverPrimitive } from "@base-ui/react/popover"

import { cn } from "@/lib/utils"

function Popover({ ...props }: PopoverPrimitive.Root.Props) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />
}

function PopoverTrigger({ ...props }: PopoverPrimitive.Trigger.Props) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />
}

function PopoverPortal({ ...props }: PopoverPrimitive.Portal.Props) {
  return <PopoverPrimitive.Portal data-slot="popover-portal" {...props} />
}

function PopoverContent({
  className,
  sideOffset = 4,
  ...props
}: PopoverPrimitive.Popup.Props & { sideOffset?: number }) {
  return (
    <PopoverPortal>
      <PopoverPrimitive.Popup
        data-slot="popover-content"
        className={cn(
          "z-50 w-72 rounded-xl border border-border bg-popover p-4 text-sm text-popover-foreground shadow-xl shadow-black/20 outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          className
        )}
        {...props}
      />
    </PopoverPortal>
  )
}

function PopoverArrow({
  className,
  ...props
}: PopoverPrimitive.Arrow.Props) {
  return (
    <PopoverPrimitive.Arrow
      data-slot="popover-arrow"
      className={cn("fill-popover stroke-border", className)}
      {...props}
    />
  )
}

export { Popover, PopoverTrigger, PopoverContent, PopoverPortal, PopoverArrow }
