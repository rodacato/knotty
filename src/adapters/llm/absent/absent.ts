import { NO_EXPERT, type LLMProvider } from '../../../ports/LLMProvider'

export const NO_EXPERT_MESSAGE = 'Eso necesita a tu experto. Conéctalo para pedirlo.'

const refuse = () => Promise.reject(new Error(NO_EXPERT_MESSAGE))

/** Nobody to ask: every call fails saying so, so no stand-in answers for an expert the person never connected. */
export const createAbsent = (): LLMProvider => ({
  id: NO_EXPERT,
  label: 'Sin experto',
  reconstruct: refuse,
  proposeAdjustment: refuse,
  reviewPurchase: refuse,
  readPhoto: refuse,
  planDesign: null,
  adjustPlan: null,
})
