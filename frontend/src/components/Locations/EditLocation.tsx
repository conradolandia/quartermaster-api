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
  type LocationPublic,
  type LocationUpdate,
  LocationsService,
} from "@/client"
import useCustomToast from "@/hooks/useCustomToast"
import { formatLocationTimezoneDisplay, handleError, US_TIMEZONES } from "@/utils"
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
import { NativeSelect } from "../ui/native-select"
import StateDropdown from "./StateDropdown"

interface EditLocationProps {
  location: LocationPublic
}

const EditLocation = ({ location }: EditLocationProps) => {
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
  } = useForm<LocationUpdate>({
    mode: "onBlur",
    criteriaMode: "all",
    defaultValues: {
      name: location.name,
      state: location.state,
      timezone: location.timezone ?? "UTC",
    },
  })

  useEffect(() => {
    if (isOpen) {
      reset({
        name: location.name,
        state: location.state,
        timezone: location.timezone ?? "UTC",
      })
    }
  }, [isOpen, location.id, location.name, location.state, location.timezone, reset])

  const mutation = useMutation({
    mutationFn: (data: LocationUpdate) =>
      LocationsService.updateLocation({
        locationId: location.id,
        requestBody: data,
      }),
    onSuccess: () => {
      showSuccessToast("Location updated successfully.")
      reset()
      setIsOpen(false)
    },
    onError: (err: ApiError) => {
      handleError(err)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["locations"] })
    },
  })

  const onSubmit: SubmitHandler<LocationUpdate> = async (data) => {
    mutation.mutate(data)
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
          Edit Location
        </Button>
      </DialogTrigger>
      <DialogContent ref={contentRef}>
          <form onSubmit={handleSubmit(onSubmit)}>
            <DialogHeader>
              <DialogTitle>Edit Location</DialogTitle>
            </DialogHeader>
            <DialogBody>
              <Text mb={4}>Update the location details below.</Text>
              <VStack gap={4}>
                <Field
                  invalid={!!errors.name}
                  errorText={errors.name?.message}
                  label="Name"
                  required
                >
                  <Input
                    id="name"
                    {...register("name", {
                      minLength: { value: 1, message: "Name cannot be empty" },
                      maxLength: {
                        value: 255,
                        message: "Name cannot exceed 255 characters",
                      },
                    })}
                    placeholder="Name"
                    type="text"
                  />
                </Field>

                <Field
                  invalid={!!errors.state}
                  errorText={errors.state?.message}
                  label="State"
                  required
                >
                  <Controller
                    name="state"
                    control={control}
                    rules={{
                      minLength: {
                        value: 2,
                        message: "State code must be 2 characters",
                      },
                      maxLength: {
                        value: 2,
                        message: "State code must be 2 characters",
                      },
                    }}
                    render={({ field }) => (
                      <StateDropdown
                        id="state"
                        value={field.value || ""}
                        onChange={field.onChange}
                        isDisabled={isSubmitting}
                        portalRef={contentRef}
                      />
                    )}
                  />
                </Field>
                <Field label="Timezone">
                  <Controller
                    name="timezone"
                    control={control}
                    render={({ field }) => {
                      const value = field.value ?? "UTC"
                      const options =
                        value && !(US_TIMEZONES as readonly string[]).includes(value)
                          ? [value, ...US_TIMEZONES]
                          : [...US_TIMEZONES]
                      return (
                        <NativeSelect
                          id="timezone"
                          value={value}
                          onChange={(e) => field.onChange(e.target.value)}
                          disabled={isSubmitting}
                        >
                          {options.map((tz) => (
                            <option key={tz} value={tz}>
                              {formatLocationTimezoneDisplay(tz)}
                            </option>
                          ))}
                        </NativeSelect>
                      )
                    }}
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

export default EditLocation
