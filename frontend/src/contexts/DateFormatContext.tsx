import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react"

import {
  getUseInternationalDateFormat,
  setUseInternationalDateFormat,
} from "@/utils"

type DateFormatContextValue = {
  useInternationalFormat: boolean
  setUseInternationalFormat: (value: boolean) => void
}

const DateFormatContext = createContext<DateFormatContextValue | null>(null)

export function DateFormatProvider({ children }: { children: React.ReactNode }) {
  const [useInternationalFormat, setState] = useState(() =>
    getUseInternationalDateFormat(),
  )

  const setUseInternationalFormat = useCallback((value: boolean) => {
    setUseInternationalDateFormat(value)
    setState(value)
  }, [])

  const value = useMemo(
    () => ({ useInternationalFormat, setUseInternationalFormat }),
    [useInternationalFormat, setUseInternationalFormat],
  )

  return (
    <DateFormatContext.Provider value={value}>
      {children}
    </DateFormatContext.Provider>
  )
}

export function useDateFormatPreference() {
  const ctx = useContext(DateFormatContext)
  if (!ctx) {
    return {
      useInternationalFormat: getUseInternationalDateFormat(),
      setUseInternationalFormat: setUseInternationalDateFormat,
    }
  }
  return ctx
}
