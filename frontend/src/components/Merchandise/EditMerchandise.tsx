import {
  Button,
  ButtonGroup,
  DialogActionTrigger,
  Input,
  NumberInput,
  Text,
  VStack,
} from "@chakra-ui/react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useEffect, useRef, useState } from "react"
import { Controller, type SubmitHandler, useForm } from "react-hook-form"
import { FaExchangeAlt } from "react-icons/fa"

import {
  type ApiError,
  type MerchandisePublic,
  type MerchandiseUpdate,
  MerchandiseService,
} from "@/client"
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

interface EditMerchandiseProps {
  merchandise: MerchandisePublic
}

const EditMerchandise = ({ merchandise }: EditMerchandiseProps) => {
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
  } = useForm<MerchandiseUpdate>({
    mode: "onBlur",
    criteriaMode: "all",
    defaultValues: {
      name: merchandise.name,
      description: merchandise.description ?? "",
      price: merchandise.price,
      quantity_available: merchandise.quantity_available,
    },
  })

  useEffect(() => {
    if (isOpen) {
      reset({
        name: merchandise.name,
        description: merchandise.description ?? "",
        price: merchandise.price,
        quantity_available: merchandise.quantity_available,
      })
    }
  }, [
    isOpen,
    merchandise.id,
    merchandise.name,
    merchandise.description,
    merchandise.price,
    merchandise.quantity_available,
    reset,
  ])

  const mutation = useMutation({
    mutationFn: (data: MerchandiseUpdate) =>
      MerchandiseService.updateMerchandise({
        merchandiseId: merchandise.id,
        requestBody: data,
      }),
    onSuccess: () => {
      showSuccessToast("Merchandise updated successfully.")
      reset()
      setIsOpen(false)
    },
    onError: (err: ApiError) => {
      handleError(err)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["merchandise"] })
    },
  })

  const onSubmit: SubmitHandler<MerchandiseUpdate> = async (data) => {
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
          Edit Merchandise
        </Button>
      </DialogTrigger>
      <DialogContent ref={contentRef}>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>Edit Merchandise</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <Text mb={4}>Update the merchandise details below.</Text>
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
                    min: { value: 0, message: "Price must be >= 0" },
                  }}
                  render={({ field: { value, onChange } }) => (
                    <NumberInput.Root
                      value={value === undefined || value === null ? "" : String(value)}
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
                    min: { value: 0, message: "Quantity must be >= 0" },
                  }}
                  render={({ field: { value, onChange } }) => (
                    <NumberInput.Root
                      value={value === undefined || value === null ? "" : String(value)}
                      onValueChange={(e) => onChange(e.valueAsNumber ?? 0)}
                      min={0}
                      step={1}
                    >
                      <NumberInput.Input />
                    </NumberInput.Root>
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

export default EditMerchandise
