/** ************************** Configuration File ************************** **/
/** Edit settings for each component of the AHRS and ADS-b traffic display.
/** Descriptions of each setting are commented.
/** ************************** ****************** ************************** **/

/** ******************************** SYSTEM ******************************** **/
var system = { // Overall system settings
  overlay_active: true, // Enable warning overlay on startup
  ahrs: { // Settings for the overall AHRS
    updateTimeout: 750 // Time required for a metric to be set as invalid
  },
  fmu: { // Settings for the overall AHRS
    updateTimeout: 1500 // Time required for a metric to be set as invalid
  },
  checkActiveTime: 2250,
  websocket_url: // Websocket URL for situation
    "ws://192.168.10.1/situation",
  enable_ahrs_ws: true,
  fmu_url: // Websocket URL for FMU Update
    "ws://192.168.10.1:8888",
  enable_fmu: false, // Enable FMU support - in development
  cpu_temp_warn: 70, // Temp at which the 'Temp' banner will be displayed (C)
  status_url: "http://192.168.10.1/getStatus",
  simulate: false
};
/** ******************************** ****** ******************************** **/

/** ******************************* CONSTANTS ****************************** **/
var COLORS = {
  RED: 0,
  GREEN: 1,
  YELLOW: 2
};
var AHRS_TYPE = {
  SPEED: 0,
  ALT: 1,
  HDG: 2,
  AHRS: 3,
  VSPEED: 4,
  GMETER: 5,
  ALL: 6
};
var UNITS = {
  KTS: 0,
  KNOTS: 0,
  MPH: 1,
  MPS: 2,
  FPS: 3,
  FPM: 4,
  KPH: 5,
  MPM: 11,
  FEET: 6,
  METERS: 7,
  M: 7,
  MILES: 8,
  NAUTICLE_MILES: 9,
  FPNMI: 10
};
var SOURCE = {
  AHRS: 0,
  GPS: 1,
  BARO: 2,
  INPUT: 3,
  AUTO: 4
};
/** ******************************* ********* ****************************** **/

/** ******************************* HEADING ******************************** **/
var headingTape = { // Compass / track tape at the bottom of the AHRS
  range: 30, // Visual range of degrees present at one time. IE: a
  // value of '30' allows 30 degrees visiable at all times.
  ticks_per_number: 10 // Specifies how often numbers are written on the tape.
  // A val of '10' means every 10th number is shown
};
/** ******************************* ******* ******************************** **/


/** ******************************** SPEED ********************************* **/
var speedTape = { // Speed tape on the left of the AHRS
  lowerSpeed: 0, // Lower displayed speed given in MPH
  upperSpeed: 200, // Upper displayed speed given in MPH
  speeds: [ // Speed color band configurations given in MPH
    {
      color: COLORS.WHITE,
      start: 55,
      end: 115
    },
    {
      color: COLORS.GREEN,
      start: 64,
      end: 140
    },
    {
      color: COLORS.YELLOW,
      start: 140,
      end: 171
    },
    {
      color: COLORS.RED,
      start: 171,
      end: 200
    }
  ],
  units: UNITS.MPH // Units for displaying speed
};
/** ******************************** ***** ********************************* **/


/** ******************************* ALTITUDE ******************************* **/
var altTape = {
  units: UNITS.FEET // Units for displaying altitude
};
/** ******************************* ******** ******************************* **/


/** ******************************** VSPEED ******************************** **/
var vspeedTape = {
  units: UNITS.FPM // Units for displaying verticle speed
};
/** ******************************** ****** ******************************** **/


/** ********************************* AHRS ********************************* **/
var ahrsTape = { // AHRS in the center of the AHRS
  limits: [30, -30], // Limits for the degrees that are displayed. Values
  // outside this range show chevrons
  degrees_in_view: 25, // Degrees in constant view (range)
  chevrons: 4, // Number of chevrons shown pased the limits
  chevron_space: 140 // Space given to each chevron (sizing)
};
/** ********************************* AHRS ********************************* **/


/** ******************************** G-Meter ******************************* **/
var gMeter = {
  display: true
};
/** ******************************** ******* ******************************* **/


/** ****************************** Sat Count ******************************* **/
var satCount = {
  display: true
};
/** ****************************** ********* ******************************* **/


/** ********************************* ADS-b ******************************** **/
/** ********************************* ***** ******************************** **/

/** ******************************** CONSTS ******************************** **/
var conv = {
  ft2m: 0.3048,
  m2ft: 3.280839895,
  nmi2m: 1852,
  m2nmi: 0.0005399568035,
  mi2nmi: 0.868976,
  nmi2mi: 1.1507797684,
  m2km: 0.001,
  km2m: 1000,
  nmi2km: 1.852,
  km2nmi: 0.5399568035,
  mps2mph: 2.23694,
  mph2mps: 0.447039259,
  mps2kts: 1.94384,
  kts2mps: 0.5144456334,
  kts2mph: 1.15078,
  mph2kts: 0.8689758251,
  mps2fpm: 196.85,
  fpm2mps: 0.00508001016,
  mps2fps: 3.28084,
  fps2mps: 0.3047999902,
  mps2kph: 3.6,
  kph2mps: 0.2777777778,
  m2mi: 0.000621371,
  mi2m: 1609.3444978926,
  mps2mpm: 60,
  mpm2mps: 0.01666666667
};
/** ******************************** ****** ******************************** **/