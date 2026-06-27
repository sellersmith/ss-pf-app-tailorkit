export function SectionWrapper(props: { children: React.ReactNode; id?: string }) {
  return (
    <s-box paddingBlockEnd="base" paddingBlockStart="base" id={props.id}>
      {props.children}
    </s-box>
  )
}
