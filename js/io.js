/* eslint-disable no-unused-vars */
/* global system, SOURCE, headingTape, speedTape, altTape, vspeedTape, ahrsTape, slipSkid, turnCoordinator, gMeter,
   satCount, conv, system_status, setCookie, message_flag */
// ============================================== //
// io.js :: Stratux AHRS
//
// View the repo at
// https://github.com/knicholson32/stratux_ahrs
//
// Run with via webserver. Entry point is
// 'index.html'
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.
// ============================================== //

var ahrsWS;
var sockets = [];
var avgCount = 0;
var headingAvg = [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ];
var fmuWS;
var presist = { overheat: false };

function initWS() {
  // Init AHRS
  if ( system.enable_ahrs_ws === true ) {
    ahrsWSInit();
    setInterval( ahrsWS.checkActive, 500 );
  }

  // Init FMU - BETA
  if ( system.enable_fmu === true ) {
    fmuInit();
    setInterval( fmuWS.checkActive, 1000 );
  }
}

function ahrsWSInit() {
  console.log( "Attempting to connect to " + system.websocket_url );
  try {
    try {
      ahrsWS.onmessage = function() { };
      ahrsWS.checkActive = function() { };
      ahrsWS.onerror = function() { };
    } catch ( error ) { }
    removeAllClients();

    // ahrsWS.close();
  } catch ( error ) {
    console.error( error );
  }
  ahrsWS = new WebSocket( system.websocket_url );
  sockets.push( ahrsWS );
  ahrsWS.closed = true;
  ahrsWS.lastMessage = new Date().getTime();

  ahrsWS.onopen = function( _e ) {
    console.log( "Connection established!" );
    ahrsWS.closed = false;
  };

  ahrsWS.onclose = function( e ) {
    ahrsWS.closed = true;
    var name = e.target.url.substr( e.target.url.lastIndexOf( "/" ) + 1 );
    if ( e.wasClean ) {
      console.log( "Websocket \"" + name + "\" closed cleanly." );
    } else {
      console.warn( "Websocket \"" + name + "\" did not closed cleanly." );
    }
    console.log( "Reconnecting after 0.5 seconds:" );
    system.ahrs.inactiveCounter++;
    if (
      system.allow_reload &&
            system.ahrs.inactiveCounter > system.ahrs.reloadAfterTimeoutCount
    ) {
      console.log( "Reboot!" );
      doRefresh();
    } else {
      setTimeout( function() {
        ahrsWSInit();
      }, 500 );
    }
  };

  ahrsWS.kill = function() {
    system.checkWS = false;
    ahrsWS.closed = true;
    ahrsWS.close();
  };

  ahrsWS.checkActive = function() {
    if ( system.checkWS === false || ahrsWS.closed === true ) { return; }

    // Get the current time
    var d = new Date().getTime();

    // If it has been too long since a message, restart the connection
    if ( d - system.ahrs.updateTimeout > ahrsWS.lastMessage ) {
      ahrsWS.close();
      if (
        system.allow_reload &&
                system.ahrs.inactiveCounter > system.ahrs.reloadAfterTimeoutCount
      ) {
        console.log( "Reboot!" );
        doRefresh();
      } else {
        console.log( "Reconnecting after 0.5 seconds:" );
        setTimeout( function() {
          ahrsWS = undefined;
          ahrsWSInit();
        }, 500 );
      }
    }
  };

  ahrsWS.onmessage = function( message ) {
    ahrsWS.lastMessage = new Date().getTime();
    message_flag.toggleClass( "bright" ); // TODO: Make this faster!!!
    if ( message.isTrusted ) {
      system.ahrs.inactiveCounter = 0;
      // TODO: Consider using a JSON parser that takes schema into account
      // For example: https://github.com/mafintosh/turbo-json-parse
      var data = JSON.parse( message.data );

      // console.log(data);
      var gpsValid = false;

      // GPS Detection:
      switch ( data.GPSFixQuality ) {
        case 2: // WAAS
        case 1: // 2D / 3D
          if (
            data.GPSSatellitesSeen < 7 ||
                        data.GPSLatitude === 0.0 ||
                        data.GPSLongitude === 0.0 ||
                        data.GPSNACp < 7 ||
                        data.GPSHorizontalAccuracy > 100 ||
                        data.GPSVerticalAccuracy >
                        500 /* || data.GPSPositionSampleRate === 0 */
          ) {
            // Data is invalid for some reason
            break;
          }
          gpsValid = true;
          satCount.update( data.GPSSatellites );
          speedTape.update( data.GPSGroundSpeed * conv.kts2mps ); // Given in kts
          headingAvg[ avgCount ] = data.AHRSGyroHeading;
          headingTape.update( data.AHRSGyroHeading ); // AHRSGyroHeading  GPSTrueCourse
          avgCount++;
          if ( avgCount > headingAvg.length - 1 ) {
            avgCount = 0;
          }
          break;
        case 6: // Dead Reckoning
        case 0: // NONE
          break;
        default:

          // No fix / unreliable fix
          break;
      }

      switch ( altTape.source ) {
        case SOURCE.GPS:
          if ( gpsValid ) {
            // vspeedTape.update(data.GPSVerticalSpeed * conv.fps2mps);    // Given in f/s -> 100ft/min  BaroVerticalSpeed GPSVerticalSpeed
            // eslint-disable-next-line no-undef
            altTape.update( data.GPSAltitudeMSL * conv.ft2m ); // BaroPressureAltitude BaroPressureAltitude GPSAltitudeMSL
          }
          break;
        case SOURCE.BARO:
          if (
            data.BaroVerticalSpeed !== 99999 &&
                        data.BaroPressureAltitude !== 99999
          ) {
            // vspeedTape.update(data.BaroVerticalSpeed * conv.fps2mps);   // Given in f/s -> 100ft/min  BaroVerticalSpeed GPSVerticalSpeed
            altTape.update( data.BaroPressureAltitude * conv.ft2m ); // BaroPressureAltitude BaroPressureAltitude GPSAltitudeMSL
          }
          break;
      }

      if (
        data.BaroVerticalSpeed !== 99999 &&
                data.BaroPressureAltitude !== 99999
      ) {
        vspeedTape.update( data.BaroVerticalSpeed * conv.fps2mps );
      }

      if ( data.AHRSStatus !== 1 ) {
        ahrsTape.update( data.AHRSPitch, data.AHRSRoll );
        slipSkid.update( data.AHRSSlipSkid );
        gMeter.update( data.AHRSGLoad );
      }

      if ( data.AHRSTurnRate !== 3276.7 ) {
        turnCoordinator.update( data.AHRSTurnRate );
      } else {
        turnCoordinator.update( 0 );
      }

      if (
        presist.overheat === false &&
                system_status.CPUTemp > system.cpu_temp_warn
      ) {
        presist.overheat = true;
        $( "#overheat_flag" ).css( "display", "block" );
      } else if (
        presist.overheat === true &&
                system_status.CPUTemp < system.cpu_temp_warn
      ) {
        presist.overheat = false;
        $( "#overheat_flag" ).css( "display", "none" );
      }

      // console.log(data);
    } else {
      console.log( "Invalid data" );
    }
  };

  ahrsWS.onerror = function( message ) {
    var name = message.target.url.substr(
      message.target.url.lastIndexOf( "/" ) + 1
    );
    console.error( "Websocket \"" + name + "\" had an error." );
    ahrsWS.close();
  };
}

