/// <reference lib="dom" />
import { COMMON_LINE_HEIGHT_RATIO, ELLIPSE, HEART, RECTANGLE, STAR, TRIANGLE, type Shape } from '../constants/shape'
import { sanitizeContentSVG } from '../fns/sanitize-content-svg'

export type TextStyle = {
  fontFamily: { family: string; src: string }
  fontSize: number
  color: string
  textAlign: 'left' | 'center' | 'right' | 'justify'
  verticalAlign: string
  textStyle: string[]
}

interface IShapeArgs {
  width: number
  height: number
  style: TextStyle
  text?: string
}

/**
 * IMPORTANT NOTE: SVG Text path does not native support text alignment - justify,
 * so we must break the content and calculate the distance between each text
 */
function getPathLength(pathDefinition: string) {
  // Create a temporary SVG element to calculate the path length
  const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  const pathElement = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  pathElement.setAttribute('d', pathDefinition)
  tempSvg.appendChild(pathElement)
  document.body.appendChild(tempSvg)
  const pathLength = pathElement.getTotalLength()
  document.body.removeChild(tempSvg)

  return pathLength
}

function getStartOffset(textAlign: TextStyle['textAlign']) {
  const offsets = {
    left: '0%',
    right: '100%',
    center: '50%',
    // Justify starts at the beginning
    justify: '0%',
  }

  return offsets[textAlign]
}

function formatFontFamily(font: string) {
  return font ? `'${font.replace(/"/g, '')}'` : ''
}

function getTextPathByAlignment(style: TextStyle, text: string, textPathElement: string, pathLength: number) {
  const { textAlign, fontFamily, fontSize } = style
  if (textAlign === 'justify') {
    const words = text.split(' ')
    const wordCount = words.length

    // Calculate total text length using the text metrics
    let textWidth = 0
    const context = document.createElement('canvas').getContext('2d')!
    context.font = `${fontSize}px ${formatFontFamily(fontFamily.family)}`

    words.forEach(word => {
      textWidth += context.measureText(word).width
    })

    const extraSpace = (pathLength - textWidth) / (wordCount - 1)

    // Build the text with precise spacing
    words.forEach((word, index) => {
      textPathElement += `<tspan dy="0" dx="${index === 0 ? 0 : extraSpace}" text-anchor="start">${word}</tspan>`
    })
  } else {
    textPathElement += text
  }

  return textPathElement
}

function getTextStyleInline(textStyle: TextStyle['textStyle'] = []) {
  // Initialize an empty array to store individual style strings
  const styles: string[] = []

  // Add styles conditionally
  if (textStyle.includes('bold')) {
    styles.push('font-weight: bold;')
  }
  if (textStyle.includes('italic')) {
    styles.push('font-style: italic;')
  }
  if (textStyle.includes('underline')) {
    styles.push('text-decoration: underline;')
  }

  // Join all styles into a single string with spaces
  return styles.join(' ')
}

