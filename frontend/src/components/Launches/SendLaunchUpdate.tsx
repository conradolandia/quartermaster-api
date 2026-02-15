import {
  Button,
  ButtonGroup,
  createListCollection,
  DialogActionTrigger,
  Input,
  Select,
  Text,
  Textarea,
  VStack,
} from "@chakra-ui/react"
import { LaunchesService } from "@/client"
import type { LaunchPublic, MissionPublic, TripPublic } from "@/client"
import { useMutation, useQuery } from "@tanstack/react-query"
import { useEffect, useRef, useState } from "react"
import { FiMail } from "react-icons/fi"
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
import { Radio, RadioGroup } from "@/components/ui/radio"
import useCustomToast from "@/hooks/useCustomToast"
import { useMissionsByLaunch } from "@/hooks/useMissionsByLaunch"
import { useTripsByMission } from "@/hooks/useTripsByMission"
import { sendLaunchUpdate } from "@/services/launchUpdateService"
import { formatTripLabel } from "@/utils"

type ScopeKind = "all" | "mission" | "trip"

export interface SendLaunchUpdateProps {
  /** Launch (for display and API). When omitted, launchId is required. */
  launch?: LaunchPublic
  /** Launch ID for API. Required when launch is not provided. */
  launchId?: string
  /** Pre-select scope when opening from mission/trip context. */
  initialScope?: ScopeKind
  /** Pre-select mission when opening from mission or trip context. */
  initialMissionId?: string | null
  /** Pre-select trip when opening from trip context. */
  initialTripId?: string | null
  /** Show the trigger button (default true). Set false when embedding in Mission/Trip menus. */
  showTrigger?: boolean
  /** Controlled open state when used without trigger. */
  isOpen?: boolean
  onOpenChange?: (open: boolean) => void
  /** Dialog title. Defaults to "Send Launch Update". */
  dialogTitle?: string
}

