import { Box, Flex, Icon, Text } from "@chakra-ui/react"
import { useQueryClient } from "@tanstack/react-query"
import { Link as RouterLink, useMatchRoute } from "@tanstack/react-router"
import { FiCheck, FiDollarSign, FiDownload, FiHome, FiSettings, FiUsers, FiTag } from "react-icons/fi"
import type { IconType } from "react-icons/lib"
import { useState, useEffect, useRef } from "react"

import type { UserPublic } from "@/client"
import {
  FaBalanceScale,
  FaAnchor,
  FaMapMarked,
  FaRocket,
  FaRoute,
  FaShip,
  FaShoppingBag,
  FaSpaceShuttle,
  FaTicketAlt,
} from "react-icons/fa"

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

// Configure the default home page - change this to set where the app navigates
// when clicking the logo or loading the app for the first time
export const DEFAULT_HOME_PATH: string = "/" // Dashboard is now the default home page

const SIDEBAR_ORDER_KEY = "sidebarOrder"

// Default items configuration
const defaultItems = [
  { icon: FiHome, title: "Dashboard", path: "/" },
  { icon: FaSpaceShuttle, title: "Missions", path: "/missions" },
  { icon: FaTicketAlt, title: "Bookings", path: "/bookings" },
  { icon: FiCheck, title: "Check-In", path: "/check-in" },
  { icon: FiDollarSign, title: "Refunds", path: "/refunds" },
  { icon: FiDownload, title: "Export", path: "/export" },
  { icon: FaRoute, title: "Trips", path: "/trips" },
  { icon: FaRocket, title: "Launches", path: "/launches" },
  { icon: FaMapMarked, title: "Locations", path: "/locations" },
  { icon: FaBalanceScale, title: "Jurisdictions", path: "/jurisdictions" },
  { icon: FaShip, title: "Boats", path: "/boats" },
  { icon: FaAnchor, title: "Boat Providers", path: "/providers" },
  { icon: FaShoppingBag, title: "Merchandise", path: "/merchandise" },
  { icon: FiTag, title: "Discount Codes", path: "/discount-codes" },
  { icon: FiSettings, title: "Settings", path: "/settings" },
]

interface SidebarItemsProps {
  onClose?: () => void
}

interface Item {
  icon: IconType
  title: string
  path: string
}

// Load saved order from localStorage and apply it to items
function getOrderedItems(items: Item[]): Item[] {
  try {
    const savedOrder = localStorage.getItem(SIDEBAR_ORDER_KEY)
    if (!savedOrder) return items

    const orderArray: string[] = JSON.parse(savedOrder)
    const itemMap = new Map(items.map(item => [item.title, item]))

    // Build ordered list from saved order
    const ordered: Item[] = []
    for (const title of orderArray) {
      const item = itemMap.get(title)
      if (item) {
        ordered.push(item)
        itemMap.delete(title)
      }
    }

    // Append any new items not in saved order
    for (const item of itemMap.values()) {
      ordered.push(item)
    }

    return ordered
  } catch {
    return items
  }
}

// Save order to localStorage
function saveOrder(items: Item[]): void {
  const order = items.map(item => item.title)
  localStorage.setItem(SIDEBAR_ORDER_KEY, JSON.stringify(order))
}

// Sortable item component
interface SortableItemProps {
  item: Item
  isActive: boolean
  onClose?: () => void
  wasDragging: React.MutableRefObject<boolean>
  isAnyDragging: boolean // True when any item is being dragged
}

function SortableItem({ item, isActive, onClose, wasDragging, isAnyDragging }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isThisDragging,
  } = useSortable({ id: item.title })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isThisDragging ? 0.5 : 1,
    zIndex: isThisDragging ? 1 : 0,
  }

  // Handle click - prevent navigation if we just finished dragging
  const handleClick = (e: React.MouseEvent) => {
    if (wasDragging.current) {
      e.preventDefault()
      e.stopPropagation()
      return
    }
    onClose?.()
  }

  return (
    <Box ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <RouterLink
        to={item.path}
        onClick={handleClick}
        style={{ pointerEvents: isAnyDragging ? "none" : "auto" }}
      >
        <Flex
          gap={3}
          px={3}
          py={3}
          mx={1}
          borderRadius="md"
          transition="all 0.2s"
          _hover={{
            bg: isActive ? "dark.accent.hover" : "dark.bg.hover",
            color: isActive ? "dark.bg.primary" : "text.primary",
          }}
          alignItems="center"
          fontSize="sm"
          color={isActive ? "dark.bg.primary" : "text.secondary"}
          borderLeft="3px solid"
          bg={isActive ? "dark.accent.primary" : "transparent"}
          fontWeight={isActive ? "bold" : "normal"}
          borderColor={isActive ? "dark.accent.primary" : "transparent"}
          cursor={isThisDragging ? "grabbing" : "pointer"}
        >
          <Icon as={item.icon} alignSelf="center" boxSize={4} />
          <Text>{item.title}</Text>
        </Flex>
      </RouterLink>
    </Box>
  )
}

const SidebarItems = ({ onClose }: SidebarItemsProps) => {
  const queryClient = useQueryClient()
  const currentUser = queryClient.getQueryData<UserPublic>(["currentUser"])
  const matchRoute = useMatchRoute()

  // Track if a drag is currently in progress (disables pointer events on links)
  const [isDragging, setIsDragging] = useState(false)
  // Track if a drag just ended (to prevent click on the dragged item)
  const wasDragging = useRef(false)

  // Build full items list (including Admin for superusers)
  const allItems: Item[] = currentUser?.is_superuser
    ? [...defaultItems, { icon: FiUsers, title: "Admin", path: "/admin" }]
    : defaultItems

  // State for ordered items
  const [orderedItems, setOrderedItems] = useState<Item[]>(() => getOrderedItems(allItems))

  // Update ordered items when allItems changes (e.g., user becomes superuser)
  useEffect(() => {
    setOrderedItems(getOrderedItems(allItems))
  }, [currentUser?.is_superuser])

  // Sensors for drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px movement before starting drag (allows clicks)
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Handle drag start - disable pointer events on all links
  function handleDragStart() {
    setIsDragging(true)
    wasDragging.current = true
  }

  // Handle drag end
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event

    if (over && active.id !== over.id) {
      setOrderedItems((items) => {
        const oldIndex = items.findIndex((item) => item.title === active.id)
        const newIndex = items.findIndex((item) => item.title === over.id)
        const newItems = arrayMove(items, oldIndex, newIndex)
        saveOrder(newItems)
        return newItems
      })
    }

    // Re-enable pointer events after a brief delay
    setTimeout(() => {
      setIsDragging(false)
      wasDragging.current = false
    }, 50)
  }

  return (
    <>
      <Text
        fontSize="xs"
        px={4}
        py={3}
        fontWeight="bold"
        color="text.muted"
        textTransform="uppercase"
        letterSpacing="wider"
      >
        Menu
      </Text>
      <Box mt={2}>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={orderedItems.map(item => item.title)}
            strategy={verticalListSortingStrategy}
          >
            {orderedItems.map((item) => (
              <SortableItem
                key={item.title}
                item={item}
                isActive={!!matchRoute({ to: item.path })}
                onClose={onClose}
                wasDragging={wasDragging}
                isAnyDragging={isDragging}
              />
            ))}
          </SortableContext>
        </DndContext>
      </Box>
    </>
  )
}

export default SidebarItems