function fmuInit() {
  console.log( "Attempting to connect to " + system.fmu_url );
  try {
    fmuWS.close();
  } catch ( error ) { }
  fmuWS = new WebSocket( system.fmu_url );
  fmuWS.lastMessage = new Date().getTime();
  fmuWS.closed = true;
  fmuWS.onopen = function( e ) {
    console.log( "Connection established!" );
    console.log( e );
    fmuWS.closed = false;
  };

  fmuWS.onclose = function( e ) {
    fmuWS.closed = true;
    var name = e.target.url.substr( e.target.url.lastIndexOf( "/" ) + 1 );
    if ( e.wasClean ) {
      console.log( "Websocket \"" + name + "\" closed cleanly." );
    } else {
      console.warn( "Websocket \"" + name + "\" did not closed cleanly." );
    }
    console.log( "Reconnecting after 0.5 seconds:" );
    setTimeout( function() {
      fmuInit();
    }, 500 );
  };

  fmuWS.checkActive = function() {
    if ( system.checkWS === false || fmuWS.closed === true ) { return; }

    // If it has been too long since a message, restart the connection
    if ( new Date().getTime() - system.fmu.updateTimeout > fmuWS.lastMessage ) {
      fmuWS.close();
    }
  };

  fmuWS.onmessage = function( message ) {
    fmuWS.lastMessage = new Date().getTime();
    $( "#message_flag" ).toggleClass( "bright" );
    if ( message.isTrusted ) {
      var data = JSON.parse( message.data );
      headingTape.updateFMU( data.hdg );
      speedTape.updateFMU( data.spd );
      altTape.updateFMU( data.alt );
    }
  };

  fmuWS.onerror = function( message ) {
    var name = message.target.url.substr(
      message.target.url.lastIndexOf( "/" ) + 1
    );
    console.error( "Websocket \"" + name + "\" had an error." );
    fmuWS.close();
  };
}

function removeAllClients() {
  for ( const s in sockets ) {
    sockets[ s ].close();
  }
  sockets = [];
}

function post( url ) {
  const http = new XMLHttpRequest();
  let text_url = "";
  switch ( url ) {
    case "cageAHRS":
      text_url = "Cage AHRS";
      break;
    case "calibrateAHRS":
      text_url = "Cage AHRS";
      break;
    default:
      text_url = "Unknown";
      break;
  }
  url = system.push_url + "/" + url;
  const params = "";
  http.open( "POST", url, true );

  // Send the proper header information along with the request
  http.setRequestHeader( "Content-type", "application/x-www-form-urlencoded" );

  // http.setRequestHeader("Content-length", params.length);
  // http.setRequestHeader("Connection", "close");

  http.onreadystatechange = function() {
    // Call a function when the state changes.
    if ( http.readyState === 4 && http.status === 200 ) {
      console.log( "Done: " + http.responseText );
      system.sendNotification(
                `Sent the '${text_url}' command to Stratux`,
                4000
      );
    } else if ( http.readyState === 4 && http.status === 0 ) {
      system.sendNotification(
                `Failed to send the '${text_url}' command to Stratux`,
                6000,
                // eslint-disable-next-line no-undef
                ( color = "red" )
      );
    } else {
      console.log( http );
    }
  };
  http.send( params );
}

function doRefresh() {
  setCookie( "bypass_warning", "true", 5 );
  location.reload();
}
