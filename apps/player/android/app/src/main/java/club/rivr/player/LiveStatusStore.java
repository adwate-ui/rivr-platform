package club.rivr.player;

import android.content.Context;
import android.content.SharedPreferences;

/**
 * What the phone keeps for the live status, in the app's private storage: its Firebase token and the key the database
 * gave it (decision 0361). No key means the member has it off, or signed out.
 */
final class LiveStatusStore {
    private static final String FILE = "rivr_live_status";
    private static final String TOKEN = "token";
    private static final String DEVICE_KEY = "device_key";

    private LiveStatusStore() {}

    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(FILE, Context.MODE_PRIVATE);
    }

    static String token(Context context) {
        return prefs(context).getString(TOKEN, null);
    }

    static String deviceKey(Context context) {
        return prefs(context).getString(DEVICE_KEY, null);
    }

    static void keepToken(Context context, String token) {
        prefs(context).edit().putString(TOKEN, token).apply();
    }

    static void keepDeviceKey(Context context, String deviceKey) {
        prefs(context).edit().putString(DEVICE_KEY, deviceKey).apply();
    }

    /** Turned off or signed out: the key goes, so a status that arrives late shows nothing. */
    static void forgetDeviceKey(Context context) {
        prefs(context).edit().remove(DEVICE_KEY).apply();
    }
}
