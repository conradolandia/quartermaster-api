import { type ApiError, type BoatCreate, BoatsService } from "@/client"
import ProviderDropdown from "@/components/Common/ProviderDropdown"
import {
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field } from "@/components/ui/field"
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"
import {
  Button,
  ButtonGroup,
  DialogActionTrigger,
  Input,
  Text,
  VStack,
} from "@chakra-ui/react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useRef } from "react"
import { Controller, type SubmitHandler, useForm } from "react-hook-form"

interface AddBoatProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

const AddBoat = ({ isOpen, onClose, onSuccess }: AddBoatProps) => {
  const contentRef = useRef(null)
  const queryClient = useQueryClient()
  const { showSuccessToast } = useCustomToast()

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<BoatCreate>({
    mode: "onBlur",
    criteriaMode: "all",
    defaultValues: {
      name: "",
      capacity: 1,
      provider_id: "",
    },
  })

  const mutation = useMutation({
    mutationFn: (data: BoatCreate) =>
      BoatsService.createBoat({
        requestBody: data,
      }),
    onSuccess: () => {
      showSuccessToast("Boat created successfully.")
      reset()
      onSuccess()
      onClose()
    },
    onError: (err: ApiError) => {
      handleError(err)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["boats"] })
    },
  })

  const onSubmit: SubmitHandler<BoatCreate> = async (data) => {
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
            <DialogTitle>Add Boat</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <Text mb={4}>Add a new boat by filling out the form below.</Text>
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
                    required: "Name is required",
                    minLength: { value: 1, message: "Name is required" },
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
                invalid={!!errors.capacity}
                errorText={errors.capacity?.message}
                label="Capacity"
                required
              >
                <Controller
                  name="capacity"
                  control={control}
                  rules={{
                    required: "Capacity is required",
                    min: { value: 1, message: "Capacity must be at least 1" },
                  }}
                  render={({ field }) => (
                    <Input
                      id="capacity"
                      type="number"
                      value={field.value ?? ""}
                      onChange={(e) =>
                        field.onChange(Number.parseInt(e.target.value) || 1)
                      }
                      min={1}
                      disabled={isSubmitting}
                      placeholder="Capacity"
                    />
                  )}
                />
              </Field>

              <Field
                invalid={!!errors.provider_id}
                errorText={errors.provider_id?.message}
                label="Provider"
                required
              >
                <Controller
                  name="provider_id"
                  control={control}
                  rules={{ required: "Provider is required" }}
                  render={({ field }) => (
                    <ProviderDropdown
                      id="provider_id"
                      value={field.value || ""}
                      onChange={field.onChange}
                      isDisabled={isSubmitting}
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
              <Button variant="solid" type="submit" loading={isSubmitting}>
                Add Boat
              </Button>
            </ButtonGroup>
          </DialogFooter>
        </form>
        <DialogCloseTrigger />
      </DialogContent>
    </DialogRoot>
  )
}

export default AddBoat
