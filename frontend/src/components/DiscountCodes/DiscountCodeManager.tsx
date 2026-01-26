import {
  Box,
  Button,
  Checkbox,
  HStack,
  IconButton,
  Input,
  Heading,
  Table,
  Text,
  VStack,
} from "@chakra-ui/react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { FiEdit, FiPlus, FiTrash2 } from "react-icons/fi"

import {
  DiscountCodesService,
  type DiscountCodeCreate,
  type DiscountCodePublic,
  type DiscountCodeUpdate,
} from "@/client"
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"

interface DiscountCodeManagerProps {
  // Add any props if needed
}

export default function DiscountCodeManager({}: DiscountCodeManagerProps) {
  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<Partial<DiscountCodeCreate>>({
    code: "",
    description: "",
    discount_type: "percentage",
    discount_value: 0,
    max_uses: null,
    is_active: true,
    valid_from: null,
    valid_until: null,
    min_order_amount: null,
    max_discount_amount: null,
    is_access_code: false,
    access_code_mission_id: null,
  })

  const queryClient = useQueryClient()
  const { showSuccessToast } = useCustomToast()

  // Fetch discount codes
  const { data: discountCodes, isLoading } = useQuery({
    queryKey: ["discount-codes"],
    queryFn: () => DiscountCodesService.listDiscountCodes({ limit: 100 }),
  })

  // Create discount code mutation
  const createMutation = useMutation({
    mutationFn: (data: DiscountCodeCreate) =>
      DiscountCodesService.createDiscountCode({ requestBody: data }),
    onSuccess: () => {
      showSuccessToast("Discount code created successfully")
      setIsAdding(false)
      resetForm()
      queryClient.invalidateQueries({ queryKey: ["discount-codes"] })
    },
    onError: handleError,
  })

  // Update discount code mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: DiscountCodeUpdate }) =>
      DiscountCodesService.updateDiscountCode({
        discountCodeId: id,
        requestBody: data,
      }),
    onSuccess: () => {
      showSuccessToast("Discount code updated successfully")
      setEditingId(null)
      resetForm()
      queryClient.invalidateQueries({ queryKey: ["discount-codes"] })
    },
    onError: handleError,
  })

  // Delete discount code mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      DiscountCodesService.deleteDiscountCode({ discountCodeId: id }),
    onSuccess: () => {
      showSuccessToast("Discount code deleted successfully")
      queryClient.invalidateQueries({ queryKey: ["discount-codes"] })
    },
    onError: handleError,
  })

  const resetForm = () => {
    setFormData({
      code: "",
      description: "",
      discount_type: "percentage",
      discount_value: 0,
      max_uses: null,
      is_active: true,
      valid_from: null,
      valid_until: null,
      min_order_amount: null,
      max_discount_amount: null,
      is_access_code: false,
      access_code_mission_id: null,
    })
  }

  const startEdit = (discountCode: DiscountCodePublic) => {
    setEditingId(discountCode.id)
    setFormData({
      code: discountCode.code,
      description: discountCode.description || "",
      discount_type: discountCode.discount_type,
      discount_value: discountCode.discount_value,
      max_uses: discountCode.max_uses,
      is_active: discountCode.is_active,
      valid_from: discountCode.valid_from,
      valid_until: discountCode.valid_until,
      min_order_amount: discountCode.min_order_amount,
      max_discount_amount: discountCode.max_discount_amount,
      is_access_code: discountCode.is_access_code || false,
      access_code_mission_id: discountCode.access_code_mission_id || null,
    })
  }

  const cancelEdit = () => {
    setEditingId(null)
    setIsAdding(false)
    resetForm()
  }

  const handleSubmit = () => {
    // Allow discount_value to be 0 (especially for access codes)
    if (!formData.code || formData.discount_value === undefined || formData.discount_value === null) return

    const data = {
      ...formData,
      code: formData.code!,
      discount_type: formData.discount_type!,
      discount_value: formData.discount_value!,
    } as DiscountCodeCreate

    if (editingId) {
      updateMutation.mutate({ id: editingId, data })
    } else {
      createMutation.mutate(data)
    }
  }

  if (isLoading) {
    return <Text>Loading discount codes...</Text>
  }

  return (
    <VStack align="stretch" gap={6}>
      <HStack justify="space-between" alignItems="center" py={2}>
        <Heading size="lg">
          Discount Codes Management
        </Heading>
        {!isAdding && !editingId && (
          <Button size="sm" onClick={() => setIsAdding(true)}>
            <FiPlus style={{ marginRight: "4px" }} />
            Add Discount Code
          </Button>
        )}
      </HStack>

      {/* Add/Edit Form */}
      {(isAdding || editingId) && (
        <Box p={4} borderWidth="1px" borderRadius="md">
          <VStack gap={3}>
            <HStack width="100%">
              <Box flex={1}>
                <Text fontSize="sm" mb={1}>
                  Code
                </Text>
                <Input
                  value={formData.code || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, code: e.target.value })
                  }
                  placeholder="DISCOUNT10"
                />
              </Box>
              <Box flex={1}>
                <Text fontSize="sm" mb={1}>
                  Description
                </Text>
                <Input
                  value={formData.description || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="10% off for early birds"
                />
              </Box>
            </HStack>

            <HStack width="100%">
              <Box flex={1}>
                <Text fontSize="sm" mb={1}>
                  Type
                </Text>
                <select
                  value={formData.discount_type || "percentage"}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      discount_type: e.target.value as "percentage" | "fixed_amount",
                    })
                  }
                  style={{
                    width: "100%",
                    padding: "0.5rem",
                    borderRadius: "0.375rem",
                    border: "1px solid",
                    borderColor: "inherit",
                  }}
                >
                  <option value="percentage">Percentage</option>
                  <option value="fixed_amount">Fixed Amount</option>
                </select>
              </Box>
              <Box flex={1}>
                <Text fontSize="sm" mb={1}>
                  Value
                </Text>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.discount_value ?? ""}
                  onChange={(e) => {
                    const value = e.target.value
                    setFormData({
                      ...formData,
                      discount_value: value === "" ? 0 : Number.parseFloat(value) || 0,
                    })
                  }}
                  placeholder={formData.is_access_code ? "0 (no discount)" : "10"}
                />
                {formData.is_access_code && (
                  <Text fontSize="xs" color="gray.500" mt={1}>
                    Use 0 for access codes without discount
                  </Text>
                )}
              </Box>
            </HStack>

            <HStack width="100%">
              <Box flex={1}>
                <Text fontSize="sm" mb={1}>
                  Max Uses
                </Text>
                <Input
                  type="number"
                  min="1"
                  value={formData.max_uses || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      max_uses: e.target.value ? Number.parseInt(e.target.value) : null,
                    })
                  }
                  placeholder="Unlimited"
                />
              </Box>
              <Box flex={1}>
                <Text fontSize="sm" mb={1}>
                  Min Order Amount
                </Text>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.min_order_amount || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      min_order_amount: e.target.value ? Number.parseFloat(e.target.value) : null,
                    })
                  }
                  placeholder="No minimum"
                />
              </Box>
            </HStack>

            <HStack width="100%" alignItems="center">
              <Box flex={1}>
                <Checkbox.Root
                  checked={formData.is_access_code || false}
                  onCheckedChange={(details) =>
                    setFormData({
                      ...formData,
                      is_access_code: !!details.checked,
                    })
                  }
                >
                  <Checkbox.HiddenInput />
                  <Checkbox.Control />
                  <Checkbox.Label>
                    Early Bird Access Code
                  </Checkbox.Label>
                </Checkbox.Root>
                <Text fontSize="xs" color="gray.500" mt={1}>
                  When enabled, this code grants access to missions in "Early Bird" booking mode
                </Text>
              </Box>
            </HStack>

            <HStack width="100%" justify="flex-end">
              <Button size="sm" onClick={cancelEdit}>
                Cancel
              </Button>
              <Button
                size="sm"
                colorScheme="blue"
                onClick={handleSubmit}
                disabled={
                  !formData.code ||
                  formData.discount_value === undefined ||
                  formData.discount_value === null ||
                  createMutation.isPending ||
                  updateMutation.isPending
                }
                loading={createMutation.isPending || updateMutation.isPending}
              >
                {editingId ? "Update" : "Create"} Discount Code
              </Button>
            </HStack>
          </VStack>
        </Box>
      )}

      {/* Discount Codes List */}
      <Box>
        <Table.Root>
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeader>Code</Table.ColumnHeader>
              <Table.ColumnHeader>Description</Table.ColumnHeader>
              <Table.ColumnHeader>Type</Table.ColumnHeader>
              <Table.ColumnHeader>Value</Table.ColumnHeader>
              <Table.ColumnHeader>Uses</Table.ColumnHeader>
              <Table.ColumnHeader>Access Code</Table.ColumnHeader>
              <Table.ColumnHeader>Status</Table.ColumnHeader>
              <Table.ColumnHeader>Actions</Table.ColumnHeader>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {discountCodes?.map((discountCode) => (
              <Table.Row key={discountCode.id}>
                <Table.Cell>
                  <Text fontWeight="medium">{discountCode.code}</Text>
                </Table.Cell>
                <Table.Cell>
                  <Text fontSize="sm" color="gray.600">
                    {discountCode.description || "—"}
                  </Text>
                </Table.Cell>
                <Table.Cell>
                  <Text fontSize="sm">
                    {discountCode.discount_type === "percentage" ? "%" : "$"}
                  </Text>
                </Table.Cell>
                <Table.Cell>
                  <Text fontSize="sm">{discountCode.discount_value}</Text>
                </Table.Cell>
                <Table.Cell>
                  <Text fontSize="sm">
                    {discountCode.used_count}
                    {discountCode.max_uses ? ` / ${discountCode.max_uses}` : ""}
                  </Text>
                </Table.Cell>
                <Table.Cell>
                  <Text
                    fontSize="sm"
                    color={discountCode.is_access_code ? "blue.500" : "gray.400"}
                  >
                    {discountCode.is_access_code ? "Yes" : "No"}
                  </Text>
                </Table.Cell>
                <Table.Cell>
                  <Text
                    fontSize="sm"
                    color={discountCode.is_active ? "green.500" : "red.500"}
                  >
                    {discountCode.is_active ? "Active" : "Inactive"}
                  </Text>
                </Table.Cell>
                <Table.Cell>
                  <HStack>
                    <IconButton
                      aria-label="Edit discount code"
                      children={<FiEdit />}
                      size="sm"
                      variant="ghost"
                      onClick={() => startEdit(discountCode)}
                    />
                    <IconButton
                      aria-label="Delete discount code"
                      children={<FiTrash2 />}
                      size="sm"
                      variant="ghost"
                      colorScheme="red"
                      onClick={() => deleteMutation.mutate(discountCode.id)}
                      loading={deleteMutation.isPending}
                    />
                  </HStack>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
        {(!discountCodes || discountCodes.length === 0) && (
          <Text color="gray.500" textAlign="center" py={4}>
            No discount codes configured
          </Text>
        )}
      </Box>
    </VStack>
  )
}
