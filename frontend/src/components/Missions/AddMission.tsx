import {
  Box,
  Button,
  createListCollection,
  Flex,
  Input,
  Portal,
  Select,
  Text,
  VStack,
} from "@chakra-ui/react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useRef, useState } from "react"

import { MissionsService } from "@/client"
import { Switch } from "../ui/switch"

import {
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
} from "../ui/dialog"

import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"
import { Field } from "../ui/field"
import { LaunchDropdown } from "./LaunchDropdown"

const bookingModeOptions = createListCollection({
  items: [
    { label: "Private (Admin Only)", value: "private" },
    { label: "Early Bird (Access Code Required)", value: "early_bird" },
    { label: "Public (Open to All)", value: "public" },
  ],
})

// Props interface
interface AddMissionProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export const AddMission = ({ isOpen, onClose, onSuccess }: AddMissionProps) => {
  const [name, setName] = useState("")
  const [launchId, setLaunchId] = useState("")
  const [active, setActive] = useState(true)
  const [bookingMode, setBookingMode] = useState("private")
  const [salesOpenAt, setSalesOpenAt] = useState("")
  const [refundCutoffHours, setRefundCutoffHours] = useState(12)
  const { showSuccessToast } = useCustomToast()
  const queryClient = useQueryClient()
  const contentRef = useRef(null)

  // Use mutation for creating mission
  const mutation = useMutation({
    mutationFn: (data: any) =>
      MissionsService.createMission({
        requestBody: data,
      }),
    onSuccess: () => {
      showSuccessToast("Mission was successfully added")
      setName("")
      setLaunchId("")
      setActive(true)
      setBookingMode("private")
      setSalesOpenAt("")
      setRefundCutoffHours(12)
      queryClient.invalidateQueries({ queryKey: ["missions"] })
      onSuccess()
      onClose()
    },
    onError: (error: any) => {
      handleError(error)
    },
  })

  const handleSubmit = async () => {
    if (!name || !launchId) return

    mutation.mutate({
      name,
      launch_id: launchId,
      active,
      booking_mode: bookingMode,
      sales_open_at: salesOpenAt ? new Date(salesOpenAt).toISOString() : null,
      refund_cutoff_hours: refundCutoffHours,
    })
  }

  return (
    <DialogRoot
      size={{ base: "xs", md: "md" }}
      placement="center"
      open={isOpen}
      onOpenChange={({ open }) => !open && onClose()}
    >
      <DialogContent ref={contentRef}>
          <DialogHeader>
            <DialogTitle>Add Mission</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <VStack gap={4}>
              <Field label="Name" required>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Mission name"
                />
              </Field>
              <Field label="Launch" required>
                <LaunchDropdown
                  id="launch_id"
                  value={launchId}
                  onChange={setLaunchId}
                  disabled={mutation.isPending}
                  portalRef={contentRef}
                />
              </Field>
              <Field label="Sales Open Date & Time">
                <Input
                  id="sales_open_at"
                  type="datetime-local"
                  value={salesOpenAt}
                  onChange={(e) => setSalesOpenAt(e.target.value)}
                  placeholder="Sales open date and time"
                />
              </Field>
              <Field label="Refund Cutoff Hours" required>
                <Input
                  id="refund_cutoff_hours"
                  type="number"
                  value={refundCutoffHours}
                  onChange={(e) =>
                    setRefundCutoffHours(Number.parseInt(e.target.value))
                  }
                  placeholder="Refund cutoff hours"
                  min={0}
                  max={72}
                />
              </Field>
              <Field>
                <Flex
                  alignItems="center"
                  justifyContent="space-between"
                  width="100%"
                >
                  <Text>Active</Text>
                  <Box
                    onClick={() => {
                      setActive(!active)
                    }}
                    cursor="pointer"
                  >
                    <Switch
                      checked={active}
                      inputProps={{ id: "active" }}
                    />
                  </Box>
                </Flex>
              </Field>
              <Field
                label="Booking Mode"
                helperText="Controls who can book tickets for this mission"
              >
                <Select.Root
                  collection={bookingModeOptions}
                  value={[bookingMode]}
                  onValueChange={(details) => setBookingMode(details.value[0])}
                >
                  <Select.Control width="100%">
                    <Select.Trigger>
                      <Select.ValueText placeholder="Select booking mode" />
                    </Select.Trigger>
                    <Select.IndicatorGroup>
                      <Select.Indicator />
                    </Select.IndicatorGroup>
                  </Select.Control>
                  <Portal container={contentRef}>
                    <Select.Positioner>
                      <Select.Content>
                        {bookingModeOptions.items.map((option) => (
                          <Select.Item key={option.value} item={option}>
                            {option.label}
                            <Select.ItemIndicator />
                          </Select.Item>
                        ))}
                      </Select.Content>
                    </Select.Positioner>
                  </Portal>
                </Select.Root>
              </Field>
            </VStack>
          </DialogBody>
          <DialogFooter gap={2}>
            <Button
              variant="subtle"
              colorPalette="gray"
              onClick={onClose}
              disabled={mutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="solid"
              onClick={handleSubmit}
              loading={mutation.isPending}
              disabled={!name || !launchId || mutation.isPending}
            >
              Add
            </Button>
          </DialogFooter>
          <DialogCloseTrigger />
        </DialogContent>
    </DialogRoot>
  )
}

export default AddMission
