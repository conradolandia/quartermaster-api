"use client"

import { ChakraProvider } from "@chakra-ui/react"
import React, { type PropsWithChildren } from "react"
import { DateFormatProvider } from "../../contexts/DateFormatContext"
import { system } from "../../theme"
import { ColorModeProvider } from "./color-mode"
import { Toaster } from "./toaster"

export function CustomProvider(props: PropsWithChildren) {
  return (
    <ChakraProvider value={system}>
      <ColorModeProvider defaultTheme="dark" forcedTheme="dark">
        <DateFormatProvider>
          {props.children}
        </DateFormatProvider>
      </ColorModeProvider>
      <Toaster />
    </ChakraProvider>
  )
}
