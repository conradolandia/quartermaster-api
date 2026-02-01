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

import { type ProviderCreate, ProvidersService } from "@/client"
import { handleError } from "@/utils"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Controller, type SubmitHandler, useForm } from "react-hook-form"
import JurisdictionDropdown from "../Common/JurisdictionDropdown"
import { Field } from "../ui/field"

// Props interface
interface AddProviderProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export const AddProvider = ({
  isOpen,
  onClose,
  onSuccess,
}: AddProviderProps) => {
  const { showSuccessToast } = useCustomToast()
  const queryClient = useQueryClient()
  const contentRef = useRef(null)

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ProviderCreate>({
    mode: "onBlur",
    criteriaMode: "all",
    defaultValues: {
      name: "",
      address: "",
      jurisdiction_id: "",
      map_link: "",
    },
  })

  // Use mutation for creating provider
  const mutation = useMutation({
    mutationFn: (data: ProviderCreate) =>
      ProvidersService.createProvider({ requestBody: data }),
    onSuccess: () => {
      showSuccessToast("Provider was successfully added")
      reset()
      queryClient.invalidateQueries({ queryKey: ["providers"] })
      onSuccess()
      onClose()
    },
    onError: (error: any) => {
      handleError(error)
    },
  })

  const onSubmit: SubmitHandler<ProviderCreate> = (data) => {
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
            <DialogTitle>Add Provider</DialogTitle>
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
                    maxLength: {
                      value: 255,
                      message: "Name cannot exceed 255 characters",
                    },
                  })}
                  placeholder="Provider name"
                />
              </Field>
              <Field
                label="Address"
                invalid={!!errors.address}
                errorText={errors.address?.message}
              >
                <Input
                  id="address"
                  {...register("address", {
                    maxLength: {
                      value: 500,
                      message: "Address cannot exceed 500 characters",
                    },
                  })}
                  placeholder="Provider address"
                />
              </Field>
              <Field
                label="Jurisdiction"
                required
                invalid={!!errors.jurisdiction_id}
                errorText={errors.jurisdiction_id?.message}
              >
                <Controller
                  name="jurisdiction_id"
                  control={control}
                  rules={{ required: "Jurisdiction is required" }}
                  render={({ field }) => (
                    <JurisdictionDropdown
                      value={field.value}
                      onChange={field.onChange}
                      id="jurisdiction_id"
                      isDisabled={isSubmitting}
                      portalRef={contentRef}
                    />
                  )}
                />
              </Field>
              <Field
                label="Map Link"
                invalid={!!errors.map_link}
                errorText={errors.map_link?.message}
              >
                <Input
                  id="map_link"
                  {...register("map_link", {
                    maxLength: {
                      value: 2000,
                      message: "Map link cannot exceed 2000 characters",
                    },
                  })}
                  placeholder="Map link URL"
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

export default AddProvider
