import type { DiscountCodeCreate } from "@/client"
import {
  DialogActionTrigger,
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
} from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import {
  Box,
  Button,
  ButtonGroup,
  Checkbox,
  Flex,
  HStack,
  Input,
  Text,
  VStack,
} from "@chakra-ui/react"
import { NativeSelect } from "@/components/ui/native-select"

interface DiscountCodeFormDialogProps {
  open: boolean
  formData: Partial<DiscountCodeCreate>
  setFormData: React.Dispatch<React.SetStateAction<Partial<DiscountCodeCreate>>>
  onSubmit: () => void
  onCancel: () => void
  isEdit: boolean
  isSubmitting: boolean
  launchesData: { data?: Array<{ id: string; name: string }> } | undefined
  missions: Array<{ id: string; name: string }>
  trips: Array<{ id: string; name?: string | null; type: string }>
}

export default function DiscountCodeFormDialog({
  open,
  formData,
  setFormData,
  onSubmit,
  onCancel,
  isEdit,
  isSubmitting,
  launchesData,
  missions,
  trips,
}: DiscountCodeFormDialogProps) {
  return (
    <DialogRoot
      size={{ base: "xs", md: "lg" }}
      placement="center"
      open={open}
      onOpenChange={({ open: o }) => !o && onCancel()}
    >
      <DialogContent>
        <DialogCloseTrigger />
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit Discount Code" : "Add Discount Code"}
          </DialogTitle>
        </DialogHeader>
        <DialogBody>
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
                      discount_type: e.target.value as
                        | "percentage"
                        | "fixed_amount",
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
                  value={
                    formData.discount_value !== undefined &&
                    formData.discount_value !== null
                      ? formData.discount_value
                      : ""
                  }
                  onChange={(e) => {
                    const value = e.target.value
                    setFormData({
                      ...formData,
                      discount_value:
                        value === ""
                          ? undefined
                          : Number.parseFloat(value) ?? undefined,
                    })
                  }}
                  placeholder={
                    formData.is_access_code
                      ? "0 (no discount)"
                      : "10 or leave empty for 0"
                  }
                />
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
                      max_uses: e.target.value
                        ? Number.parseInt(e.target.value)
                        : null,
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
                      min_order_amount: e.target.value
                        ? Number.parseFloat(e.target.value)
                        : null,
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
                  <Checkbox.Label>Early Bird Access Code</Checkbox.Label>
                </Checkbox.Root>
                <Text fontSize="xs" color="gray.500" mt={1}>
                  When enabled, this code grants access to missions in "Early
                  Bird" booking mode
                </Text>
              </Box>
            </HStack>

            <HStack width="100%" alignItems="center">
              <Box flex={1}>
                <Flex
                  alignItems="center"
                  justifyContent="space-between"
                  width="100%"
                >
                  <Text fontSize="sm">Active</Text>
                  <Box
                    onClick={() => {
                      setFormData({
                        ...formData,
                        is_active: !formData.is_active,
                      })
                    }}
                    cursor="pointer"
                  >
                    <Switch
                      checked={formData.is_active ?? true}
                      inputProps={{ id: "is_active" }}
                    />
                  </Box>
                </Flex>
                <Text fontSize="xs" color="gray.500" mt={1}>
                  When disabled, this discount code cannot be used
                </Text>
              </Box>
            </HStack>

            <Text fontSize="sm" fontWeight="medium" mt={2}>
              Restrictions (optional)
            </Text>
            <Text fontSize="xs" color="gray.500" mb={2}>
              Limit where this code can be used. Leave empty for no restriction.
            </Text>
            <HStack width="100%">
              <Box flex={1}>
                <Text fontSize="sm" mb={1}>
                  Trip Type
                </Text>
                <NativeSelect
                  value={formData.restricted_trip_type || ""}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                    setFormData({
                      ...formData,
                      restricted_trip_type: e.target.value || null,
                    })
                  }
                >
                  <option value="">Any</option>
                  <option value="launch_viewing">Launch Viewing</option>
                  <option value="pre_launch">Pre-Launch</option>
                </NativeSelect>
              </Box>
              <Box flex={1}>
                <Text fontSize="sm" mb={1}>
                  Launch
                </Text>
                <NativeSelect
                  value={formData.restricted_launch_id || ""}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                    setFormData({
                      ...formData,
                      restricted_launch_id: e.target.value || null,
                      restricted_mission_id: null,
                      restricted_trip_id: null,
                    })
                  }
                >
                  <option value="">Any</option>
                  {launchesData?.data?.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </NativeSelect>
              </Box>
            </HStack>
            <HStack width="100%">
              <Box flex={1}>
                <Text fontSize="sm" mb={1}>
                  Mission
                </Text>
                <NativeSelect
                  value={formData.restricted_mission_id || ""}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                    setFormData({
                      ...formData,
                      restricted_mission_id: e.target.value || null,
                      restricted_trip_id: null,
                    })
                  }
                >
                  <option value="">Any</option>
                  {missions.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </NativeSelect>
              </Box>
              <Box flex={1}>
                <Text fontSize="sm" mb={1}>
                  Trip
                </Text>
                <NativeSelect
                  value={formData.restricted_trip_id || ""}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                    setFormData({
                      ...formData,
                      restricted_trip_id: e.target.value || null,
                    })
                  }
                >
                  <option value="">Any</option>
                  {trips.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name || t.type}
                    </option>
                  ))}
                </NativeSelect>
              </Box>
            </HStack>
          </VStack>
        </DialogBody>
        <DialogFooter gap={2}>
          <ButtonGroup>
            <DialogActionTrigger asChild>
              <Button variant="outline">Cancel</Button>
            </DialogActionTrigger>
            <Button
              colorPalette="blue"
              onClick={onSubmit}
              disabled={
                !formData.code || isSubmitting
              }
              loading={isSubmitting}
            >
              {isEdit ? "Update" : "Create"} Discount Code
            </Button>
          </ButtonGroup>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  )
}
