import type { Session } from "@supabase/supabase-js"
import type { HostedWorkspaceActor } from "./workspace-api"
import type { StagingAccess } from "./staging-session"

export interface ActiveStagingSession {
  session: Session
  access: StagingAccess
  epoch: number
  controller: AbortController
  actor: HostedWorkspaceActor
}

/** Authorization requests have generations; a workspace lifetime changes only with its authority. */
export function createStagingAuthorization(deps: {
  verify: (session: Session, signal: AbortSignal) => Promise<StagingAccess>
  onActive: (value: ActiveStagingSession | null) => void
  onSignedIn: (value: boolean) => void
  onMessage: (value: string) => void
}) {
  let active: ActiveStagingSession | null = null
  let latest: Session | null = null
  let generation = 0
  let epoch = 0
  let disposed = false
  let signedOut = false
  let pending: { token: string; userId: string; controller: AbortController; promise: Promise<void> } | null = null

  function cancelCheck() { generation++; pending?.controller.abort(); pending = null }
  function closeWorkspace() { active?.controller.abort(); active = null; deps.onActive(null) }
  function invalidate() {
    if (disposed) return
    cancelCheck(); closeWorkspace()
    deps.onMessage("Your access changed. Sign in again or contact the staging owner.")
  }
  async function authorize(session: Session | null): Promise<void> {
    if (disposed || (signedOut && session)) return
    latest = session
    deps.onSignedIn(Boolean(session))
    if (!session) {
      cancelCheck(); closeWorkspace()
      deps.onMessage("Sign in with your invited staging account.")
      return
    }
    if (active && active.actor.userId !== session.user.id) closeWorkspace()
    if (pending?.token === session.access_token && pending.userId === session.user.id) return pending.promise
    cancelCheck()
    const current = generation, controller = new AbortController()
    if (!active) deps.onMessage("Checking private staging access…")
    const promise = (async () => {
      try {
        const access = await deps.verify(session, controller.signal)
        if (disposed || signedOut || current !== generation) return
        const sameAuthority = active && active.actor.userId === session.user.id && active.access.access.role === access.access.role && active.access.access.workspaceId === access.access.workspaceId && active.access.access.evidenceId === access.access.evidenceId
        if (sameAuthority && active) {
          // Existing form/request closures retain this actor object and receive the refreshed token.
          active.actor.accessToken = session.access_token
          active = { ...active, session, access }
        } else {
          closeWorkspace()
          const workspaceController = new AbortController()
          const actor: HostedWorkspaceActor = {
            accessToken: session.access_token, userId: session.user.id, role: access.access.role, signal: workspaceController.signal,
            onUnauthorized: () => { if (active?.controller === workspaceController) invalidate() },
          }
          active = { session, access, epoch: ++epoch, controller: workspaceController, actor }
        }
        deps.onActive(active)
        deps.onMessage("Private staging access verified.")
      } catch {
        if (disposed || current !== generation) return
        cancelCheck(); closeWorkspace()
        deps.onMessage("Staging access is unavailable or your invitation is inactive. Contact the staging owner.")
      } finally { if (current === generation) pending = null }
    })()
    if (current === generation) pending = { token: session.access_token, userId: session.user.id, controller, promise }
    return promise
  }
  return {
    authorize,
    refresh: () => latest ? authorize(latest) : Promise.resolve(),
    invalidate,
    allowSignIn: () => { signedOut = false },
    signOut: () => { signedOut = true; latest = null; cancelCheck(); closeWorkspace(); deps.onSignedIn(false) },
    dispose: () => { disposed = true; latest = null; cancelCheck(); active?.controller.abort(); active = null },
  }
}
