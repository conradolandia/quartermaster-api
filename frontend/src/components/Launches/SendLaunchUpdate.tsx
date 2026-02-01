import {
  Button,
  ButtonGroup,
  DialogActionTrigger,
  Input,
  Text,
  Textarea,
  VStack,
} from "@chakra-ui/react"
import { useMutation } from "@tanstack/react-query"
import { useRef, useState } from "react"
import { FiMail } from "react-icons/fi"

import type { LaunchPublic } from "@/client"
import { Checkbox } from "@/components/ui/checkbox"
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

interface SendUpdateData {
  message: string
  priority: boolean
}

const SendLaunchUpdate = ({ launch }: SendLaunchUpdateProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const [message, setMessage] = useState("")
  const [priority, setPriority] = useState(false)
  const { showSuccessToast, showErrorToast } = useCustomToast()
  const contentRef = useRef(null)

  const sendUpdateMutation = useMutation({
    mutationFn: async (data: SendUpdateData) => {
      const response = await fetch(
        `/api/v1/launches/${launch.id}/send-update`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("access_token")}`,
          },
          body: JSON.stringify({
            message: data.message,
            priority: data.priority,
          }),
        },
      )
      if (!response.ok) {
        throw new Error("Failed to send update")
      }
      return response.json() as Promise<SendUpdateResponse>
    },
    onSuccess: (data) => {
      if (data.emails_sent > 0) {
        showSuccessToast(
          `Successfully sent launch update to ${data.emails_sent} customer(s).`,
        )
      } else {
        showSuccessToast("No customers found for this launch.")
      }
      if (data.emails_failed > 0) {
        showErrorToast(`Failed to send ${data.emails_failed} email(s).`)
      }
      setIsOpen(false)
      setMessage("")
      setPriority(false)
    },
    onError: () => {
      showErrorToast("Failed to send launch update. Please try again.")
    },
  })

  const handleSend = () => {
    if (message.trim()) {
      sendUpdateMutation.mutate({ message, priority })
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
      <DialogContent ref={contentRef}>
        <DialogHeader>
          <DialogTitle>Send Launch Update</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <Text mb={4}>
            Send an update to customers with confirmed bookings for this launch.
            {!priority &&
              " Only customers who have opted in to receive launch updates will be notified."}
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

            <Checkbox
              checked={priority}
              onCheckedChange={({ checked }) => setPriority(checked === true)}
            >
              Priority update (override customer preferences - send to all
              customers)
            </Checkbox>
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
    </DialogRoot>
  )
}

export default SendLaunchUpdate
