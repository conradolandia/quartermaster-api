import { useState } from "react"
import {
  FiCode,
  FiCopy,
  FiEdit,
  FiPrinter,
  FiCalendar,
  FiTrash2,
  FiXCircle,
} from "react-icons/fi"

import { BookingsService, type BookingPublic } from "../../client"
import { MenuItem } from "../ui/menu"
import { ActionsMenu } from "../ui/actions-menu"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Button } from "@chakra-ui/react"
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"
import DeleteBooking from "../Bookings/DeleteBooking"
import EditBooking from "../Bookings/EditBooking"
import PermanentDeleteBooking from "../Bookings/PermanentDeleteBooking"
import RescheduleBooking from "../Bookings/RescheduleBooking"

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
  /** When provided, called after a permanent delete (e.g. navigate away from detail page). */
  onPermanentDeleteSuccess?: () => void
}

const BookingActionsMenu = ({
  booking,
  disabled,
  onPrint,
  editModalOpen: controlledEditOpen,
  onEditModalOpenChange,
  onOpenRawData,
  editDisabled = false,
  onPermanentDeleteSuccess,
}: BookingActionsMenuProps) => {
  const [internalEditOpen, setInternalEditOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [permanentDeleteModalOpen, setPermanentDeleteModalOpen] =
    useState(false)
  const [rescheduleModalOpen, setRescheduleModalOpen] = useState(false)
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
          <MenuItem value="print" onClick={onPrint} asChild>
            <Button
              variant="ghost"
              size="sm"
              color="dark.accent.primary"
              justifyContent="start"
              w="full"
            >
              <FiPrinter fontSize="16px" />
              Print
            </Button>
          </MenuItem>
        )}
        {onOpenRawData && (
          <MenuItem value="raw-data" onClick={onOpenRawData} asChild>
            <Button
              variant="ghost"
              size="sm"
              color="dark.accent.primary"
              justifyContent="start"
              w="full"
            >
              <FiCode fontSize="16px" />
              Raw data
            </Button>
          </MenuItem>
        )}
        {!isEditControlled && !editDisabled && (
          <MenuItem value="edit" onClick={handleOpenEdit} asChild>
            <Button
              variant="ghost"
              size="sm"
              color="dark.accent.primary"
              justifyContent="start"
              w="full"
            >
              <FiEdit fontSize="16px" />
              Edit Booking
            </Button>
          </MenuItem>
        )}
        {!editDisabled && (
          <MenuItem
            value="reschedule"
            onClick={() => setRescheduleModalOpen(true)}
            asChild
          >
            <Button
              variant="ghost"
              size="sm"
              color="dark.accent.primary"
              justifyContent="start"
              w="full"
            >
              <FiCalendar fontSize="16px" />
              Reschedule
            </Button>
          </MenuItem>
        )}
        <MenuItem
          value="duplicate"
          onClick={() => duplicateMutation.mutate()}
          disabled={duplicateMutation.isPending}
          asChild
        >
          <Button
            variant="ghost"
            size="sm"
            color="dark.accent.primary"
            justifyContent="start"
            w="full"
            disabled={duplicateMutation.isPending}
          >
            <FiCopy fontSize="16px" />
            Duplicate
          </Button>
        </MenuItem>
        <MenuItem
          value="cancel"
          onClick={() => setDeleteModalOpen(true)}
          asChild
        >
          <Button
            variant="ghost"
            size="sm"
            color="status.error"
            justifyContent="start"
            w="full"
          >
            <FiTrash2 fontSize="16px" />
            Cancel Booking
          </Button>
        </MenuItem>
        <MenuItem
          value="delete"
          onClick={() => setPermanentDeleteModalOpen(true)}
          asChild
        >
          <Button
            variant="ghost"
            size="sm"
            color="status.error"
            justifyContent="start"
            w="full"
          >
            <FiXCircle fontSize="16px" />
            Delete
          </Button>
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
      <PermanentDeleteBooking
        booking={booking}
        isOpen={permanentDeleteModalOpen}
        onClose={() => setPermanentDeleteModalOpen(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["bookings"] })
          queryClient.invalidateQueries({
            queryKey: ["booking", booking.confirmation_code],
          })
          onPermanentDeleteSuccess?.()
        }}
      />
      <RescheduleBooking
        booking={booking}
        isOpen={rescheduleModalOpen}
        onClose={() => setRescheduleModalOpen(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["bookings"] })
          queryClient.invalidateQueries({
            queryKey: ["booking", booking.confirmation_code],
          })
        }}
      />
    </>
  )
}

export default BookingActionsMenu
