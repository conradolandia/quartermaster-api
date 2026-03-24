import { useEffect, useRef, useState } from "react"

import { DEFAULT_PAGE_SIZE } from "@/components/ui/page-size-select"
import { useIncludeArchived } from "@/contexts/IncludeArchivedContext"
import {
  BOOKING_STATUSES,
  PAYMENT_STATUSES,
  parseStatusList,
} from "../types"
import type { SortableColumn } from "../types"

type SortDirection = "asc" | "desc"

const initialSearch = () => new URLSearchParams(window.location.search)

export function useBookingsTableState() {
  const [missionId, setMissionId] = useState<string | undefined>(() =>
    initialSearch().get("missionId") || undefined,
  )
  const [launchId, setLaunchId] = useState<string | undefined>(() =>
    initialSearch().get("launchId") || undefined,
  )
  const [tripId, setTripId] = useState<string | undefined>(() =>
    initialSearch().get("tripId") || undefined,
  )
  const [tripType, setTripType] = useState<string | undefined>(() =>
    initialSearch().get("tripType") || undefined,
  )
  const [boatId, setBoatId] = useState<string | undefined>(() =>
    initialSearch().get("boatId") || undefined,
  )
  const [ticketItemType, setTicketItemType] = useState<string | undefined>(
    () => initialSearch().get("ticketItemType") || undefined,
  )
  const [bookingStatusFilter, setBookingStatusFilter] = useState<string[]>(
    () =>
      parseStatusList(
        initialSearch().get("bookingStatuses"),
        BOOKING_STATUSES,
      ),
  )
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string[]>(
    () =>
      parseStatusList(
        initialSearch().get("paymentStatuses"),
        PAYMENT_STATUSES,
      ),
  )
  const { includeArchived, setIncludeArchived } = useIncludeArchived()
  const [searchQuery, setSearchQuery] = useState<string>(
    () => initialSearch().get("search") || "",
  )
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState<string>(
    () => initialSearch().get("search") || "",
  )
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [searchParams, setSearchParams] = useState(initialSearch())

  const page = Number.parseInt(searchParams.get("page") || "1")
  const pageSizeParam = searchParams.get("pageSize")
  const pageSize = pageSizeParam
    ? Number.parseInt(pageSizeParam, 10)
    : DEFAULT_PAGE_SIZE
  const effectivePageSize =
    Number.isInteger(pageSize) && pageSize > 0 ? pageSize : DEFAULT_PAGE_SIZE
  const sortBy = (searchParams.get("sortBy") as SortableColumn) || "created_at"
  const sortDirection =
    (searchParams.get("sortDirection") as SortDirection) || "desc"

  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    searchDebounceRef.current = setTimeout(() => {
      const trimmed = searchQuery.trim()
      setDebouncedSearchQuery(trimmed)
      const params = new URLSearchParams(window.location.search)
      if (trimmed) params.set("search", trimmed)
      else params.delete("search")
      params.set("page", "1")
      window.history.replaceState(
        {},
        "",
        `${window.location.pathname}?${params.toString()}`,
      )
      setSearchParams(new URLSearchParams(params.toString()))
      setTimeout(() => searchInputRef.current?.focus(), 0)
    }, 300)
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    }
  }, [searchQuery])

  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search)
      setSearchParams(params)
      setMissionId(params.get("missionId") || undefined)
      setLaunchId(params.get("launchId") || undefined)
      setTripId(params.get("tripId") || undefined)
      setBoatId(params.get("boatId") || undefined)
      setTripType(params.get("tripType") || undefined)
      setTicketItemType(params.get("ticketItemType") || undefined)
      const search = params.get("search") || ""
      setSearchQuery(search)
      setDebouncedSearchQuery(search)
      setBookingStatusFilter(
        parseStatusList(params.get("bookingStatuses"), BOOKING_STATUSES),
      )
      setPaymentStatusFilter(
        parseStatusList(params.get("paymentStatuses"), PAYMENT_STATUSES),
      )
    }
    window.addEventListener("popstate", handlePopState)
    return () => window.removeEventListener("popstate", handlePopState)
  }, [])

  const updateFiltersInUrl = (updates: {
    missionId?: string
    launchId?: string
    tripId?: string
    boatId?: string
    tripType?: string
    ticketItemType?: string
    bookingStatuses?: string[]
    paymentStatuses?: string[]
    search?: string
  }) => {
    const params = new URLSearchParams(window.location.search)
    if (updates.missionId !== undefined) {
      if (updates.missionId) params.set("missionId", updates.missionId)
      else params.delete("missionId")
    }
    if (updates.launchId !== undefined) {
      if (updates.launchId) params.set("launchId", updates.launchId)
      else params.delete("launchId")
    }
    if (updates.tripId !== undefined) {
      if (updates.tripId) params.set("tripId", updates.tripId)
      else params.delete("tripId")
    }
    if (updates.boatId !== undefined) {
      if (updates.boatId) params.set("boatId", updates.boatId)
      else params.delete("boatId")
    }
    if (updates.tripType !== undefined) {
      if (updates.tripType) params.set("tripType", updates.tripType)
      else params.delete("tripType")
    }
    if (updates.ticketItemType !== undefined) {
      if (updates.ticketItemType)
        params.set("ticketItemType", updates.ticketItemType)
      else params.delete("ticketItemType")
    }
    if (updates.bookingStatuses !== undefined) {
      const all =
        updates.bookingStatuses.length === BOOKING_STATUSES.length &&
        BOOKING_STATUSES.every((s) => updates.bookingStatuses!.includes(s))
      if (all) params.delete("bookingStatuses")
      else params.set("bookingStatuses", updates.bookingStatuses.join(","))
    }
    if (updates.paymentStatuses !== undefined) {
      const all =
        updates.paymentStatuses.length === PAYMENT_STATUSES.length &&
        PAYMENT_STATUSES.every((s) => updates.paymentStatuses!.includes(s))
      if (all) params.delete("paymentStatuses")
      else params.set("paymentStatuses", updates.paymentStatuses.join(","))
    }
    if (updates.search !== undefined) {
      if (updates.search) params.set("search", updates.search)
      else params.delete("search")
    }
    params.set("page", "1")
    window.history.replaceState(
      {},
      "",
      `${window.location.pathname}?${params.toString()}`,
    )
    setSearchParams(new URLSearchParams(params.toString()))
  }

  const handleSort = (column: SortableColumn) => {
    const newDirection: SortDirection =
      sortBy === column && sortDirection === "asc" ? "desc" : "asc"
    const params = new URLSearchParams(window.location.search)
    params.set("sortBy", column)
    params.set("sortDirection", newDirection)
    window.history.replaceState(
      {},
      "",
      `${window.location.pathname}?${params.toString()}`,
    )
    setSearchParams(new URLSearchParams(params.toString()))
  }

  const handleSearchChange = (value: string) => setSearchQuery(value)

  const handleMissionFilter = (selectedMissionId?: string) => {
    setMissionId(selectedMissionId)
    setLaunchId(undefined)
    setTripId(undefined)
    setTicketItemType(undefined)
    updateFiltersInUrl({
      missionId: selectedMissionId,
      launchId: undefined,
      tripId: undefined,
      ticketItemType: undefined,
    })
  }

  const handleTripFilter = (selectedTripId?: string) => {
    setTripId(selectedTripId)
    setBoatId(undefined)
    setTicketItemType(undefined)
    updateFiltersInUrl({
      tripId: selectedTripId,
      boatId: undefined,
      ticketItemType: undefined,
    })
  }

  const handleBoatFilter = (selectedBoatId?: string) => {
    setBoatId(selectedBoatId)
    updateFiltersInUrl({ boatId: selectedBoatId })
  }

  const handleTripTypeFilter = (selectedTripType?: string) => {
    setTripType(selectedTripType)
    updateFiltersInUrl({ tripType: selectedTripType })
  }

  const handleTicketItemTypeFilter = (selected?: string) => {
    setTicketItemType(selected)
    updateFiltersInUrl({ ticketItemType: selected })
  }

  const handleIncludeArchivedChange = (checked: boolean) => {
    setIncludeArchived(checked)
    const params = new URLSearchParams(window.location.search)
    params.set("page", "1")
    window.history.replaceState(
      {},
      "",
      `${window.location.pathname}?${params.toString()}`,
    )
    setSearchParams(new URLSearchParams(params.toString()))
  }

  const applyBookingStatus = (next: string[]) => {
    if (next.length === 0) return
    if (
      next.length === bookingStatusFilter.length &&
      next.every((s, i) => s === bookingStatusFilter[i])
    )
      return
    setBookingStatusFilter(next)
    updateFiltersInUrl({ bookingStatuses: next })
  }

  const applyPaymentStatus = (next: string[]) => {
    if (next.length === 0) return
    if (
      next.length === paymentStatusFilter.length &&
      next.every((s, i) => s === paymentStatusFilter[i])
    )
      return
    setPaymentStatusFilter(next)
    updateFiltersInUrl({ paymentStatuses: next })
  }

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(window.location.search)
    params.set("page", newPage.toString())
    window.history.replaceState(
      {},
      "",
      `${window.location.pathname}?${params.toString()}`,
    )
    setSearchParams(new URLSearchParams(params.toString()))
  }

  const handlePageSizeChange = (newPageSize: number) => {
    const params = new URLSearchParams(window.location.search)
    params.set("pageSize", newPageSize.toString())
    params.set("page", "1")
    window.history.replaceState(
      {},
      "",
      `${window.location.pathname}?${params.toString()}`,
    )
    setSearchParams(new URLSearchParams(params.toString()))
  }

  const hasActiveFilters = !!(
    missionId ||
    tripId ||
    boatId ||
    tripType ||
    ticketItemType ||
    bookingStatusFilter.length < BOOKING_STATUSES.length ||
    paymentStatusFilter.length < PAYMENT_STATUSES.length ||
    debouncedSearchQuery
  )

  const handleClearFilters = () => {
    setMissionId(undefined)
    setTripId(undefined)
    setBoatId(undefined)
    setTripType(undefined)
    setTicketItemType(undefined)
    setBookingStatusFilter([...BOOKING_STATUSES])
    setPaymentStatusFilter([...PAYMENT_STATUSES])
    setSearchQuery("")
    setDebouncedSearchQuery("")
    updateFiltersInUrl({
      missionId: undefined,
      tripId: undefined,
      boatId: undefined,
      tripType: undefined,
      ticketItemType: undefined,
      bookingStatuses: [...BOOKING_STATUSES],
      paymentStatuses: [...PAYMENT_STATUSES],
      search: undefined,
    })
  }

  return {
    missionId,
    setMissionId,
    launchId,
    tripId,
    setTripId,
    tripType,
    ticketItemType,
    boatId,
    setBoatId,
    bookingStatusFilter,
    paymentStatusFilter,
    includeArchived,
    searchQuery,
    debouncedSearchQuery,
    searchParams,
    searchInputRef,
    page,
    effectivePageSize,
    sortBy,
    sortDirection,
    updateFiltersInUrl,
    handleSort,
    handleSearchChange,
    handleMissionFilter,
    handleTripFilter,
    handleBoatFilter,
    handleTripTypeFilter,
    handleTicketItemTypeFilter,
    handleIncludeArchivedChange,
    applyBookingStatus,
    applyPaymentStatus,
    handlePageChange,
    handlePageSizeChange,
    hasActiveFilters,
    handleClearFilters,
  }
}
