/** The saved switch that shows the debug tools. */
export interface DebugAccess {
  visible(): boolean
  setVisible(visible: boolean): void
}
