import { catalogDestination } from './ui/navigation/routes'
import { registerPwa } from './pwa'

registerPwa('./')
const standalone = matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
const destination = catalogDestination(location, standalone)
if (destination) location.replace(destination)
else void import('./presentation-render').then(({ showPresentation }) => showPresentation('./'))
