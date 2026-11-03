package club.rivr.player;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import java.util.Map;

/**
 * The lock-screen live status on Android (decision 0323): one ongoing notification, as the prototype's Lock screen states
 * have it. The line above (`Waitlist · Table 1`, `Seat ready · held for`, `Call time left`), the figure in words (`Next in
 * line`) or a chronometer counting down to the hold's or the call time's end by itself, the game or seat beside the app's
 * name, and one button ("I'm on my way", "Order"). Every word comes from the server (@rivr/i18n). Only a seat call sounds.
 */
final class LiveStatusNotification {
    static final String CHANNEL_ID = "live_status";
    static final String EXTRA_PATH = "club.rivr.player.PATH";
    private static final int NOTIFICATION_ID = 323;

    private LiveStatusNotification() {}

    /** The channel the member sees in the phone's settings, named in the app's words. */
    static void createChannel(Context context, String name) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        String shown = name == null || name.isEmpty() ? context.getString(R.string.app_name) : name;
        NotificationChannel channel = new NotificationChannel(CHANNEL_ID, shown, NotificationManager.IMPORTANCE_HIGH);
        channel.setShowBadge(false);
        context.getSystemService(NotificationManager.class).createNotificationChannel(channel);
    }

    /** Shows the status a data message carries (LiveStatusMessagingService), or removes it when it says ended. */
    static void show(Context context, Map<String, String> data) {
        String state = data.get("state");
        if (state == null || state.equals("ended")) {
            cancel(context);
            return;
        }
        if (!mayNotify(context)) return;
        boolean isAlert = "1".equals(data.get("alert"));
        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_rivr)
            .setColor(ContextCompat.getColor(context, R.color.rivr_color_gold))
            .setContentTitle(data.get("label"))
            .setSubText(data.get("meta"))
            .setOngoing(true)
            .setCategory(NotificationCompat.CATEGORY_STATUS)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            // Only a seat call sounds and drops down; every other status, and a change to one, shows quietly.
            .setSilent(!isAlert)
            .setOnlyAlertOnce(!isAlert)
            .setContentIntent(open(context, "/", 0));
        String value = data.get("value");
        if (value != null && !value.isEmpty()) builder.setContentText(value);
        countDown(builder, millis(data.get("endsAt")));
        String actionTitle = data.get("actionTitle");
        String actionUrl = data.get("actionUrl");
        if (actionTitle != null && !actionTitle.isEmpty() && actionUrl != null && actionUrl.startsWith("/")) {
            builder.addAction(0, actionTitle, open(context, actionUrl, 1));
        }
        NotificationManagerCompat.from(context).notify(NOTIFICATION_ID, builder.build());
    }

    /** Removes what shows: the member left, or turned it off, or signed out. */
    static void cancel(Context context) {
        NotificationManagerCompat.from(context).cancel(NOTIFICATION_ID);
    }

    /** The app page an intent from the notification opens, or null for any other intent. */
    static String pathOf(Intent intent) {
        return intent == null ? null : intent.getStringExtra(EXTRA_PATH);
    }

    /** The phone counts down to the end by itself; once it has run out there is nothing left to show. */
    private static void countDown(NotificationCompat.Builder builder, long endsAt) {
        if (endsAt <= 0) return;
        builder.setUsesChronometer(true).setChronometerCountDown(true).setShowWhen(true).setWhen(endsAt);
        builder.setTimeoutAfter(Math.max(1, endsAt - System.currentTimeMillis()));
    }

    private static boolean mayNotify(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
            && ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            return false;
        }
        return NotificationManagerCompat.from(context).areNotificationsEnabled();
    }

    private static long millis(String text) {
        if (text == null || text.isEmpty()) return 0;
        try {
            return Long.parseLong(text);
        } catch (NumberFormatException unreadable) {
            return 0;
        }
    }

    private static PendingIntent open(Context context, String path, int request) {
        Intent intent = new Intent(context, MainActivity.class)
            .setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP)
            .putExtra(EXTRA_PATH, path);
        return PendingIntent.getActivity(context, request, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}
