import { Box, Button, Flex, Input, Text, VStack } from "@chakra-ui/react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useRef, useState } from "react"

import { LaunchesService, MissionsService } from "@/client"
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
  const [refundCutoffHours, setRefundCutoffHours] = useState(12)
  const { showSuccessToast } = useCustomToast()
  const queryClient = useQueryClient()
  const contentRef = useRef(null)

  useQuery({
    queryKey: ["launch-for-add-mission", launchId],
    queryFn: () => LaunchesService.readLaunch({ launchId }),
    enabled: !!launchId && isOpen,
  })

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
                  <Switch checked={active} inputProps={{ id: "active" }} />
                </Box>
              </Flex>
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
