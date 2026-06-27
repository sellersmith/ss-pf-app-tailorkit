import type { PathCommand } from '~/modules/VectorEditor/utils/svg'

/** Scale vector path commands when the bounding box is resized. */
export function scaleVectorPathCommands(
  cmds: PathCommand[],
  ox: number,
  oy: number,
  nx: number,
  ny: number,
  sx: number,
  sy: number
): PathCommand[] {
  return cmds.map((cmd: PathCommand) => {
    const s: typeof cmd = { ...cmd, x: Math.round((cmd.x - ox) * sx + nx), y: Math.round((cmd.y - oy) * sy + ny) }
    if (cmd.cp1) s.cp1 = { x: Math.round((cmd.cp1.x - ox) * sx + nx), y: Math.round((cmd.cp1.y - oy) * sy + ny) }
    if (cmd.cp2) s.cp2 = { x: Math.round((cmd.cp2.x - ox) * sx + nx), y: Math.round((cmd.cp2.y - oy) * sy + ny) }
    if (cmd.cp) s.cp = { x: Math.round((cmd.cp.x - ox) * sx + nx), y: Math.round((cmd.cp.y - oy) * sy + ny) }
    return s
  })
}
