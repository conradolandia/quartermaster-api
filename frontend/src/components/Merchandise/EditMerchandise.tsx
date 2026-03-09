import {
  Button,
  ButtonGroup,
  DialogActionTrigger,
  Grid,
  Input,
  NumberInput,
  Text,
  VStack,
} from "@chakra-ui/react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useRef, useState } from "react"
import { Controller, type SubmitHandler, useForm } from "react-hook-form"
import { FaExchangeAlt } from "react-icons/fa"

import {
  type ApiError,
  type MerchandisePublic,
  type MerchandiseVariationUpdate,
  MerchandiseService,
  type MerchandiseUpdate,
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
import VariationsTable, {
  type VariationsTableRef,
} from "./VariationsTable"

interface EditMerchandiseProps {
  merchandise: MerchandisePublic
  /** When provided, dialog open state is controlled (e.g. open after duplicate). */
  isOpen?: boolean
  onOpenChange?: (open: boolean) => void
}

const EditMerchandise = ({
  merchandise,
  isOpen: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: EditMerchandiseProps) => {
  const [internalOpen, setInternalOpen] = useState(false)
  const isControlled = controlledOpen !== undefined && controlledOnOpenChange != null
  const isOpen = isControlled ? controlledOpen : internalOpen
  const setOpen = isControlled ? controlledOnOpenChange : setInternalOpen
  const queryClient = useQueryClient()
  const { showSuccessToast } = useCustomToast()
  const contentRef = useRef(null)
  const variationsTableRef = useRef<VariationsTableRef>(null)
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
      price: merchandise.price / 100,
      quantity_available: merchandise.quantity_available,
    },
  })

  useEffect(() => {
    if (isOpen) {
      reset({
        name: merchandise.name,
        description: merchandise.description ?? "",
        price: merchandise.price / 100,
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
      setOpen(false)
    },
    onError: (err: ApiError) => {
      handleError(err)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["merchandise"] })
    },
  })

  const onSubmit: SubmitHandler<MerchandiseUpdate> = async (data) => {
    mutation.mutate({
      ...data,
      price: data.price != null ? Math.round(data.price * 100) : undefined,
    })
  }

  const { data: variations = [], isSuccess: variationsLoaded } = useQuery({
    queryKey: ["merchandise", merchandise.id, "variations"],
    queryFn: () =>
      MerchandiseService.listMerchandiseVariations({
        merchandiseId: merchandise.id,
      }),
    enabled: isOpen && !!merchandise.id,
  })

  const updateVariationMutation = useMutation({
    mutationFn: ({
      variationId,
      requestBody,
    }: {
      variationId: string
      requestBody: MerchandiseVariationUpdate
    }) =>
      MerchandiseService.updateMerchandiseVariation({
        merchandiseId: merchandise.id,
        variationId,
        requestBody,
      }),
    onSuccess: () => {
      showSuccessToast("Variation updated.")
      variationsTableRef.current?.closeEdit()
    },
    onError: (err: ApiError) => {
      handleError(err)
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ["merchandise", merchandise.id, "variations"],
      })
      queryClient.invalidateQueries({ queryKey: ["merchandise"] })
    },
  })

  const createVariationMutation = useMutation({
    mutationFn: (requestBody: {
      variant_value: string
      quantity_total: number
    }) =>
      MerchandiseService.createMerchandiseVariation({
        merchandiseId: merchandise.id,
        requestBody: {
          merchandise_id: merchandise.id,
          variant_value: requestBody.variant_value,
          quantity_total: requestBody.quantity_total,
        },
      }),
    onSuccess: () => {
      showSuccessToast("Variation added.")
    },
    onError: (err: ApiError) => {
      handleError(err)
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ["merchandise", merchandise.id, "variations"],
      })
      queryClient.invalidateQueries({ queryKey: ["merchandise"] })
    },
  })

  const hasVariations = variations.length > 0

  return (
    <DialogRoot
      size={{ base: "md", md: "xl" }}
      placement="center"
      open={isOpen}
      onOpenChange={({ open }) => setOpen(open)}
    >
      {!isControlled && (
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm" color="dark.accent.primary">
            <FaExchangeAlt fontSize="16px" />
            Edit
          </Button>
        </DialogTrigger>
      )}
      <DialogContent ref={contentRef} maxW="2xl">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>Edit Merchandise</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <Text mb={4}>Update the merchandise details below.</Text>
            <VStack gap={4}>
              <Grid
                templateColumns={{ base: "1fr", md: "1fr 1fr 1fr" }}
                gap={4}
                width="100%"
              >
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
                        message:
                          "Description cannot exceed 2000 characters",
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
              </Grid>
              {!hasVariations && (
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
              )}
              {hasVariations && variationsLoaded && (
                <VariationsTable
                  ref={variationsTableRef}
                  variations={variations}
                  onUpdateVariation={(variationId, requestBody) =>
                    updateVariationMutation.mutate({
                      variationId,
                      requestBody,
                    })
                  }
                  onAddVariation={async (data) => {
                    await createVariationMutation.mutateAsync(data)
                  }}
                  isUpdating={updateVariationMutation.isPending}
                  isAdding={createVariationMutation.isPending}
                />
              )}
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
