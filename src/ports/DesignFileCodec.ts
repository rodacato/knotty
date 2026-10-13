import type { DesignFileResult } from '../domain/session/file'
import type { DesignState } from '../domain/session/state'

export interface DesignFileCodec {
  encode(state: DesignState): Promise<Uint8Array<ArrayBuffer>>
  /** Never throws: whatever cannot be read comes back as a rejection. */
  decode(file: Blob): Promise<DesignFileResult>
}
