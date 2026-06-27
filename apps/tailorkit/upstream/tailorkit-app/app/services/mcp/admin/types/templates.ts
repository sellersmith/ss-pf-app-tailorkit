interface ICreateTemplateArgs {
  templateId: string
  shopDomain: string
  name: string
  dimension: {
    width: number
    height: number
    measurementUnit: string
    resolution: number
  }
}

export type { ICreateTemplateArgs }
