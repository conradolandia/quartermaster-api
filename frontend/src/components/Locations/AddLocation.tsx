import useCustomToast from "@/hooks/useCustomToast";
import { Button, Input, VStack, Portal, ButtonGroup } from "@chakra-ui/react";
import { useRef } from "react";
import {
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
  DialogActionTrigger,
} from "../ui/dialog";

import { Field } from "../ui/field";
import { LocationsService, type LocationCreate } from "@/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type SubmitHandler, useForm, Controller } from "react-hook-form";
import StateDropdown from "./StateDropdown";
import { handleError } from "@/utils";

// Props interface
interface AddLocationProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AddLocation = ({
  isOpen,
  onClose,
  onSuccess,
}: AddLocationProps) => {
  const { showSuccessToast } = useCustomToast();
  const queryClient = useQueryClient();
  const contentRef = useRef(null);

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<LocationCreate>({
    mode: "onBlur",
    criteriaMode: "all",
    defaultValues: {
      name: "",
      state: "",
    },
  });

  // Use mutation for creating location
  const mutation = useMutation({
    mutationFn: (data: LocationCreate) =>
      LocationsService.createLocation({ requestBody: data }),
    onSuccess: () => {
      showSuccessToast("Location was successfully added");
      reset();
      queryClient.invalidateQueries({ queryKey: ["locations"] });
      onSuccess();
      onClose();
    },
    onError: (error: any) => {
      handleError(error);
    },
  });

  const onSubmit: SubmitHandler<LocationCreate> = (data) => {
    mutation.mutate(data);
  };

  return (
    <DialogRoot
      size={{ base: "xs", md: "md" }}
      placement="center"
      open={isOpen}
      onOpenChange={({ open }) => !open && onClose()}
    >
      <Portal>
        <DialogContent ref={contentRef}>
          <form onSubmit={handleSubmit(onSubmit)}>
            <DialogHeader>
              <DialogTitle>Add Location</DialogTitle>
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
                      maxLength: { value: 255, message: "Name cannot exceed 255 characters" }
                    })}
                    placeholder="Location name"
                  />
                </Field>
                <Field
                  label="State"
                  required
                  invalid={!!errors.state}
                  errorText={errors.state?.message}
                >
                  <Controller
                    name="state"
                    control={control}
                    rules={{
                      required: "State is required"
                    }}
                    render={({ field }) => (
                      <StateDropdown
                        value={field.value}
                        onChange={field.onChange}
                        id="state"
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
                  Add
                </Button>
              </ButtonGroup>
            </DialogFooter>
          </form>
          <DialogCloseTrigger />
        </DialogContent>
      </Portal>
    </DialogRoot>
  );
};

export default AddLocation;
