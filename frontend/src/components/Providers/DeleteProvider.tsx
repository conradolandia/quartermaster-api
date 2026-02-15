import {
  Alert,
  Button,
  ButtonGroup,
  DialogActionTrigger,
  Text,
  VStack,
} from "@chakra-ui/react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { FaTrash } from "react-icons/fa"

import { type ApiError, type ProviderPublic, ProvidersService } from "@/client"
import useCustomToast from "@/hooks/useCustomToast"
import { getApiErrorMessage, handleError } from "@/utils"
import {
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog"

interface DeleteProviderProps {
  provider: ProviderPublic
}

const DeleteProvider = ({ provider }: DeleteProviderProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const queryClient = useQueryClient()
  const { showSuccessToast } = useCustomToast()

  const mutation = useMutation({
    mutationFn: () =>
      ProvidersService.deleteProvider({
        providerId: provider.id,
      }),
    onSuccess: () => {
      showSuccessToast("Provider deleted successfully.")
      setIsOpen(false)
      setErrorMessage(null)
    },
    onError: (err: ApiError) => {
      setErrorMessage(getApiErrorMessage(err))
      handleError(err)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["providers"] })
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
          <FaTrash fontSize="16px" />
          Delete
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Provider</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <VStack gap={4} align="flex-start">
            <Text>Are you sure you want to delete {provider.name}?</Text>
            <Text>This action cannot be undone.</Text>
            <Text fontSize="sm" color="red.500">
              Note: You cannot delete a provider if any boats are associated
              with it.
            </Text>
            {errorMessage && (
              <Alert.Root status="error">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Title>Unable to delete provider</Alert.Title>
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

export default DeleteProvider
