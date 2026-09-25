import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { compose } from './composition'
import { App } from './ui/App'
import './ui/sistema/tokens.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App compose={compose} />
  </StrictMode>,
)

// Production only: in development the cache would get in the way of hot reload.
if (import.meta.env.PROD && 'serviceWorker' in navigator) void navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => {})
