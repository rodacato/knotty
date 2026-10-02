import { useMemo } from 'react'
import { describeChange } from '../../domain/editing/changes/changes'
import type { DesignState } from '../../domain/session/state'
import { useServices } from '../services'
import { useStore } from '../store'
import { ChangeListView } from '../system/ChangeList'

/** What the version changed, read from the design's history, with its way back wired to the store. */
export function ChangeList({ state, version, inBubble = false }: { state: DesignState; version: number; inBubble?: boolean }) {
  const { catalog } = useServices()
  const restore = useStore((s) => s.restoreFromVersion)
  const undo = useStore((s) => s.undoChange)
  const select = useStore((s) => s.select)
  const thinking = useStore((s) => s.thinking)
  const change = useMemo(() => {
    const ordered = [...state.versions].sort((a, b) => a.n - b.n)
    const i = ordered.findIndex((v) => v.n === version)
    return i > 0 ? describeChange(ordered[i - 1].design, ordered[i].design, catalog) : null
  }, [state.versions, version, catalog])
  return <ChangeListView change={change} thinking={thinking} onSelect={select} onRestore={(ids) => restore(version, ids)} onUndo={() => undo(version)} inBubble={inBubble} />
}
