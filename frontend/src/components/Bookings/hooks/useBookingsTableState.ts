import { useCallback, useEffect, useRef, useState } from "react"

import { DEFAULT_PAGE_SIZE } from "@/components/ui/page-size-select"
import { useIncludeArchived } from "@/contexts/IncludeArchivedContext"
import { BOOKING_STATUSES, PAYMENT_STATUSES, parseStatusList } from "../types"
import type { SortableColumn } from "../types"

type SortDirection = "asc" | "desc"

const initialSearch = () => new URLSearchParams(window.location.search)

type FilterUrlUpdates = {
  missionId?: string | null
  launchId?: string | null
  tripId?: string | null
  boatId?: string | null
  tripType?: string | null
  ticketItemType?: string | null
  bookingStatuses?: string[]
  paymentStatuses?: string[]
  search?: string | null
}

function applyOptionalParam(
  params: URLSearchParams,
  key: string,
  value: string | null | undefined,
  present: boolean,
) {
  if (!present) return
  if (value) params.set(key, value)
  else params.delete(key)
}

function replaceSearchIfChanged(nextQuery: string): boolean {
  const prevQuery = window.location.search.replace(/^\?/, "")
  if (prevQuery === nextQuery) return false
  const url = nextQuery
    ? `${window.location.pathname}?${nextQuery}`
    : window.location.pathname
  window.history.replaceState({}, "", url)
  return true
}

export function useBookingsTableState() {
  const [missionId, setMissionId] = useState<string | undefined>(
    () => initialSearch().get("missionId") || undefined,
  )
  const [launchId, setLaunchId] = useState<string | undefined>(
    () => initialSearch().get("launchId") || undefined,
  )
  const [tripId, setTripId] = useState<string | undefined>(
    () => initialSearch().get("tripId") || undefined,
  )
  const [tripType, setTripType] = useState<string | undefined>(
    () => initialSearch().get("tripType") || undefined,
  )
  const [boatId, setBoatId] = useState<string | undefined>(
    () => initialSearch().get("boatId") || undefined,
  )
  const [ticketItemType, setTicketItemType] = useState<string | undefined>(
    () => initialSearch().get("ticketItemType") || undefined,
  )
  const [bookingStatusFilter, setBookingStatusFilter] = useState<string[]>(() =>
    parseStatusList(initialSearch().get("bookingStatuses"), BOOKING_STATUSES),
  )
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string[]>(() =>
    parseStatusList(initialSearch().get("paymentStatuses"), PAYMENT_STATUSES),
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
      const nextQuery = params.toString()
      if (replaceSearchIfChanged(nextQuery)) {
        setSearchParams(new URLSearchParams(nextQuery))
      }
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

  const updateFiltersInUrl = useCallback((updates: FilterUrlUpdates) => {
    const params = new URLSearchParams(window.location.search)
    // Use `in` so explicit undefined/null means "clear", while omitted keys are untouched.
    applyOptionalParam(
      params,
      "missionId",
      updates.missionId,
      "missionId" in updates,
    )
    applyOptionalParam(
      params,
      "launchId",
      updates.launchId,
      "launchId" in updates,
    )
    applyOptionalParam(params, "tripId", updates.tripId, "tripId" in updates)
    applyOptionalParam(params, "boatId", updates.boatId, "boatId" in updates)
    applyOptionalParam(
      params,
      "tripType",
      updates.tripType,
      "tripType" in updates,
    )
    applyOptionalParam(
      params,
      "ticketItemType",
      updates.ticketItemType,
      "ticketItemType" in updates,
    )
    if ("bookingStatuses" in updates && updates.bookingStatuses) {
      const all =
        updates.bookingStatuses.length === BOOKING_STATUSES.length &&
        BOOKING_STATUSES.every((s) => updates.bookingStatuses!.includes(s))
      if (all) params.delete("bookingStatuses")
      else params.set("bookingStatuses", updates.bookingStatuses.join(","))
    }
    if ("paymentStatuses" in updates && updates.paymentStatuses) {
      const all =
        updates.paymentStatuses.length === PAYMENT_STATUSES.length &&
        PAYMENT_STATUSES.every((s) => updates.paymentStatuses!.includes(s))
      if (all) params.delete("paymentStatuses")
      else params.set("paymentStatuses", updates.paymentStatuses.join(","))
    }
    if ("search" in updates) {
      if (updates.search) params.set("search", updates.search)
      else params.delete("search")
    }
    params.set("page", "1")
    const nextQuery = params.toString()
    if (!replaceSearchIfChanged(nextQuery)) return
    setSearchParams(new URLSearchParams(nextQuery))
  }, [])

  const handleSort = (column: SortableColumn) => {
    const newDirection: SortDirection =
      sortBy === column && sortDirection === "asc" ? "desc" : "asc"
    const params = new URLSearchParams(window.location.search)
    params.set("sortBy", column)
    params.set("sortDirection", newDirection)
    const nextQuery = params.toString()
    if (!replaceSearchIfChanged(nextQuery)) return
    setSearchParams(new URLSearchParams(nextQuery))
  }

  const handleSearchChange = (value: string) => setSearchQuery(value)

  const handleMissionFilter = (selectedMissionId?: string) => {
    setMissionId(selectedMissionId)
    setLaunchId(undefined)
    setTripId(undefined)
    setTicketItemType(undefined)
    updateFiltersInUrl({
      missionId: selectedMissionId ?? null,
      launchId: null,
      tripId: null,
      ticketItemType: null,
    })
  }

  const handleTripFilter = (selectedTripId?: string) => {
    setTripId(selectedTripId)
    setBoatId(undefined)
    setTicketItemType(undefined)
    updateFiltersInUrl({
      tripId: selectedTripId ?? null,
      boatId: null,
      ticketItemType: null,
    })
  }

  const handleBoatFilter = (selectedBoatId?: string) => {
    setBoatId(selectedBoatId)
    updateFiltersInUrl({ boatId: selectedBoatId ?? null })
  }

  const handleTripTypeFilter = (selectedTripType?: string) => {
    setTripType(selectedTripType)
    updateFiltersInUrl({ tripType: selectedTripType ?? null })
  }

  const handleTicketItemTypeFilter = (selected?: string) => {
    setTicketItemType(selected)
    updateFiltersInUrl({ ticketItemType: selected ?? null })
  }

  const handleIncludeArchivedChange = (checked: boolean) => {
    setIncludeArchived(checked)
    const params = new URLSearchParams(window.location.search)
    params.set("page", "1")
    const nextQuery = params.toString()
    if (!replaceSearchIfChanged(nextQuery)) return
    setSearchParams(new URLSearchParams(nextQuery))
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
    const nextQuery = params.toString()
    if (!replaceSearchIfChanged(nextQuery)) return
    setSearchParams(new URLSearchParams(nextQuery))
  }

  const handlePageSizeChange = (newPageSize: number) => {
    const params = new URLSearchParams(window.location.search)
    params.set("pageSize", newPageSize.toString())
    params.set("page", "1")
    const nextQuery = params.toString()
    if (!replaceSearchIfChanged(nextQuery)) return
    setSearchParams(new URLSearchParams(nextQuery))
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
      missionId: null,
      tripId: null,
      boatId: null,
      tripType: null,
      ticketItemType: null,
      bookingStatuses: [...BOOKING_STATUSES],
      paymentStatuses: [...PAYMENT_STATUSES],
      search: null,
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
