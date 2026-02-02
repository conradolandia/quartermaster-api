import {
  Button,
  ButtonGroup,
  DialogActionTrigger,
  Text,
  VStack,
} from "@chakra-ui/react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { FaTrash } from "react-icons/fa"

import {
  type ApiError,
  type JurisdictionPublic,
  JurisdictionsService,
} from "@/client"
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"
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

interface DeleteJurisdictionProps {
  jurisdiction: JurisdictionPublic
}

const DeleteJurisdiction = ({ jurisdiction }: DeleteJurisdictionProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const queryClient = useQueryClient()
  const { showSuccessToast } = useCustomToast()

  const mutation = useMutation({
    mutationFn: () =>
      JurisdictionsService.deleteJurisdiction({
        jurisdictionId: jurisdiction.id,
      }),
    onSuccess: () => {
      showSuccessToast("Jurisdiction deleted successfully.")
      setIsOpen(false)
    },
    onError: (err: ApiError) => {
      handleError(err)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["jurisdictions"] })
    },
  })

  const handleDelete = () => {
    mutation.mutate()
  }

  return (
    <DialogRoot
      size={{ base: "xs", md: "md" }}
      placement="center"
      open={isOpen}
      onOpenChange={({ open }) => setIsOpen(open)}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" color="status.error">
          <FaTrash fontSize="16px" />
          Delete
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Jurisdiction</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <VStack gap={4} align="flex-start">
            <Text>Are you sure you want to delete {jurisdiction.name}?</Text>
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
              colorScheme="red"
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

export default DeleteJurisdiction
