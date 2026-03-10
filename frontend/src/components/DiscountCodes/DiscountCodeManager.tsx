import {
  type DiscountCodeCreate,
  type DiscountCodePublic,
  type DiscountCodeUpdate,
  DiscountCodesService,
  LaunchesService,
  MissionsService,
  TripsService,
} from "@/client"
import useCustomToast from "@/hooks/useCustomToast"
import { useMissionsByLaunch } from "@/hooks/useMissionsByLaunch"
import { useTripsByMission } from "@/hooks/useTripsByMission"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { FiPlus } from "react-icons/fi"

import { handleError } from "@/utils"
import { getPublicOrigin } from "@/utils/url"

import DiscountCodeFormDialog from "./DiscountCodeFormDialog"
import DiscountCodesTable from "./DiscountCodesTable"

import { Button, Heading, HStack, Text, VStack } from "@chakra-ui/react"

type DiscountCodeManagerProps = {}

const initialFormData: Partial<DiscountCodeCreate> = {
  code: "",
  description: "",
  discount_type: "percentage",
  max_uses: null,
  is_active: true,
  valid_from: null,
  valid_until: null,
  min_order_amount: null,
  max_discount_amount: null,
  is_access_code: false,
  access_code_mission_id: null,
  restricted_trip_type: null,
  restricted_launch_id: null,
  restricted_mission_id: null,
  restricted_trip_id: null,
}

export default function DiscountCodeManager({}: DiscountCodeManagerProps) {
  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] =
    useState<Partial<DiscountCodeCreate>>(initialFormData)

  const queryClient = useQueryClient()
  const { showSuccessToast } = useCustomToast()

  const buildBookingUrl = (code: string, isAccessCode: boolean) => {
    return `${getPublicOrigin()}/book?${isAccessCode ? "access" : "discount"}=${encodeURIComponent(code)}`
  }

  const copyBookingUrl = (code: string, isAccessCode: boolean) => {
    void navigator.clipboard
      .writeText(buildBookingUrl(code, isAccessCode))
      .then(() => {
        showSuccessToast("Booking URL copied to clipboard")
      })
  }

  const { data: launchesData } = useQuery({
    queryKey: ["launches"],
    queryFn: () => LaunchesService.readLaunches(),
    enabled: isAdding || !!editingId,
  })
  const { missions: missionsByLaunch } = useMissionsByLaunch(
    formData.restricted_launch_id ?? undefined,
    (isAdding || !!editingId) && !!formData.restricted_launch_id,
  )
  const { data: allMissionsData } = useQuery({
    queryKey: ["missions"],
    queryFn: () => MissionsService.readMissions({ limit: 500 }),
    enabled: (isAdding || !!editingId) && !formData.restricted_launch_id,
  })
  const missions = formData.restricted_launch_id
    ? missionsByLaunch
    : allMissionsData?.data ?? []
  const { trips } = useTripsByMission(
    formData.restricted_mission_id ?? undefined,
    (isAdding || !!editingId) && !!formData.restricted_mission_id,
  )

  const { data: discountCodes, isLoading } = useQuery({
    queryKey: ["discount-codes"],
    queryFn: () => DiscountCodesService.listDiscountCodes({ limit: 100 }),
  })

  const { data: tableLaunches } = useQuery({
    queryKey: ["launches-table"],
    queryFn: () => LaunchesService.readLaunches(),
    enabled: !!discountCodes?.length,
  })
  const { data: tableMissions } = useQuery({
    queryKey: ["missions-table"],
    queryFn: () => MissionsService.readMissions({ limit: 500 }),
    enabled: !!discountCodes?.length,
  })
  const { data: tableTrips } = useQuery({
    queryKey: ["trips-table"],
    queryFn: () => TripsService.readTrips({ limit: 500 }),
    enabled: !!discountCodes?.length,
  })

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
    setFormData({ ...initialFormData })
  }

  const startEdit = (discountCode: DiscountCodePublic) => {
    setEditingId(discountCode.id)
    setFormData({
      code: discountCode.code,
      description: discountCode.description || "",
      discount_type: discountCode.discount_type,
      discount_value:
        discountCode.discount_type === "fixed_amount"
          ? discountCode.discount_value / 100
          : discountCode.discount_value <= 1
            ? discountCode.discount_value * 100
            : discountCode.discount_value,
      max_uses: discountCode.max_uses,
      is_active: discountCode.is_active,
      valid_from: discountCode.valid_from,
      valid_until: discountCode.valid_until,
      min_order_amount:
        discountCode.min_order_amount != null
          ? discountCode.min_order_amount / 100
          : null,
      max_discount_amount:
        discountCode.max_discount_amount != null
          ? discountCode.max_discount_amount / 100
          : null,
      is_access_code: discountCode.is_access_code || false,
      access_code_mission_id: discountCode.access_code_mission_id || null,
      restricted_trip_type: discountCode.restricted_trip_type || null,
      restricted_launch_id: discountCode.restricted_launch_id || null,
      restricted_mission_id: discountCode.restricted_mission_id || null,
      restricted_trip_id: discountCode.restricted_trip_id || null,
    })
  }

  const cancelEdit = () => {
    setEditingId(null)
    setIsAdding(false)
    resetForm()
  }

  const handleSubmit = () => {
    if (!formData.code) return

    const rawValue = formData.discount_value ?? 0
    const discountValue =
      formData.discount_type === "fixed_amount"
        ? Math.round(rawValue * 100)
        : rawValue / 100
    const data = {
      ...formData,
      code: formData.code!,
      discount_type: formData.discount_type!,
      discount_value: discountValue,
      min_order_amount:
        formData.min_order_amount != null
          ? Math.round(formData.min_order_amount * 100)
          : null,
      max_discount_amount:
        formData.max_discount_amount != null
          ? Math.round(formData.max_discount_amount * 100)
          : null,
      restricted_trip_type: formData.restricted_trip_type || null,
      restricted_launch_id: formData.restricted_launch_id || null,
      restricted_mission_id: formData.restricted_mission_id || null,
      restricted_trip_id: formData.restricted_trip_id || null,
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
      <HStack
        justify="space-between"
        alignItems="center"
        py={2}
        flexWrap="wrap"
        gap={3}
      >
        <Heading size="lg">Discount Codes Management</Heading>
        <Button size="sm" onClick={() => setIsAdding(true)}>
          <FiPlus style={{ marginRight: "4px" }} />
          Add Discount Code
        </Button>
      </HStack>

      <DiscountCodeFormDialog
        open={isAdding || !!editingId}
        formData={formData}
        setFormData={setFormData}
        onSubmit={handleSubmit}
        onCancel={cancelEdit}
        isEdit={!!editingId}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
        launchesData={launchesData}
        missions={missions}
        trips={trips}
      />

      <DiscountCodesTable
        discountCodes={discountCodes}
        tableLaunches={tableLaunches?.data}
        tableMissions={tableMissions?.data}
        tableTrips={tableTrips?.data}
        onEdit={startEdit}
        onDelete={(id) => deleteMutation.mutate(id)}
        buildBookingUrl={buildBookingUrl}
        copyBookingUrl={copyBookingUrl}
        isDeleting={deleteMutation.isPending}
      />
    </VStack>
  )
}
