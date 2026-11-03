package club.rivr.player;

import android.Manifest;
import android.content.Intent;
import android.os.Build;
import androidx.core.app.NotificationManagerCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.google.firebase.messaging.FirebaseMessaging;

/**
 * The app's own LiveStatus plugin (decision 0361), as the player app calls it (src/features/profile/nativePhone.ts): asks
 * leave to notify, gives the phone's Firebase token, keeps the key the database gave the phone, removes what shows when
 * the member turns it off or signs out, and tells the app which page a tapped status opens.
 */
@CapacitorPlugin(
    name = "LiveStatus",
    permissions = @Permission(strings = { Manifest.permission.POST_NOTIFICATIONS }, alias = LiveStatusPlugin.NOTIFICATIONS)
)
public class LiveStatusPlugin extends Plugin {
    static final String NOTIFICATIONS = "notifications";

    @Override
    public void load() {
        openFrom(getActivity().getIntent());
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        openFrom(intent);
    }

    /** A tapped status opened the app: the page is kept for the app until it listens (a cold start). */
    private void openFrom(Intent intent) {
        String path = LiveStatusNotification.pathOf(intent);
        if (path == null) return;
        intent.removeExtra(LiveStatusNotification.EXTRA_PATH);
        JSObject opened = new JSObject();
        opened.put("path", path);
        notifyListeners("opened", opened, true);
    }

    /** Before Android 13 notifications need no asking: they are on unless the member turned them off in settings. */
    @Override
    @PluginMethod
    public void checkPermissions(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            super.checkPermissions(call);
            return;
        }
        JSObject permissions = new JSObject();
        permissions.put(NOTIFICATIONS, NotificationManagerCompat.from(getContext()).areNotificationsEnabled() ? "granted" : "denied");
        call.resolve(permissions);
    }

    @PluginMethod
    public void register(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && getPermissionState(NOTIFICATIONS) != PermissionState.GRANTED) {
            requestPermissionForAlias(NOTIFICATIONS, call, "afterAsking");
            return;
        }
        giveToken(call);
    }

    @PermissionCallback
    private void afterAsking(PluginCall call) {
        if (getPermissionState(NOTIFICATIONS) != PermissionState.GRANTED) {
            call.reject("Notifications are off for RIVR", "denied");
            return;
        }
        giveToken(call);
    }

    private void giveToken(PluginCall call) {
        LiveStatusNotification.createChannel(getContext(), call.getString("channelName", ""));
        FirebaseMessaging messaging;
        try {
            messaging = FirebaseMessaging.getInstance();
        } catch (IllegalStateException notSetUp) {
            // A build without the Firebase app's config (google-services.json): no live status on this build.
            call.reject("Firebase is not set up in this build", "not_configured");
            return;
        }
        messaging.getToken().addOnCompleteListener(task -> {
            if (!task.isSuccessful() || task.getResult() == null) {
                call.reject("Firebase gave no token", "unavailable");
                return;
            }
            LiveStatusStore.keepToken(getContext(), task.getResult());
            JSObject registered = new JSObject();
            registered.put("platform", "android");
            registered.put("token", task.getResult());
            call.resolve(registered);
        });
    }

    @PluginMethod
    public void current(PluginCall call) {
        JSObject kept = new JSObject();
        kept.put("token", LiveStatusStore.token(getContext()));
        kept.put("deviceKey", LiveStatusStore.deviceKey(getContext()));
        call.resolve(kept);
    }

    @PluginMethod
    public void keepDeviceKey(PluginCall call) {
        String deviceKey = call.getString("deviceKey");
        if (deviceKey == null || !deviceKey.matches("[0-9a-f]{64}")) {
            call.reject("Not a device key");
            return;
        }
        LiveStatusStore.keepDeviceKey(getContext(), deviceKey);
        call.resolve();
    }

    @PluginMethod
    public void unregister(PluginCall call) {
        boolean wasOn = LiveStatusStore.deviceKey(getContext()) != null;
        LiveStatusStore.forgetDeviceKey(getContext());
        LiveStatusNotification.cancel(getContext());
        JSObject forgotten = new JSObject();
        forgotten.put("token", wasOn ? LiveStatusStore.token(getContext()) : null);
        call.resolve(forgotten);
    }
}