function generateNormalTextPath(args: IShapeArgs) {
  const { width, height, text = '', style } = args
  const { fontFamily, color, textAlign, textStyle } = style
  let { fontSize } = style

  // TODO: Temporary force set vertical align to top
  const verticalAlign = 'top'
  const svgNS = 'http://www.w3.org/2000/svg'

  // Create SVG element
  const svg = document.createElementNS(svgNS, 'svg')
  svg.setAttribute('width', width.toString())
  svg.setAttribute('height', height.toString())

  // Create text element
  const textElement = document.createElementNS(svgNS, 'text')
  textElement.setAttribute('font-family', formatFontFamily(fontFamily.family))
  textElement.setAttribute('fill', color)

  // TODO: Improve render text via script instead of SVG
  // ==========================
  // Calculate text metrics using canvas
  const context = document.createElement('canvas').getContext('2d')!
  context.font = `${fontSize}px ${formatFontFamily(fontFamily.family)}`
  const metrics = context.measureText('x')
  // Get the actual height of text characters
  const actualHeight = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent

  // Add small offset for special fonts to prevent clipping
  const offset = fontSize * 0.15 // 15% of fontSize for safety margin
  // Set alignment attributes with precise positioning
  const alignmentMap: any = {
    left: { x: offset, anchor: 'start' },
    center: { x: width / 2, anchor: 'middle' },
    right: { x: width - offset, anchor: 'end' },
  }

  const verticalMap: any = {
    top: { y: actualHeight, baseline: 'hanging' },
    middle: { y: height / 2, baseline: 'middle' },
    bottom: { y: height - actualHeight / 2, baseline: 'auto' },
  }
  //==========================

  // Determine x, y positions based on alignment
  const { x, anchor } = alignmentMap[textAlign] || alignmentMap.left
  const { y, baseline } = verticalMap[verticalAlign] || verticalMap.top

  // Set baseline alignment
  textElement.setAttribute('dominant-baseline', baseline)

  // Helper function to split text into lines
  function splitTextIntoLines(text: string, maxWidth: number, maxHeight: number): string[] {
    const words = text.split(' ')
    const lines = []
    let currentLine = ''

    for (let i = 0; i < words.length; i++) {
      // Create a canvas context to measure text width
      const context = document.createElement('canvas').getContext('2d')!
      context.font = `${fontSize}px '${formatFontFamily(fontFamily.family)}'`

      const word = words[i]
      const tempText = `${currentLine} ${word}`.trim()
      const width = context.measureText(tempText).width

      if (width < maxWidth) {
        currentLine = tempText
      } else {
        const line = currentLine.trim()

        if (line) {
          lines.push(line)
        }

        currentLine = word
      }

      if (
        (width > maxWidth && i + 1 === words.length)
        || (lines.length + 1) * fontSize * COMMON_LINE_HEIGHT_RATIO >= maxHeight
      ) {
        if (fontSize - 1 > 0) {
          fontSize--

          return splitTextIntoLines(text, maxWidth, maxHeight)
        }
      }
    }

    lines.push(currentLine)

    return lines
  }

  // Split text into lines
  const lines = splitTextIntoLines(text, width, height)

  textElement.setAttribute('font-size', fontSize.toString())

  // Calculate line height and start position
  const lineHeight = fontSize * COMMON_LINE_HEIGHT_RATIO

  const styleInline = getTextStyleInline(textStyle)

  // Detect Safari browser
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent)

  // Append tspans for each line
  lines.forEach((line, index) => {
    const tspan = document.createElementNS(svgNS, 'tspan')
    tspan.textContent = line

    tspan.setAttribute('x', x.toString())
    tspan.setAttribute('y', (y + index * lineHeight).toString())
    tspan.setAttribute('text-anchor', anchor)
    tspan.setAttribute('style', styleInline)

    if (isSafari && baseline === 'hanging') {
      tspan.setAttribute('dy', '0.75em')
    }

    textElement.appendChild(tspan)
  })

  // Append the text element to the SVG
  svg.appendChild(textElement)

  const svgString = new XMLSerializer().serializeToString(svg)

  return svgString
}

/**
 * @description Create rectangle path - Move cursor to 0,0 and draw line 0 + width 0 + height point
 * @param args IShapeArgs
 * @returns path string
 */

export const generateRectanglePath = (args: IShapeArgs) => {
  const {
    width,
    height,
    style: { fontSize = 0, fontFamily, color, textAlign, verticalAlign, textStyle },
    style,
    text = '',
  } = args

  const pathId = 'rectanglePath'
  const pathDefinition = `
    M ${fontSize} ${fontSize}
    H ${width + fontSize}
    V ${height + fontSize}
    H ${fontSize}
    Z
  `

  const pathLength = getPathLength(pathDefinition)

  // Determine the startOffset based on textAlign
  const startOffset = getStartOffset(textAlign)

  let textPathElement = `<textPath href="#${pathId}" startOffset="${startOffset}" text-anchor="${
    textAlign === 'center' ? 'middle' : textAlign === 'right' ? 'end' : 'start'
  }">`

  const textPathContent = getTextPathByAlignment(style, text, textPathElement, pathLength)

  textPathElement = `${textPathContent}</textPath>`

  const textStyleInline = getTextStyleInline(textStyle)

  let styleInline = `
    font-size: ${fontSize}px;
    font-family: ${formatFontFamily(fontFamily.family)};
    fill: ${color};
    dominant-baseline: ${verticalAlign};
  `

  styleInline += textStyleInline

  const svgContent = `
    <svg xmlns="http://www.w3.org/2000/svg"
        width="${width + 2 * fontSize}" height="${height + 2 * fontSize}">
        <path id="${pathId}" d="${pathDefinition}" fill="none" stroke="transparent" />
        <text style="${styleInline}">
            ${textPathElement}
        </text>
    </svg>`

  return svgContent
}

/**
 * @description Create ellipse path - Move cursor to 0,0 and draw arc around the the center point with radius value
 * @param args IShapeArgs
 * @returns path string
 */

