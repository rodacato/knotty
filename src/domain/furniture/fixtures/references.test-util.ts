import { createBundledReferences } from '../../../adapters/references/store'
import { basesOf, type Example } from '../examples'
import type { CabinetPlan } from '../modules/cabinet'
import type { FurniturePlan } from '../modules/plan'

/** The references the app ships, as its tests read them. */
export const testReferences = createBundledReferences()

/** The bases the tests hold to what a base has to pass: the ones with a place on the home screen. The rest are listed too, with what is still to fix. */
export const testBases = basesOf(testReferences.all().filter((r) => r.home))

const sideboard = testReferences.latest('KC-APA-01')
if (sideboard?.plan?.kind !== 'cabinet') throw new Error('the sideboard reference (KC-APA-01) is missing')

/** The first product of the reference catalog (KC-APA-01), a sideboard: what its photos show that a cabinet plan can say (step 29 of the proposal). The base is named for its legs; this one, with the plain name, is what the tests open. */
export const sideboardPlan: CabinetPlan = { ...sideboard.plan, name: 'Aparador' }
export const exampleSideboard: Extract<Example, { plan: FurniturePlan }> = { name: 'Aparador', plan: sideboardPlan, notes: sideboard.notes, kind: sideboard.kind, finish: sideboard.finish }
