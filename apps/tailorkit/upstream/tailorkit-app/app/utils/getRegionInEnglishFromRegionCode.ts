/**
 * Get region in English from region code
 * @param code
 * @returns
 */

const restOfTheWorlds = ['REST_OF_THE_WORLD', 'REST_OF_WORLD']

export function getRegionInEnglishFromRegionCode(code: string) {
  try {
    const regionNames = new Intl.DisplayNames(['en'], { type: 'region' })

    return !restOfTheWorlds.includes(code) ? regionNames.of(code) : 'Rest Of The World'
  } catch (e) {
    console.log(e)

    return code
  }
}
