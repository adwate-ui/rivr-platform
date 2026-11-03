import { useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import { onNotificationOpened } from '../notificationLinks.ts';

/**
 * In the native app, opens the page a lock-screen status names when it or its button is tapped (decision 0361): Tonight,
 * Tonight answering a seat call ("I'm on my way", decision 0321), or Order. A web push's tap does the same in the service
 * worker. Shows nothing.
 */
export function NotificationLinks() {
  const navigate = useNavigate();
  useEffect(() => onNotificationOpened((path) => void navigate({ href: path })), [navigate]);
  return null;
}
