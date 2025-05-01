import useCustomToast from "@/hooks/useCustomToast";
import { Button, Input, VStack, Portal } from "@chakra-ui/react";
import { useState, useRef } from "react";
import {
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
} from "../ui/dialog";

import { Field } from "../ui/field";
import { LocationsService, type LocationCreate } from "@/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import StateDropdown from "./StateDropdown";

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
  const [name, setName] = useState("");
  const [state, setState] = useState("");
  const { showSuccessToast, showErrorToast } = useCustomToast();
  const queryClient = useQueryClient();
  const contentRef = useRef(null);

  // Use mutation for creating location
  const mutation = useMutation({
    mutationFn: (data: LocationCreate) =>
      LocationsService.createLocation({ requestBody: data }),
    onSuccess: () => {
      showSuccessToast("Location was successfully added");
      setName("");
      setState("");
      queryClient.invalidateQueries({ queryKey: ["locations"] });
      onSuccess();
      onClose();
    },
    onError: (error: any) => {
      console.error("Error adding location:", error);
      showErrorToast(
        error.response?.data?.detail ||
          "An error occurred while adding the location"
      );
    },
  });

  const handleSubmit = async () => {
    if (!name || !state) return;

    mutation.mutate({ name, state });
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
          <DialogHeader>
            <DialogTitle>Add Location</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <VStack gap={4}>
              <Field label="Name" required>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Location name"
                />
              </Field>
              <Field label="State" required>
                <StateDropdown
                  value={state}
                  onChange={setState}
                  id="state"
                  isDisabled={mutation.isPending}
                  portalRef={contentRef}
                />
              </Field>
            </VStack>
          </DialogBody>
          <DialogFooter gap={2}>
            <Button
              variant="subtle"
              colorPalette="gray"
              onClick={onClose}
              disabled={mutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="solid"
              onClick={handleSubmit}
              loading={mutation.isPending}
              disabled={!name || !state || mutation.isPending}
            >
              Add
            </Button>
          </DialogFooter>
          <DialogCloseTrigger />
        </DialogContent>
      </Portal>
    </DialogRoot>
  );
};

export default AddLocation;
