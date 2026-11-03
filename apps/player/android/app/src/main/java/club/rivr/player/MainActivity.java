package club.rivr.player;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

/**
 * The player app's one screen: the hosted player app in Capacitor's web view (decision 0323), with the app's own
 * LiveStatus plugin for the lock-screen live status (decision 0361).
 */
public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // A local plugin is registered before the bridge starts.
        registerPlugin(LiveStatusPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
