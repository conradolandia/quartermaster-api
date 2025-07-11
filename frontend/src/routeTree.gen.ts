/* prettier-ignore-start */

/* eslint-disable */

// @ts-nocheck

// noinspection JSUnusedGlobalSymbols

// This file is auto-generated by TanStack Router

// Import Routes

import { Route as rootRoute } from './routes/__root'
import { Route as SignupImport } from './routes/signup'
import { Route as ResetPasswordImport } from './routes/reset-password'
import { Route as RecoverPasswordImport } from './routes/recover-password'
import { Route as LoginImport } from './routes/login'
import { Route as LayoutImport } from './routes/_layout'
import { Route as LayoutIndexImport } from './routes/_layout/index'
import { Route as LayoutTripsImport } from './routes/_layout/trips'
import { Route as LayoutSettingsImport } from './routes/_layout/settings'
import { Route as LayoutMissionsImport } from './routes/_layout/missions'
import { Route as LayoutLocationsImport } from './routes/_layout/locations'
import { Route as LayoutLaunchesImport } from './routes/_layout/launches'
import { Route as LayoutJurisdictionsImport } from './routes/_layout/jurisdictions'
import { Route as LayoutItemsImport } from './routes/_layout/items'
import { Route as LayoutBookingsImport } from './routes/_layout/bookings'
import { Route as LayoutBoatsImport } from './routes/_layout/boats'
import { Route as LayoutAdminImport } from './routes/_layout/admin'

// Create/Update Routes

const SignupRoute = SignupImport.update({
  path: '/signup',
  getParentRoute: () => rootRoute,
} as any)

const ResetPasswordRoute = ResetPasswordImport.update({
  path: '/reset-password',
  getParentRoute: () => rootRoute,
} as any)

const RecoverPasswordRoute = RecoverPasswordImport.update({
  path: '/recover-password',
  getParentRoute: () => rootRoute,
} as any)

const LoginRoute = LoginImport.update({
  path: '/login',
  getParentRoute: () => rootRoute,
} as any)

const LayoutRoute = LayoutImport.update({
  id: '/_layout',
  getParentRoute: () => rootRoute,
} as any)

const LayoutIndexRoute = LayoutIndexImport.update({
  path: '/',
  getParentRoute: () => LayoutRoute,
} as any)

const LayoutTripsRoute = LayoutTripsImport.update({
  path: '/trips',
  getParentRoute: () => LayoutRoute,
} as any)

const LayoutSettingsRoute = LayoutSettingsImport.update({
  path: '/settings',
  getParentRoute: () => LayoutRoute,
} as any)

const LayoutMissionsRoute = LayoutMissionsImport.update({
  path: '/missions',
  getParentRoute: () => LayoutRoute,
} as any)

const LayoutLocationsRoute = LayoutLocationsImport.update({
  path: '/locations',
  getParentRoute: () => LayoutRoute,
} as any)

const LayoutLaunchesRoute = LayoutLaunchesImport.update({
  path: '/launches',
  getParentRoute: () => LayoutRoute,
} as any)

const LayoutJurisdictionsRoute = LayoutJurisdictionsImport.update({
  path: '/jurisdictions',
  getParentRoute: () => LayoutRoute,
} as any)

const LayoutItemsRoute = LayoutItemsImport.update({
  path: '/items',
  getParentRoute: () => LayoutRoute,
} as any)

const LayoutBookingsRoute = LayoutBookingsImport.update({
  path: '/bookings',
  getParentRoute: () => LayoutRoute,
} as any)

const LayoutBoatsRoute = LayoutBoatsImport.update({
  path: '/boats',
  getParentRoute: () => LayoutRoute,
} as any)

const LayoutAdminRoute = LayoutAdminImport.update({
  path: '/admin',
  getParentRoute: () => LayoutRoute,
} as any)

// Populate the FileRoutesByPath interface

declare module '@tanstack/react-router' {
  interface FileRoutesByPath {
    '/_layout': {
      preLoaderRoute: typeof LayoutImport
      parentRoute: typeof rootRoute
    }
    '/login': {
      preLoaderRoute: typeof LoginImport
      parentRoute: typeof rootRoute
    }
    '/recover-password': {
      preLoaderRoute: typeof RecoverPasswordImport
      parentRoute: typeof rootRoute
    }
    '/reset-password': {
      preLoaderRoute: typeof ResetPasswordImport
      parentRoute: typeof rootRoute
    }
    '/signup': {
      preLoaderRoute: typeof SignupImport
      parentRoute: typeof rootRoute
    }
    '/_layout/admin': {
      preLoaderRoute: typeof LayoutAdminImport
      parentRoute: typeof LayoutImport
    }
    '/_layout/boats': {
      preLoaderRoute: typeof LayoutBoatsImport
      parentRoute: typeof LayoutImport
    }
    '/_layout/bookings': {
      preLoaderRoute: typeof LayoutBookingsImport
      parentRoute: typeof LayoutImport
    }
    '/_layout/items': {
      preLoaderRoute: typeof LayoutItemsImport
      parentRoute: typeof LayoutImport
    }
    '/_layout/jurisdictions': {
      preLoaderRoute: typeof LayoutJurisdictionsImport
      parentRoute: typeof LayoutImport
    }
    '/_layout/launches': {
      preLoaderRoute: typeof LayoutLaunchesImport
      parentRoute: typeof LayoutImport
    }
    '/_layout/locations': {
      preLoaderRoute: typeof LayoutLocationsImport
      parentRoute: typeof LayoutImport
    }
    '/_layout/missions': {
      preLoaderRoute: typeof LayoutMissionsImport
      parentRoute: typeof LayoutImport
    }
    '/_layout/settings': {
      preLoaderRoute: typeof LayoutSettingsImport
      parentRoute: typeof LayoutImport
    }
    '/_layout/trips': {
      preLoaderRoute: typeof LayoutTripsImport
      parentRoute: typeof LayoutImport
    }
    '/_layout/': {
      preLoaderRoute: typeof LayoutIndexImport
      parentRoute: typeof LayoutImport
    }
  }
}

// Create and export the route tree

export const routeTree = rootRoute.addChildren([
  LayoutRoute.addChildren([
    LayoutAdminRoute,
    LayoutBoatsRoute,
    LayoutBookingsRoute,
    LayoutItemsRoute,
    LayoutJurisdictionsRoute,
    LayoutLaunchesRoute,
    LayoutLocationsRoute,
    LayoutMissionsRoute,
    LayoutSettingsRoute,
    LayoutTripsRoute,
    LayoutIndexRoute,
  ]),
  LoginRoute,
  RecoverPasswordRoute,
  ResetPasswordRoute,
  SignupRoute,
])

/* prettier-ignore-end */
