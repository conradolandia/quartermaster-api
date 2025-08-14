import { MissionsService } from "@/client"
import {
  Button,
  ButtonGroup,
  DialogActionTrigger,
  Flex,
  Input,
  Portal,
  Text,
  VStack,
} from "@chakra-ui/react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useRef, useState } from "react"
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
  public: boolean
  sales_open_at: string | null
  refund_cutoff_hours: number
  created_at: string
  updated_at: string
}

interface EditMissionProps {
  mission: Mission
}

const EditMission = ({ mission }: EditMissionProps) => {
  const [isOpen, setIsOpen] = useState(false)
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
      public: mission.public,
      sales_open_at: mission.sales_open_at
        ? new Date(mission.sales_open_at).toISOString().slice(0, 16)
        : "",
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
      reset()
      setIsOpen(false)
    },
    onError: (err: any) => {
      handleError(err)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["missions"] })
    },
  })

  const onSubmit: SubmitHandler<any> = async (data) => {
    // Format the data before sending
    const formattedData = {
      ...data,
      sales_open_at: data.sales_open_at
        ? new Date(data.sales_open_at).toISOString()
        : null,
    }
    mutation.mutate(formattedData)
  }

  return (
    <DialogRoot
      size={{ base: "xs", md: "md" }}
      placement="center"
      open={isOpen}
      onOpenChange={({ open }) => setIsOpen(open)}
    >
      <DialogTrigger asChild>
        <Button variant="ghost">
          <FaExchangeAlt fontSize="16px" />
          Edit Mission
        </Button>
      </DialogTrigger>
      <Portal>
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
                        isDisabled={isSubmitting}
                        portalRef={contentRef}
                      />
                    )}
                  />
                </Field>

                <Field
                  invalid={!!errors.sales_open_at}
                  errorText={errors.sales_open_at?.message}
                  label="Sales Open Date & Time"
                >
                  <Input
                    id="sales_open_at"
                    {...register("sales_open_at")}
                    placeholder="Sales open date and time"
                    type="datetime-local"
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
                  <Controller
                    name="active"
                    control={control}
                    render={({ field }) => (
                      <Flex
                        alignItems="center"
                        justifyContent="space-between"
                        width="100%"
                      >
                        <Text>Active</Text>
                        <Switch
                          id="active"
                          isChecked={field.value}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            field.onChange(e.target.checked)
                          }
                        />
                      </Flex>
                    )}
                  />
                </Field>

                <Field>
                  <Controller
                    name="public"
                    control={control}
                    render={({ field }) => (
                      <Flex
                        alignItems="center"
                        justifyContent="space-between"
                        width="100%"
                      >
                        <Text>Public</Text>
                        <Switch
                          id="public"
                          isChecked={field.value}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            field.onChange(e.target.checked)
                          }
                        />
                      </Flex>
                    )}
                  />
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
                <Button variant="solid" type="submit" loading={isSubmitting}>
                  Save
                </Button>
              </ButtonGroup>
            </DialogFooter>
          </form>
          <DialogCloseTrigger />
        </DialogContent>
      </Portal>
    </DialogRoot>
  )
}

export default EditMission
