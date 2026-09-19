import type { ReactNode } from "react";

export function Shimmer({ children = "Generating response…", className = "" }: { children?: ReactNode; className?: string }) { return <p className={`shimmer text-sm text-muted-foreground ${className}`}>{children}</p>; }
