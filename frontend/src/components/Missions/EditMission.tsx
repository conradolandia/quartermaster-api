import { MissionsService } from "@/client"
import {
  Box,
  Button,
  ButtonGroup,
  DialogActionTrigger,
  Flex,
  Input,
  Text,
  VStack,
} from "@chakra-ui/react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useEffect, useRef, useState } from "react"
import { Controller, type SubmitHandler, useForm } from "react-hook-form"
import { FaExchangeAlt } from "react-icons/fa"
import { Switch } from "../ui/switch"

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
import { LaunchDropdown } from "./LaunchDropdown"

interface Mission {
  id: string
  name: string
  launch_id: string
  active: boolean
  refund_cutoff_hours: number
  created_at: string
  updated_at: string
  timezone?: string
}

interface EditMissionProps {
  mission: Mission
  /** When provided, dialog open state is controlled (e.g. open after duplicate). */
  isOpen?: boolean
  onOpenChange?: (open: boolean) => void
}

const EditMission = ({
  mission,
  isOpen: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: EditMissionProps) => {
  const [internalOpen, setInternalOpen] = useState(false)
  const isControlled = controlledOpen !== undefined && controlledOnOpenChange != null
  const isOpen = isControlled ? controlledOpen : internalOpen
  const setOpen = isControlled ? controlledOnOpenChange : setInternalOpen
  const [active, setActive] = useState(mission.active)
  const queryClient = useQueryClient()
  const { showSuccessToast } = useCustomToast()
  const contentRef = useRef(null)

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm({
    mode: "onBlur",
    criteriaMode: "all",
    defaultValues: {
      name: mission.name,
      launch_id: mission.launch_id,
      active: mission.active,
      refund_cutoff_hours: mission.refund_cutoff_hours,
    },
  })

  const mutation = useMutation({
    mutationFn: (data: any) =>
      MissionsService.updateMission({
        missionId: mission.id,
        requestBody: data,
      }),
    onSuccess: () => {
      showSuccessToast("Mission updated successfully.")
      setOpen(false)
      queryClient.invalidateQueries({ queryKey: ["missions"] })
    },
    onError: (err: any) => {
      handleError(err)
    },
  })

  // Reset form and local state when dialog opens or mission changes
  useEffect(() => {
    if (isOpen) {
      setActive(mission.active)
      reset({
        name: mission.name,
        launch_id: mission.launch_id,
        active: mission.active,
        refund_cutoff_hours: mission.refund_cutoff_hours,
      })
    }
  }, [isOpen, mission, reset])

  const onSubmit: SubmitHandler<any> = async (data) => {
    // Format the data before sending; use local state for active switch
    const formattedData: any = {
      name: data.name,
      launch_id: data.launch_id,
      active: active,
      refund_cutoff_hours: data.refund_cutoff_hours,
    }
    mutation.mutate(formattedData)
  }

  return (
    <DialogRoot
      size={{ base: "xs", md: "md" }}
      placement="center"
      open={isOpen}
      onOpenChange={({ open }) => setOpen(open)}
    >
      {!isControlled && (
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm" color="dark.accent.primary">
            <FaExchangeAlt fontSize="16px" />
            Edit Mission
          </Button>
        </DialogTrigger>
      )}
      <DialogContent ref={contentRef}>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>Edit Mission</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <Text mb={4}>Update the mission details below.</Text>
            <VStack gap={4}>
              <Field
                invalid={!!errors.name}
                errorText={errors.name?.message}
                label="Name"
              >
                <Input
                  id="name"
                  {...register("name")}
                  placeholder="Mission name"
                  type="text"
                />
              </Field>

              <Field
                invalid={!!errors.launch_id}
                errorText={errors.launch_id?.message}
                label="Launch"
              >
                <Controller
                  name="launch_id"
                  control={control}
                  render={({ field }) => (
                    <LaunchDropdown
                      id="launch_id"
                      value={field.value || ""}
                      onChange={field.onChange}
                      disabled={isSubmitting}
                      portalRef={contentRef}
                    />
                  )}
                />
              </Field>

              <Field
                invalid={!!errors.refund_cutoff_hours}
                errorText={errors.refund_cutoff_hours?.message}
                label="Refund Cutoff Hours"
              >
                <Input
                  id="refund_cutoff_hours"
                  {...register("refund_cutoff_hours", {
                    valueAsNumber: true,
                  })}
                  placeholder="Refund cutoff hours"
                  type="number"
                  min={0}
                  max={72}
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
                    cursor="pointer"
                  >
                    <Switch checked={active} inputProps={{ id: "active" }} />
                  </Box>
                </Flex>
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
              <Button
                variant="solid"
                type="submit"
                loading={isSubmitting}
              >
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

export default EditMission
