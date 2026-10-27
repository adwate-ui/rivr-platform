/** The console's Cameras screen (#122; tech plan item 17; decision 0238), for staff who manage devices. */
export const cameras = {
  title: 'Cameras',
  notAllowed: 'Only staff who manage devices keep the cameras.',
  tableLabel: 'The venue\'s cameras',
  name: 'Name',
  channel: 'Channel',
  channelHint: 'The recorder\'s name for this camera\'s feed, such as 2 or ch-2.',
  watches: 'Watches',
  status: 'Status',
  inUse: 'In use',
  retired: 'Retired',
  cage: 'The cage',
  elsewhere: 'Elsewhere',
  empty: 'No cameras yet.',
  addTitle: 'New camera',
  invalidName: 'Give the camera a name of up to 80 characters.',
  invalidChannel: 'Write the channel in letters, digits and . _ : - only.',
  add: 'Add the camera',
  added: '{name} added.',
  retire: 'Retire',
  retireLabel: 'Retire {name}',
};

/** Why a camera was not saved. */
export const cameraFailures = {
  notAllowed: 'Only staff who manage devices keep the cameras.',
  invalid: 'Write a name and a channel in letters and digits, and choose a table of this venue, the cage or elsewhere.',
  taken: 'That name, table or the cage already has a camera in use. Retire that one first.',
  paused: 'The venue is frozen. Release it, then change the cameras.',
  unavailable: 'That did not go through. Check the connection and try again.',
};
