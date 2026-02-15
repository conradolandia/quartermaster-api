import { type ApiError, type BookingPublic, BookingsService } from "@/client"
import {
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
} from "@/components/ui/dialog"
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"
import {
  Button,
  ButtonGroup,
  DialogActionTrigger,
  Text,
} from "@chakra-ui/react"
import { useMutation, useQueryClient } from "@tanstack/react-query"

interface PermanentDeleteBookingProps {
  booking: BookingPublic
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

export default function PermanentDeleteBooking({
  booking,
  isOpen,
  onClose,
  onSuccess,
}: PermanentDeleteBookingProps) {
  const queryClient = useQueryClient()
  const { showSuccessToast } = useCustomToast()

  const mutation = useMutation({
    mutationFn: () =>
      BookingsService.deleteBooking({
        bookingId: booking.id,
      }),
    onSuccess: () => {
      showSuccessToast("Booking deleted permanently.")
      onClose()
      onSuccess?.()
    },
    onError: (err: ApiError) => {
      handleError(err)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["bookings"] })
      queryClient.invalidateQueries({
        queryKey: ["booking", booking.confirmation_code],
      })
    },
  })

  return (
    <DialogRoot
      size={{ base: "xs", md: "md" }}
      placement="center"
      open={isOpen}
      onOpenChange={({ open }) => !open && onClose()}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete booking permanently</DialogTitle>
        </DialogHeader>
        <DialogCloseTrigger />
        <DialogBody>
          <Text>
            Permanently delete the booking for{" "}
            <Text as="span" fontWeight="bold">
              {[booking.first_name, booking.last_name].filter(Boolean).join(" ")}
            </Text>{" "}
            (Confirmation: {booking.confirmation_code})?
          </Text>
          <Text mt={2} fontSize="sm" color="status.error">
            This removes the booking and all its items from the system. This
            action cannot be undone.
          </Text>
        </DialogBody>
        <DialogFooter>
          <ButtonGroup>
            <DialogActionTrigger asChild>
              <Button variant="outline">Cancel</Button>
            </DialogActionTrigger>
            <Button
              variant="solid"
              colorPalette="red"
              onClick={() => mutation.mutate()}
              loading={mutation.isPending}
              disabled={mutation.isPending}
            >
              {mutation.isPending ? "Deleting..." : "Delete permanently"}
            </Button>
          </ButtonGroup>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  )
}
