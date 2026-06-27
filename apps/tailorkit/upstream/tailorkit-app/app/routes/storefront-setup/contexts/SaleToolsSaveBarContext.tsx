import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'

interface SaleToolsSaveBarContextType {
  hasPendingChanges: boolean
  isSaving: boolean
  setPendingChanges: (pending: boolean) => void
  setSaving: (saving: boolean) => void
  registerSaveHandler: (handler: () => void | Promise<void>) => void
  registerDiscardHandler: (handler: () => void) => void
  triggerSave: () => void | Promise<void>
  triggerDiscard: () => void
}

const SaleToolsSaveBarContext = createContext<SaleToolsSaveBarContextType | null>(null)

interface SaleToolsSaveBarProviderProps {
  children: ReactNode
}

export function SaleToolsSaveBarProvider({ children }: SaleToolsSaveBarProviderProps) {
  const [hasPendingChanges, setHasPendingChanges] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const saveHandlerRef = useRef<(() => void | Promise<void>) | null>(null)
  const discardHandlerRef = useRef<(() => void) | null>(null)

  const setPendingChanges = useCallback((pending: boolean) => {
    setHasPendingChanges(pending)
  }, [])

  const setSaving = useCallback((saving: boolean) => {
    setIsSaving(saving)
  }, [])

  const registerSaveHandler = useCallback((handler: () => void | Promise<void>) => {
    saveHandlerRef.current = handler
  }, [])

  const registerDiscardHandler = useCallback((handler: () => void) => {
    discardHandlerRef.current = handler
  }, [])

  const triggerSave = useCallback(() => {
    if (saveHandlerRef.current) {
      return saveHandlerRef.current()
    }
  }, [])

  const triggerDiscard = useCallback(() => {
    if (discardHandlerRef.current) {
      discardHandlerRef.current()
    }
  }, [])

  const value = useMemo(
    () => ({
      hasPendingChanges,
      isSaving,
      setPendingChanges,
      setSaving,
      registerSaveHandler,
      registerDiscardHandler,
      triggerSave,
      triggerDiscard,
    }),
    [
      hasPendingChanges,
      isSaving,
      setPendingChanges,
      setSaving,
      registerSaveHandler,
      registerDiscardHandler,
      triggerSave,
      triggerDiscard,
    ]
  )

  return <SaleToolsSaveBarContext.Provider value={value}>{children}</SaleToolsSaveBarContext.Provider>
}

export function useSaleToolsSaveBar(): SaleToolsSaveBarContextType {
  const context = useContext(SaleToolsSaveBarContext)
  if (!context) {
    throw new Error('useSaleToolsSaveBar must be used within a SaleToolsSaveBarProvider')
  }
  return context
}