export const generateEllipsePath = (args: IShapeArgs) => {
  const {
    width,
    height,
    style: { fontSize = 0, fontFamily, color, textAlign, verticalAlign, textStyle },
    style,
    text = '',
  } = args

  // Calculate the center and radii for the ellipse
  const centerX = width / 2 + fontSize
  const centerY = height / 2 + fontSize
  const radiusX = width / 2
  const radiusY = height / 2

  // Define the elliptical path using an SVG path (clockwise)
  const ellipticalPath = `
    M ${centerX - radiusX}, ${centerY}
    a ${radiusX},${radiusY} 0 1,1 ${2 * radiusX},0
    a ${radiusX},${radiusY} 0 1,1 ${-2 * radiusX},0
  `
  const pathId = 'ellipseAC'
  const pathLength = getPathLength(ellipticalPath)

  // Determine the startOffset based on textAlign
  const startOffset = getStartOffset(textAlign)

  let textPathElement = `<textPath href="#${pathId}" startOffset="${startOffset}" text-anchor="${
    textAlign === 'center' ? 'middle' : textAlign === 'right' ? 'end' : 'start'
  }">`

  const textPathContent = getTextPathByAlignment(style, text, textPathElement, pathLength)

  textPathElement = `${textPathContent}</textPath>`

  const textStyleInline = getTextStyleInline(textStyle)

  let styleInline = `
    font-size: ${fontSize}px;
    font-family: ${formatFontFamily(fontFamily.family)};
    fill: ${color};
    dominant-baseline: ${verticalAlign};
  `

  styleInline += textStyleInline

  const path = `
    <svg xmlns="http://www.w3.org/2000/svg"
        width="${width + 2 * fontSize}" height="${height + 2 * fontSize}"
        viewBox="0 0 ${width + 2 * fontSize} ${height + 2 * fontSize}">
        <path id="${pathId}" d="${ellipticalPath}" fill="none" stroke="transparent" />
        <text style="${styleInline}">
            ${textPathElement}
        </text>
    </svg>`

  return path
}

/**
 * @description Create triangle path - Move cursor to vertical center, 0 and draw line to left and right corner of shape
 * @param args IShapeArgs
 * @returns path string
 */

export const generateTrianglePath = (args: IShapeArgs) => {
  const {
    width,
    height,
    style: { fontSize = 0, fontFamily, color, textAlign, verticalAlign, textStyle },
    style,
    text = '',
  } = args

  // Calculate the points of the triangle
  const pointA = { x: width / 2 + fontSize, y: fontSize } // Top-center
  const pointB = { x: fontSize, y: height + fontSize } // Bottom-left
  const pointC = { x: width + fontSize, y: height + fontSize } // Bottom-right

  const vertexGap = (fontSize * COMMON_LINE_HEIGHT_RATIO) / 2 // The gap to apply to each vertex
  // Define the triangular path (clockwise with correct text orientation)
  const trianglePath = `
    M ${pointA.x},${pointA.y}
    L ${pointC.x},${pointC.y - vertexGap}
    M ${pointC.x}, ${pointB.y}
    L ${pointA.y},${pointB.y}
    M ${pointA.y}, ${pointB.y - vertexGap}
    L ${pointA.x},${pointA.y}
  `

  const pathId = 'triangleAC'
  const pathLength = getPathLength(trianglePath)

  // Determine the startOffset based on textAlign
  const startOffset = getStartOffset(textAlign)

  let textPathElement = `<textPath href="#${pathId}" startOffset="${startOffset}" text-anchor="${
    textAlign === 'center' ? 'middle' : textAlign === 'right' ? 'end' : 'start'
  }">`

  const textPathContent = getTextPathByAlignment(style, text, textPathElement, pathLength)

  textPathElement = `${textPathContent}</textPath>`

  const textStyleInline = getTextStyleInline(textStyle)

  let styleInline = `
    font-size: ${fontSize}px;
    font-family: ${formatFontFamily(fontFamily.family)};
    fill: ${color};
    dominant-baseline: ${verticalAlign};
  `

  styleInline += textStyleInline

  const path = `
    <svg xmlns="http://www.w3.org/2000/svg"
        width="${width + 2 * fontSize}" height="${height + 2 * fontSize}"
        viewBox="0 0 ${width + 2 * fontSize} ${height + 2 * fontSize}">
        <path id="${pathId}" d="${trianglePath}" fill="none" stroke="transparent" />
        <text style="${styleInline}">
            ${textPathElement}
        </text>
    </svg>`

  return path
}

