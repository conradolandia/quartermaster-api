import { type ApiError, type BoatUpdate, BoatsService } from "@/client"
import JurisdictionDropdown from "@/components/Common/JurisdictionDropdown"
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
  Portal,
  Text,
  VStack,
} from "@chakra-ui/react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useRef, useState } from "react"
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
      provider_name: boat.provider_name,
      provider_location: boat.provider_location,
      provider_address: boat.provider_address,
      jurisdiction_id: boat.jurisdiction_id,
      map_link: boat.map_link,
    },
  })

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

      <Portal>
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
                  invalid={!!errors.provider_name}
                  errorText={errors.provider_name?.message}
                  label="Provider Name"
                  required
                >
                  <Input
                    id="provider_name"
                    {...register("provider_name", {
                      maxLength: {
                        value: 255,
                        message: "Provider name cannot exceed 255 characters",
                      },
                    })}
                    placeholder="Provider Name"
                    type="text"
                  />
                </Field>

                <Field
                  invalid={!!errors.provider_location}
                  errorText={errors.provider_location?.message}
                  label="Provider Location"
                  required
                >
                  <Input
                    id="provider_location"
                    {...register("provider_location", {
                      maxLength: {
                        value: 255,
                        message:
                          "Provider location cannot exceed 255 characters",
                      },
                    })}
                    placeholder="Provider Location"
                    type="text"
                  />
                </Field>

                <Field
                  invalid={!!errors.provider_address}
                  errorText={errors.provider_address?.message}
                  label="Provider Address"
                  required
                >
                  <Input
                    id="provider_address"
                    {...register("provider_address", {
                      maxLength: {
                        value: 500,
                        message:
                          "Provider address cannot exceed 500 characters",
                      },
                    })}
                    placeholder="Provider Address"
                    type="text"
                  />
                </Field>

                <Field
                  invalid={!!errors.jurisdiction_id}
                  errorText={errors.jurisdiction_id?.message}
                  label="Jurisdiction"
                  required
                >
                  <Controller
                    name="jurisdiction_id"
                    control={control}
                    render={({ field }) => (
                      <JurisdictionDropdown
                        id="jurisdiction_id"
                        value={field.value || ""}
                        onChange={field.onChange}
                        isDisabled={isSubmitting}
                        portalRef={contentRef}
                      />
                    )}
                  />
                </Field>

                <Field
                  invalid={!!errors.map_link}
                  errorText={errors.map_link?.message}
                  label="Map Link (Optional)"
                >
                  <Input
                    id="map_link"
                    {...register("map_link", {
                      maxLength: {
                        value: 2000,
                        message: "Map link cannot exceed 2000 characters",
                      },
                    })}
                    placeholder="Map Link"
                    type="text"
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
      </Portal>
    </DialogRoot>
  )
}

export default EditBoat
