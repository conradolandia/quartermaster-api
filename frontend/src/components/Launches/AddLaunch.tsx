import { useRef, useState } from "react"
import { Button, Input, VStack, Portal } from "@chakra-ui/react"
import { useMutation, useQueryClient } from "@tanstack/react-query"

import {
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
} from "../ui/dialog"

import { Field } from "../ui/field"
import { LaunchesService, type LaunchCreate } from "@/client"
import useCustomToast from "@/hooks/useCustomToast"
import { LocationDropdown } from "./LocationDropdown"

// Props interface
interface AddLaunchProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export const AddLaunch = ({
  isOpen,
  onClose,
  onSuccess,
}: AddLaunchProps) => {
  const [name, setName] = useState("")
  const [launchTimestamp, setLaunchTimestamp] = useState("")
  const [summary, setSummary] = useState("")
  const [locationId, setLocationId] = useState("")
  const { showSuccessToast, showErrorToast } = useCustomToast()
  const queryClient = useQueryClient()
  const contentRef = useRef(null)

  // Use mutation for creating launch
  const mutation = useMutation({
    mutationFn: (data: LaunchCreate) =>
      LaunchesService.createLaunch({ requestBody: data }),
    onSuccess: () => {
      showSuccessToast("Launch was successfully added")
      setName("")
      setLaunchTimestamp("")
      setSummary("")
      setLocationId("")
      queryClient.invalidateQueries({ queryKey: ["launches"] })
      onSuccess()
      onClose()
    },
    onError: (error: any) => {
      console.error("Error adding launch:", error)
      showErrorToast(
        error.response?.data?.detail ||
          "An error occurred while adding the launch"
      )
    },
  })

  const handleSubmit = async () => {
    if (!name || !launchTimestamp || !summary || !locationId) return

    mutation.mutate({
      name,
      launch_timestamp: new Date(launchTimestamp).toISOString(),
      summary,
      location_id: locationId,
    })
  }

  return (
    <DialogRoot
      size={{ base: "xs", md: "md" }}
      placement="center"
      open={isOpen}
      onOpenChange={({ open }) => !open && onClose()}
    >
      <Portal>
        <DialogContent ref={contentRef}>
          <DialogHeader>
            <DialogTitle>Add Launch</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <VStack gap={4}>
              <Field label="Name" required>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Launch name"
                />
              </Field>
              <Field label="Launch Date & Time" required>
                <Input
                  id="launch_timestamp"
                  type="datetime-local"
                  value={launchTimestamp}
                  onChange={(e) => setLaunchTimestamp(e.target.value)}
                  placeholder="Launch date and time"
                />
              </Field>
              <Field label="Summary" required>
                <Input
                  id="summary"
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="Launch summary"
                />
              </Field>
              <Field label="Location" required>
                <LocationDropdown
                  id="location_id"
                  value={locationId}
                  onChange={setLocationId}
                  isDisabled={mutation.isPending}
                  portalRef={contentRef}
                />
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
              disabled={!name || !launchTimestamp || !summary || !locationId || mutation.isPending}
            >
              Add
            </Button>
          </DialogFooter>
          <DialogCloseTrigger />
        </DialogContent>
      </Portal>
    </DialogRoot>
  )
}

export default AddLaunch
