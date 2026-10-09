/** A finish is in the total only when it has something to buy and all of it has a price. */
export const finishCounted = (containerPrices: (number | null)[]) => containerPrices.length > 0 && containerPrices.every((p) => p !== null)

/** What the total adds up, in words. */
export function totalCovers({ sheets, onlyPlywood, withFinish }: { sheets: number; onlyPlywood: boolean; withFinish: boolean }): string {
  const boards = onlyPlywood ? `${sheets === 1 ? 'hoja' : 'hojas'} de triplay` : sheets === 1 ? 'tablero' : 'tableros'
  return `${sheets} ${boards}, herrajes${withFinish ? ', cubrecanto y acabado' : ' y cubrecanto'}.`
}

export const sheetsHeading = (onlyPlywood: boolean) => (onlyPlywood ? 'Hojas de triplay' : 'Tableros')

/** What the total leaves out for lack of a price; null when every price is known. */
export function leftOut(missingPrices: string[]): string | null {
  return missingPrices.length ? `Sin contar lo que no tiene precio: ${missingPrices.join(', ')}.` : null
}
