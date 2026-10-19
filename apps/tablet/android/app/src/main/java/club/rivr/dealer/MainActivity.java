package club.rivr.dealer;

import android.app.ActivityManager;
import android.app.admin.DevicePolicyManager;
import android.app.admin.SystemUpdatePolicy;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.os.UserManager;
import android.view.WindowManager;
import com.getcapacitor.BridgeActivity;

/**
 * The dealer tablet's one screen (#41). On a tablet provisioned with this app as its device owner
 * (docs/runbooks/dealer-tablet.md), it locks the tablet to itself: no home button, no recent apps,
 * no notifications and no other app, and it is the home screen, so it opens again after a restart.
 * On any other device, such as a developer's phone, it runs as a normal app. The screen stays on.
 */
public class MainActivity extends BridgeActivity {
    // System updates install only while the club is closed: 11:00 to 15:00, the tablet's own time.
    private static final int UPDATE_WINDOW_START = 11 * 60;
    private static final int UPDATE_WINDOW_END = 15 * 60;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        DevicePolicyManager policy = (DevicePolicyManager) getSystemService(Context.DEVICE_POLICY_SERVICE);
        if (policy.isDeviceOwnerApp(getPackageName())) {
            lockDown(policy, new ComponentName(this, DealerAdminReceiver.class));
        }
    }

    /** As device owner: this app alone, as the home screen, with no way out through safe mode or another app. */
    private void lockDown(DevicePolicyManager policy, ComponentName admin) {
        policy.setLockTaskPackages(admin, new String[] { getPackageName() });
        // The power menu stays, to switch off or restart; a restart into safe mode would open the usual home screen.
        policy.addUserRestriction(admin, UserManager.DISALLOW_SAFE_BOOT);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.VANILLA_ICE_CREAM) {
            // A link the hosted bundle opens cannot start another app inside the locked task.
            policy.setLockTaskFeatures(admin, DevicePolicyManager.LOCK_TASK_FEATURE_GLOBAL_ACTIONS
                | DevicePolicyManager.LOCK_TASK_FEATURE_BLOCK_ACTIVITY_START_IN_TASK);
        }
        policy.setSystemUpdatePolicy(admin, SystemUpdatePolicy.createWindowedInstallPolicy(UPDATE_WINDOW_START, UPDATE_WINDOW_END));
        // The home screen is an alias that is off on every other device, so a developer's phone never offers it.
        ComponentName home = new ComponentName(this, getPackageName() + ".DealerHome");
        getPackageManager().setComponentEnabledSetting(home, PackageManager.COMPONENT_ENABLED_STATE_ENABLED, PackageManager.DONT_KILL_APP);
        IntentFilter homeIntents = new IntentFilter(Intent.ACTION_MAIN);
        homeIntents.addCategory(Intent.CATEGORY_HOME);
        homeIntents.addCategory(Intent.CATEGORY_DEFAULT);
        policy.addPersistentPreferredActivity(admin, homeIntents, home);
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
