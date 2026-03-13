import { useState } from "react"
import {
  FiCheck,
  FiCode,
  FiCopy,
  FiDollarSign,
  FiEdit,
  FiLink,
  FiPrinter,
  FiCalendar,
  FiCornerUpLeft,
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
import { getPublicOrigin } from "@/utils/url"
import DeleteBooking from "../Bookings/DeleteBooking"
import EditBooking from "../Bookings/EditBooking"
import PermanentDeleteBooking from "../Bookings/PermanentDeleteBooking"
import RefundBooking from "../Bookings/RefundBooking"
import RescheduleBooking from "../Bookings/RescheduleBooking"
import { getRefundedCents } from "../Bookings/types"

/** Action keys that can be hidden when shown as standalone buttons (e.g. on the detail page). */
export type BookingActionHideInMenu =
  | "refund"
  | "check-in"
  | "revert-check-in"
  | "reschedule"

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
  /** Actions to hide in the menu because they are shown as standalone buttons (e.g. on the detail page). */
  hideInMenu?: BookingActionHideInMenu[]
  /** When true, disables all mutating actions except Refund. */
  archived?: boolean
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
  hideInMenu = [],
  archived = false,
}: BookingActionsMenuProps) => {
  const hide = (key: BookingActionHideInMenu) => hideInMenu.includes(key)
  const [internalEditOpen, setInternalEditOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [permanentDeleteModalOpen, setPermanentDeleteModalOpen] =
    useState(false)
  const [refundModalOpen, setRefundModalOpen] = useState(false)
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

  const checkInMutation = useMutation({
    mutationFn: () =>
      BookingsService.checkInBooking({
        confirmationCode: booking.confirmation_code,
      }),
    onSuccess: () => {
      showSuccessToast("Booking checked in successfully")
      queryClient.invalidateQueries({ queryKey: ["bookings"] })
      queryClient.invalidateQueries({
        queryKey: ["booking", booking.confirmation_code],
      })
    },
    onError: handleError,
  })

  const revertCheckInMutation = useMutation({
    mutationFn: () =>
      BookingsService.revertCheckIn({
        confirmationCode: booking.confirmation_code,
      }),
    onSuccess: () => {
      showSuccessToast("Check-in reverted; booking is confirmed again")
      queryClient.invalidateQueries({ queryKey: ["bookings"] })
      queryClient.invalidateQueries({
        queryKey: ["booking", booking.confirmation_code],
      })
    },
    onError: handleError,
  })

  const canRefund =
    booking.booking_status &&
    ["confirmed", "checked_in", "completed"].includes(
      booking.booking_status,
    ) &&
    booking.payment_status !== "refunded" &&
    getRefundedCents(booking) < (booking.total_amount ?? 0)
  const canCheckIn = booking.booking_status === "confirmed"
  const canRevertCheckIn = booking.booking_status === "checked_in"

  const handleOpenEdit = () => {
    setEditingBooking(null)
    setEditModalOpen(true)
  }

  const handleCloseEdit = () => {
    setEditModalOpen(false)
    setEditingBooking(null)
  }

  const copyLinkToClipboard = () => {
    const url = `${getPublicOrigin()}/bookings?code=${booking.confirmation_code}`
    void navigator.clipboard.writeText(url).then(() => {
      showSuccessToast("Booking link copied to clipboard")
    })
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
        {onPrint && (
          <MenuItem
            value="copy-link"
            onClick={copyLinkToClipboard}
            asChild
          >
            <Button
              variant="ghost"
              size="sm"
              color="dark.accent.primary"
              justifyContent="start"
              w="full"
            >
              <FiLink fontSize="16px" />
              Copy link
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
          <MenuItem value="edit" onClick={handleOpenEdit} disabled={archived} asChild>
            <Button
              variant="ghost"
              size="sm"
              color="dark.accent.primary"
              justifyContent="start"
              w="full"
              disabled={archived}
            >
              <FiEdit fontSize="16px" />
              Edit Booking
            </Button>
          </MenuItem>
        )}
        {!onPrint && (
          <MenuItem value="copy-link" onClick={copyLinkToClipboard} asChild>
            <Button
              variant="ghost"
              size="sm"
              color="dark.accent.primary"
              justifyContent="start"
              w="full"
            >
              <FiLink fontSize="16px" />
              Copy link
            </Button>
          </MenuItem>
        )}
        <MenuItem
          value="duplicate"
          onClick={() => duplicateMutation.mutate()}
          disabled={duplicateMutation.isPending || archived}
          asChild
        >
          <Button
            variant="ghost"
            size="sm"
            color="dark.accent.primary"
            justifyContent="start"
            w="full"
            disabled={duplicateMutation.isPending || archived}
          >
            <FiCopy fontSize="16px" />
            Duplicate
          </Button>
        </MenuItem>
        {canCheckIn && !hide("check-in") && (
          <MenuItem
            value="check-in"
            onClick={() => checkInMutation.mutate()}
            disabled={checkInMutation.isPending || archived}
            asChild
          >
            <Button
              variant="ghost"
              size="sm"
              color="dark.accent.primary"
              justifyContent="start"
              w="full"
              disabled={checkInMutation.isPending || archived}
            >
              <FiCheck fontSize="16px" />
              Check In
            </Button>
          </MenuItem>
        )}
        {canRevertCheckIn && !hide("revert-check-in") && (
          <MenuItem
            value="revert-check-in"
            onClick={() => revertCheckInMutation.mutate()}
            disabled={revertCheckInMutation.isPending || archived}
            asChild
          >
            <Button
              variant="ghost"
              size="sm"
              color="dark.accent.primary"
              justifyContent="start"
              w="full"
              disabled={revertCheckInMutation.isPending || archived}
            >
              <FiCornerUpLeft fontSize="16px" />
              Revert Check-in
            </Button>
          </MenuItem>
        )}
        {!editDisabled && !hide("reschedule") && (
          <MenuItem
            value="reschedule"
            onClick={() => setRescheduleModalOpen(true)}
            disabled={archived}
            asChild
          >
            <Button
              variant="ghost"
              size="sm"
              color="dark.accent.primary"
              justifyContent="start"
              w="full"
              disabled={archived}
            >
              <FiCalendar fontSize="16px" />
              Reschedule
            </Button>
          </MenuItem>
        )}
        {canRefund && !hide("refund") && (
          <MenuItem
            value="refund"
            onClick={() => setRefundModalOpen(true)}
            asChild
          >
            <Button
              variant="ghost"
              size="sm"
              color="dark.accent.primary"
              justifyContent="start"
              w="full"
            >
              <FiDollarSign fontSize="16px" />
              Refund
            </Button>
          </MenuItem>
        )}
        <MenuItem
          value="cancel"
          onClick={() => setDeleteModalOpen(true)}
          disabled={archived}
          asChild
        >
          <Button
            variant="ghost"
            size="sm"
            color="status.error"
            justifyContent="start"
            w="full"
            disabled={archived}
          >
            <FiTrash2 fontSize="16px" />
            Cancel Booking
          </Button>
        </MenuItem>
        <MenuItem
          value="delete"
          onClick={() => setPermanentDeleteModalOpen(true)}
          disabled={archived}
          asChild
        >
          <Button
            variant="ghost"
            size="sm"
            color="status.error"
            justifyContent="start"
            w="full"
            disabled={archived}
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
      <RefundBooking
        booking={booking}
        isOpen={refundModalOpen}
        onClose={() => setRefundModalOpen(false)}
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
