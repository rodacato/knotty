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
