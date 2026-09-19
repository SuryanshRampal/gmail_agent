"use client";

import * as React from "react";
import { cn } from "cn";

function Bubble({ align = "start", variant = "default", className, ...props }: React.ComponentProps<"div"> & { align?: "start" | "end"; variant?: "default" | "muted" }) { return <div className={cn("flex w-full", align === "end" ? "justify-end" : "justify-start", className)} {...props} />; }
function BubbleContent({ className, ...props }: React.ComponentProps<"div">) { return <div className={cn("max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-6", className)} {...props} />; }
function BubbleGroup({ className, ...props }: React.ComponentProps<"div">) { return <div className={cn("flex flex-col gap-2", className)} {...props} />; }
function BubbleReactions({ className, ...props }: React.ComponentProps<"div">) { return <div className={cn("mt-2 flex gap-1 text-xs", className)} {...props} />; }

export { Bubble, BubbleContent, BubbleGroup, BubbleReactions };