const SendLaunchUpdate = ({
  launch: launchProp,
  launchId: launchIdProp,
  initialScope,
  initialMissionId,
  initialTripId,
  showTrigger = true,
  isOpen: controlledOpen,
  onOpenChange,
  dialogTitle = "Send Launch Update",
}: SendLaunchUpdateProps) => {
  const [internalOpen, setInternalOpen] = useState(false)
  const isOpen = controlledOpen ?? internalOpen
  const setOpen = onOpenChange ?? setInternalOpen

  const effectiveLaunchId = launchProp?.id ?? launchIdProp ?? ""

  const { data: fetchedLaunch } = useQuery({
    queryKey: ["launch", effectiveLaunchId],
    queryFn: () => LaunchesService.readLaunch({ launchId: effectiveLaunchId }),
    enabled: isOpen && !!effectiveLaunchId && !launchProp,
  })

  const launch = launchProp ?? fetchedLaunch ?? null
  const launchName = launch?.name ?? (launchProp ? undefined : "Loading...")

  const [message, setMessage] = useState("")
  const [subject, setSubject] = useState("")
  const [priority, setPriority] = useState(false)
  const [scope, setScope] = useState<ScopeKind>(initialScope ?? "all")
  const [missionId, setMissionId] = useState<string | null>(
    initialMissionId ?? null,
  )
  const [tripId, setTripId] = useState<string | null>(initialTripId ?? null)
  const { showSuccessToast, showErrorToast } = useCustomToast()
  const contentRef = useRef(null)

  const { missions } = useMissionsByLaunch(effectiveLaunchId, isOpen)
  const { trips } = useTripsByMission(
    scope === "trip" ? missionId : null,
    isOpen && scope === "trip" && !!missionId,
  )

  useEffect(() => {
    if (isOpen) {
      setScope(initialScope ?? "all")
      setMissionId(initialMissionId ?? null)
      setTripId(initialTripId ?? null)
    } else {
      setScope(initialScope ?? "all")
      setMissionId(initialMissionId ?? null)
      setTripId(initialTripId ?? null)
    }
  }, [isOpen, initialScope, initialMissionId, initialTripId])

  useEffect(() => {
    if (scope !== "trip") setTripId(null)
    if (scope === "all") setMissionId(null)
  }, [scope])

  const sendUpdateMutation = useMutation({
    mutationFn: async (payload: {
      message: string
      subject: string
      priority: boolean
      scope: ScopeKind
      missionId: string | null
      tripId: string | null
    }) =>
      sendLaunchUpdate(effectiveLaunchId, {
        message: payload.message,
        subject: payload.subject.trim() || undefined,
        priority: payload.priority,
        missionId: payload.scope === "mission" ? payload.missionId : undefined,
        tripId: payload.scope === "trip" ? payload.tripId : undefined,
      }),
    onSuccess: (result) => {
      if (result.emails_sent > 0) {
        showSuccessToast(
          `Successfully sent launch update to ${result.emails_sent} customer(s).`,
        )
      } else {
        showSuccessToast("No customers found for this scope.")
      }
      if (result.emails_failed > 0) {
        showErrorToast(`Failed to send ${result.emails_failed} email(s).`)
      }
      setOpen(false)
      setMessage("")
      setSubject("")
      setPriority(false)
      setScope(initialScope ?? "all")
      setMissionId(initialMissionId ?? null)
      setTripId(initialTripId ?? null)
      setOpen(false)
    },
    onError: () => {
      showErrorToast("Failed to send launch update. Please try again.")
    },
  })

  const handleSend = () => {
    if (!message.trim()) return
    if (scope === "mission" && !missionId) {
      showErrorToast("Select a mission.")
      return
    }
    if (scope === "trip" && (!missionId || !tripId)) {
      showErrorToast("Select a mission and trip.")
      return
    }
    sendUpdateMutation.mutate({
      message: message.trim(),
      subject,
      priority,
      scope,
      missionId: scope === "mission" ? missionId : null,
      tripId: scope === "trip" ? tripId : null,
    })
  }

  return (
    <DialogRoot
      size={{ base: "xs", md: "md" }}
      placement="center"
      open={isOpen}
      onOpenChange={({ open }) => setOpen(open)}
    >
      {showTrigger && (
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm" color="dark.accent.primary">
            <FiMail fontSize="16px" />
            Send Update
          </Button>
        </DialogTrigger>
      )}
      <DialogContent ref={contentRef}>
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <Text mb={4}>
            Send an update to customers with confirmed bookings for this launch.
            {!priority &&
              " Only customers who have opted in to receive launch updates will be notified."}
          </Text>
          <VStack gap={4}>
            <Field label="Launch">
              <Input
                value={launchName ?? launch?.name ?? effectiveLaunchId}
                disabled
              />
            </Field>

            <Field label="Send to">
              <RadioGroup
                value={scope}
                onValueChange={(e) => {
                  const v = e.value
                  if (v != null) setScope(v as ScopeKind)
                }}
              >
                <VStack align="stretch" gap={2}>
                  <Radio value="all">All (entire launch)</Radio>
                  <Radio value="mission">Mission only</Radio>
                  <Radio value="trip">Trip only</Radio>
                </VStack>
              </RadioGroup>
            </Field>

            {scope === "mission" && (
              <Field label="Mission">
                <Select.Root
                  collection={createListCollection({
                    items: missions.map((m: MissionPublic) => ({
                      value: m.id,
                      label: m.name ?? m.id,
                    })),
                  })}
                  value={missionId ? [missionId] : []}
                  onValueChange={(e: { value: string[] }) =>
                    setMissionId(e.value[0] ?? null)
                  }
                >
                  <Select.Control width="100%">
                    <Select.Trigger>
                      <Select.ValueText placeholder="Select a mission" />
                    </Select.Trigger>
                    <Select.IndicatorGroup>
                      <Select.Indicator />
                    </Select.IndicatorGroup>
                  </Select.Control>
                  <Select.Positioner>
                    <Select.Content>
                      {missions.map((m: MissionPublic) => (
                        <Select.Item
                          key={m.id}
                          item={{ value: m.id, label: m.name ?? m.id }}
                        >
                          {m.name ?? m.id}
                          <Select.ItemIndicator />
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select.Positioner>
                </Select.Root>
              </Field>
            )}

            {scope === "trip" && (
              <>
                <Field label="Mission">
                  <Select.Root
                    collection={createListCollection({
                      items: missions.map((m: MissionPublic) => ({
                        value: m.id,
                        label: m.name ?? m.id,
                      })),
                    })}
                    value={missionId ? [missionId] : []}
                    onValueChange={(e: { value: string[] }) => {
                      setMissionId(e.value[0] ?? null)
                      setTripId(null)
                    }}
                  >
                    <Select.Control width="100%">
                      <Select.Trigger>
                        <Select.ValueText placeholder="Select a mission" />
                      </Select.Trigger>
                      <Select.IndicatorGroup>
                        <Select.Indicator />
                      </Select.IndicatorGroup>
                    </Select.Control>
                    <Select.Positioner>
                      <Select.Content>
                        {missions.map((m: MissionPublic) => (
                          <Select.Item
                            key={m.id}
                            item={{ value: m.id, label: m.name ?? m.id }}
                          >
                            {m.name ?? m.id}
                            <Select.ItemIndicator />
                          </Select.Item>
                        ))}
                      </Select.Content>
                    </Select.Positioner>
                  </Select.Root>
                </Field>
                <Field label="Trip">
                  <Select.Root
                    collection={createListCollection({
                      items: trips.map((t: TripPublic) => ({
                        value: t.id,
                        label: formatTripLabel(t),
                      })),
                    })}
                    value={tripId ? [tripId] : []}
                    onValueChange={(e: { value: string[] }) =>
                      setTripId(e.value[0] ?? null)
                    }
                    disabled={!missionId}
                  >
                    <Select.Control width="100%">
                      <Select.Trigger>
                        <Select.ValueText placeholder="Select a trip" />
                      </Select.Trigger>
                      <Select.IndicatorGroup>
                        <Select.Indicator />
                      </Select.IndicatorGroup>
                    </Select.Control>
                    <Select.Positioner>
                      <Select.Content>
                        {trips.map((t: TripPublic) => (
                          <Select.Item
                            key={t.id}
                            item={{ value: t.id, label: formatTripLabel(t) }}
                          >
                            {formatTripLabel(t)}
                            <Select.ItemIndicator />
                          </Select.Item>
                        ))}
                      </Select.Content>
                    </Select.Positioner>
                  </Select.Root>
                </Field>
              </>
            )}

            <Field label="Email Subject (optional)">
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Launch Update: Mission Alpha"
              />
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
              disabled={
                !message.trim() ||
                (scope === "mission" && !missionId) ||
                (scope === "trip" && (!missionId || !tripId))
              }
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
