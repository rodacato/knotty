import type { DesignState } from '../../domain/session/state'
import type { DesignRepository, Sandbox } from '../../ports/DesignRepository'

/** The real repository, until the sandbox is on: then every read and write stays in memory and the saved design is never touched. */
export function createSandboxedRepository(real: DesignRepository): DesignRepository & Sandbox {
  let held: DesignState | null | undefined
  const on = () => held !== undefined
  return {
    load: () => (on() ? (held ?? null) : real.load()),
    save(state) {
      if (on()) held = state
      else real.save(state)
    },
    clear() {
      if (on()) held = null
      else real.clear()
    },
    enter() {
      held = null
    },
    leave() {
      held = undefined
    },
    active: on,
  }
}
