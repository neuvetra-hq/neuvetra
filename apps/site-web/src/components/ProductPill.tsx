const JOST = "'Jost Variable', 'Jost', sans-serif"

export interface ProductPillTheme {
  /** 1px border + glow color, matched to the product's hue. */
  border: string
}

export interface ProductPillProps {
  name: string
  kicker: string
  theme: ProductPillTheme
  onClick: () => void
}

/**
 * Compact representation of a product card, shown at top-left once a chat
 * conversation engages. Vertically stacked text-only buttons that send
 * "Tell me about <product>" into the chat on click — keeps the homepage
 * conversational instead of locking the visitor into static cards.
 *
 * The expanded counterpart is `ProductCard` in App.tsx.
 */
export function ProductPill({ name, kicker, theme, onClick }: ProductPillProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="pointer-events-auto group flex flex-col items-start rounded-md px-3 py-2 text-left backdrop-blur-md transition-all duration-200 hover:scale-[1.02] hover:bg-white/5 cursor-pointer"
      style={{
        fontFamily: JOST,
        background: "rgba(0, 0, 0, 0.32)",
        border: `1px solid ${theme.border}`,
      }}
    >
      <span
        className="text-white"
        style={{
          fontWeight: 200,
          fontSize: "0.95rem",
          letterSpacing: "0.04em",
        }}
      >
        {name}
      </span>
      <span
        className="uppercase text-white/45 group-hover:text-white/70 transition-colors duration-200"
        style={{
          fontWeight: 300,
          fontSize: "0.6rem",
          letterSpacing: "0.3em",
          marginTop: "0.15rem",
        }}
      >
        {kicker}
      </span>
    </button>
  )
}
