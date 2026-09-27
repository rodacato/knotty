import { DESIGN_KINDS, kindLabel, type DesignKind } from '../../domain/design/kind'
import { Select } from './Field'

/** The kinds of furniture Knotty knows, as the person names them; `none` is the empty choice. */
export function KindSelect({ value, onChange, none, disabled, id }: { value: DesignKind | null; onChange: (kind: DesignKind | null) => void; none: string; disabled?: boolean; id?: string }) {
  return (
    <Select id={id} value={value ?? ''} disabled={disabled} onChange={(e) => onChange((e.target.value || null) as DesignKind | null)}>
      <option value="">{none}</option>
      {DESIGN_KINDS.map((kind) => (
        <option key={kind} value={kind}>
          {kindLabel(kind)}
        </option>
      ))}
    </Select>
  )
}
