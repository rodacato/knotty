import { DESIGN_KINDS, kindLabel, type DesignKind } from '../../domain/design/kind'

/** The kinds of furniture Knotty knows, as the person names them; `none` is the empty choice. */
export function KindSelect({ value, onChange, none, disabled, id }: { value: DesignKind | null; onChange: (kind: DesignKind | null) => void; none: string; disabled?: boolean; id?: string }) {
  return (
    <select
      id={id}
      value={value ?? ''}
      disabled={disabled}
      onChange={(e) => onChange((e.target.value || null) as DesignKind | null)}
      className="min-h-11 rounded-xl border border-line bg-bone px-3 text-sm disabled:opacity-60"
    >
      <option value="">{none}</option>
      {DESIGN_KINDS.map((kind) => (
        <option key={kind} value={kind}>
          {kindLabel(kind)}
        </option>
      ))}
    </select>
  )
}
