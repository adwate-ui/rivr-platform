package club.rivr.dealer;

import android.app.ActivityManager;
import android.app.admin.DevicePolicyManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Bundle;
import android.view.WindowManager;
import com.getcapacitor.BridgeActivity;

/**
 * The dealer tablet's one screen (#41). On a tablet provisioned with this app as its device owner
 * (docs/runbooks/dealer-tablet.md), it locks the tablet to itself: no home button, no recent apps,
 * no notifications and no other app, and it is the home screen, so it opens again after a restart.
 * On any other device, such as a developer's phone, it runs as a normal app. The screen stays on.
 */
public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        DevicePolicyManager policy = (DevicePolicyManager) getSystemService(Context.DEVICE_POLICY_SERVICE);
        if (policy.isDeviceOwnerApp(getPackageName())) {
            ComponentName admin = new ComponentName(this, DealerAdminReceiver.class);
            policy.setLockTaskPackages(admin, new String[] { getPackageName() });
            IntentFilter home = new IntentFilter(Intent.ACTION_MAIN);
            home.addCategory(Intent.CATEGORY_HOME);
            home.addCategory(Intent.CATEGORY_DEFAULT);
            policy.addPersistentPreferredActivity(admin, home, new ComponentName(this, MainActivity.class));
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        DevicePolicyManager policy = (DevicePolicyManager) getSystemService(Context.DEVICE_POLICY_SERVICE);
        ActivityManager activities = (ActivityManager) getSystemService(Context.ACTIVITY_SERVICE);
        // Only where the device owner allows it: elsewhere startLockTask asks the user to pin the screen.
        if (policy.isLockTaskPermitted(getPackageName())
            && activities.getLockTaskModeState() == ActivityManager.LOCK_TASK_MODE_NONE) {
            startLockTask();
        }
    }
}
