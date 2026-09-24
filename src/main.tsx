import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { componer } from './composicion'
import { App } from './ui/App'
import './ui/sistema/tokens.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App componer={componer} />
  </StrictMode>,
)

// Solo en producción: en desarrollo el caché estorbaría a la recarga en caliente.
if (import.meta.env.PROD && 'serviceWorker' in navigator) void navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => {})
