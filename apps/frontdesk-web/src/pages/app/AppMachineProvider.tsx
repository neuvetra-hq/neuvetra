import { useEffect } from "react"
import { useNavigate } from "react-router"
import { createActorContext } from "@xstate/react"
import { appMachine } from "./machine/appMachine"

export const AppMachineContext = createActorContext(appMachine)

function WebGLGate({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate()
  const webglState = AppMachineContext.useSelector((s) => s.value.webgl)

  useEffect(() => {
    if (webglState === "unsupported") {
      navigate("/", { replace: true })
    }
  }, [webglState, navigate])

  if (webglState === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0b0c0d]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-700 border-t-neutral-300" />
      </div>
    )
  }

  if (webglState === "unsupported") return null

  return <>{children}</>
}

export function AppMachineProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    document.body.style.backgroundColor = '#0b0c0d'
    return () => { document.body.style.backgroundColor = '' }
  }, [])

  return (
    <AppMachineContext.Provider>
      <WebGLGate>{children}</WebGLGate>
    </AppMachineContext.Provider>
  )
}
