import { useState } from "react"
import { FiEdit, FiTrash2 } from "react-icons/fi"

import type { BookingPublic } from "@/client"
import {
  MenuContent,
  MenuItem,
  MenuRoot,
  MenuTrigger,
} from "@/components/ui/menu"
import { IconButton } from "@chakra-ui/react"
import EditBooking from "../Bookings/EditBooking"
import DeleteBooking from "../Bookings/DeleteBooking"

interface BookingActionsMenuProps {
  booking: BookingPublic
  disabled?: boolean
}

const BookingActionsMenu = ({ booking, disabled }: BookingActionsMenuProps) => {
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)

  return (
    <>
      <MenuRoot>
        <MenuTrigger asChild>
          <IconButton
            aria-label="Action Menu"
            variant="ghost"
            size="sm"
            disabled={disabled}
          >
            ⋯
          </IconButton>
        </MenuTrigger>
        <MenuContent>
          <MenuItem value="edit" onClick={() => setEditModalOpen(true)}>
            <FiEdit />
            Edit Booking
          </MenuItem>
          <MenuItem
            value="cancel"
            onClick={() => setDeleteModalOpen(true)}
            color="status.error"
          >
            <FiTrash2 />
            Cancel Booking
          </MenuItem>
        </MenuContent>
      </MenuRoot>
      <EditBooking
        booking={booking}
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        onSuccess={() => {
          // This will trigger a refetch via the mutation's onSettled
        }}
      />
      <DeleteBooking
        booking={booking}
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onSuccess={() => {
          // This will trigger a refetch via the mutation's onSettled
        }}
      />
    </>
  )
}

export default BookingActionsMenu
