# 0286: No driver app

Date: 1 Nov 2026. The audit of 28 Oct, F3-10, and the owner's answer (Q5): "Delete it everywhere", approved as an exception to the CI freeze.

- **Why.** `apps/driver` was a stub ("No pickups.") that still shipped. It was deployed to staging, previews and production, and its APK sat in the release matrix beside the tablet's. With fail-fast on, a failed driver build or an unset `PROD_DRIVER_URL` cancelled the tablet APK on launch day.
- **Removed:** `apps/driver`, `DriverShell`, the driver strings and port, the brand kit's driver icons, the smoke flow, and driver from `deploy-staging.yml`, `preview.yml` and `release.yml`.
- **No cab trips in the app either** (decision 0285). Staff book the cab.
- **Overrides the spec.** `docs/spec/additions-2026-10-14.md` (a driver APK on every release) and `docs/contracts/lane-c.md` ("Driver app: all of it") are superseded here. A driver app returns only as new work.
- **Left as is:** the applied migration's `device_kind` value `driver_phone`.
- **Ops, outside the repository:** the Cloudflare projects `rivr-driver-staging` and `rivr-driver` still serve the last stub, and the `STAGING_DRIVER_URL` and `PROD_DRIVER_URL` repository variables are unused. The owner can remove them.
