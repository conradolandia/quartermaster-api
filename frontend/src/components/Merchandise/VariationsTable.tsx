import type { MerchandiseVariationPublic } from "@/client"
import {
  Box,
  Button,
  ButtonGroup,
  Flex,
  Grid,
  IconButton,
  Input,
  NumberInput,
  Text,
  VStack,
} from "@chakra-ui/react"
import { forwardRef, useImperativeHandle, useState } from "react"
import { FiEdit } from "react-icons/fi"

import { Field } from "../ui/field"

export type VariationsTableRef = { closeEdit: () => void }

interface VariationsTableProps {
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

const VariationsTable = forwardRef<VariationsTableRef, VariationsTableProps>(
  function VariationsTable(
    {
      variations,
      onUpdateVariation,
      onAddVariation,
      isUpdating,
      isAdding,
    },
    ref,
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
  },
)

export default VariationsTable
