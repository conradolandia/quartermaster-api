import { useState } from "react"
import { Button, ButtonGroup, Text, VStack } from "@chakra-ui/react"
import { FiTrash2 } from "react-icons/fi"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import {
  DialogActionTrigger,
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { type ApiError, TripsService } from "@/client"
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"

interface DeleteTripProps {
  id: string
  type: string
}

const DeleteTrip = ({ id, type }: DeleteTripProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const queryClient = useQueryClient()
  const { showSuccessToast } = useCustomToast()

  const mutation = useMutation({
    mutationFn: () =>
      TripsService.deleteTrip({
        tripId: id,
      }),
    onSuccess: () => {
      showSuccessToast("Trip deleted successfully.")
      setIsOpen(false)
    },
    onError: (err: ApiError) => {
      handleError(err)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["trips"] })
    },
  })

  const handleDelete = () => {
    mutation.mutate()
  }

  const tripTypeText = type === "launch_viewing" ? "Launch Viewing" : "Pre-Launch"

  return (
    <DialogRoot
      size={{ base: "xs", md: "md" }}
      placement="center"
      role="alertdialog"
      open={isOpen}
      onOpenChange={({ open }) => setIsOpen(open)}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" colorPalette="red">
          <FiTrash2 fontSize="16px" />
          Delete Trip
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Trip</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <VStack gap={4} align="flex-start">
            <Text>
              {tripTypeText} trip will be permanently deleted. Are you sure?
            </Text>
            <Text>This action cannot be undone.</Text>
          </VStack>
        </DialogBody>

        <DialogFooter gap={2}>
          <ButtonGroup>
            <DialogActionTrigger asChild>
              <Button
                variant="subtle"
                colorPalette="gray"
                disabled={mutation.isPending}
              >
                Cancel
              </Button>
            </DialogActionTrigger>
            <Button
              variant="solid"
              colorPalette="red"
              onClick={handleDelete}
              loading={mutation.isPending}
            >
              Delete
            </Button>
          </ButtonGroup>
        </DialogFooter>
        <DialogCloseTrigger />
      </DialogContent>
    </DialogRoot>
  )
}

export default DeleteTrip
