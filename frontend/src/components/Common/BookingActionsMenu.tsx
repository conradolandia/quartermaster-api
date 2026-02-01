import { useState } from "react"
import { FiCopy, FiEdit, FiTrash2 } from "react-icons/fi"

import { BookingsService, type BookingPublic } from "@/client"
import {
  MenuContent,
  MenuItem,
  MenuRoot,
  MenuTrigger,
} from "@/components/ui/menu"
import { IconButton } from "@chakra-ui/react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"
import DeleteBooking from "../Bookings/DeleteBooking"
import EditBooking from "../Bookings/EditBooking"

interface BookingActionsMenuProps {
  booking: BookingPublic
  disabled?: boolean
}

const BookingActionsMenu = ({ booking, disabled }: BookingActionsMenuProps) => {
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [editingBooking, setEditingBooking] = useState<BookingPublic | null>(
    null,
  )
  const queryClient = useQueryClient()
  const { showSuccessToast } = useCustomToast()

  const duplicateMutation = useMutation({
    mutationFn: () =>
      BookingsService.duplicateBooking({ bookingId: booking.id }),
    onSuccess: (duplicated) => {
      setEditingBooking(duplicated)
      setEditModalOpen(true)
      showSuccessToast("Booking duplicated. Edit the new draft below.")
    },
    onError: handleError,
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["bookings"] })
    },
  })

  const handleOpenEdit = () => {
    setEditingBooking(null)
    setEditModalOpen(true)
  }

  const handleCloseEdit = () => {
    setEditModalOpen(false)
    setEditingBooking(null)
  }

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
          <MenuItem value="edit" onClick={handleOpenEdit}>
            <FiEdit />
            Edit Booking
          </MenuItem>
          <MenuItem
            value="duplicate"
            onClick={() => duplicateMutation.mutate()}
            disabled={duplicateMutation.isPending}
          >
            <FiCopy />
            Duplicate
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
        booking={editingBooking ?? booking}
        isOpen={editModalOpen}
        onClose={handleCloseEdit}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["bookings"] })
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
