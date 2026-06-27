import { Fragment } from 'react/jsx-runtime'

interface DevToolsScriptInjectorProps {
  enableDevTools: boolean
}

/**
 * Injects the React DevTools script into the document
 */
export default function DevToolsScriptInjector(props: DevToolsScriptInjectorProps) {
  const { enableDevTools } = props

  return <Fragment>{enableDevTools ? <script src="http://localhost:8097"></script> : <Fragment />}</Fragment>
}
