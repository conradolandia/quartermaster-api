import {
  Box,
  Button,
  Card,
  HStack,
  Input,
  Text,
  VStack,
} from "@chakra-ui/react"
import { useMutation } from "@tanstack/react-query"
import { useRef, useState } from "react"
import { FiUpload, FiX } from "react-icons/fi"

import useCustomToast from "@/hooks/useCustomToast"

interface YamlImportFormProps {
  onImport: (file: File) => Promise<any>
  onSuccess?: (data: any) => void
  onCancel?: () => void
  acceptedFileTypes?: string[]
  maxFileSize?: number // in MB
  placeholder?: string
}

const YamlImportForm = ({
  onImport,
  onSuccess,
  onCancel,
  acceptedFileTypes = [".yaml", ".yml"],
  maxFileSize = 5, // 5MB default
  placeholder = "Select a YAML file to import",
}: YamlImportFormProps) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { showSuccessToast, showErrorToast } = useCustomToast()

  const importMutation = useMutation({
    mutationFn: onImport,
    onSuccess: (data) => {
      showSuccessToast("YAML file imported successfully!")
      onSuccess?.(data)
      setSelectedFile(null)
    },
    onError: (error: any) => {
      showErrorToast(
        error?.response?.data?.detail || "Failed to import YAML file",
      )
    },
  })

  const handleFileSelect = (file: File) => {
    // Validate file type
    const isValidType = acceptedFileTypes.some((type) =>
      file.name.toLowerCase().endsWith(type.toLowerCase()),
    )
    if (!isValidType) {
      showErrorToast(
        `Invalid file type. Please select a ${acceptedFileTypes.join(
          " or ",
        )} file.`,
      )
      return
    }

    // Validate file size
    const fileSizeMB = file.size / (1024 * 1024)
    if (fileSizeMB > maxFileSize) {
      showErrorToast(`File too large. Maximum size is ${maxFileSize}MB.`)
      return
    }

    setSelectedFile(file)
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)

    const file = e.dataTransfer.files[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }

  const handleImport = () => {
    if (selectedFile) {
      importMutation.mutate(selectedFile)
    }
  }

  const handleCancel = () => {
    setSelectedFile(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
    onCancel?.()
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${Number.parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`
  }

  return (
    <Card.Root>
      <Card.Body>
        <VStack gap={4} align="stretch">
          <Text fontWeight="medium">Import from YAML File</Text>

          {/* File Input */}
          <Box
            border="1px dashed"
            borderColor={isDragOver ? "accent.default" : "dark.border.default"}
            borderRadius="md"
            p={6}
            textAlign="center"
            cursor="pointer"
            transition="all 0.2s"
            _hover={{ borderColor: "blue.400", bg: "blue.50" }}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
          >
            <VStack gap={2}>
              <FiUpload size={24} color="gray" />
              <Text color="text.muted">
                {selectedFile ? selectedFile.name : placeholder}
              </Text>
              <Text fontSize="sm" color="text.muted">
                Drag and drop or click to select
              </Text>
              <Text fontSize="xs" color="text.muted">
                Accepted formats: {acceptedFileTypes.join(", ")} (max{" "}
                {maxFileSize}MB)
              </Text>
            </VStack>
          </Box>

          <Input
            ref={fileInputRef}
            type="file"
            accept={acceptedFileTypes.join(",")}
            onChange={handleFileInputChange}
            display="none"
          />

          {/* Selected File Info */}
          {selectedFile && (
            <Box p={3} borderRadius="md">
              <HStack justify="space-between">
                <VStack align="start" gap={1}>
                  <Text fontWeight="medium" fontSize="sm">
                    {selectedFile.name}
                  </Text>
                  <Text fontSize="xs" color="text.muted">
                    {formatFileSize(selectedFile.size)}
                  </Text>
                </VStack>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelectedFile(null)}
                >
                  <FiX />
                </Button>
              </HStack>
            </Box>
          )}

          {/* Actions */}
          <HStack gap={3} justify="flex-end">
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={importMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              colorPalette="blue"
              onClick={handleImport}
              loading={importMutation.isPending}
              disabled={!selectedFile}
            >
              <FiUpload />
              Import
            </Button>
          </HStack>
        </VStack>
      </Card.Body>
    </Card.Root>
  )
}

export default YamlImportForm