/**
 * @description Create star path
 * 1. Base on number of star point => edges = numberOfVertex * 2
 * 2. Each vertex is always a point of a circle
 * 3. The distance from center point to each vertex equal to Radius (r1) and interior vertex equal to Radius / 2 (r2)
 * 4. The distance from vertex to relative interior vertex = Math.sqrt(r1 ^ 2 * r2 ^2)
 * @param args IShapeArgs
 * @returns path string
 */
export const generateStarPath = (args: IShapeArgs) => {
  const {
    width,
    height,
    style: { fontSize = 0, fontFamily, color, textAlign, verticalAlign, textStyle },
    style,
    text = '',
  } = args

  // Calculate the center and radius
  const centerX = width / 2 + fontSize
  const centerY = height / 2 + fontSize
  const outerRadius = Math.min(width, height) / 2
  const innerRadius = outerRadius / 2.5

  // Calculate the points of the star
  const points = 5
  const vertexGap = 5 // The gap to apply to each vertex
  let starPath = ''

  for (let i = 0; i < 2 * points; i++) {
    const radius = i % 2 === 0 ? outerRadius : innerRadius
    const angle = (i * Math.PI) / points - Math.PI / 2
    const nextAngle = ((i + 1) * Math.PI) / points - Math.PI / 2
    const x = centerX + radius * Math.cos(angle)
    const y = centerY + radius * Math.sin(angle)
    const nextRadius = (i + 1) % 2 === 0 ? outerRadius : innerRadius
    const nextX = centerX + nextRadius * Math.cos(nextAngle)
    const nextY = centerY + nextRadius * Math.sin(nextAngle)

    // Calculate direction vector
    const dx = nextX - x
    const dy = nextY - y
    const distance = Math.sqrt(dx * dx + dy * dy)

    // Adjust start and end points by vertexGap
    const startX = x + (dx * vertexGap) / distance
    const startY = y + (dy * vertexGap) / distance
    const endX = nextX - (dx * vertexGap) / distance
    const endY = nextY - (dy * vertexGap) / distance

    if (i === 0) {
      starPath += `M ${startX},${startY} L ${endX},${endY} `
    } else {
      starPath += `M ${startX},${startY} L ${endX},${endY} `
    }
  }

  starPath += 'Z' // Close the path

  const pathId = 'starAC'
  const pathLength = getPathLength(starPath)

  // Determine the startOffset based on textAlign
  const startOffset = getStartOffset(textAlign)

  let textPathElement = `<textPath href="#${pathId}" startOffset="${startOffset}" text-anchor="${
    textAlign === 'center' ? 'middle' : textAlign === 'right' ? 'end' : 'start'
  }">`

  const textPathContent = getTextPathByAlignment(style, text, textPathElement, pathLength)

  textPathElement = `${textPathContent}</textPath>`

  const textStyleInline = getTextStyleInline(textStyle)

  let styleInline = `
    font-size: ${fontSize}px;
    font-family: ${formatFontFamily(fontFamily.family)};
    fill: ${color};
    dominant-baseline: ${verticalAlign};
  `

  styleInline += textStyleInline

  const path = `
    <svg xmlns="http://www.w3.org/2000/svg"
        width="${width + 2 * fontSize}" height="${height + 2 * fontSize}"
        viewBox="0 0 ${width + 2 * fontSize} ${height + 2 * fontSize}">
        <path id="${pathId}" d="${starPath}" fill="none" stroke="transparent" />
        <text style="${styleInline}">
            ${textPathElement}
        </text>
    </svg>`

  return path
}

/**
 * @description Create heart path
 * 1. Start point is  centerX, height * 0.3
 * 2. Draw the curve from start point to the centerX, centerBottom
 * @param args IShapeArgs
 * @returns path string
 */
