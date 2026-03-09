import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react"

const STORAGE_KEY = "includeArchived"

function getStoredValue(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "true"
  } catch {
    return false
  }
}

function setStoredValue(value: boolean) {
  try {
    if (value) {
      localStorage.setItem(STORAGE_KEY, "true")
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  } catch {
    // localStorage unavailable
  }
}

type IncludeArchivedContextValue = {
  includeArchived: boolean
  setIncludeArchived: (value: boolean) => void
}

const IncludeArchivedContext =
  createContext<IncludeArchivedContextValue | null>(null)

export function IncludeArchivedProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [includeArchived, setState] = useState(getStoredValue)

  const setIncludeArchived = useCallback((value: boolean) => {
    setStoredValue(value)
    setState(value)
  }, [])

  const value = useMemo(
    () => ({ includeArchived, setIncludeArchived }),
    [includeArchived, setIncludeArchived],
  )

  return (
    <IncludeArchivedContext.Provider value={value}>
      {children}
    </IncludeArchivedContext.Provider>
  )
}

export function useIncludeArchived() {
  const ctx = useContext(IncludeArchivedContext)
  if (!ctx) {
    return {
      includeArchived: getStoredValue(),
      setIncludeArchived: setStoredValue,
    }
  }
  return ctx
}
