import { Box, Container, Heading, Text } from "@chakra-ui/react"

import { useDateFormatPreference } from "@/contexts/DateFormatContext"
import { Field } from "../ui/field"
import { Switch } from "../ui/switch"

export default function DisplaySettings() {
  const { useInternationalFormat, setUseInternationalFormat } =
    useDateFormatPreference()

  return (
    <Container maxW="full">
      <Heading size="sm" py={4}>
        Display
      </Heading>
      <Box w={{ sm: "full", md: "md" }}>
        <Field
          label="Date and time format"
          helperText="When enabled, dates and times use international format (YYYY-MM-DD HH:MM:SS, 24-hour) instead of your locale format."
        >
          <Box display="flex" alignItems="center" gap={3} py={2}>
            <Switch
              checked={useInternationalFormat}
              onCheckedChange={({ checked }) =>
                setUseInternationalFormat(checked === true)
              }
            />
            <Text fontSize="sm" color="fg.muted">
              {useInternationalFormat
                ? "International (YYYY-MM-DD HH:MM:SS)"
                : "Locale format"}
            </Text>
          </Box>
        </Field>
      </Box>
    </Container>
  )
}
