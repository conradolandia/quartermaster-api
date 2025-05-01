import useCustomToast from "@/hooks/useCustomToast";
import { Button, Input, VStack, Portal, NumberInput } from "@chakra-ui/react";
import React, { useState, useRef } from "react";
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
import { JurisdictionsService, type JurisdictionCreate } from "@/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import StateDropdown from "../Locations/StateDropdown";
import LocationDropdown from "./LocationDropdown";

// Props interface
interface AddJurisdictionProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AddJurisdiction = ({
  isOpen,
  onClose,
  onSuccess,
}: AddJurisdictionProps) => {
  const [name, setName] = useState("");
  const [state, setState] = useState("");
  const [salesTaxRate, setSalesTaxRate] = useState(0);
  const [locationId, setLocationId] = useState("");
  const { showSuccessToast, showErrorToast } = useCustomToast();
  const queryClient = useQueryClient();
  const contentRef = useRef(null);

  // Use mutation for creating jurisdiction
  const mutation = useMutation({
    mutationFn: (data: JurisdictionCreate) =>
      JurisdictionsService.createJurisdiction({ requestBody: data }),
    onSuccess: () => {
      showSuccessToast("Jurisdiction was successfully added");
      setName("");
      setState("");
      setSalesTaxRate(0);
      setLocationId("");
      queryClient.invalidateQueries({ queryKey: ["jurisdictions"] });
      onSuccess();
      onClose();
    },
    onError: (error: any) => {
      console.error("Error adding jurisdiction:", error);
      showErrorToast(
        error.response?.data?.detail ||
          "An error occurred while adding the jurisdiction"
      );
    },
  });

  const handleSubmit = async () => {
    if (!name || !state || !locationId) return;

    mutation.mutate({
      name,
      state,
      sales_tax_rate: salesTaxRate,
      location_id: locationId
    });
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
            <DialogTitle>Add Jurisdiction</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <VStack gap={4}>
              <Field label="Name" required>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jurisdiction name"
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
              <Field label="Sales Tax Rate (%)" required>
                <Input
                  id="salesTaxRate"
                  type="number"
                  value={salesTaxRate}
                  onChange={(e) => setSalesTaxRate(parseFloat(e.target.value) || 0)}
                  min={0}
                  max={100}
                  step={0.1}
                  disabled={mutation.isPending}
                  placeholder="Sales tax rate"
                />
              </Field>
              <Field label="Location" required>
                <LocationDropdown
                  value={locationId}
                  onChange={setLocationId}
                  id="locationId"
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
              disabled={!name || !state || !locationId || mutation.isPending}
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

export default AddJurisdiction;
