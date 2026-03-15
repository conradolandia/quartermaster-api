import { Button, Text, VStack } from "@chakra-ui/react"

import type { BookingItemPublic } from "@/client"
import { Field } from "@/components/ui/field"
import {
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
} from "@/components/ui/dialog"
import { NativeSelect } from "@/components/ui/native-select"
import { formatCents } from "@/utils"
import { getItemTypeLabel } from "./types"

export interface PendingBoatChange {
  itemId: string
  item: BookingItemPublic
  newBoatId: string
  newBoatName: string
  ticketTypeOptions: { ticket_type: string; price: number }[]
}

interface BoatChangeTypeDialogProps {
  open: boolean
  pendingBoatChange: PendingBoatChange | null
  selectedTicketType: string
  onSelectedTicketTypeChange: (value: string) => void
  onConfirm: () => void
  onClose: () => void
}

export function BoatChangeTypeDialog({
  open,
  pendingBoatChange,
  selectedTicketType,
  onSelectedTicketTypeChange,
  onConfirm,
  onClose,
}: BoatChangeTypeDialogProps) {
  return (
    <DialogRoot
      open={open}
      onOpenChange={({ open: isOpen }) => {
        if (!isOpen) onClose()
      }}
    >
      <DialogContent>
        <DialogCloseTrigger />
        <DialogHeader>
          <DialogTitle>Choose ticket type for new boat</DialogTitle>
        </DialogHeader>
        <DialogBody>
          {pendingBoatChange && (
            <VStack gap={4} align="stretch">
              <Text>
                Ticket type &quot;{getItemTypeLabel(pendingBoatChange.item.item_type)}
                &quot; is not available on boat &quot;{pendingBoatChange.newBoatName}
                &quot;. Select a ticket type for the new boat:
              </Text>
              <Field label="Ticket type">
                <NativeSelect
                  value={selectedTicketType}
                  onChange={(e) => onSelectedTicketTypeChange(e.target.value)}
                >
                  {pendingBoatChange.ticketTypeOptions.map((p) => (
                    <option key={p.ticket_type} value={p.ticket_type}>
                      {getItemTypeLabel(p.ticket_type)} (
                      ${formatCents(p.price)})
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            </VStack>
          )}
        </DialogBody>
        <DialogFooter gap={2}>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="solid"
            disabled={!selectedTicketType}
            onClick={onConfirm}
          >
            Change boat
          </Button>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  )
}
