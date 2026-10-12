import { createRoot } from 'react-dom/client'
import { createBundledReferences } from './adapters/references/store'
import catalogData from '../public/catalog/catalog.json'
import { Catalog } from './domain/materials/catalog'
import { cardsOf } from './ui/capture/cards'
import { Presentation } from './ui/presentation/Presentation'
import scene from '../design/assets/studio/scene/desktop-aparador.jpg'
import materials from '../design/assets/studio/current/desktop-materials-list.jpg'
import './ui/system/tokens.css'
import './ui/presentation/pages.css'

const examples = cardsOf(createBundledReferences().home(), Catalog.parse(catalogData))
createRoot(document.getElementById('root')!).render(<Presentation examples={examples} scene={scene} materials={materials} />)
