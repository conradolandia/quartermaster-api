import { type ApiError, BoatsService } from "@/client"
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
import useCustomToast from "@/hooks/useCustomToast"
import { getApiErrorMessage, handleError } from "@/utils"
import { Alert, Button, ButtonGroup, Text, VStack } from "@chakra-ui/react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { FiTrash2 } from "react-icons/fi"

interface DeleteBoatProps {
  id: string
  name: string
}

const DeleteBoat = ({ id, name }: DeleteBoatProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const queryClient = useQueryClient()
  const { showSuccessToast } = useCustomToast()

  const mutation = useMutation({
    mutationFn: () =>
      BoatsService.deleteBoat({
        boatId: id,
      }),
    onSuccess: () => {
      showSuccessToast("Boat deleted successfully.")
      setIsOpen(false)
      setErrorMessage(null)
    },
    onError: (err: ApiError) => {
      setErrorMessage(getApiErrorMessage(err))
      handleError(err)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["boats"] })
    },
  })

  const handleDelete = () => {
    setErrorMessage(null)
    mutation.mutate()
  }

  const handleOpenChange = ({ open }: { open: boolean }) => {
    setIsOpen(open)
    if (!open) setErrorMessage(null)
  }

  return (
    <DialogRoot
      size={{ base: "xs", md: "md" }}
      placement="center"
      role="alertdialog"
      open={isOpen}
      onOpenChange={handleOpenChange}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" color="status.error">
          <FiTrash2 fontSize="16px" />
          Delete
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Boat</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <VStack gap={4} align="flex-start">
            <Text>
              Boat "{name}" will be permanently deleted. Are you sure?
            </Text>
            <Text>This action cannot be undone.</Text>
            <Text fontSize="sm" color="red.500">
              Note: You cannot delete a boat if it is used on trips or in
              bookings.
            </Text>
            {errorMessage && (
              <Alert.Root status="error">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Title>Unable to delete boat</Alert.Title>
                  <Alert.Description>{errorMessage}</Alert.Description>
                </Alert.Content>
              </Alert.Root>
            )}
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

export default DeleteBoat
