/** A finish is in the total only when it has something to buy and all of it has a price. */
export const finishCounted = (containerPrices: (number | null)[]) => containerPrices.length > 0 && containerPrices.every((p) => p !== null)

/** What the total adds up, in words. */
export function totalCovers(sheets: number, withFinish: boolean): string {
  return `${sheets} ${sheets === 1 ? 'hoja' : 'hojas'} de triplay, herrajes${withFinish ? ', cubrecanto y acabado' : ' y cubrecanto'}.`
}

/** What the total leaves out for lack of a price; null when every price is known. */
export function leftOut(missingPrices: string[]): string | null {
  return missingPrices.length ? `Sin contar lo que no tiene precio: ${missingPrices.join(', ')}.` : null
}
