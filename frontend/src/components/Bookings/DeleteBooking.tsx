import {
  Button,
  ButtonGroup,
  DialogActionTrigger,
  Text,
  Portal,
} from "@chakra-ui/react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import {
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
} from "@/components/ui/dialog"
import { type ApiError, type BookingPublic, BookingsService } from "@/client"
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"

interface DeleteBookingProps {
  booking: BookingPublic
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

const DeleteBooking = ({ booking, isOpen, onClose, onSuccess }: DeleteBookingProps) => {
  const queryClient = useQueryClient()
  const { showSuccessToast } = useCustomToast()

  const mutation = useMutation({
    mutationFn: () =>
      BookingsService.updateBooking({
        bookingId: booking.id,
        requestBody: { status: "cancelled" },
      }),
    onSuccess: () => {
      showSuccessToast("Booking cancelled successfully.")
      onSuccess()
      onClose()
    },
    onError: (err: ApiError) => {
      handleError(err)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["bookings"] })
    },
  })

  return (
    <DialogRoot
      size={{ base: "xs", md: "md" }}
      placement="center"
      open={isOpen}
      onOpenChange={({ open }) => !open && onClose()}
    >
      <Portal>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Booking</DialogTitle>
          </DialogHeader>
          <DialogCloseTrigger />
          <DialogBody>
            <Text>
              Are you sure you want to cancel the booking for{" "}
              <Text as="span" fontWeight="bold">
                {booking.user_name}
              </Text>{" "}
              (Confirmation: {booking.confirmation_code})?
            </Text>
            <Text mt={2} fontSize="sm" color="gray.600">
              This action will set the booking status to "cancelled".
            </Text>
          </DialogBody>
          <DialogFooter>
            <ButtonGroup>
              <DialogActionTrigger asChild>
                <Button variant="outline">Cancel</Button>
              </DialogActionTrigger>
              <Button
                variant="solid"
                colorScheme="red"
                onClick={() => mutation.mutate()}
                loading={mutation.isPending}
                disabled={mutation.isPending}
              >
                {mutation.isPending ? "Cancelling..." : "Cancel Booking"}
              </Button>
            </ButtonGroup>
          </DialogFooter>
        </DialogContent>
      </Portal>
    </DialogRoot>
  )
}

export default DeleteBooking
