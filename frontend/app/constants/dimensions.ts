export const DIMENSIONS_FROM_ASPECT_RATIO_LOOKUP = {
  // '2:3': {
  //   width: 1080,
  //   height: 1440,
  // },
  // '4:5': {
  //   width: 1080,
  //   height: 1350,
  // },
  '9:16': {
    width: 1080,
    height: 1920,
  },
  '1:1': {
    width: 1080,
    height: 1080,
  },
  // '3:2': {
  //   width: 1440,
  //   height: 1080,
  // },
  '16:9': {
    width: 1920,
    height: 1080,
  },
  // '21:9': {
  //   width: 2560,
  //   height: 1080,
  // },
} as const;