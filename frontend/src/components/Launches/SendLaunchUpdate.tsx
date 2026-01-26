import {
  Button,
  ButtonGroup,
  DialogActionTrigger,
  Input,
  Portal,
  Text,
  Textarea,
  VStack,
} from "@chakra-ui/react"
import { useMutation } from "@tanstack/react-query"
import { useRef, useState } from "react"
import { FiMail } from "react-icons/fi"

import type { LaunchPublic } from "@/client"
import {
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field } from "@/components/ui/field"
import useCustomToast from "@/hooks/useCustomToast"

interface SendLaunchUpdateProps {
  launch: LaunchPublic
}

interface SendUpdateResponse {
  emails_sent: number
  emails_failed: number
  recipients: string[]
}

const SendLaunchUpdate = ({ launch }: SendLaunchUpdateProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const [message, setMessage] = useState("")
  const { showSuccessToast, showErrorToast } = useCustomToast()
  const contentRef = useRef(null)

  const sendUpdateMutation = useMutation({
    mutationFn: async (updateMessage: string) => {
      const response = await fetch(
        `/api/v1/launches/${launch.id}/send-update`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("access_token")}`,
          },
          body: JSON.stringify({ message: updateMessage }),
        }
      )
      if (!response.ok) {
        throw new Error("Failed to send update")
      }
      return response.json() as Promise<SendUpdateResponse>
    },
    onSuccess: (data) => {
      if (data.emails_sent > 0) {
        showSuccessToast(
          `Successfully sent launch update to ${data.emails_sent} customer(s).`
        )
      } else {
        showSuccessToast(
          "No customers with launch update preference found for this launch."
        )
      }
      if (data.emails_failed > 0) {
        showErrorToast(`Failed to send ${data.emails_failed} email(s).`)
      }
      setIsOpen(false)
      setMessage("")
    },
    onError: () => {
      showErrorToast("Failed to send launch update. Please try again.")
    },
  })

  const handleSend = () => {
    if (message.trim()) {
      sendUpdateMutation.mutate(message)
    }
  }

  return (
    <DialogRoot
      size={{ base: "xs", md: "md" }}
      placement="center"
      open={isOpen}
      onOpenChange={({ open }) => setIsOpen(open)}
    >
      <DialogTrigger asChild>
        <Button variant="ghost">
          <FiMail fontSize="16px" />
          Send Update
        </Button>
      </DialogTrigger>
      <Portal>
        <DialogContent ref={contentRef}>
          <DialogHeader>
            <DialogTitle>Send Launch Update</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <Text mb={4}>
              Send an update to all customers with confirmed bookings for this
              launch who have opted in to receive launch updates.
            </Text>
            <VStack gap={4}>
              <Field label="Launch">
                <Input value={launch.name} disabled />
              </Field>

              <Field label="Update Message">
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Enter the update message to send to customers..."
                  rows={6}
                />
              </Field>
            </VStack>
          </DialogBody>

          <DialogFooter gap={2}>
            <ButtonGroup>
              <DialogActionTrigger asChild>
                <Button
                  variant="subtle"
                  colorPalette="gray"
                  disabled={sendUpdateMutation.isPending}
                >
                  Cancel
                </Button>
              </DialogActionTrigger>
              <Button
                variant="solid"
                onClick={handleSend}
                disabled={!message.trim()}
                loading={sendUpdateMutation.isPending}
              >
                Send Update
              </Button>
            </ButtonGroup>
          </DialogFooter>
          <DialogCloseTrigger />
        </DialogContent>
      </Portal>
    </DialogRoot>
  )
}

export default SendLaunchUpdate
