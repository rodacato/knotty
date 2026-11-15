import { createRoot } from 'react-dom/client'
import { createBundledReferences } from './adapters/references/store'
import catalogData from '../public/catalog/catalog.json'
import { Catalog } from './domain/materials/catalog'
import { cardsOf } from './ui/capture/cards'
import { Presentation } from './ui/presentation/Presentation'
import { exampleSheet } from './ui/presentation/exampleSheet'
import scene from '../design/assets/studio/scene/landing-aparador.jpg'
import './ui/system/tokens.css'
import './ui/presentation/pages.css'

export function showPresentation(base: './' | '../') {
  const references = createBundledReferences()
  const catalog = Catalog.parse(catalogData)
  const examples = cardsOf(references.home(), catalog)
  const sideboard = references.latest('KC-APA-01')
  const sheet = sideboard && exampleSheet(sideboard, catalog, 'Techo')
  createRoot(document.getElementById('root')!).render(<Presentation examples={examples} scene={scene} sheet={sheet} root={base} />)
}
