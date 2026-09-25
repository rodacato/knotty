// Typed errors: the code tells the expert what to fix and the data tells it where.
// The codes are data: they are saved in the trace and the expert reads them, so renaming one needs a migration.

type ErrorCode =
  | 'E_SCHEMA'
  | 'E_DUPLICATE_ID'
  | 'E_UNKNOWN_PIECE'
  | 'E_UNKNOWN_JOINT'
  | 'E_UNKNOWN_REF'
  | 'E_REF_AXIS'
  | 'E_CYCLE'
  | 'E_INVALID_EXTENT'
  | 'E_OVERLAP'
  | 'E_FLOATING'
  | 'E_OVERALL_SIZE'
  | 'E_UNKNOWN_MATERIAL'
  | 'E_TOO_BIG_FOR_SHEET'
  | 'E_JOINT_WITHOUT_CONTACT'
  | 'E_REQUIREMENT'
  | 'E_INVALID_OPERATION'

type WarningCode = 'W_CONTACT_WITHOUT_JOINT' | 'W_FROZEN_REFERENCE'

export interface DesignError {
  code: ErrorCode
  message: string
  data?: Record<string, unknown>
}

export interface DesignWarning {
  code: WarningCode
  message: string
  data?: Record<string, unknown>
}

export const error = (code: ErrorCode, message: string, data?: Record<string, unknown>): DesignError => ({ code, message, ...(data ? { data } : {}) })

/** What comes of something that can fail with several errors at once. */
export type Result<T> = { ok: true; value: T } | { ok: false; errors: DesignError[] }

export const success = <T>(value: T): Result<T> => ({ ok: true, value })
export const failure = <T = never>(errors: DesignError[]): Result<T> => ({ ok: false, errors })
