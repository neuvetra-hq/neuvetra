import { cn } from "@/lib/utils"
import type { ReactNode } from "react"
import type React from "react"

interface AuroraBackgroundProps extends React.HTMLProps<HTMLDivElement> {
  children: ReactNode
  showRadialGradient?: boolean
}

export function AuroraBackground({
  className,
  children,
  showRadialGradient = true,
  ...props
}: AuroraBackgroundProps) {
  return (
    <div
      className={cn("relative overflow-hidden bg-background transition-bg", className)}
      {...props}
    >
      {/* Aurora layer */}
      <div
        className="pointer-events-none absolute inset-0"
        style={
          {
            "--aurora":
              "repeating-linear-gradient(100deg,#059669_10%,#6ee7b7_15%,#10b981_20%,#a7f3d0_25%,#34d399_30%,#0d9488_40%)",
            "--white-gradient":
              "repeating-linear-gradient(100deg,#fff_0%,#fff_7%,transparent_10%,transparent_12%,#fff_16%)",
            "--dark-gradient":
              "repeating-linear-gradient(100deg,#000_0%,#000_7%,transparent_10%,transparent_12%,#000_16%)",
          } as React.CSSProperties
        }
      >
        <div
          className={cn(
            "after:animate-aurora pointer-events-none absolute -inset-[10px]",
            "[background-image:var(--white-gradient),var(--aurora)]",
            "[background-size:300%,_200%] [background-position:50%_50%,50%_50%]",
            "opacity-[0.12] blur-[20px] invert filter will-change-transform",
            "after:absolute after:inset-0",
            "after:[background-image:var(--white-gradient),var(--aurora)]",
            "after:[background-size:200%,_100%] after:[background-attachment:fixed]",
            "after:mix-blend-difference after:content-['']",
            "dark:[background-image:var(--dark-gradient),var(--aurora)] dark:invert-0",
            "after:dark:[background-image:var(--dark-gradient),var(--aurora)]",
            showRadialGradient &&
              "[mask-image:radial-gradient(ellipse_at_100%_0%,black_5%,transparent_55%)]",
          )}
        />
      </div>

      {/* Content */}
      <div className="relative">{children}</div>
    </div>
  )
}
