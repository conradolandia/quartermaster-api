import useCustomToast from "@/hooks/useCustomToast"
import {
  Button,
  ButtonGroup,
  Input,
  NumberInput,
  VStack,
} from "@chakra-ui/react"
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

import {
  type ApiError,
  type MerchandiseCreate,
  MerchandiseService,
} from "@/client"
import { handleError } from "@/utils"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Controller, type SubmitHandler, useForm } from "react-hook-form"
import { Field } from "../ui/field"

interface AddMerchandiseProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export const AddMerchandise = ({
  isOpen,
  onClose,
  onSuccess,
}: AddMerchandiseProps) => {
  const { showSuccessToast } = useCustomToast()
  const queryClient = useQueryClient()
  const contentRef = useRef(null)

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<MerchandiseCreate>({
    mode: "onBlur",
    criteriaMode: "all",
    defaultValues: {
      name: "",
      description: "",
      price: 0,
      quantity_available: 0,
      variant_name: "",
      variant_options: "",
    },
  })

  const mutation = useMutation({
    mutationFn: (data: MerchandiseCreate) =>
      MerchandiseService.createMerchandise({ requestBody: data }),
    onSuccess: () => {
      showSuccessToast("Merchandise was successfully added")
      reset()
      queryClient.invalidateQueries({ queryKey: ["merchandise"] })
      onSuccess()
      onClose()
    },
    onError: (error: ApiError) => {
      handleError(error)
    },
  })

  const onSubmit: SubmitHandler<MerchandiseCreate> = (data) => {
    mutation.mutate({
      ...data,
      price: Math.round(data.price * 100),
      variant_name: data.variant_name?.trim() || undefined,
      variant_options: data.variant_options?.trim() || undefined,
    })
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
            <DialogTitle>Add Merchandise</DialogTitle>
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
                  placeholder="Item name"
                />
              </Field>
              <Field
                label="Description"
                invalid={!!errors.description}
                errorText={errors.description?.message}
              >
                <Input
                  id="description"
                  {...register("description", {
                    maxLength: {
                      value: 2000,
                      message: "Description cannot exceed 2000 characters",
                    },
                  })}
                  placeholder="Optional description"
                />
              </Field>
              <Field
                label="Price"
                required
                invalid={!!errors.price}
                errorText={errors.price?.message}
              >
                <Controller
                  name="price"
                  control={control}
                  rules={{
                    required: "Price is required",
                    min: { value: 0, message: "Price must be >= 0" },
                  }}
                  render={({ field: { value, onChange } }) => (
                    <NumberInput.Root
                      value={
                        value === undefined || value === null
                          ? ""
                          : String(value)
                      }
                      onValueChange={(e) => onChange(e.valueAsNumber ?? 0)}
                      min={0}
                      step={0.01}
                      formatOptions={{ minimumFractionDigits: 2 }}
                    >
                      <NumberInput.Input />
                    </NumberInput.Root>
                  )}
                />
              </Field>
              <Field
                label="Quantity available"
                required
                invalid={!!errors.quantity_available}
                errorText={errors.quantity_available?.message}
              >
                <Controller
                  name="quantity_available"
                  control={control}
                  rules={{
                    required: "Quantity is required",
                    min: { value: 0, message: "Quantity must be >= 0" },
                  }}
                  render={({ field: { value, onChange } }) => (
                    <NumberInput.Root
                      value={
                        value === undefined || value === null
                          ? ""
                          : String(value)
                      }
                      onValueChange={(e) => onChange(e.valueAsNumber ?? 0)}
                      min={0}
                      step={1}
                    >
                      <NumberInput.Input />
                    </NumberInput.Root>
                  )}
                />
              </Field>
              <Field
                label="Variant name (optional)"
                invalid={!!errors.variant_name}
                errorText={errors.variant_name?.message}
              >
                <Input
                  id="variant_name"
                  {...register("variant_name", {
                    maxLength: {
                      value: 64,
                      message: "Variant name cannot exceed 64 characters",
                    },
                  })}
                  placeholder="e.g. Size"
                />
              </Field>
              <Field
                label="Variant options (optional, comma-separated)"
                invalid={!!errors.variant_options}
                errorText={errors.variant_options?.message}
              >
                <Input
                  id="variant_options"
                  {...register("variant_options", {
                    maxLength: {
                      value: 500,
                      message: "Variant options cannot exceed 500 characters",
                    },
                  })}
                  placeholder="e.g. S, M, L"
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

export default AddMerchandise
