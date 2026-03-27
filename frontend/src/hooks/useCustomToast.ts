"use client"

import { toaster } from "@/components/ui/toaster"

const useCustomToast = () => {
  const showSuccessToast = (description: string) => {
    toaster.create({
      title: "Success!",
      description,
      type: "success",
    })
  }

  const showErrorToast = (description: string) => {
    toaster.create({
      title: "Something went wrong!",
      description,
      type: "error",
    })
  }

  const showWarningToast = (title: string, description: string) => {
    toaster.create({
      title,
      description,
      type: "warning",
    })
  }

  return { showSuccessToast, showErrorToast, showWarningToast }
}

export default useCustomToast
