import { List } from '@phosphor-icons/react'
import { useEffect, type ReactNode } from 'react'
import { Knot } from '../system/Brand'
import { useInstall } from '../install/useInstall'

export function PageLink({ href, children, primary = false, download = false }: { href: string; children: ReactNode; primary?: boolean; download?: boolean }) {
  return <a className={`page-link ${primary ? 'page-link-primary' : ''}`} href={href} download={download || undefined}>{children}</a>
}

export function Shell({ page, children, root = '../' }: { page: 'presentation' | 'brand'; children: ReactNode; root?: './' | '../' }) {
  const install = useInstall()
  useEffect(() => {
    if (!location.hash) return
    let id: string
    try { id = decodeURIComponent(location.hash.slice(1)) } catch { return }
    // Sections appear after the asynchronous page entry has loaded.
    document.getElementById(id)?.scrollIntoView({ behavior: 'instant' })
  }, [])
  const links = (
    <>
      <a className="nav-link" href={page === 'brand' ? root : '#como-funciona'}>{page === 'brand' ? 'Conoce Knotty' : 'Cómo funciona'}</a>
      {page === 'presentation' && <a className="nav-link" href="#catalog">Muebles</a>}
      <a className="page-link page-link-band" href={`${root}catalog/#catalog`}>Explorar el catálogo</a>
    </>
  )
  return (
    <div className="brand-page">
      <a className="skip-link" href="#content">Ir al contenido</a>
      <div className="page-band">
        <header className="page-header page-width">
          <a className="wordmark" href={root} aria-label="Knotty · Inicio"><Knot className="h-9 w-[82px]" /><span>Knotty</span></a>
          <nav className="page-nav" aria-label="Navegación principal">{links}</nav>
          {/* On a phone the same links fold under one square control, so the band stays one line. */}
          <details className="page-menu">
            <summary aria-label="Menú"><List size={26} aria-hidden /></summary>
            <nav aria-label="Navegación principal">{links}</nav>
          </details>
        </header>
      </div>
      <main id="content" tabIndex={-1}>{children}</main>
      <footer className="page-footer page-width">
        <a className="wordmark" href={root}><Knot className="h-8 w-[74px]" /><span>Knotty</span></a>
        <p>De tu espacio al taller.</p>
        <div>{page === 'presentation' && <a className="nav-link" href="#preguntas">Preguntas frecuentes</a>}<a className="nav-link" href={`${root}marca/`} aria-current={page === 'brand' ? 'page' : undefined}>Guía de marca</a><a className="nav-link" href="https://github.com/rodacato/knotty">Ver el código</a>{install && <button type="button" className="nav-link" onClick={install.onClick} aria-expanded={install.expanded}>{install.label}</button>}</div>
        {install?.hint && <p role="note" className="install-hint">{install.hint}</p>}
      </footer>
    </div>
  )
}
