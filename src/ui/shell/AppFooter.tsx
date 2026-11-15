/** The app's foot, printed as the site's (UI-93): paper under a heavy ink rule, links in condensed capitals. */
export function AppFooter() {
  const link = 'inline-flex min-h-11 items-center font-display text-lg font-medium uppercase hover:underline hover:decoration-2 hover:underline-offset-4'
  return (
    <footer className="mx-auto w-full max-w-[1280px] px-5 md:px-8">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t-[3px] border-graphite py-5 text-base text-graphite">
        <p>Tus diseños se guardan en este navegador.</p>
        <nav aria-label="Acerca de Knotty" className="flex gap-6"><a className={link} href="../">Conoce Knotty</a><a className={link} href="../marca/">Guía de marca</a></nav>
        <p className="numerals text-sm">v{__APP_VERSION__}</p>
      </div>
    </footer>
  )
}
