import { designFileName } from '../../domain/session/file'
import { currentDesign, type DesignState } from '../../domain/session/state'
import type { DesignFileCodec } from '../../ports/DesignFileCodec'

function saveAs(bytes: Uint8Array<ArrayBuffer>, name: string) {
  // A generic type: with a gzip one some browsers add `.gz` to the name.
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/octet-stream' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

/** Hands a design to the person as a `.knotty` file. */
export async function downloadDesign(files: DesignFileCodec, state: DesignState): Promise<void> {
  saveAs(await files.encode(state), designFileName(currentDesign(state).name))
}
