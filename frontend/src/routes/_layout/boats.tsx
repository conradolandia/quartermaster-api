import {
  Button,
  Container,
  Flex,
  Heading,
} from "@chakra-ui/react"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { z } from "zod"
import { FiPlus } from "react-icons/fi"

import AddBoat from "@/components/Boats/AddBoat"
import BoatsList from "@/components/Boats/BoatsList"

const boatsSearchSchema = z.object({
  page: z.number().catch(1),
  jurisdictionId: z.string().optional(),
})

export const Route = createFileRoute("/_layout/boats")({
  component: Boats,
  validateSearch: (search) => boatsSearchSchema.parse(search),
})

function Boats() {
  const { page, jurisdictionId } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const [isAddBoatOpen, setIsAddBoatOpen] = useState(false)

  const setPage = (newPage: number) =>
    navigate({
      search: (prev: { [key: string]: string }) => ({ ...prev, page: newPage }),
    })

  const handleAddBoatSuccess = () => {
    setIsAddBoatOpen(false)
  }

  return (
    <Container maxW="full">
      <Flex justify="space-between" align="center" pt={12} pb={4}>
        <Heading size="lg">Boats Management</Heading>
        <Button
          onClick={() => setIsAddBoatOpen(true)}
          colorScheme="blue"
        >
          <Flex align="center" gap={2}>
            <FiPlus />
            <span>Add Boat</span>
          </Flex>
        </Button>
      </Flex>

      <AddBoat
        isOpen={isAddBoatOpen}
        onClose={() => setIsAddBoatOpen(false)}
        onSuccess={handleAddBoatSuccess}
      />

      <BoatsList
        page={page}
        setPage={setPage}
        jurisdictionId={jurisdictionId}
      />
    </Container>
  )
}
