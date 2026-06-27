export function generateNumberThumbnail(num: number): string {
  // eslint-disable-next-line max-len
  return `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 50 50"><rect width="100%" height="100%" fill="white"/><text x="50%" y="50%" fill="black" font-size="25" font-weight="bold" text-anchor="middle" dominant-baseline="central" style="white-space:nowrap;">${num}</text></svg>`
}
