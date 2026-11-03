package club.rivr.player;

import androidx.annotation.NonNull;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;
import java.util.Map;

/**
 * Firebase's messages to this phone (decision 0323): the live-status consumer's data messages, which show or remove the
 * ongoing notification whether or not the app is open. Nothing shows once the member turned it off or signed out.
 */
public class LiveStatusMessagingService extends FirebaseMessagingService {
    @Override
    public void onMessageReceived(@NonNull RemoteMessage message) {
        Map<String, String> data = message.getData();
        if (!"rivr_live_status".equals(data.get("kind"))) return;
        if (LiveStatusStore.deviceKey(this) == null) {
            LiveStatusNotification.cancel(this);
            return;
        }
        LiveStatusNotification.show(this, data);
    }

    /** A new token is kept; the app saves it the next time it opens (LiveStatusPlugin.register). */
    @Override
    public void onNewToken(@NonNull String token) {
        LiveStatusStore.keepToken(this, token);
    }
}
