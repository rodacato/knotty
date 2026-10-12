export function AppFooter() {
  return (
    <footer className="bg-kraft">
      <div className="mx-auto flex w-full max-w-[1280px] flex-wrap items-center justify-between gap-4 px-5 py-6 text-sm text-graphite-2 md:px-8">
        <p>Tus diseños se guardan en este navegador.</p>
        <nav aria-label="Acerca de Knotty" className="flex gap-6"><a className="inline-flex min-h-11 items-center hover:underline" href="./presentacion/">Conoce Knotty</a><a className="inline-flex min-h-11 items-center hover:underline" href="./marca/">Guía de marca</a></nav>
        <p className="numerals text-xs">v{__APP_VERSION__}</p>
      </div>
    </footer>
  )
}
