export function minifyDesignMetrics(ds: any) {
  return {
    w: ds?.width || ds?.w || 0,
    h: ds?.height || ds?.h || 0,
    l: ds?.left || ds?.l || 0,
    t: ds?.top || ds?.t || 0,
    r: ds?.rotation || ds?.r || 0,
    u: ds?.url || ds?.u || '',
  }
}
