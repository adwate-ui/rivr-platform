# 0267: The social wall

Date: 28 Oct 2026. Issues #157 and #158.

- Every five minutes, the `social-wall` Edge Function asks Instagram's Graph API for the public posts that tag the club, since the newest one it holds. It records them as waiting. The Instagram account is the club's own: `SOCIAL_VENUE_ID` names the venue, and the database refuses the practice venue. Until `INSTAGRAM_USER_ID` and `INSTAGRAM_ACCESS_TOKEN` are set, the function does nothing.
- Staff who publish marketing (`marketing.publish`) moderate the posts in the console's Social screen. They approve or reject each one, and can change their mind later. They open a post on Instagram to see it before approving.
- Approved posts show the poster's public Instagram handle and caption.
  - On a TV in the social wall mode, they rotate one at a time, 12 seconds each. The TV is told at once when a post is approved.
  - On the website, the home page ends with an "On Instagram" block of the newest twelve. It links each post to Instagram.
  - Neither shows the photo. Instagram's media links expire, and copying the photos to storage is left for later.