export const generateHeartPath = (args: IShapeArgs) => {
  const {
    width,
    height,
    style: { fontSize = 0, fontFamily, color, textAlign, verticalAlign, textStyle },
    style,
    text = '',
  } = args

  const heartDepth = 0.3
  // Calculate the center and control points for the heart
  const centerX = width / 2 + fontSize
  const centerY = height / 2 + fontSize
  const topCurveHeight = height * heartDepth

  const pathData = `
    M ${centerX},${topCurveHeight}
    C ${centerX + width / 2 - fontSize},${centerY - height}
      ${centerX + width - fontSize},${centerY + height / 3}
      ${centerX},${centerY + height / 2}
    C ${centerX - width + fontSize},${centerY + height / 3}
      ${centerX - width / 2 + fontSize},${centerY - height}
      ${centerX},${topCurveHeight}
    Z`

  const pathId = 'heartAC'
  const pathLength = getPathLength(pathData)

  // Determine the startOffset based on textAlign
  const startOffset = getStartOffset(textAlign)

  let textPathElement = `<textPath href="#${pathId}" startOffset="${startOffset}" text-anchor="${
    textAlign === 'center' ? 'middle' : textAlign === 'right' ? 'end' : 'start'
  }">`

  const textPathContent = getTextPathByAlignment(style, text, textPathElement, pathLength)

  textPathElement = `${textPathContent}</textPath>`

  const textStyleInline = getTextStyleInline(textStyle)

  let styleInline = `
    font-size: ${fontSize}px;
    font-family: ${formatFontFamily(fontFamily.family)};
    fill: ${color};
    dominant-baseline: ${verticalAlign};
  `

  styleInline += textStyleInline

  const svgContent = `
    <svg xmlns="http://www.w3.org/2000/svg"
        width="${width + 2 * fontSize}" height="${height + 2 * fontSize}"
        viewBox="0 0 ${width + 2 * fontSize} ${height + 2 * fontSize}">
        <path id="${pathId}" d="${pathData}" fill="none" stroke="transparent" />
        <text style="${styleInline}">
            ${textPathElement}
        </text>
    </svg>`

  return svgContent
}

export const generateShapePath = async (shape: Shape, args: IShapeArgs) => {
  const textPathCreation = {
    [RECTANGLE]: generateRectanglePath,
    [ELLIPSE]: generateEllipsePath,
    [TRIANGLE]: generateTrianglePath,
    [STAR]: generateStarPath,
    [HEART]: generateHeartPath,
    '': generateNormalTextPath,
  }

  const { src: fontSrc, family: fontFamily } = args.style.fontFamily

  const generateTextPathFnc = textPathCreation[shape] || generateNormalTextPath

  // Generate text path
  const svgStr = generateTextPathFnc({
    ...args,
    // Sanitize content for special shape svg
    text: shape ? sanitizeContentSVG(args.text || '') : args.text,
  })

  const svgDoc = new DOMParser().parseFromString(svgStr, 'image/svg+xml')
  const base64Font = await getBase64Font(fontSrc)

  if (!base64Font) return svgStr

  const svgNS = 'http://www.w3.org/2000/svg'
  const defs = svgDoc.createElementNS(svgNS, 'defs')

  defs.innerHTML = `<style type="text/css">
            @font-face {
              font-family: '${fontFamily}';
              src: url('data:font/truetype;base64,${base64Font}') format('truetype');
            }
          </style>`
  svgDoc.documentElement.appendChild(defs)

  const str = new XMLSerializer().serializeToString(svgDoc.documentElement)
  return str
}

const fontInstances: { [key: string]: string } = {}

async function getBase64Font(fontUrl: string) {
  if (!fontUrl) return ''

  const fontInstance = fontInstances[fontUrl]

  if (fontInstance) return fontInstance

  // Fetch and convert the font to Base64
  const response = await fetch(fontUrl)

  if (!response.ok) {
    console.log(`Failed to fetch font: ${response.statusText}`)

    return ''
  }

  const fontData = await response.arrayBuffer()
  const base64Font = convertArrayBufferToBase64(fontData)

  fontInstances[fontUrl] = base64Font

  return base64Font
}

/**
 * TODO: write test cases for this function later
 * Converts an ArrayBuffer response to a Base64 encoded string.
 * Optimized to handle large data efficiently and includes error handling.
 *
 * @param {ArrayBuffer} arrayBuffer - The input ArrayBuffer.
 * @returns {string} The Base64-encoded string.
 */
function convertArrayBufferToBase64(arrayBuffer: ArrayBuffer): string {
  try {
    const uint8Array = new Uint8Array(arrayBuffer)

    // Using array and join for efficient concatenation
    const binaryStringChunks = []
    for (let i = 0; i < uint8Array.length; i++) {
      binaryStringChunks.push(String.fromCharCode(uint8Array[i]))
    }

    const binaryString = binaryStringChunks.join('')
    return btoa(binaryString)
  } catch (error) {
    console.error('Error converting ArrayBuffer to Base64:', error)
    return ''
  }
}
