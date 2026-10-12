import { createRoot } from 'react-dom/client'
import { BrandGuide } from './ui/presentation/BrandGuide'
import './ui/system/tokens.css'
import './ui/presentation/pages.css'

createRoot(document.getElementById('root')!).render(<BrandGuide />)
