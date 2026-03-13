import { NativeSelect } from "@/components/ui/native-select"
import {
  Box,
  Button,
  Flex,
  HStack,
  IconButton,
  Input,
  Text,
  VStack,
} from "@chakra-ui/react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { FiPlus, FiTrash2 } from "react-icons/fi"

import {
  type ApiError,
  type TripMerchandisePublic,
  MerchandiseService,
  TripMerchandiseService,
} from "@/client"
import { formatCents, handleError } from "@/utils"

function formatMerchandiseQtyLine(item: TripMerchandisePublic): string {
  const hasVariations = (item.variations_availability?.length ?? 0) > 0
  const customSuffix =
    item.quantity_available_override != null
      ? ` / ${hasVariations ? item.quantity_available : item.quantity_available_override} (custom)`
      : ""
  return hasVariations
    ? `Qty: ${item.variations_availability!.map((v) => `${v.variant_value}: ${v.quantity_available}`).join(", ")} (default)${customSuffix}`
    : item.variant_options
      ? `Options: ${item.variant_options}. Qty: ${item.quantity_available_default} (default)${customSuffix}`
      : `Qty: ${item.quantity_available_default} (default)${customSuffix}`
}

interface MerchandiseTabProps {
  tripId: string
  isOpen: boolean
  onPendingChange: (hasPending: boolean) => void
}

