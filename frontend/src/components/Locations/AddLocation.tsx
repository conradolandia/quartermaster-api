import useCustomToast from "@/hooks/useCustomToast"
import { Button, ButtonGroup, Input, VStack } from "@chakra-ui/react"
import { useRef } from "react"
import {
  DialogActionTrigger,
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
} from "../ui/dialog"

import { type LocationCreate, LocationsService } from "@/client"
import { handleError } from "@/utils"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Controller, type SubmitHandler, useForm } from "react-hook-form"
import { Field } from "../ui/field"
import StateDropdown from "./StateDropdown"

// Props interface
interface AddLocationProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export const AddLocation = ({
  isOpen,
  onClose,
  onSuccess,
}: AddLocationProps) => {
  const { showSuccessToast } = useCustomToast()
  const queryClient = useQueryClient()
  const contentRef = useRef(null)

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<LocationCreate>({
    mode: "onBlur",
    criteriaMode: "all",
    defaultValues: {
      name: "",
      state: "",
      timezone: "UTC",
    },
  })

  // Use mutation for creating location
  const mutation = useMutation({
    mutationFn: (data: LocationCreate) =>
      LocationsService.createLocation({ requestBody: data }),
    onSuccess: () => {
      showSuccessToast("Location was successfully added")
      reset()
      queryClient.invalidateQueries({ queryKey: ["locations"] })
      onSuccess()
      onClose()
    },
    onError: (error: any) => {
      handleError(error)
    },
  })

  const onSubmit: SubmitHandler<LocationCreate> = (data) => {
    mutation.mutate(data)
  }

  return (
    <DialogRoot
      size={{ base: "xs", md: "md" }}
      placement="center"
      open={isOpen}
      onOpenChange={({ open }) => !open && onClose()}
    >
      <DialogContent ref={contentRef}>
          <form onSubmit={handleSubmit(onSubmit)}>
            <DialogHeader>
              <DialogTitle>Add Location</DialogTitle>
            </DialogHeader>
            <DialogBody>
              <VStack gap={4}>
                <Field
                  label="Name"
                  required
                  invalid={!!errors.name}
                  errorText={errors.name?.message}
                >
                  <Input
                    id="name"
                    {...register("name", {
                      required: "Name is required",
                      minLength: { value: 1, message: "Name is required" },
                      maxLength: {
                        value: 255,
                        message: "Name cannot exceed 255 characters",
                      },
                    })}
                    placeholder="Location name"
                  />
                </Field>
                <Field
                  label="State"
                  required
                  invalid={!!errors.state}
                  errorText={errors.state?.message}
                >
                  <Controller
                    name="state"
                    control={control}
                    rules={{
                      required: "State is required",
                    }}
                    render={({ field }) => (
                      <StateDropdown
                        value={field.value}
                        onChange={field.onChange}
                        id="state"
                        isDisabled={isSubmitting}
                        portalRef={contentRef}
                      />
                    )}
                  />
                </Field>
                <Field
                  label="Timezone"
                  invalid={!!errors.timezone}
                  errorText={errors.timezone?.message}
                >
                  <Input
                    id="timezone"
                    {...register("timezone", {
                      maxLength: { value: 64, message: "Max 64 characters" },
                    })}
                    placeholder="e.g. America/New_York"
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
                  Add
                </Button>
              </ButtonGroup>
            </DialogFooter>
          </form>
          <DialogCloseTrigger />
        </DialogContent>
    </DialogRoot>
  )
}

export default AddLocation
