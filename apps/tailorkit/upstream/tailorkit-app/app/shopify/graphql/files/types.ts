type TFile = {
  originalSource: string
  contentType: 'IMAGE' | 'FILE'
  filename: string
  alt: string
}

export type TFileToUpload = TFile & {
  _id?: string
  file?: File | TFile
}
