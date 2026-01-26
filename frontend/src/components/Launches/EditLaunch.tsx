import {
  Button,
  ButtonGroup,
  DialogActionTrigger,
  Input,
  Text,
  VStack,
} from "@chakra-ui/react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useRef, useState } from "react"
import { Controller, type SubmitHandler, useForm } from "react-hook-form"
import { FaExchangeAlt } from "react-icons/fa"

import {
  type ApiError,
  type LaunchPublic,
  type LaunchUpdate,
  LaunchesService,
} from "@/client"
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"
import { LocationDropdown } from "../Common/LocationDropdown"
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

interface EditLaunchProps {
  launch: LaunchPublic
}

const EditLaunch = ({ launch }: EditLaunchProps) => {
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
  } = useForm<LaunchUpdate>({
    mode: "onBlur",
    criteriaMode: "all",
    defaultValues: {
      name: launch.name,
      launch_timestamp: new Date(launch.launch_timestamp)
        .toISOString()
        .slice(0, 16),
      summary: launch.summary,
      location_id: launch.location_id,
    },
  })

  const mutation = useMutation({
    mutationFn: (data: LaunchUpdate) =>
      LaunchesService.updateLaunch({
        launchId: launch.id,
        requestBody: data,
      }),
    onSuccess: () => {
      showSuccessToast("Launch updated successfully.")
      reset()
      setIsOpen(false)
    },
    onError: (err: ApiError) => {
      handleError(err)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["launches"] })
    },
  })

  const onSubmit: SubmitHandler<LaunchUpdate> = async (data) => {
    mutation.mutate(data)
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
          Edit Launch
        </Button>
      </DialogTrigger>
      <DialogContent ref={contentRef}>
          <form onSubmit={handleSubmit(onSubmit)}>
            <DialogHeader>
              <DialogTitle>Edit Launch</DialogTitle>
            </DialogHeader>
            <DialogBody>
              <Text mb={4}>Update the launch details below.</Text>
              <VStack gap={4}>
                <Field
                  invalid={!!errors.name}
                  errorText={errors.name?.message}
                  label="Name"
                >
                  <Input
                    id="name"
                    {...register("name")}
                    placeholder="Launch name"
                    type="text"
                  />
                </Field>

                <Field
                  invalid={!!errors.launch_timestamp}
                  errorText={errors.launch_timestamp?.message}
                  label="Launch Date & Time"
                >
                  <Input
                    id="launch_timestamp"
                    {...register("launch_timestamp")}
                    placeholder="Launch date and time"
                    type="datetime-local"
                  />
                </Field>

                <Field
                  invalid={!!errors.summary}
                  errorText={errors.summary?.message}
                  label="Summary"
                >
                  <Input
                    id="summary"
                    {...register("summary")}
                    placeholder="Launch summary"
                    type="text"
                  />
                </Field>

                <Field
                  invalid={!!errors.location_id}
                  errorText={errors.location_id?.message}
                  label="Location"
                >
                  <Controller
                    name="location_id"
                    control={control}
                    render={({ field }) => (
                      <LocationDropdown
                        id="location_id"
                        value={field.value || ""}
                        onChange={field.onChange}
                        isDisabled={isSubmitting}
                        portalRef={contentRef}
                      />
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
    </DialogRoot>
  )
}

export default EditLaunch
