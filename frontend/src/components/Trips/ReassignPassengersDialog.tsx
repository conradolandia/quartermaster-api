import { NativeSelect } from "@/components/ui/native-select"
import { Button, Flex, Text, VStack } from "@chakra-ui/react"

import {
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field } from "@/components/ui/field"

export interface ReassignSource {
  boat_id: string
  boatName: string
  used: number
}

interface ReassignPassengersDialogProps {
  reassignFrom: ReassignSource | null
  reassignToBoatId: string
  reassignTypeMapping: Record<string, string>
  isSubmitting: boolean
  canSubmit: boolean
  tripBoats: any[]
  boatsMap: Map<string, any>
  onClose: () => void
  onTargetBoatChange: (boatId: string) => void
  onTypeMappingChange: (mapping: Record<string, string>) => void
  onConfirm: () => void
}

const ReassignPassengersDialog = ({
  reassignFrom,
  reassignToBoatId,
  reassignTypeMapping,
  isSubmitting,
  canSubmit,
  tripBoats,
  boatsMap,
  onClose,
  onTargetBoatChange,
  onTypeMappingChange,
  onConfirm,
}: ReassignPassengersDialogProps) => {
  return (
    <DialogRoot
      size="xs"
      placement="center"
      open={reassignFrom != null}
      onOpenChange={({ open }) => {
        if (!open) onClose()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reassign passengers</DialogTitle>
        </DialogHeader>
        <DialogBody>
          {reassignFrom &&
            (() => {
              const from = reassignFrom
              const fromBoat = tripBoats.find(
                (tb) => tb.boat_id === from.boat_id,
              )
              const used: Record<string, number> =
                fromBoat && "used_per_ticket_type" in fromBoat
                  ? ((
                      fromBoat as {
                        used_per_ticket_type?: Record<string, number>
                      }
                    ).used_per_ticket_type ?? {})
                  : {}
              const sourceTypesWithQty = Object.entries(used).filter(
                ([, qty]) => qty > 0,
              )
              const toBoat = tripBoats.find(
                (tb) => tb.boat_id === reassignToBoatId,
              )
              const targetTypes: string[] =
                toBoat &&
                "pricing" in toBoat &&
                Array.isArray(
                  (toBoat as { pricing?: { ticket_type: string }[] }).pricing,
                )
                  ? (
                      (
                        toBoat as {
                          pricing: { ticket_type: string }[]
                        }
                      ).pricing ?? []
                    ).map((p) => p.ticket_type)
                  : []
              return (
                <VStack align="stretch" gap={4}>
                  <Text>
                    Move {from.used} passenger(s) from{" "}
                    <strong>{from.boatName}</strong> to:
                  </Text>
                  <Field label="Target boat" required>
                    <NativeSelect
                      value={reassignToBoatId}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                        onTargetBoatChange(e.target.value)
                      }
                      disabled={isSubmitting}
                    >
                      <option value="">Select a boat</option>
                      {tripBoats
                        .filter((tb) => tb.boat_id !== from.boat_id)
                        .map((tb) => {
                          const b = boatsMap.get(tb.boat_id)
                          const rem =
                            "remaining_capacity" in tb
                              ? (tb as { remaining_capacity: number })
                                  .remaining_capacity
                              : null
                          return (
                            <option key={tb.boat_id} value={tb.boat_id}>
                              {b?.name || "Unknown"}
                              {rem != null ? ` (${rem} spots left)` : ""}
                            </option>
                          )
                        })}
                    </NativeSelect>
                  </Field>
                  {reassignToBoatId &&
                    sourceTypesWithQty.length > 0 &&
                    targetTypes.length > 0 && (
                      <Field
                        label="Map ticket types"
                        helperText="Map each source boat ticket type to the target boat type it becomes."
                      >
                        <VStack align="stretch" gap={2}>
                          {sourceTypesWithQty.map(([srcType, qty]) => (
                            <Flex
                              key={srcType}
                              gap={2}
                              align="center"
                              wrap="wrap"
                            >
                              <Text fontSize="sm" flex="0 0 auto">
                                {qty} × {srcType}
                              </Text>
                              <Text fontSize="sm" flex="0 0 auto">
                                →
                              </Text>
                              <NativeSelect
                                size="sm"
                                value={reassignTypeMapping[srcType] ?? ""}
                                onChange={(
                                  e: React.ChangeEvent<HTMLSelectElement>,
                                ) =>
                                  onTypeMappingChange({
                                    ...reassignTypeMapping,
                                    [srcType]: e.target.value,
                                  })
                                }
                                disabled={isSubmitting}
                                style={{ minWidth: "10rem" }}
                              >
                                <option value="">Select type</option>
                                {targetTypes.map((tt) => (
                                  <option key={tt} value={tt}>
                                    {tt}
                                  </option>
                                ))}
                              </NativeSelect>
                            </Flex>
                          ))}
                        </VStack>
                      </Field>
                    )}
                </VStack>
              )
            })()}
        </DialogBody>
        <DialogFooter gap={2}>
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            colorScheme="blue"
            onClick={onConfirm}
            loading={isSubmitting}
            disabled={!canSubmit}
          >
            Move passengers
          </Button>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  )
}

export default ReassignPassengersDialog
