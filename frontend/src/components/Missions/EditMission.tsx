import { MissionsService } from "@/client"
import {
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
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useRef, useState } from "react"
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
  const queryClient = useQueryClient()
  const { showSuccessToast } = useCustomToast()
  const contentRef = useRef(null)
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
      reset()
      setIsOpen(false)
    },
    onError: (err: any) => {
      handleError(err)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["missions"] })
    },
  })

  const onSubmit: SubmitHandler<any> = async (data) => {
    // Format the data before sending
    const formattedData = {
      ...data,
      sales_open_at: data.sales_open_at
        ? new Date(data.sales_open_at).toISOString()
        : null,
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
                  <Controller
                    name="active"
                    control={control}
                    render={({ field }) => (
                      <Flex
                        alignItems="center"
                        justifyContent="space-between"
                        width="100%"
                      >
                        <Text>Active</Text>
                        <Switch
                          checked={field.value}
                          onCheckedChange={(details) =>
                            field.onChange(details.checked)
                          }
                          inputProps={{ id: "active" }}
                        />
                      </Flex>
                    )}
                  />
                </Field>

                <Field>
                  <Controller
                    name="public"
                    control={control}
                    render={({ field }) => (
                      <Flex
                        alignItems="center"
                        justifyContent="space-between"
                        width="100%"
                      >
                        <Text>Public</Text>
                        <Switch
                          checked={field.value}
                          onCheckedChange={(details) =>
                            field.onChange(details.checked)
                          }
                          inputProps={{ id: "public" }}
                        />
                      </Flex>
                    )}
                  />
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
