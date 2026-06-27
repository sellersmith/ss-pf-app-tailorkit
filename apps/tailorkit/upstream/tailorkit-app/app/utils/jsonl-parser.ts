/* eslint-disable @typescript-eslint/ban-ts-comment */
type OnErr = (buf: string, err: Error, line: number) => void

export interface ParseJsonlOptions {
  /** When false, read from local file (server only). Default: true */
  isUrl?: boolean
  /** Accept trailing commas `,`. Default: false                       */
  allowTrailingComma?: boolean
  /** Accept single-quoted strings.   Default: false                    */
  allowSingleQuote?: boolean
  /** Called when JSON.parse fails for one object                       */
  onError?: OnErr
  /** If true, function returns `Promise<unknown[]>` instead of stream  */
  asArray?: boolean
}

/**
 * Universal JSONL reader: usable in both browser and Node.
 * – In *Node* it can read either URLs (via `fetch`) **or** local files
 * – In the *browser* it can read URLs (fetch/stream); local files are disallowed
 * Returns an async generator by default; set `asArray: true` to collect.
 */
export async function parseJsonl(
  source: string,
  opts: ParseJsonlOptions = {}
): Promise<unknown[] | AsyncGenerator<unknown>> {
  const gen = _stream(source, opts)
  return opts.asArray ? _collect(gen) : gen
}

/* ---------------------------------------------------------------------- */
/*  Implementation details                                                */
/* ---------------------------------------------------------------------- */

async function* _stream(
  source: string,
  { isUrl = true, allowTrailingComma = false, allowSingleQuote = false, onError }: ParseJsonlOptions
): AsyncGenerator<unknown> {
  const isServer = typeof window === 'undefined'

  /* ---------------------------------------------------- */
  /* 1. Obtain a text stream                             */
  /* ---------------------------------------------------- */
  let textStream: ReadableStream<string>

  if (isUrl) {
    // works both sides – in Node 18+ fetch is global, too
    const res = await fetch(source)
    if (!res.ok || !res.body) {
      throw new Error(`Unable to fetch ${source}: ${res.statusText}`)
    }
    textStream = res.body.pipeThrough(new TextDecoderStream())
  } else {
    if (!isServer) throw new Error('Reading local files is server-only')
    // dynamic imports keep fs/readline out of browser bundle
    const fs = await import('node:fs')
    const { Readable } = await import('node:stream')
    const file = fs.createReadStream(source, { encoding: 'utf8' })
    // turn Node stream → WHATWG stream so we can reuse the same code path
    textStream = Readable.toWeb(file) as unknown as ReadableStream<string>
  }

  /* ---------------------------------------------------- */
  /* 2. Parse line-by-line                                */
  /* ---------------------------------------------------- */
  const reader = textStream.getReader()

  let lineBuf = ''
  let buf = ''
  let depth = 0
  let inStr = false
  let esc = false
  let lineNo = 0

  // const sanitize = (l: string) =>
  //   /[“”‘’\/\t]/u.test(l)
  //     ? l
  //         .replace(/[“”]/gu, '"')
  //         .replace(/[‘’]/gu, "'")
  //         .replace(/\\\//g, '/')
  //         .replace(/\t/g, ' ')
  //     : l

  const stripComment = (l: string) => {
    let out = ''
    let s = false,
      e = false
    for (let i = 0; i < l.length; i++) {
      const c = l[i]
      if (e) {
        out += c
        e = false
      } else if (c === '\\') {
        out += c
        e = true
      } else if (c === '"') {
        out += c
        s = !s
      } else if (!s && c === '/' && l[i + 1] === '/') break
      else if (!s && c === '#' && (i === 0 || /\s/.test(l[i - 1]))) break
      else out += c
    }
    return out.trimEnd()
  }

  /** Flush a completed JSON candidate in `buf` */
  const flush = () => {
    let candidate = buf
    if (allowTrailingComma) candidate = candidate.replace(/,\s*(?=[}\]])/g, '')
    if (allowSingleQuote) {
      candidate = candidate
        .replace(/([{,]\s*)'([^']+?)'\s*:/g, '$1"$2":')
        .replace(/:\s*'([^']*?)'\s*([,}])/g, ':"$1"$2')
    }
    try {
      const parsed = JSON.parse(candidate)
      // @ts-ignore — yield inside helper
      return parsed
    } catch (err) {
      if (onError && err instanceof Error) onError(candidate, err, lineNo)
    }
  }

  while (true) {
    const { value, done } = await reader.read()
    if (done) break

    for (const ch of value) {
      if (ch === '\n') {
        lineNo++
        // const line = sanitize(stripComment(lineBuf.trim()))
        const line = stripComment(lineBuf.trim())
        lineBuf = ''
        if (!line) continue
        if (buf) buf += '\n'
        buf += line

        for (const c of line) {
          if (esc) esc = false
          else if (c === '\\') esc = true
          else if (c === '"') inStr = !inStr
          else if (!inStr && c === '{') depth++
          else if (!inStr && c === '}') depth--
        }

        if (depth === 0 && !inStr) {
          const parsed = flush()
          if (parsed !== undefined) yield parsed
          buf = ''
        }
      } else {
        lineBuf += ch
      }
    }
  }
  // handle tail
  lineNo++
  // lineBuf = sanitize(stripComment(lineBuf.trim()))
  lineBuf = stripComment(lineBuf.trim())
  if (lineBuf) {
    if (buf) buf += '\n'
    buf += lineBuf
  }
  if (buf.trim()) {
    const parsed = flush()
    if (parsed !== undefined) yield parsed
  }
}

async function _collect(source: AsyncGenerator<unknown>) {
  const arr: unknown[] = []
  for await (const o of source) arr.push(o)
  return arr
}
