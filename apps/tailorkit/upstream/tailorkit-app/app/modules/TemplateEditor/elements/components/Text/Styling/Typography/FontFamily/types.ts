export interface IFontFamily {
  fontFamily: { family: string; src: string }
  onChangeFontFamily: (args: { family: string; src: string }) => void
}
