import { useState } from "react"
import { FiCode, FiCopy, FiEdit, FiPrinter, FiTrash2 } from "react-icons/fi"

import { BookingsService, type BookingPublic } from "../../client"
import { MenuItem } from "../ui/menu"
import { ActionsMenu } from "../ui/actions-menu"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"
import DeleteBooking from "../Bookings/DeleteBooking"
import EditBooking from "../Bookings/EditBooking"

interface BookingActionsMenuProps {
  booking: BookingPublic
  disabled?: boolean
  /** When provided, shows a Print item in the menu that calls this. */
  onPrint?: () => void
  /** When provided, Edit is shown as external button; menu uses this controlled state for the edit modal. */
  editModalOpen?: boolean
  onEditModalOpenChange?: (open: boolean) => void
  /** When provided, shows a Raw data item in the menu that calls this. */
  onOpenRawData?: () => void
  /** When true, Edit is hidden (e.g. checked-in bookings cannot be edited). */
  editDisabled?: boolean
}

const BookingActionsMenu = ({
  booking,
  disabled,
  onPrint,
  editModalOpen: controlledEditOpen,
  onEditModalOpenChange,
  onOpenRawData,
  editDisabled = false,
}: BookingActionsMenuProps) => {
  const [internalEditOpen, setInternalEditOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [editingBooking, setEditingBooking] = useState<BookingPublic | null>(
    null,
  )

  const isEditControlled = controlledEditOpen !== undefined && onEditModalOpenChange != null
  const editModalOpen = isEditControlled ? controlledEditOpen : internalEditOpen
  const setEditModalOpen = isEditControlled ? onEditModalOpenChange : setInternalEditOpen
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
      <ActionsMenu ariaLabel="Booking actions" disabled={disabled}>
          {onPrint && (
            <MenuItem value="print" onClick={onPrint}>
              <FiPrinter />
              Print
            </MenuItem>
          )}
          {onOpenRawData && (
            <MenuItem value="raw-data" onClick={onOpenRawData}>
              <FiCode />
              Raw data
            </MenuItem>
          )}
          {!isEditControlled && !editDisabled && (
            <MenuItem value="edit" onClick={handleOpenEdit}>
              <FiEdit />
              Edit Booking
            </MenuItem>
          )}
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
      </ActionsMenu>
      <EditBooking
        booking={editingBooking ?? booking}
        isOpen={editModalOpen}
        onClose={handleCloseEdit}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["bookings"] })
          queryClient.invalidateQueries({
            queryKey: ["booking", booking.confirmation_code],
          })
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
