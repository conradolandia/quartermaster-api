// Definición compartida de la interfaz Boat para toda la aplicación
export interface Boat {
  id: string
  name: string
  slug?: string
  capacity: number
  provider_id: string
  created_at: string
  updated_at: string
  // Provider data (loaded from relationship)
  provider_name?: string
  provider_location?: string
  provider_address?: string
  jurisdiction_id?: string
  map_link?: string | null
}
