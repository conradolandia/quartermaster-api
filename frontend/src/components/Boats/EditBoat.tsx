import { type ApiError, type BoatUpdate, BoatsService } from "@/client"
import ProviderDropdown from "@/components/Common/ProviderDropdown"
import {
  DialogActionTrigger,
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
import useCustomToast from "@/hooks/useCustomToast"
import type { Boat } from "@/types/boat"
import { handleError } from "@/utils"
import {
  Button,
  ButtonGroup,
  Input,
  Text,
  VStack,
} from "@chakra-ui/react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useEffect, useRef, useState } from "react"
import { Controller, type SubmitHandler, useForm } from "react-hook-form"
import { FiEdit } from "react-icons/fi"

// Este es un componente simplificado que imita la estructura del proyecto
// En un proyecto real, incluiría formularios completos y llamadas a la API

interface EditBoatProps {
  boat: Boat
}

const EditBoat = ({ boat }: EditBoatProps) => {
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
  } = useForm<BoatUpdate>({
    mode: "onBlur",
    criteriaMode: "all",
    defaultValues: {
      name: boat.name,
      capacity: boat.capacity,
      provider_id: boat.provider_id,
    },
  })

  // Sync form to current boat when dialog opens so we show latest data after refetch
  useEffect(() => {
    if (isOpen) {
      reset({
        name: boat.name,
        capacity: boat.capacity,
        provider_id: boat.provider_id,
      })
    }
  }, [isOpen, boat.name, boat.capacity, boat.provider_id, reset])

  const mutation = useMutation({
    mutationFn: (data: BoatUpdate) =>
      BoatsService.updateBoat({
        boatId: boat.id,
        requestBody: data,
      }),
    onSuccess: () => {
      showSuccessToast("Boat updated successfully.")
      reset()
      setIsOpen(false)
    },
    onError: (err: ApiError) => {
      handleError(err)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["boats"] })
    },
  })

  const onSubmit: SubmitHandler<BoatUpdate> = async (data) => {
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
          <FiEdit fontSize="16px" />
          Edit Boat
        </Button>
      </DialogTrigger>

      <DialogContent ref={contentRef}>
          <form onSubmit={handleSubmit(onSubmit)}>
            <DialogCloseTrigger />
            <DialogHeader>
              <DialogTitle>Edit Boat</DialogTitle>
            </DialogHeader>
            <DialogBody>
              <Text mb={4}>Update the boat details below.</Text>
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
                  invalid={!!errors.capacity}
                  errorText={errors.capacity?.message}
                  label="Capacity"
                  required
                >
                  <Controller
                    name="capacity"
                    control={control}
                    rules={{
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
                    render={({ field }) => (
                      <ProviderDropdown
                        id="provider_id"
                        value={field.value ? String(field.value) : ""}
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
                  Save
                </Button>
              </ButtonGroup>
            </DialogFooter>
          </form>
        </DialogContent>
    </DialogRoot>
  )
}

export default EditBoat
