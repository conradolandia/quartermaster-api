import useCustomToast from "@/hooks/useCustomToast"
import {
  Box,
  Button,
  ButtonGroup,
  Flex,
  IconButton,
  Input,
  NumberInput,
  Text,
  VStack,
} from "@chakra-ui/react"
import { useRef, useState } from "react"
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
import { FiTrash2 } from "react-icons/fi"

import {
  type ApiError,
  type MerchandiseCreate,
  MerchandiseService,
} from "@/client"
import { handleError } from "@/utils"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Controller, type SubmitHandler, useForm } from "react-hook-form"
import { Field } from "../ui/field"

type PendingVariation = { variant_value: string; quantity_total: number }

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
  const [pendingVariations, setPendingVariations] = useState<
    PendingVariation[]
  >([])
  const [newVariantValue, setNewVariantValue] = useState("")
  const [newQuantity, setNewQuantity] = useState(0)

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
    },
  })

  const createMerchandiseMutation = useMutation({
    mutationFn: (data: MerchandiseCreate) =>
      MerchandiseService.createMerchandise({ requestBody: data }),
    onError: (error: ApiError) => {
      handleError(error)
    },
  })

  const createVariationMutation = useMutation({
    mutationFn: ({
      merchandiseId,
      variant_value,
      quantity_total,
    }: {
      merchandiseId: string
      variant_value: string
      quantity_total: number
    }) =>
      MerchandiseService.createMerchandiseVariation({
        merchandiseId,
        requestBody: {
          merchandise_id: merchandiseId,
          variant_value,
          quantity_total,
        },
      }),
    onError: (error: ApiError) => {
      handleError(error)
    },
  })

  const hasPendingVariations = pendingVariations.length > 0

  const addPendingVariation = () => {
    const value = newVariantValue.trim()
    if (!value) return
    setPendingVariations((prev) => [
      ...prev,
      { variant_value: value, quantity_total: newQuantity },
    ])
    setNewVariantValue("")
    setNewQuantity(0)
  }

  const removePendingVariation = (index: number) => {
    setPendingVariations((prev) => prev.filter((_, i) => i !== index))
  }

  const finishSuccess = () => {
    showSuccessToast("Merchandise was successfully added")
    reset()
    setPendingVariations([])
    setNewVariantValue("")
    setNewQuantity(0)
    queryClient.invalidateQueries({ queryKey: ["merchandise"] })
    onSuccess()
    onClose()
  }

  const onSubmit: SubmitHandler<MerchandiseCreate> = async (data) => {
    const payload = {
      ...data,
      price: Math.round(data.price * 100),
    }
    if (!hasPendingVariations) {
      createMerchandiseMutation.mutate(payload, {
        onSuccess: finishSuccess,
      })
      return
    }
    try {
      const created = await createMerchandiseMutation.mutateAsync({
        ...payload,
        quantity_available: 0,
      })
      for (const pv of pendingVariations) {
        await createVariationMutation.mutateAsync({
          merchandiseId: created.id,
          variant_value: pv.variant_value,
          quantity_total: pv.quantity_total,
        })
      }
      finishSuccess()
    } catch {
      // Errors handled in mutation onError
    }
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
              {!hasPendingVariations && (
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
                        onValueChange={(e) =>
                          onChange(e.valueAsNumber ?? 0)
                        }
                        min={0}
                        step={1}
                      >
                        <NumberInput.Input />
                      </NumberInput.Root>
                    )}
                  />
                </Field>
              )}
              {hasPendingVariations && (
                <Field
                  label="Variations (inventory per variant)"
                  helperText="Add variants (name + quantity). Each variant is one option in the booking catalog."
                >
                  <VStack gap={3} align="stretch" width="100%">
                    {pendingVariations.map((pv, index) => (
                      <Flex
                        key={`${pv.variant_value}-${index}`}
                        align="center"
                        gap={4}
                        py={2}
                        px={3}
                        borderRadius="md"
                        bg="bg.muted"
                        flexWrap="wrap"
                      >
                        <Box minW="80px" flex={1}>
                          <Text fontWeight="medium" fontSize="sm" color="text.muted">
                            Variant
                          </Text>
                          <Text>{pv.variant_value}</Text>
                        </Box>
                        <Box minW="56px" textAlign="center">
                          <Text
                            fontWeight="medium"
                            fontSize="sm"
                            color="text.muted"
                          >
                            Quantity
                          </Text>
                          <Text>{pv.quantity_total}</Text>
                        </Box>
                        <IconButton
                          aria-label="Remove variation"
                          variant="ghost"
                          size="sm"
                          onClick={() => removePendingVariation(index)}
                        >
                          <FiTrash2 />
                        </IconButton>
                      </Flex>
                    ))}
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
                          onChange={(e) =>
                            setNewVariantValue(e.target.value)
                          }
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
                        onClick={addPendingVariation}
                        disabled={!newVariantValue.trim()}
                      >
                        Add
                      </Button>
                    </Flex>
                  </VStack>
                </Field>
              )}
              {!hasPendingVariations && (
                <Field
                  label="Variations (optional)"
                  helperText="Add variants to show multiple options (e.g. sizes). Leave empty for a single quantity."
                >
                  <Flex align="flex-end" gap={4} flexWrap="wrap">
                    <Field label="Variant name" flex={1} minW="120px">
                      <Input
                        size="sm"
                        placeholder="e.g. XL"
                        value={newVariantValue}
                        onChange={(e) =>
                          setNewVariantValue(e.target.value)
                        }
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
                      variant="outline"
                      onClick={addPendingVariation}
                      disabled={!newVariantValue.trim()}
                    >
                      Add variant
                    </Button>
                  </Flex>
                </Field>
              )}
            </VStack>
          </DialogBody>
          <DialogFooter gap={2}>
            <ButtonGroup>
              <DialogActionTrigger asChild>
                <Button
                  variant="subtle"
                  colorPalette="gray"
                  disabled={
                    isSubmitting ||
                    createMerchandiseMutation.isPending ||
                    createVariationMutation.isPending
                  }
                >
                  Cancel
                </Button>
              </DialogActionTrigger>
              <Button
                variant="solid"
                type="submit"
                loading={
                  isSubmitting ||
                  createMerchandiseMutation.isPending ||
                  createVariationMutation.isPending
                }
                disabled={
                  isSubmitting ||
                  createMerchandiseMutation.isPending ||
                  createVariationMutation.isPending
                }
              >
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
