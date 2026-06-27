/* eslint-disable max-len */
import os from 'os'
import fs from 'fs'
import path from 'path'
import { uploadFileToAmazonS3 } from '~/utils/amazon-s3'
import { uuid } from '~/utils/uuid'
import type { MEASUREMENT_UNIT } from '~/constants/measurement-units'
import type { RESOLUTION } from '~/constants/resolution'
import { acquireBrowser, releaseBrowser } from './puppeteer/browserPool'

export interface PreviewDimension {
  width: number
  height: number
  measurementUnit: MEASUREMENT_UNIT
  resolution: RESOLUTION
}

export interface PreviewLayerPosition {
  x: number
  y: number
  width: number
  height: number
}

export interface PreviewLayerSettings {
  content?: string
  textColor?: string
  fontSize?: number
  textAlign?: string
  verticalAlign?: string
}

export interface PreviewLayerImage {
  src?: string
}

export interface PreviewLayer {
  zIndex: number
  visible?: boolean
  type: 'text' | 'image' | string
  position: PreviewLayerPosition
  settings?: PreviewLayerSettings | Record<string, unknown>
  image?: PreviewLayerImage
}

/**
 * Generate a preview image for the provided template layers using a headless browser and Konva,
 * upload it to S3, and return the public URL. Non-blocking: returns empty string on failure.
 */
export async function generateTemplatePreviewUrl(args: {
  dimension: PreviewDimension
  layers: PreviewLayer[]
  shopDomain: string
}): Promise<string> {
  const { dimension, layers, shopDomain } = args

  if (!shopDomain || !layers?.length) return ''

  const browser = await acquireBrowser()
  try {
    const page = await browser.newPage()

    // Inline HTML loads Konva from CDN and renders layers, then exposes window.previewDataURL
    const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="Content-Security-Policy" content="default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; img-src * data: blob:; connect-src *; script-src * 'unsafe-inline' 'unsafe-eval'; style-src * 'unsafe-inline';" />
    <title>Template Preview</title>
    <script src="https://unpkg.com/konva@9.3.15/konva.min.js"></script>
  </head>
  <body>
    <div id="container"></div>
    <script>
      (function(){
        const dimension = ${JSON.stringify(dimension)};
        const rawLayers = ${JSON.stringify(layers)};

        function lengthUnitToPixels(length, unit, ppi){
          let inches;
          switch(unit){
            case 'm': inches = length / (2.54 * 100); break;
            case 'cm': inches = length / 2.54; break;
            case 'inch': inches = length; break;
            case 'mm': inches = length / 25.4; break;
            case 'px': default: inches = length / ppi; break;
          }
          return Math.max(1, Math.round(inches * ppi));
        }

        const widthPx = lengthUnitToPixels(dimension.width, dimension.measurementUnit, dimension.resolution);
        const heightPx = lengthUnitToPixels(dimension.height, dimension.measurementUnit, dimension.resolution);

        const stage = new Konva.Stage({ container: 'container', width: widthPx, height: heightPx });
        const base = new Konva.Layer();
        stage.add(base);

        function loadImage(url){
          return new Promise(function(resolve, reject){
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve(img);
            img.onerror = (e) => reject(e);
            img.src = url;
          });
        }

        (async function draw(){
          // draw from back to front
          const ordered = rawLayers.slice().sort((a,b)=>a.zIndex-b.zIndex);
          for (const l of ordered){
            if (!l || l.visible === false) continue;
            const type = l.type;
            const settings = l.settings || {};

            // Support both layer.position.{x,y,width,height} and flat {left,top,width,height}
            const pos = l.position || {};
            const x = (pos.x != null ? pos.x : (l.left != null ? l.left : 0)) || 0;
            const y = (pos.y != null ? pos.y : (l.top != null ? l.top : 0)) || 0;
            const width = (pos.width != null ? pos.width : (l.width != null ? l.width : 0)) || 0;
            const height = (pos.height != null ? pos.height : (l.height != null ? l.height : 0)) || 0;

            if (type === 'text'){
              const content = (settings && settings.content) || '';
              const text = new Konva.Text({
                x, y, width, height,
                text: content,
                fill: (settings && settings.textColor) || '#222',
                fontSize: Math.max(10, Math.min(64, settings && settings.fontSize || 24)),
                align: (settings && settings.textAlign) || 'center',
                verticalAlign: (settings && settings.verticalAlign) || 'middle',
              });
              base.add(text);
              continue;
            }

            if (type === 'image'){
              const src = (l.image && l.image.src) || '';
              if (!src) continue;
              try{
                const img = await loadImage(src);
                const node = new Konva.Image({ x, y, image: img, width, height });
                base.add(node);
              }catch(e){ /* skip broken image */ }
            }
          }

          base.draw();
          // Slight downscale to reduce size
          const dataUrl = stage.toDataURL({ mimeType: 'image/webp', pixelRatio: 0.7, quality: 0.9 });
          window.previewDataURL = dataUrl;
        })();
      })();
    </script>
  </body>
</html>`

    await page.setViewport({
      width: Math.min(2000, Math.max(1, Math.round(args.dimension.width || 1000))),
      height: Math.min(2000, Math.max(1, Math.round(args.dimension.height || 1000))),
    })
    await page.setContent(html, { waitUntil: 'networkidle0' })
    await page.waitForFunction('window.previewDataURL && window.previewDataURL.startsWith("data:")', {
      timeout: 15000,
    })
    const dataUrl: string = await page.evaluate(() => (window as any).previewDataURL)

    // Persist to tmp file then upload to S3
    const base64 = dataUrl.split(',')[1]
    const buffer = Buffer.from(base64, 'base64')
    const tmpFile = path.join(os.tmpdir(), `template-preview-${uuid()}.webp`)
    await fs.promises.writeFile(tmpFile, buffer)

    try {
      const url = await uploadFileToAmazonS3(tmpFile, shopDomain)
      return url || ''
    } finally {
      await fs.promises.unlink(tmpFile).catch(() => {})
    }
  } catch (err) {
    console.warn('Preview generation failed:', err)
    return ''
  } finally {
    await releaseBrowser(browser)
  }
}
