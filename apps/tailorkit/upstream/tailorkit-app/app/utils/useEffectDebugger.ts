import { useEffect, useRef } from 'react'

const usePrevious = (value: any, initialValue: any) => {
  const ref = useRef(initialValue)
  useEffect(() => {
    ref.current = value
  })
  return ref.current
}

// use as useEffect
export const useEffectDebugger = (effectHook: () => any, dependencies: any[], dependencyNames = []) => {
  const previousDeps = usePrevious(dependencies, [])

  const changedDeps = dependencies.reduce((acc, dependency, index) => {
    if (dependency !== previousDeps[index]) {
      const keyName = dependencyNames[index] || index
      return {
        ...acc,
        [keyName]: {
          before: previousDeps[index],
          after: dependency,
        },
      }
    }

    return acc
  }, {})

  if (Object.keys(changedDeps).length) {
    console.log(`[use-effect-debugger]`, changedDeps)
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(effectHook, dependencies)
}
