"use client"

import {
  DEFAULT_PAGE_SIZE,
  PAGE_SIZE_OPTIONS,
  type PageSizeOption,
} from "@/constants/pagination"
import { Flex, Text } from "@chakra-ui/react"
import type * as React from "react"
import { NativeSelect } from "./native-select"

export interface PageSizeSelectProps {
  value: number
  onChange: (pageSize: number) => void
  options?: readonly number[]
  size?: "sm" | "md" | "lg"
  "aria-label"?: string
}

export function PageSizeSelect({
  value,
  onChange,
  options = PAGE_SIZE_OPTIONS,
  size = "sm",
  "aria-label": ariaLabel = "Rows per page",
}: PageSizeSelectProps) {
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const n = Number(e.target.value)
    if (Number.isInteger(n) && n > 0) onChange(n)
  }

  return (
    <Flex align="center" gap={2}>
      <Text fontSize="sm" color="gray.500" whiteSpace="nowrap">
        Rows per page
      </Text>
      <NativeSelect
        size={size}
        value={value}
        onChange={handleChange}
        aria-label={ariaLabel}
        style={{ width: "auto", minWidth: "4rem" }}
      >
        {options.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </NativeSelect>
    </Flex>
  )
}

export { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS }
export type { PageSizeOption }
