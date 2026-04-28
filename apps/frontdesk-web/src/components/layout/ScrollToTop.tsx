import { useEffect } from "react"
import { useLocation } from "react-router"

export function ScrollToTop() {
  const { pathname, hash } = useLocation()

  useEffect(() => {
    if (hash) {
      // Wait one frame for the new page to render before scrolling to the element
      const id = setTimeout(() => {
        const el = document.querySelector(hash)
        if (el) el.scrollIntoView({ behavior: "smooth" })
      }, 50)
      return () => clearTimeout(id)
    } else {
      window.scrollTo(0, 0)
    }
  }, [pathname, hash])

  return null
}
