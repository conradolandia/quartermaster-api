import { Button, Text } from "@chakra-ui/react"
import type { UseMutationResult } from "@tanstack/react-query"

import {
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
} from "@/components/ui/dialog"

interface RenamePricingConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  oldType: string
  newType: string | undefined
  affectedCount: number
  onConfirm: () => void
  mutation: Pick<UseMutationResult, "isPending">
}

const RenamePricingConfirmDialog = ({
  open,
  onOpenChange,
  oldType,
  newType,
  affectedCount,
  onConfirm,
  mutation,
}: RenamePricingConfirmDialogProps) => {
  return (
    <DialogRoot
      size="xs"
      placement="center"
      open={open}
      onOpenChange={({ open }) => onOpenChange(open)}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename ticket type</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <Text>
            Renaming "{oldType}" to "{newType}" will update {affectedCount}{" "}
            existing booking item(s). Continue?
          </Text>
        </DialogBody>
        <DialogFooter gap={2}>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button
            colorScheme="blue"
            onClick={onConfirm}
            loading={mutation.isPending}
          >
            Update
          </Button>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  )
}

export default RenamePricingConfirmDialog
