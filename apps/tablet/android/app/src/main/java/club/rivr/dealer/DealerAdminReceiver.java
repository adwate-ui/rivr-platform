package club.rivr.dealer;

import android.app.admin.DeviceAdminReceiver;

/**
 * Makes RIVR Dealer the tablet's device owner when the tablet is provisioned with
 * `adb shell dpm set-device-owner club.rivr.dealer/.DealerAdminReceiver`
 * (docs/runbooks/dealer-tablet.md), so the app can lock the tablet to itself (#41). It needs no callbacks.
 */
public class DealerAdminReceiver extends DeviceAdminReceiver {}
