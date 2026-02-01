import { Button, DialogTitle, Text } from "@chakra-ui/react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { FiTrash2 } from "react-icons/fi"

import { MerchandiseService } from "@/client"
import useCustomToast from "@/hooks/useCustomToast"
import {
  DialogActionTrigger,
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTrigger,
} from "../ui/dialog"

const DeleteMerchandise = ({ id }: { id: string }) => {
  const [isOpen, setIsOpen] = useState(false)
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()
  const {
    handleSubmit,
    formState: { isSubmitting },
  } = useForm()

  const deleteMerchandise = async (merchandiseId: string) => {
    await MerchandiseService.deleteMerchandise({ merchandiseId })
  }

  const mutation = useMutation({
    mutationFn: deleteMerchandise,
    onSuccess: () => {
      showSuccessToast("The merchandise item was deleted successfully")
      setIsOpen(false)
    },
    onError: () => {
      showErrorToast(
        "An error occurred while deleting. The item may still be used on a trip.",
      )
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["merchandise"] })
    },
  })

  const onSubmit = async () => {
    mutation.mutate(id)
  }

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
          Delete
        </Button>
      </DialogTrigger>

      <DialogContent>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogCloseTrigger />
          <DialogHeader>
            <DialogTitle>Delete Merchandise</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <Text mb={4}>
              This merchandise item will be permanently deleted. It can only be
              deleted if it is not used on any trip. Are you sure?
            </Text>
          </DialogBody>

          <DialogFooter gap={2}>
            <DialogActionTrigger asChild>
              <Button
                variant="subtle"
                colorPalette="gray"
                disabled={isSubmitting}
              >
                Cancel
              </Button>
            </DialogActionTrigger>
            <Button
              variant="solid"
              colorPalette="red"
              type="submit"
              loading={isSubmitting}
            >
              Delete
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </DialogRoot>
  )
}

export default DeleteMerchandise
