import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { compose } from './composition'
import { App } from './ui/App'
import './ui/system/tokens.css'
import { registerPwa } from './pwa'

// Composed once: StrictMode runs the app's start twice, and a second repository would start from what was saved before the first one wrote.
let services: ReturnType<typeof compose> | null = null
const composeOnce = () => (services ??= compose())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App compose={composeOnce} />
  </StrictMode>,
)

registerPwa('../')
