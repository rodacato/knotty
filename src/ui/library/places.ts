const DAY = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'long' })

export function savedOn(savedAt: string): string {
  const date = new Date(savedAt)
  return Number.isNaN(date.getTime()) ? '' : DAY.format(date)
}

/** Asks the browser not to clear the saved designs when it runs short of room; some browsers ask the person. */
export function askToPersist() {
  void navigator.storage?.persist?.().catch(() => false)
}
