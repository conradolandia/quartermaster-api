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
  type ProviderPublic,
  type ProviderUpdate,
  ProvidersService,
} from "@/client"
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"
import JurisdictionDropdown from "../Common/JurisdictionDropdown"
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

interface EditProviderProps {
  provider: ProviderPublic
}

const EditProvider = ({ provider }: EditProviderProps) => {
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
  } = useForm<ProviderUpdate>({
    mode: "onBlur",
    criteriaMode: "all",
    defaultValues: {
      name: provider.name,
      address: provider.address || "",
      jurisdiction_id: provider.jurisdiction_id,
      map_link: provider.map_link || "",
    },
  })

  const mutation = useMutation({
    mutationFn: (data: ProviderUpdate) =>
      ProvidersService.updateProvider({
        providerId: provider.id,
        requestBody: data,
      }),
    onSuccess: () => {
      showSuccessToast("Provider updated successfully.")
      reset()
      setIsOpen(false)
    },
    onError: (err: ApiError) => {
      handleError(err)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["providers"] })
    },
  })

  const onSubmit: SubmitHandler<ProviderUpdate> = async (data) => {
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
        <Button variant="ghost" size="sm">
          <FaExchangeAlt fontSize="16px" />
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent ref={contentRef}>
          <form onSubmit={handleSubmit(onSubmit)}>
            <DialogHeader>
              <DialogTitle>Edit Provider</DialogTitle>
            </DialogHeader>
            <DialogBody>
              <Text mb={4}>Update the provider details below.</Text>
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
                  invalid={!!errors.address}
                  errorText={errors.address?.message}
                  label="Address"
                >
                  <Input
                    id="address"
                    {...register("address", {
                      maxLength: {
                        value: 500,
                        message: "Address cannot exceed 500 characters",
                      },
                    })}
                    placeholder="Address"
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
                  label="Map Link"
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
          <DialogCloseTrigger />
        </DialogContent>
    </DialogRoot>
  )
}

export default EditProvider
