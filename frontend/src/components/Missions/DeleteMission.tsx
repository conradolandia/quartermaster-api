import { Button, Text } from "@chakra-ui/react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { FiTrash2 } from "react-icons/fi"

import { MissionsService } from "@/client"
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"
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
} from "../ui/dialog"

const DeleteMission = ({ id, name }: { id: string; name: string }) => {
  const [isOpen, setIsOpen] = useState(false)
  const queryClient = useQueryClient()
  const { showSuccessToast } = useCustomToast()
  const {
    handleSubmit,
    formState: { isSubmitting },
  } = useForm()

  const mutation = useMutation({
    mutationFn: () => MissionsService.deleteMission({ missionId: id }),
    onSuccess: () => {
      showSuccessToast("Mission deleted successfully.")
      setIsOpen(false)
    },
    onError: (err: any) => {
      handleError(err)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["missions"] })
    },
  })

  const onSubmit = async () => {
    mutation.mutate()
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
        <Button variant="ghost" size="sm" color="status.error">
          <FiTrash2 fontSize="16px" />
          Delete Mission
        </Button>
      </DialogTrigger>

      <DialogContent>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogCloseTrigger />
          <DialogHeader>
            <DialogTitle>Delete Mission</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <Text mb={4}>
              Mission "{name}" will be permanently deleted. Are you sure? You
              will not be able to undo this action.
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

export default DeleteMission
