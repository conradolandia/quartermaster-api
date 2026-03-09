"use client"

import { ChakraProvider } from "@chakra-ui/react"
import React, { type PropsWithChildren } from "react"
import { DateFormatProvider } from "../../contexts/DateFormatContext"
import { IncludeArchivedProvider } from "../../contexts/IncludeArchivedContext"
import { system } from "../../theme"
import { ColorModeProvider } from "./color-mode"
import { Toaster } from "./toaster"

export function CustomProvider(props: PropsWithChildren) {
  return (
    <ChakraProvider value={system}>
      <ColorModeProvider defaultTheme="dark" forcedTheme="dark">
        <DateFormatProvider>
          <IncludeArchivedProvider>
            {props.children}
          </IncludeArchivedProvider>
        </DateFormatProvider>
      </ColorModeProvider>
      <Toaster />
    </ChakraProvider>
  )
}
