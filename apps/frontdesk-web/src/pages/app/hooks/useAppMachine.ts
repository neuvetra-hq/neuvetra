import type { SnapshotFrom } from "xstate"
import { AppMachineContext } from "../AppMachineProvider"
import type { appMachine } from "../machine/appMachine"

export function useAppMachine<T>(
  selector: (snapshot: SnapshotFrom<typeof appMachine>) => T
): T {
  return AppMachineContext.useSelector(selector)
}

export function useAppSend() {
  return AppMachineContext.useActorRef().send
}
