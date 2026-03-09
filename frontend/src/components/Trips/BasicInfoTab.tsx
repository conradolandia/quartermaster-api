import { NativeSelect } from "@/components/ui/native-select"
import { Box, Flex, Input, Text, VStack } from "@chakra-ui/react"
import type { RefObject } from "react"

import { MissionDropdown } from "@/components/Common/MissionDropdown"
import { Field } from "@/components/ui/field"
import { Switch } from "@/components/ui/switch"
import {
  formatInLocationTimezone,
  formatLocationTimezoneDisplay,
} from "@/utils"

interface BasicInfoTabProps {
  missionId: string
  setMissionId: (id: string) => void
  name: string
  setName: (name: string) => void
  type: string
  setType: (type: string) => void
  bookingMode: string
  setBookingMode: (mode: string) => void
  salesOpenAt: string
  setSalesOpenAt: (val: string) => void
  departureTime: string
  setDepartureTime: (val: string) => void
  boardingMinutesBeforeDeparture: number
  setBoardingMinutesBeforeDeparture: (val: number) => void
  checkinMinutesBeforeBoarding: number
  setCheckinMinutesBeforeBoarding: (val: number) => void
  active: boolean
  setActive: (val: boolean) => void
  unlisted: boolean
  setUnlisted: (val: boolean) => void
  tz: string
  isPending: boolean
  contentRef: RefObject<HTMLElement>
}

const BasicInfoTab = ({
  missionId,
  setMissionId,
  name,
  setName,
  type,
  setType,
  bookingMode,
  setBookingMode,
  salesOpenAt,
  setSalesOpenAt,
  departureTime,
  setDepartureTime,
  boardingMinutesBeforeDeparture,
  setBoardingMinutesBeforeDeparture,
  checkinMinutesBeforeBoarding,
  setCheckinMinutesBeforeBoarding,
  active,
  setActive,
  unlisted,
  setUnlisted,
  tz,
  isPending,
  contentRef,
}: BasicInfoTabProps) => {
  return (
    <VStack gap={4}>
      <Field label="Mission" required>
        <MissionDropdown
          id="mission_id"
          value={missionId}
          onChange={setMissionId}
          isDisabled={isPending}
          portalRef={contentRef}
        />
      </Field>

      <Field
        label="Name"
        helperText="Optional custom label for this trip"
      >
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Trip name (optional)"
          disabled={isPending}
        />
      </Field>

      <Field label="Type" required>
        <NativeSelect
          id="type"
          value={type}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
            setType(e.target.value)
          }
          disabled={isPending}
        >
          <option value="launch_viewing">Launch Viewing</option>
          <option value="pre_launch">Pre-Launch</option>
        </NativeSelect>
      </Field>

      <Field
        label="Booking Mode"
        helperText="Controls who can book this trip"
      >
        <NativeSelect
          id="booking_mode"
          value={bookingMode}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
            const mode = e.target.value
            setBookingMode(mode)
            if (mode === "public") {
              setSalesOpenAt("")
              setUnlisted(false)
            }
          }}
          disabled={isPending}
        >
          <option value="private">Private (Admin Only)</option>
          <option value="early_bird">
            Early Bird (Access Code Required)
          </option>
          <option value="public">Public (Open to All)</option>
        </NativeSelect>
      </Field>

      <Field
        label={`Sales Open (${formatLocationTimezoneDisplay(tz)})`}
        helperText={
          bookingMode === "public"
            ? "Not used when booking mode is Public."
            : "Trip is not bookable until this time. Leave empty for no restriction. Cannot be in the past."
        }
      >
        <Input
          id="sales_open_at"
          type="datetime-local"
          value={salesOpenAt}
          onChange={(e) => setSalesOpenAt(e.target.value)}
          placeholder={`Enter time in ${tz}`}
          disabled={isPending || bookingMode === "public"}
          min={
            bookingMode !== "public" && tz
              ? formatInLocationTimezone(new Date(), tz)
              : undefined
          }
        />
      </Field>

      <Field
        label={`Departure Time (${formatLocationTimezoneDisplay(tz)})`}
        required
      >
        <Input
          id="departure_time"
          type="datetime-local"
          value={departureTime}
          onChange={(e) => setDepartureTime(e.target.value)}
          placeholder={`Enter time in ${tz}`}
          disabled={isPending}
        />
      </Field>

      <Field
        label="Boarding (minutes before departure)"
        helperText="When boarding starts relative to departure"
      >
        <Input
          id="boarding_minutes"
          type="number"
          min={0}
          value={boardingMinutesBeforeDeparture}
          onChange={(e) =>
            setBoardingMinutesBeforeDeparture(
              Math.max(0, parseInt(e.target.value, 10) || 0),
            )
          }
          disabled={isPending}
        />
      </Field>

      <Field
        label="Check-in (minutes before boarding)"
        helperText="When check-in opens relative to boarding"
      >
        <Input
          id="checkin_minutes"
          type="number"
          min={0}
          value={checkinMinutesBeforeBoarding}
          onChange={(e) =>
            setCheckinMinutesBeforeBoarding(
              Math.max(0, parseInt(e.target.value, 10) || 0),
            )
          }
          disabled={isPending}
        />
      </Field>

      <Field>
        <Flex
          alignItems="center"
          justifyContent="space-between"
          width="100%"
        >
          <Text>Active</Text>
          <Box
            onClick={() => setActive(!active)}
            cursor={isPending ? "not-allowed" : "pointer"}
            opacity={isPending ? 0.5 : 1}
          >
            <Switch
              checked={active}
              disabled={isPending}
              inputProps={{ id: "active" }}
            />
          </Box>
        </Flex>
      </Field>
      <Field
        helperText="Only visible via direct link; excluded from public listing."
      >
        <Flex
          alignItems="center"
          justifyContent="space-between"
          width="100%"
        >
          <Text>Unlisted</Text>
          <Box
            onClick={() => setUnlisted(!unlisted)}
            cursor={isPending ? "not-allowed" : "pointer"}
            opacity={isPending ? 0.5 : 1}
          >
            <Switch
              checked={unlisted}
              disabled={isPending}
              inputProps={{ id: "unlisted" }}
            />
          </Box>
        </Flex>
      </Field>
    </VStack>
  )
}

export default BasicInfoTab
