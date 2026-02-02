import {
  Box,
  Button,
  ButtonGroup,
  DialogActionTrigger,
  Flex,
  Grid,
  IconButton,
  Input,
  NumberInput,
  Text,
  VStack,
} from "@chakra-ui/react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react"
import { Controller, type SubmitHandler, useForm } from "react-hook-form"
import { FaExchangeAlt } from "react-icons/fa"
import { FiEdit } from "react-icons/fi"

import {
  type ApiError,
  type MerchandisePublic,
  type MerchandiseVariationPublic,
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

export type VariationsTableRef = { closeEdit: () => void }

const VariationsTable = forwardRef<
  VariationsTableRef,
  {
    variations: MerchandiseVariationPublic[]
    onUpdateVariation: (
      variationId: string,
      data: {
        variant_value?: string
        quantity_total: number
        quantity_sold: number
        quantity_fulfilled: number
      },
    ) => void
    onAddVariation: (data: {
      variant_value: string
      quantity_total: number
    }) => Promise<void>
    isUpdating: boolean
    isAdding: boolean
  }
>(function VariationsTable(
  {
    variations,
    onUpdateVariation,
    onAddVariation,
    isUpdating,
    isAdding,
  },
  ref
) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editVariantValue, setEditVariantValue] = useState("")
  const [editQuantityTotal, setEditQuantityTotal] = useState(0)
  const [editQuantitySold, setEditQuantitySold] = useState(0)
  const [editQuantityFulfilled, setEditQuantityFulfilled] = useState(0)
  const [newVariantValue, setNewVariantValue] = useState("")
  const [newQuantity, setNewQuantity] = useState(0)

  useImperativeHandle(ref, () => ({
    closeEdit: () => setEditingId(null),
  }))

  const startEdit = (v: MerchandiseVariationPublic) => {
    setEditingId(v.id)
    setEditVariantValue(v.variant_value ?? "")
    setEditQuantityTotal(v.quantity_total)
    setEditQuantitySold(v.quantity_sold)
    setEditQuantityFulfilled(v.quantity_fulfilled)
  }

  const cancelEdit = () => setEditingId(null)

  const saveEdit = () => {
    if (editingId != null) {
      onUpdateVariation(editingId, {
        variant_value: editVariantValue,
        quantity_total: editQuantityTotal,
        quantity_sold: editQuantitySold,
        quantity_fulfilled: editQuantityFulfilled,
      })
    }
  }

  return (
    <Field label="Variations (inventory per variant)">
      <VStack gap={3} align="stretch" width="100%">
        {/* List: read-only rows + edit button; when editing, one row shows edit panel below it */}
        {variations.map((v) => {
          const isEditing = editingId === v.id
          return (
            <Box key={v.id}>
              <Flex
                align="center"
                gap={4}
                py={2}
                bg={isEditing ? "bg.muted" : undefined}
                flexWrap="wrap"
              >
                <Box minW="80px" flex={1}>
                  <Text fontWeight="medium" fontSize="sm" color="text.muted">
                    Variant
                  </Text>
                  <Text>{v.variant_value || "(none)"}</Text>
                </Box>
                <Box minW="56px" textAlign="center">
                  <Text fontWeight="medium" fontSize="sm" color="text.muted">
                    Total
                  </Text>
                  <Text>{v.quantity_total}</Text>
                </Box>
                <Box minW="56px" textAlign="center">
                  <Text fontWeight="medium" fontSize="sm" color="text.muted">
                    Sold
                  </Text>
                  <Text>{v.quantity_sold}</Text>
                </Box>
                <Box minW="56px" textAlign="center">
                  <Text fontWeight="medium" fontSize="sm" color="text.muted">
                    Fulfilled
                  </Text>
                  <Text>{v.quantity_fulfilled}</Text>
                </Box>
                <Box minW="56px" textAlign="center">
                  <Text fontWeight="medium" fontSize="sm" color="text.muted">
                    Unfulfilled
                  </Text>
                  <Text>{v.quantity_sold - v.quantity_fulfilled}</Text>
                </Box>
                <Box>
                  {isEditing ? (
                    <ButtonGroup size="xs">
                      <Button
                        variant="outline"
                        onClick={cancelEdit}
                        disabled={isUpdating}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={saveEdit}
                        loading={isUpdating}
                        disabled={isUpdating}
                      >
                        Save
                      </Button>
                    </ButtonGroup>
                  ) : (
                    <IconButton
                      aria-label="Edit variation"
                      variant="ghost"
                      size="sm"
                      onClick={() => startEdit(v)}
                    >
                      <FiEdit />
                    </IconButton>
                  )}
                </Box>
              </Flex>
              {/* Edit panel: only when this row is being edited; separate block of labeled fields */}
              {isEditing && (
                <Box
                  key={`edit-${v.id}`}
                  mt={2}
                  p={4}
                  borderRadius="md"
                  borderWidth="1px"
                  borderColor="border"
                >
                  <Grid
                    templateColumns={{ base: "1fr", sm: "1fr 1fr" }}
                    gap={4}
                    maxW="md"
                  >
                    <Field label="Variant name">
                      <Input
                        id={`variation-edit-${v.id}-variant`}
                        size="sm"
                        value={editVariantValue}
                        onChange={(e) =>
                          setEditVariantValue(e.target.value)
                        }
                        placeholder="e.g. XL"
                        maxLength={128}
                      />
                    </Field>
                    <Field label="Total">
                      <NumberInput.Root
                        value={String(editQuantityTotal)}
                        onValueChange={(e) =>
                          setEditQuantityTotal(e.valueAsNumber ?? 0)
                        }
                        min={0}
                        step={1}
                        size="sm"
                      >
                        <NumberInput.Input
                          id={`variation-edit-${v.id}-total`}
                        />
                      </NumberInput.Root>
                    </Field>
                    <Field label="Sold">
                      <NumberInput.Root
                        value={String(editQuantitySold)}
                        onValueChange={(e) =>
                          setEditQuantitySold(e.valueAsNumber ?? 0)
                        }
                        min={0}
                        step={1}
                        size="sm"
                      >
                        <NumberInput.Input
                          id={`variation-edit-${v.id}-sold`}
                        />
                      </NumberInput.Root>
                    </Field>
                    <Field label="Fulfilled">
                      <NumberInput.Root
                        value={String(editQuantityFulfilled)}
                        onValueChange={(e) =>
                          setEditQuantityFulfilled(e.valueAsNumber ?? 0)
                        }
                        min={0}
                        step={1}
                        size="sm"
                      >
                        <NumberInput.Input
                          id={`variation-edit-${v.id}-fulfilled`}
                        />
                      </NumberInput.Root>
                    </Field>
                  </Grid>
                </Box>
              )}
            </Box>
          )
        })}
        {/* Add new variant */}
        <Flex
          align="flex-end"
          gap={4}
          py={3}
          flexWrap="wrap"
          borderTopWidth="1px"
          borderColor="border"
        >
          <Field label="New variant" flex={1} minW="120px">
            <Input
              size="sm"
              placeholder="e.g. XL"
              value={newVariantValue}
              onChange={(e) => setNewVariantValue(e.target.value)}
            />
          </Field>
          <Field label="Quantity" width="100px">
            <NumberInput.Root
              value={String(newQuantity)}
              onValueChange={(e) =>
                setNewQuantity(e.valueAsNumber ?? 0)
              }
              min={0}
              step={1}
              size="sm"
            >
              <NumberInput.Input />
            </NumberInput.Root>
          </Field>
          <Button
            size="sm"
            onClick={async () => {
              const value = newVariantValue.trim()
              if (!value) return
              await onAddVariation({
                variant_value: value,
                quantity_total: newQuantity,
              })
              setNewVariantValue("")
              setNewQuantity(0)
            }}
            disabled={isAdding || !newVariantValue.trim()}
            loading={isAdding}
          >
            Add
          </Button>
        </Flex>
      </VStack>
    </Field>
  )
})

interface EditMerchandiseProps {
  merchandise: MerchandisePublic
}

const EditMerchandise = ({ merchandise }: EditMerchandiseProps) => {
  const [isOpen, setIsOpen] = useState(false)
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
      onOpenChange={({ open }) => setIsOpen(open)}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <FaExchangeAlt fontSize="16px" />
          Edit
        </Button>
      </DialogTrigger>
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
