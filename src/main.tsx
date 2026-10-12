import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { compose } from './composition'
import { App } from './ui/App'
import './ui/system/tokens.css'
import { registerPwa } from './pwa'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App compose={compose} />
  </StrictMode>,
)

registerPwa('../')
