import { Icon } from "@chakra-ui/react"
import { FiArrowDown, FiArrowUp } from "react-icons/fi"

import type { SortableColumn, SortDirection } from "../types"

interface SortIconProps {
  column: SortableColumn
  sortBy?: SortableColumn
  sortDirection?: SortDirection
}

export default function SortIcon({ column, sortBy, sortDirection }: SortIconProps) {
  if (sortBy !== column) {
    return <Icon as={FiArrowUp} opacity={0.3} />
  }
  return <Icon as={sortDirection === "asc" ? FiArrowUp : FiArrowDown} />
}
