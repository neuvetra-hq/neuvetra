import { createContext, useContext, useState, useRef } from "react"

interface RouteTransitionContextValue {
  transitionComplete: boolean
  notifyComplete: () => void
  reset: () => void
}

const RouteTransitionContext = createContext<RouteTransitionContextValue>({
  transitionComplete: false,
  notifyComplete: () => {},
  reset: () => {},
})

export function RouteTransitionProvider({ children }: { children: React.ReactNode }) {
  const [transitionComplete, setTransitionComplete] = useState(false)
  const notifyComplete = useRef(() => setTransitionComplete(true))
  const reset = useRef(() => setTransitionComplete(false))

  return (
    <RouteTransitionContext.Provider value={{
      transitionComplete,
      notifyComplete: notifyComplete.current,
      reset: reset.current,
    }}>
      {children}
    </RouteTransitionContext.Provider>
  )
}

export function useRouteTransition() {
  return useContext(RouteTransitionContext)
}
