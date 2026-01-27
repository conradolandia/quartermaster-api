import { LaunchesService, MissionsService } from "@/client"
import {
  Box,
  Button,
  ButtonGroup,
  createListCollection,
  DialogActionTrigger,
  Flex,
  Input,
  Portal,
  Select,
  Text,
  VStack,
} from "@chakra-ui/react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useRef, useState } from "react"
import { Controller, type SubmitHandler, useForm } from "react-hook-form"
import { FaExchangeAlt } from "react-icons/fa"
import { Switch } from "../ui/switch"

import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"
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
  public: boolean
  booking_mode: string
  sales_open_at: string | null
  refund_cutoff_hours: number
  created_at: string
  updated_at: string
}

const bookingModeOptions = createListCollection({
  items: [
    { label: "Private (Admin Only)", value: "private" },
    { label: "Early Bird (Access Code Required)", value: "early_bird" },
    { label: "Public (Open to All)", value: "public" },
  ],
})

interface EditMissionProps {
  mission: Mission
}

const EditMission = ({ mission }: EditMissionProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const [active, setActive] = useState(mission.active)
  const [isPublic, setIsPublic] = useState(mission.public)
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
  const isPast = launchData ? new Date(launchData.launch_timestamp) < new Date() : false
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
      public: mission.public,
      booking_mode: mission.booking_mode || "private",
      sales_open_at: mission.sales_open_at
        ? new Date(mission.sales_open_at).toISOString().slice(0, 16)
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
      setIsPublic(mission.public)
      reset({
        name: mission.name,
        launch_id: mission.launch_id,
        active: mission.active,
        public: mission.public,
        booking_mode: mission.booking_mode || "private",
        sales_open_at: mission.sales_open_at
          ? new Date(mission.sales_open_at).toISOString().slice(0, 16)
          : "",
        refund_cutoff_hours: mission.refund_cutoff_hours,
      })
    }
  }, [isOpen, mission, reset])

  const onSubmit: SubmitHandler<any> = async (data) => {
    // Format the data before sending
    // Use local state for active and public switches
    const formattedData: any = {
      name: data.name,
      launch_id: data.launch_id,
      active: active,
      public: isPublic,
      booking_mode: data.booking_mode || "private",
      sales_open_at: data.sales_open_at
        ? new Date(data.sales_open_at).toISOString()
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
        <Button variant="ghost">
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
              <Text mb={4}>Update the mission details below.</Text>
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
                        disabled={isSubmitting}
                        portalRef={contentRef}
                      />
                    )}
                  />
                </Field>

                <Field
                  invalid={!!errors.sales_open_at}
                  errorText={errors.sales_open_at?.message}
                  label="Sales Open Date & Time"
                >
                  <Input
                    id="sales_open_at"
                    {...register("sales_open_at")}
                    placeholder="Sales open date and time"
                    type="datetime-local"
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

                <Field>
                  <Flex
                    alignItems="center"
                    justifyContent="space-between"
                    width="100%"
                  >
                    <Text>Public</Text>
                    <Box
                      onClick={() => {
                        setIsPublic(!isPublic)
                      }}
                      cursor="pointer"
                    >
                      <Switch
                        checked={isPublic}
                        inputProps={{ id: "public" }}
                      />
                    </Box>
                  </Flex>
                </Field>

                <Field
                  label="Booking Mode"
                  helperText="Controls who can book tickets for this mission"
                >
                  <Controller
                    name="booking_mode"
                    control={control}
                    render={({ field }) => (
                      <Select.Root
                        collection={bookingModeOptions}
                        value={field.value ? [field.value] : ["private"]}
                        onValueChange={(details) =>
                          field.onChange(details.value[0])
                        }
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
                    )}
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
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                </DialogActionTrigger>
                <Button variant="solid" type="submit" loading={isSubmitting}>
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
