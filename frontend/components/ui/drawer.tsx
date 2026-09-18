"use client";

import * as React from "react";
import { Dialog as DrawerPrimitive } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { cn } from "cn";

type DrawerProps = DrawerPrimitive.Root.Props & { showSwipeHandle?: boolean; swipeDirection?: "down" | "right" };

function Drawer({ ...props }: DrawerProps) {
  return <DrawerPrimitive.Root data-slot="drawer" {...props} />;
}

function DrawerTrigger({ ...props }: DrawerPrimitive.Trigger.Props) {
  return <DrawerPrimitive.Trigger data-slot="drawer-trigger" {...props} />;
}

function DrawerClose({ ...props }: DrawerPrimitive.Close.Props) {
  return <DrawerPrimitive.Close data-slot="drawer-close" {...props} />;
}

function DrawerContent({ className, children, showSwipeHandle = true, ...props }: DrawerPrimitive.Popup.Props & { showSwipeHandle?: boolean }) {
  return <DrawerPrimitive.Portal><DrawerPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" /><DrawerPrimitive.Popup data-slot="drawer-content" className={cn("fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[85vh] w-full max-w-3xl flex-col rounded-t-3xl border border-white/10 bg-[#1e1e2a] text-white shadow-2xl outline-none", className)} {...props}>{showSwipeHandle && <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-white/25" aria-hidden="true" />}{children}<DrawerPrimitive.Close className="absolute right-4 top-5 rounded-full p-2 text-white/50 transition-colors hover:bg-white/10 hover:text-white"><X className="size-4" /><span className="sr-only">Close drawer</span></DrawerPrimitive.Close></DrawerPrimitive.Popup></DrawerPrimitive.Portal>;
}

function DrawerHeader({ className, ...props }: React.ComponentProps<"div">) { return <div className={cn("flex flex-col gap-1 px-6 pb-4 pt-5", className)} {...props} />; }
function DrawerTitle({ className, ...props }: DrawerPrimitive.Title.Props) { return <DrawerPrimitive.Title className={cn("text-lg font-medium", className)} {...props} />; }
function DrawerDescription({ className, ...props }: DrawerPrimitive.Description.Props) { return <DrawerPrimitive.Description className={cn("text-sm text-white/50", className)} {...props} />; }
function DrawerBody({ className, ...props }: React.ComponentProps<"div">) { return <div className={cn("min-h-0 flex-1 overflow-y-auto px-6 pb-6", className)} {...props} />; }
function DrawerFooter({ className, ...props }: React.ComponentProps<"div">) { return <div className={cn("flex flex-col-reverse gap-2 border-t border-white/10 px-6 py-4 sm:flex-row sm:justify-end", className)} {...props} />; }

export { Drawer, DrawerTrigger, DrawerClose, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerBody, DrawerFooter };
