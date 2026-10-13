import { designFileName } from '../../domain/session/file'
import { currentDesign, type DesignState } from '../../domain/session/state'
import { useServices } from '../services'

function saveAs(bytes: Uint8Array<ArrayBuffer>, name: string) {
  // A generic type: with a gzip one some browsers add `.gz` to the name.
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/octet-stream' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

/** Hands the open design to the person as a `.knotty` file. */
export function useDownloadDesign(state: DesignState): () => Promise<void> {
  const { files } = useServices()
  return async () => saveAs(await files.encode(state), designFileName(currentDesign(state).name))
}
