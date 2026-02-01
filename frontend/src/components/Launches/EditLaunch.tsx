import {
  Button,
  ButtonGroup,
  DialogActionTrigger,
  Input,
  Text,
  VStack,
} from "@chakra-ui/react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useEffect, useRef, useState } from "react"
import { Controller, type SubmitHandler, useForm } from "react-hook-form"
import { FaExchangeAlt } from "react-icons/fa"

import {
  type ApiError,
  type LaunchPublic,
  type LaunchUpdate,
  LaunchesService,
} from "@/client"
import useCustomToast from "@/hooks/useCustomToast"
import {
  formatInLocationTimezone,
  formatLocationTimezoneDisplay,
  handleError,
  parseApiDate,
  parseLocationTimeToUtc,
} from "@/utils"
import { LocationDropdown } from "../Common/LocationDropdown"
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

interface EditLaunchProps {
  launch: LaunchPublic
}

const EditLaunch = ({ launch }: EditLaunchProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const queryClient = useQueryClient()
  const { showSuccessToast } = useCustomToast()
  const contentRef = useRef(null)

  // Check if launch is in the past
  const isPast = parseApiDate(launch.launch_timestamp) < new Date()
  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<LaunchUpdate>({
    mode: "onBlur",
    criteriaMode: "all",
    defaultValues: {
      name: launch.name,
      launch_timestamp: formatInLocationTimezone(
        parseApiDate(launch.launch_timestamp),
        launch.timezone ?? "UTC",
      ),
      summary: launch.summary,
      location_id: launch.location_id,
    },
  })

  useEffect(() => {
    if (isOpen) {
      reset({
        name: launch.name,
        launch_timestamp: formatInLocationTimezone(
          parseApiDate(launch.launch_timestamp),
          launch.timezone ?? "UTC",
        ),
        summary: launch.summary,
        location_id: launch.location_id,
      })
    }
  }, [
    isOpen,
    launch.id,
    launch.name,
    launch.launch_timestamp,
    launch.timezone,
    launch.summary,
    launch.location_id,
    reset,
  ])

  const mutation = useMutation({
    mutationFn: (data: LaunchUpdate) =>
      LaunchesService.updateLaunch({
        launchId: launch.id,
        requestBody: data,
      }),
    onSuccess: () => {
      showSuccessToast("Launch updated successfully.")
      reset()
      setIsOpen(false)
    },
    onError: (err: ApiError) => {
      handleError(err)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["launches"] })
    },
  })

  const onSubmit: SubmitHandler<LaunchUpdate> = async (data) => {
    // datetime-local value is in location timezone; convert to UTC ISO for API
    const tz = launch.timezone ?? "UTC"
    mutation.mutate({
      ...data,
      launch_timestamp: data.launch_timestamp
        ? parseLocationTimeToUtc(data.launch_timestamp, tz)
        : undefined,
    })
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
              ? "This launch has already occurred and cannot be edited"
              : ""
          }
        >
          <FaExchangeAlt fontSize="16px" />
          Edit Launch
        </Button>
      </DialogTrigger>
      <DialogContent ref={contentRef}>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>Edit Launch</DialogTitle>
          </DialogHeader>
          <DialogBody>
            {isPast && (
              <Text mb={4} color="orange.500">
                This launch has already occurred and cannot be edited. Contact a
                system administrator if you need to make changes to past
                launches.
              </Text>
            )}
            {!isPast && <Text mb={4}>Update the launch details below.</Text>}
            <VStack gap={4}>
              <Field
                invalid={!!errors.name}
                errorText={errors.name?.message}
                label="Name"
              >
                <Input
                  id="name"
                  {...register("name")}
                  placeholder="Launch name"
                  type="text"
                />
              </Field>

              <Field
                invalid={!!errors.launch_timestamp}
                errorText={errors.launch_timestamp?.message}
                label={`Launch Date & Time (${formatLocationTimezoneDisplay(
                  launch.timezone ?? "UTC",
                )})`}
              >
                <Input
                  id="launch_timestamp"
                  {...register("launch_timestamp")}
                  placeholder={`Enter time in ${formatLocationTimezoneDisplay(
                    launch.timezone ?? "UTC",
                  )}`}
                  type="datetime-local"
                  disabled={isPast}
                />
              </Field>

              <Field
                invalid={!!errors.summary}
                errorText={errors.summary?.message}
                label="Summary"
              >
                <Input
                  id="summary"
                  {...register("summary")}
                  placeholder="Launch summary"
                  type="text"
                  disabled={isPast}
                />
              </Field>

              <Field
                invalid={!!errors.location_id}
                errorText={errors.location_id?.message}
                label="Location"
              >
                <Controller
                  name="location_id"
                  control={control}
                  render={({ field }) => (
                    <LocationDropdown
                      id="location_id"
                      value={field.value || ""}
                      onChange={field.onChange}
                      isDisabled={isSubmitting || isPast}
                      portalRef={contentRef}
                    />
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

export default EditLaunch
