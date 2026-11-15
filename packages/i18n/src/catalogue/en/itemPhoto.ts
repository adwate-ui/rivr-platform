/** A dish's photo on the console (AS-11): the club's own, shown in the app in a 4:3 tile. */
export const itemPhoto = {
  /** Read out with the button: `Add a photo of Paneer tikka`. */
  add: 'Add a photo',
  addName: 'Add a photo of {name}',
  replace: 'Replace the photo',
  replaceName: 'Replace the photo of {name}',
  saved: 'Photo saved.',
  failures: {
    not_a_photo: 'Not a photo. Choose a JPEG, PNG or WebP.',
    too_big: 'Too large. Choose a smaller photo.',
    not_allowed: 'Not in your role. Ask an admin.',
    unavailable: 'Not sent. Try again.',
  },
} as const;