const MerchandiseTab = ({ tripId, isOpen, onPendingChange }: MerchandiseTabProps) => {
  const queryClient = useQueryClient()

  const [isAdding, setIsAdding] = useState(false)
  const [form, setForm] = useState({
    merchandise_id: "",
    price_override: "",
    quantity_available_override: "",
  })

  useEffect(() => {
    onPendingChange(isAdding)
  }, [isAdding, onPendingChange])

  const { data: tripMerchandiseList } = useQuery({
    queryKey: ["trip-merchandise", tripId],
    queryFn: () =>
      TripMerchandiseService.listTripMerchandise({ tripId }),
    enabled: isOpen,
  })

  const { data: catalogMerchandise } = useQuery({
    queryKey: ["merchandise-catalog"],
    queryFn: () =>
      MerchandiseService.readMerchandiseList({ limit: 500, skip: 0 }),
    enabled: isOpen && isAdding,
  })

  useEffect(() => {
    if (
      isAdding &&
      catalogMerchandise?.data?.length &&
      !form.merchandise_id
    ) {
      const firstId = catalogMerchandise.data[0].id
      setForm((prev) => ({ ...prev, merchandise_id: firstId }))
    }
  }, [isAdding, catalogMerchandise?.data, form.merchandise_id])

  const createMutation = useMutation({
    mutationFn: (body: {
      trip_id: string
      merchandise_id: string
      price_override?: number | null
      quantity_available_override?: number | null
    }) =>
      TripMerchandiseService.createTripMerchandise({ requestBody: body }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trip-merchandise", tripId] })
      setIsAdding(false)
      setForm({
        merchandise_id: "",
        price_override: "",
        quantity_available_override: "",
      })
    },
    onError: (err: ApiError) => handleError(err),
  })

  const deleteMutation = useMutation({
    mutationFn: (tripMerchandiseId: string) =>
      TripMerchandiseService.deleteTripMerchandise({ tripMerchandiseId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trip-merchandise", tripId] })
    },
    onError: (err: ApiError) => handleError(err),
  })

  const handleAdd = () => {
    if (!form.merchandise_id) return
    createMutation.mutate({
      trip_id: tripId,
      merchandise_id: form.merchandise_id,
      price_override: form.price_override
        ? Math.round(Number.parseFloat(form.price_override) * 100)
        : null,
      quantity_available_override: form.quantity_available_override
        ? Number.parseInt(form.quantity_available_override, 10)
        : null,
    })
  }

  const handleRemove = (tripMerchandiseId: string) => {
    deleteMutation.mutate(tripMerchandiseId)
  }

  const resetForm = () => {
    setIsAdding(false)
    setForm({
      merchandise_id: "",
      price_override: "",
      quantity_available_override: "",
    })
  }

  return (
    <VStack gap={3} align="stretch">
      <Box>
        <VStack align="stretch" gap={2}>
          {tripMerchandiseList?.map((item) => (
            <Flex
              key={item.id}
              justify="space-between"
              align="center"
              p={2}
              borderWidth="1px"
              borderRadius="md"
            >
              <Box>
                <Text color="gray.100" fontWeight="medium">
                  {item.name}
                </Text>
                <Text
                  fontSize="xs"
                  color="gray.300"
                  mt={0.5}
                  lineHeight="1.2"
                >
                  Price: ${formatCents(item.price_default)} (default)
                  {item.price_override != null &&
                    ` / $${formatCents(item.price_override)} (custom)`}
                </Text>
                <VStack align="start" gap={0}>
                  <Text
                    fontSize="xs"
                    color="gray.500"
                    lineHeight="1.2"
                  >
                    {formatMerchandiseQtyLine(item)}
                  </Text>
                </VStack>
              </Box>
              <IconButton
                aria-label="Remove merchandise"
                size="sm"
                variant="ghost"
                colorPalette="red"
                onClick={() => handleRemove(item.id)}
                disabled={deleteMutation.isPending}
              >
                <FiTrash2 />
              </IconButton>
            </Flex>
          ))}
          {(!tripMerchandiseList ||
            tripMerchandiseList.length === 0) &&
            !isAdding && (
              <Text color="gray.500" textAlign="center" py={3}>
                No merchandise configured for this trip
              </Text>
            )}
        </VStack>
        {isAdding ? (
          <Box mt={2} p={3} borderWidth="1px" borderRadius="md">
            <VStack gap={3}>
              <HStack width="100%" align="stretch" gap={4}>
                <Box
                  flex={1}
                  display="flex"
                  flexDirection="column"
                  minW={0}
                >
                  <Text fontSize="sm" mb={1}>
                    Catalog item
                  </Text>
                  {(() => {
                    const selected = catalogMerchandise?.data?.find(
                      (m) => m.id === form.merchandise_id,
                    )
                    if (
                      !selected ||
                      (selected.variations?.length ?? 0) > 0
                    )
                      return null
                    return (
                      <Text
                        fontSize="xs"
                        color="gray.500"
                        mt={1}
                      >
                        No variants. Add variants in Merchandise
                        catalog to show per-option availability.
                      </Text>
                    )
                  })()}
                  <Box flex={1} minHeight={2} />
                  <NativeSelect
                    value={form.merchandise_id}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        merchandise_id: e.target.value,
                      })
                    }
                    placeholder="Select merchandise"
                  >
                    {catalogMerchandise?.data?.map((m) => {
                      const hasVariations =
                        (m.variations?.length ?? 0) > 0
                      const qtyLabel = hasVariations
                        ? m.variations!
                            .map(
                              (v) =>
                                `${v.variant_value}: ${v.quantity_total - v.quantity_sold}`,
                            )
                            .join(", ")
                        : m.variant_options
                          ? `${m.variant_options} (qty ${m.quantity_available})`
                          : `qty ${m.quantity_available}`
                      return (
                        <option key={m.id} value={m.id}>
                          {m.name} — ${formatCents(m.price)} (
                          {qtyLabel})
                        </option>
                      )
                    })}
                  </NativeSelect>
                </Box>
                <Box
                  flex={1}
                  display="flex"
                  flexDirection="column"
                  minW={0}
                >
                  <Text fontSize="sm" mb={1}>
                    Price override ($, optional)
                  </Text>
                  <Box flex={1} minHeight={2} />
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    value={form.price_override}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        price_override: e.target.value,
                      })
                    }
                    placeholder="Use catalog price"
                  />
                </Box>
                <Box
                  flex={1}
                  display="flex"
                  flexDirection="column"
                  minW={0}
                >
                  <Text fontSize="sm" mb={1}>
                    Quantity override (optional)
                  </Text>
                  {catalogMerchandise?.data?.find(
                    (m) => m.id === form.merchandise_id,
                  )?.variations?.length ? (
                    <Text fontSize="xs" color="gray.500" mt={1}>
                      Cap on total for this trip. Per-variant
                      availability comes from catalog.
                    </Text>
                  ) : null}
                  <Box flex={1} minHeight={2} />
                  <Input
                    type="number"
                    min={0}
                    value={form.quantity_available_override}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        quantity_available_override: e.target.value,
                      })
                    }
                    placeholder={
                      catalogMerchandise?.data?.find(
                        (m) => m.id === form.merchandise_id,
                      )?.variations?.length
                        ? "Max total for trip"
                        : "Use catalog qty"
                    }
                  />
                </Box>
              </HStack>
              <HStack width="100%" justify="flex-end">
                <Button size="sm" onClick={resetForm}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  colorPalette="blue"
                  onClick={handleAdd}
                  disabled={
                    !form.merchandise_id ||
                    createMutation.isPending
                  }
                >
                  Add Merchandise
                </Button>
              </HStack>
            </VStack>
          </Box>
        ) : (
          <Button
            size="sm"
            variant="outline"
            mt={2}
            onClick={() => setIsAdding(true)}
          >
            <FiPlus style={{ marginRight: "4px" }} />
            Add Merchandise
          </Button>
        )}
      </Box>
    </VStack>
  )
}

export { MerchandiseTab }
export type { MerchandiseTabProps }
