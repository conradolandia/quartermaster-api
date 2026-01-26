import {
  Button,
  ButtonGroup,
  DialogActionTrigger,
  Input,
  Text,
  VStack,
} from "@chakra-ui/react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useRef, useState } from "react"
import { Controller, type SubmitHandler, useForm } from "react-hook-form"
import { FaExchangeAlt } from "react-icons/fa"

import {
  type ApiError,
  type JurisdictionPublic,
  type JurisdictionUpdate,
  JurisdictionsService,
} from "@/client"
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"
import LocationDropdown from "../Common/LocationDropdown"
import StateDropdown from "../Locations/StateDropdown"
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

interface EditJurisdictionProps {
  jurisdiction: JurisdictionPublic
}

const EditJurisdiction = ({ jurisdiction }: EditJurisdictionProps) => {
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
  } = useForm<JurisdictionUpdate>({
    mode: "onBlur",
    criteriaMode: "all",
    defaultValues: {
      name: jurisdiction.name,
      state: jurisdiction.state,
      sales_tax_rate: jurisdiction.sales_tax_rate,
      location_id: jurisdiction.location_id,
    },
  })

  const mutation = useMutation({
    mutationFn: (data: JurisdictionUpdate) =>
      JurisdictionsService.updateJurisdiction({
        jurisdictionId: jurisdiction.id,
        requestBody: data,
      }),
    onSuccess: () => {
      showSuccessToast("Jurisdiction updated successfully.")
      reset()
      setIsOpen(false)
    },
    onError: (err: ApiError) => {
      handleError(err)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["jurisdictions"] })
    },
  })

  const onSubmit: SubmitHandler<JurisdictionUpdate> = async (data) => {
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
          Edit Jurisdiction
        </Button>
      </DialogTrigger>
      <DialogContent ref={contentRef}>
          <form onSubmit={handleSubmit(onSubmit)}>
            <DialogHeader>
              <DialogTitle>Edit Jurisdiction</DialogTitle>
            </DialogHeader>
            <DialogBody>
              <Text mb={4}>Update the jurisdiction details below.</Text>
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
                      maxLength: {
                        value: 100,
                        message: "State cannot exceed 100 characters",
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

                <Field
                  invalid={!!errors.sales_tax_rate}
                  errorText={errors.sales_tax_rate?.message}
                  label="Sales Tax Rate (%)"
                  required
                >
                  <Controller
                    name="sales_tax_rate"
                    control={control}
                    rules={{
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
                  invalid={!!errors.location_id}
                  errorText={errors.location_id?.message}
                  label="Location"
                  required
                >
                  <Controller
                    name="location_id"
                    control={control}
                    render={({ field }) => (
                      <LocationDropdown
                        id="location_id"
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

export default EditJurisdiction
