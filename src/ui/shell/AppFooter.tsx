import { version } from '../../../package.json'

export function AppFooter() {
  return (
    <footer className="bg-kraft">
      <div className="mx-auto flex w-full max-w-[1280px] items-center justify-between gap-4 px-5 py-6 text-sm text-graphite-2 md:px-8">
        <p>Tus diseños se guardan en este navegador.</p>
        <p className="numerals text-xs">v{version}</p>
      </div>
    </footer>
  )
}
