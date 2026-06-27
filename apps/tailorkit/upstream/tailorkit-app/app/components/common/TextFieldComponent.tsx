import type { TextFieldProps } from '@shopify/polaris'
import { TextField } from '@shopify/polaris'
import { useEffect, useRef, useState } from 'react'

interface ITextFieldComponentProps {
  isError?: boolean
  errMessage?: string
  onBlur?: () => void
  customStyles?: React.CSSProperties
}

export default function TextFieldComponent(props: ITextFieldComponentProps & TextFieldProps) {
  const { onFocus, isError, errMessage, customStyles = {}, onBlur } = props

  const [focus, setFocus] = useState(false)
  const divRef = useRef<HTMLDivElement>(null)

  const _onFocus = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      setFocus(pre => !pre)
    }
  }

  useEffect(() => {
    const elm = divRef.current

    elm?.addEventListener('keydown', _onFocus)

    return () => elm?.removeEventListener('keydown', _onFocus)
  }, [])

  return (
    <div ref={divRef} style={{ ...customStyles }} className="custom-text-field-component">
      <TextField
        {...props}
        {...(isError
          ? {
              error: errMessage,
            }
          : {})}
        onFocus={() => {
          setFocus(true)
          onFocus && onFocus()
        }}
        onBlur={() => {
          setFocus(false)
          onBlur && onBlur()
        }}
        focused={focus}
      />
    </div>
  )
}
