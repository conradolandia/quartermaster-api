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

import { type JurisdictionCreate, JurisdictionsService } from "@/client"
import { handleError } from "@/utils"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Controller, type SubmitHandler, useForm } from "react-hook-form"
import LocationDropdown from "../Common/LocationDropdown"
import StateDropdown from "../Locations/StateDropdown"
import { Field } from "../ui/field"

// Props interface
interface AddJurisdictionProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export const AddJurisdiction = ({
  isOpen,
  onClose,
  onSuccess,
}: AddJurisdictionProps) => {
  const { showSuccessToast } = useCustomToast()
  const queryClient = useQueryClient()
  const contentRef = useRef(null)

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<JurisdictionCreate>({
    mode: "onBlur",
    criteriaMode: "all",
    defaultValues: {
      name: "",
      state: "",
      sales_tax_rate: 0,
      location_id: "",
    },
  })

  // Use mutation for creating jurisdiction
  const mutation = useMutation({
    mutationFn: (data: JurisdictionCreate) =>
      JurisdictionsService.createJurisdiction({ requestBody: data }),
    onSuccess: () => {
      showSuccessToast("Jurisdiction was successfully added")
      reset()
      queryClient.invalidateQueries({ queryKey: ["jurisdictions"] })
      onSuccess()
      onClose()
    },
    onError: (error: any) => {
      handleError(error)
    },
  })

  const onSubmit: SubmitHandler<JurisdictionCreate> = (data) => {
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
              <DialogTitle>Add Jurisdiction</DialogTitle>
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
                    placeholder="Jurisdiction name"
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
                      maxLength: {
                        value: 100,
                        message: "State cannot exceed 100 characters",
                      },
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
                  label="Sales Tax Rate (%)"
                  required
                  invalid={!!errors.sales_tax_rate}
                  errorText={errors.sales_tax_rate?.message}
                >
                  <Controller
                    name="sales_tax_rate"
                    control={control}
                    rules={{
                      required: "Sales tax rate is required",
                      min: {
                        value: 0,
                        message: "Sales tax rate must be between 0 and 100%",
                      },
                      max: {
                        value: 1,
                        message: "Sales tax rate must be between 0 and 100%",
                      },
                    }}
                    render={({ field }) => (
                      <Input
                        id="sales_tax_rate"
                        type="number"
                        value={
                          field.value ? (field.value * 100).toString() : ""
                        }
                        onChange={(e) => {
                          const percentValue =
                            Number.parseFloat(e.target.value) || 0
                          field.onChange(percentValue / 100) // Convert percentage to decimal for storage
                        }}
                        min={0}
                        max={100}
                        step={0.01}
                        disabled={isSubmitting}
                        placeholder="Sales tax rate (e.g. 6.5 for 6.5%)"
                      />
                    )}
                  />
                </Field>
                <Field
                  label="Location"
                  required
                  invalid={!!errors.location_id}
                  errorText={errors.location_id?.message}
                >
                  <Controller
                    name="location_id"
                    control={control}
                    rules={{ required: "Location is required" }}
                    render={({ field }) => (
                      <LocationDropdown
                        value={field.value}
                        onChange={field.onChange}
                        id="location_id"
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

export default AddJurisdiction
