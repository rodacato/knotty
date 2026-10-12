import { ArrowRight } from '@phosphor-icons/react'
import type { ReactNode } from 'react'
import { Knot } from '../system/Brand'

export function PageLink({ href, children, primary = false, download = false }: { href: string; children: ReactNode; primary?: boolean; download?: boolean }) {
  return <a className={`page-link ${primary ? 'page-link-primary' : ''}`} href={href} download={download || undefined}>{children}<ArrowRight size={18} aria-hidden /></a>
}

export function Shell({ page, children }: { page: 'presentation' | 'brand'; children: ReactNode }) {
  return (
    <div className="brand-page">
      <a className="skip-link" href="#content">Ir al contenido</a>
      <header className="page-header page-width">
        <a className="wordmark" href="../presentacion/" aria-label="Knotty · Presentación"><Knot className="size-10" /><span>Knotty</span></a>
        <nav aria-label="Navegación principal">
          <a className="nav-link" href={page === 'brand' ? '../presentacion/' : '#como-funciona'}>{page === 'brand' ? 'Conoce Knotty' : 'Cómo funciona'}</a>
          <a className="nav-link" href="../marca/" aria-current={page === 'brand' ? 'page' : undefined}>Guía de marca</a>
          <PageLink href="../">Abrir Knotty</PageLink>
        </nav>
      </header>
      <main id="content" tabIndex={-1}>{children}</main>
      <footer className="page-footer page-width">
        <a className="wordmark" href="../presentacion/"><Knot className="size-8" /><span>Knotty</span></a>
        <p>De tu espacio al taller.</p>
        <div><a className="nav-link" href="../marca/">Guía de marca</a><a className="nav-link" href="https://github.com/rodacato/knotty">Ver el código</a></div>
      </footer>
    </div>
  )
}
