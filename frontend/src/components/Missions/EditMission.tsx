import { LaunchesService, MissionsService } from "@/client"
import {
  Box,
  Button,
  ButtonGroup,
  DialogActionTrigger,
  Flex,
  Input,
  Text,
  VStack,
} from "@chakra-ui/react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useRef, useState } from "react"
import { Controller, type SubmitHandler, useForm } from "react-hook-form"
import { FaExchangeAlt } from "react-icons/fa"
import { Switch } from "../ui/switch"

import useCustomToast from "@/hooks/useCustomToast"
import {
  formatInLocationTimezone,
  formatLocationTimezoneDisplay,
  handleError,
  parseApiDate,
  parseLocationTimeToUtc,
} from "@/utils"
import {
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog"
import { Field } from "../ui/field"
import { LaunchDropdown } from "./LaunchDropdown"

interface Mission {
  id: string
  name: string
  launch_id: string
  active: boolean
  sales_open_at: string | null
  refund_cutoff_hours: number
  created_at: string
  updated_at: string
  timezone?: string
}

interface EditMissionProps {
  mission: Mission
}

const EditMission = ({ mission }: EditMissionProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const [active, setActive] = useState(mission.active)
  const queryClient = useQueryClient()
  const { showSuccessToast } = useCustomToast()
  const contentRef = useRef(null)

  // Fetch launch to check if it's in the past
  const { data: launchData } = useQuery({
    queryKey: ["launch-for-mission", mission.launch_id],
    queryFn: () => LaunchesService.readLaunch({ launchId: mission.launch_id }),
    enabled: isOpen,
  })

  // Check if mission's launch is in the past
  const isPast = launchData
    ? parseApiDate(launchData.launch_timestamp) < new Date()
    : false
  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm({
    mode: "onBlur",
    criteriaMode: "all",
    defaultValues: {
      name: mission.name,
      launch_id: mission.launch_id,
      active: mission.active,
      sales_open_at: mission.sales_open_at
        ? formatInLocationTimezone(
            parseApiDate(mission.sales_open_at),
            mission.timezone ?? "UTC",
          )
        : "",
      refund_cutoff_hours: mission.refund_cutoff_hours,
    },
  })

  const mutation = useMutation({
    mutationFn: (data: any) =>
      MissionsService.updateMission({
        missionId: mission.id,
        requestBody: data,
      }),
    onSuccess: () => {
      showSuccessToast("Mission updated successfully.")
      setIsOpen(false)
      queryClient.invalidateQueries({ queryKey: ["missions"] })
    },
    onError: (err: any) => {
      handleError(err)
    },
  })

  // Reset form and local state when dialog opens or mission changes
  useEffect(() => {
    if (isOpen) {
      setActive(mission.active)
      reset({
        name: mission.name,
        launch_id: mission.launch_id,
        active: mission.active,
        sales_open_at: mission.sales_open_at
          ? formatInLocationTimezone(
              parseApiDate(mission.sales_open_at),
              mission.timezone ?? "UTC",
            )
          : "",
        refund_cutoff_hours: mission.refund_cutoff_hours,
      })
    }
  }, [isOpen, mission, reset])

  const onSubmit: SubmitHandler<any> = async (data) => {
    // Format the data before sending
    // Use local state for active switch
    const tz = mission.timezone ?? "UTC"
    const formattedData: any = {
      name: data.name,
      launch_id: data.launch_id,
      active: active,
      sales_open_at: data.sales_open_at
        ? parseLocationTimeToUtc(data.sales_open_at, tz)
        : null,
      refund_cutoff_hours: data.refund_cutoff_hours,
    }
    mutation.mutate(formattedData)
  }

  return (
    <DialogRoot
      size={{ base: "xs", md: "md" }}
      placement="center"
      open={isOpen}
      onOpenChange={({ open }) => setIsOpen(open)}
    >
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          disabled={isPast}
          title={
            isPast
              ? "This mission's launch has already occurred and cannot be edited"
              : ""
          }
        >
          <FaExchangeAlt fontSize="16px" />
          Edit Mission
        </Button>
      </DialogTrigger>
      <DialogContent ref={contentRef}>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>Edit Mission</DialogTitle>
          </DialogHeader>
          <DialogBody>
            {isPast && (
              <Text mb={4} color="orange.500">
                This mission's launch has already occurred and cannot be edited.
                Contact a system administrator if you need to make changes to
                past missions.
              </Text>
            )}
            {!isPast && <Text mb={4}>Update the mission details below.</Text>}
            <VStack gap={4}>
              <Field
                invalid={!!errors.name}
                errorText={errors.name?.message}
                label="Name"
              >
                <Input
                  id="name"
                  {...register("name")}
                  placeholder="Mission name"
                  type="text"
                  disabled={isPast}
                />
              </Field>

              <Field
                invalid={!!errors.launch_id}
                errorText={errors.launch_id?.message}
                label="Launch"
              >
                <Controller
                  name="launch_id"
                  control={control}
                  render={({ field }) => (
                    <LaunchDropdown
                      id="launch_id"
                      value={field.value || ""}
                      onChange={field.onChange}
                      disabled={isSubmitting || isPast}
                      portalRef={contentRef}
                    />
                  )}
                />
              </Field>

              <Field
                invalid={!!errors.sales_open_at}
                errorText={errors.sales_open_at?.message}
                label={`Sales Open Date & Time (${formatLocationTimezoneDisplay(
                  mission.timezone ?? "UTC",
                )})`}
              >
                <Input
                  id="sales_open_at"
                  {...register("sales_open_at")}
                  placeholder={`Enter time in ${formatLocationTimezoneDisplay(
                    mission.timezone ?? "UTC",
                  )}`}
                  type="datetime-local"
                  disabled={isPast}
                />
              </Field>

              <Field
                invalid={!!errors.refund_cutoff_hours}
                errorText={errors.refund_cutoff_hours?.message}
                label="Refund Cutoff Hours"
              >
                <Input
                  id="refund_cutoff_hours"
                  {...register("refund_cutoff_hours", {
                    valueAsNumber: true,
                  })}
                  placeholder="Refund cutoff hours"
                  type="number"
                  min={0}
                  max={72}
                  disabled={isPast}
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
                      if (!isPast) setActive(!active)
                    }}
                    cursor={isPast ? "not-allowed" : "pointer"}
                    opacity={isPast ? 0.5 : 1}
                  >
                    <Switch checked={active} inputProps={{ id: "active" }} />
                  </Box>
                </Flex>
              </Field>
            </VStack>
          </DialogBody>

          <DialogFooter gap={2}>
            <ButtonGroup>
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
                type="submit"
                loading={isSubmitting}
                disabled={isPast}
              >
                Save
              </Button>
            </ButtonGroup>
          </DialogFooter>
        </form>
        <DialogCloseTrigger />
      </DialogContent>
    </DialogRoot>
  )
}

export default EditMission
