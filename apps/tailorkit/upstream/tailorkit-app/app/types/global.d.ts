declare module '@huggingface/transformers' {
  export function pipeline(task: string, model: string): Promise<(input: any, options?: any) => Promise<any>>

  export class AutoModel {
    static from_pretrained(modelName: string, options?: any): Promise<any>
  }

  export class AutoProcessor {
    static from_pretrained(modelName: string): Promise<any>
  }

  export class RawImage {
    static fromURL(url: string): Promise<any>
    width: number
    height: number
  }
}
