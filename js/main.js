/* eslint-disable no-unused-vars */
/* global system, orientationInit, orientationChange, AHRS_TYPE, SOURCE, UNITS, headingTape, speedTape, altTape,
   vspeedTape, ahrsTape, slipSkid, turnCoordinator, gMeter, satCount, global, getCookie, getUrlParameter, initWS,
   ahrsWS, fmuWS, lastCheckInTime, post, setCookie */
// ============================================== //
// main.js :: Stratux AHRS
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

var html;
var system_status = {};
var message_flag;
var invalidList = [ false, false, false, false, false, false ];

// Run systemInit when the DOM is ready for modifications.
$( document ).ready( () => {
  html = $( "html" );
  message_flag = $( "#message_flag" );

  // Print init message
  console.log( "JS INIT" );

  // Prevent touch moves to ensure the user can't scroll off the screen
  $( "body" ).bind( "touchmove", function( e ) {
    e.preventDefault();
  } );

  // Init Overlay
  const bypass_warning = getCookie( "bypass_warning" );
  if ( system.overlay_active === true && bypass_warning !== "true" ) {
    $( "#overlay" ).css( "display", "unset" );
    $( "#overlay" ).click( function() {
      console.warn(
        "User acknowledged warning. View './README.md' for more information."
      );
      $( "#overlay" ).css( "opacity", "0" );
      setTimeout( function() {
        system.overlay_active = false;
        $( "#overlay" ).remove();
      }, 500 );
    } );
  }

  // Initialize the orientation system
  orientationInit();

  // Bind button interactions to their functions
  initButtons();

  if ( getUrlParameter( "simulate" ) === "true" ) {
    system.simulate = true;
  } else if ( getUrlParameter( "simulate" ) === "false" ) {
    system.simulate = false;
  }

  // Set up simulation if simulate is enabled
  if ( system.simulate ) {
    // Init the simulation pace variable
    var interval_val = 0;

    // Don't init ahrs_ws if we are simulating
    system.enable_ahrs_ws = false;
    $( "#simulate_tag" ).css( "display", "unset" );

    // Repeating function every 1/4 second
    setInterval( function() {
      // Exit simulation if it has been canceled
      if ( !system.simulate ) { return; }

      // Increment interval
      interval_val++;

      // Send artificial updates for simulation
      headingTape.update( +interval_val );
      ahrsTape.update(
        Math.sin( interval_val / 10 ) * 7,
        Math.cos( interval_val / 15 + 0.7 ) * 12
      );
      speedTape.update( Math.sin( interval_val / 20 + 0.5 ) * 9 + 70 );
      altTape.update( Math.cos( interval_val / 18 + 0.3 ) * 75 + 1423 );
      vspeedTape.update( Math.sin( interval_val / 18 + 0.3 ) * 50 + 4 );
      slipSkid.update( Math.sin( interval_val / 27 ) * 20 );
      turnCoordinator.update( Math.sin( interval_val / 17 ) * 3.5 );
      satCount.update( 7 );
      gMeter.update( Math.cos( interval_val / 30 ) + 1 );

      // Toggle message flag to show updates
      $( "#message_flag" ).toggleClass( "bright" ); // TODO: Make this faster!!!
    }, 250 );
  }

  // Check for valid date every 1/4 second
  setInterval( checkValid, 250 );

  // Refresh the websock connections after set time (checkActiveTime) if the
  // data is not valid for too long
  setInterval( refreshIfInvalidTimeout, system.checkActiveTime );

  if ( system.simulate === false ) {
    initWS();
  }
} );

system.ahrs.inactiveCounter = 0;
system.force_diff_orientation = false;

system.sendNotification = function( msg, opentime, color = "#587E4B" ) {
  let l;
  let side = "top";
  if ( system.orinetation === "landscape" ) {
    l = $( `<div class="notification">${msg}</div>` );
  } else {
    l = $( `<div class="notification portrait">${msg}</div>` );
    side = "right";
  }
  l.css( "background-color", color );
  $( "body" ).append( l );
  setTimeout( () => {
    l.css( side, "0px" );
  }, 1 );
  setTimeout( () => {
    l.css( side, "-40px" );
  }, opentime );
  setTimeout( () => {
    l.remove();
  }, opentime + 2000 );
};

// Get status at interval
if ( system.enable_get_status === true ) {
  var getRequest = true;
  setInterval( function() {
    if ( getRequest === true ) {
      getRequest = false;
      $.getJSON( system.status_url, function( data ) {
        system_status = data;
      } ).always( function() {
        getRequest = true;
      } );
    }
  }, 1000 );
}

// NOTICE: ALL INPUTS TO UPDATE FUNCTIONS ARE TO BE IN SI UNITS

function initButtons() {
  const buttons = $( ".number_button" );
  for ( let i = 0; i < buttons.length; i++ ) {
    $( buttons[ i ] ).click( event => {
      reportButton( $( event.currentTarget ).html() );
    } );
  }

  $( "#settings_icon" ).mouseup( () => {
    // Make the menu visible
    $( "#settings_menu" ).removeClass( "hidden" );
    $( "#settings_overlay" ).removeClass( "hidden" );

    // Now that it is visible, set its scroll back to 0 so that
    // the default icons are visible first
    $( "#settings_menu" )[ 0 ].scrollLeft = 0;
    $( "#settings_menu" )[ 0 ].scrollTop = 0;
  } );

  $( document ).keyup( function( e ) {
    if ( e.keyCode === 27 ) {
      $( "#settings_menu" ).addClass( "hidden" );
      $( "#settings_overlay" ).addClass( "hidden" );
      hideBaroInput();
    }
  } );

  $( "#settings_overlay" ).click( () => {
    $( "#settings_menu" ).addClass( "hidden" );
    $( "#settings_overlay" ).addClass( "hidden" );
    hideBaroInput();
  } );

  // Set Pitch On-Click
  $( "#align_ahrs" ).click( function() {
    var r = confirm( "Center AHRS?" );
    if ( r === true ) {
      post( "cageAHRS" );
    }
  } );

  $( "#calibrate_gyro" ).click( function() {
    var r = confirm( "Calibrate GYRO?" );
    if ( r === true ) {
      post( "calibrateAHRS" );
    }
  } );

  var baro_input_value = [ "0", "0", "0", "0", "0" ];
  var pre_input = true;
  var index = 0;
  function updateBaroPressure( push = false ) {
    if ( push ) {
      if ( altTape.altimeter_setting_unit === UNITS.INHG ) {
        if (
          baro_input_value[ 0 ] === "" ||
          baro_input_value[ 1 ] === "" ||
          baro_input_value[ 2 ] === "" ||
          baro_input_value[ 3 ] === ""
        ) {
          system.sendNotification(
            "Please enter a valid altimeter setting",
            2000,
            // eslint-disable-next-line no-undef
            ( color = "red" )
          );
          return false;
        }
      } else {
        if (
          baro_input_value[ 0 ] === "" &&
          baro_input_value[ 1 ] === "" &&
          baro_input_value[ 2 ] === "" &&
          baro_input_value[ 3 ] === "" &&
          baro_input_value[ 4 ] === ""
        ) {
          system.sendNotification(
            "Please enter a valid altimeter setting",
            2000,
            // eslint-disable-next-line no-undef
            ( color = "red" )
          );
          return false;
        }
      }
    }
    let press_str = "";
    if ( altTape.altimeter_setting_unit === UNITS.INHG ) {
      press_str =
        "" +
        baro_input_value[ 0 ] +
        baro_input_value[ 1 ] +
        "." +
        baro_input_value[ 2 ] +
        baro_input_value[ 3 ];
    } else {
      press_str =
        "" +
        baro_input_value[ 0 ] +
        baro_input_value[ 1 ] +
        baro_input_value[ 2 ] +
        baro_input_value[ 3 ] +
        "." +
        baro_input_value[ 4 ];
    }
    let val = parseFloat( press_str );
    if ( altTape.altimeter_setting_unit === UNITS.INHG ) {
      if ( push || index === 4 ) {
        if ( val < 26 ) {
          system.sendNotification(
            "Altimeter setting too low",
            2000,
            // eslint-disable-next-line no-undef
            ( color = "red" )
          );
          val = 26;
          baro_input_value = [ "2", "6", "0", "0", "0" ];
          press_str =
            "" +
            baro_input_value[ 0 ] +
            baro_input_value[ 1 ] +
            "." +
            baro_input_value[ 2 ] +
            baro_input_value[ 3 ];
          $( "#altimeter_display" ).html( press_str );
          index = 0;
          return false;
        } else if ( val > 32 ) {
          system.sendNotification(
            "Altimeter setting too high",
            2000,
            // eslint-disable-next-line no-undef
            ( color = "red" )
          );
          val = 32;
          baro_input_value = [ "3", "2", "0", "0", "0" ];
          press_str =
            "" +
            baro_input_value[ 0 ] +
            baro_input_value[ 1 ] +
            "." +
            baro_input_value[ 2 ] +
            baro_input_value[ 3 ];
          $( "#altimeter_display" ).html( press_str );
          index = 0;
          return false;
        }
      }
    } else {
      // Unit is MB or hPa
      if ( push || index > 5 ) {
        if ( val < 880.4 ) {
          system.sendNotification(
            "Altimeter setting too low",
            2000,
            // eslint-disable-next-line no-undef
            ( color = "red" )
          );
          val = 880.4;
          baro_input_value = [ "0", "8", "8", "0", "4" ];
          press_str =
            "" +
            baro_input_value[ 0 ] +
            baro_input_value[ 1 ] +
            baro_input_value[ 2 ] +
            baro_input_value[ 3 ] +
            "." +
            baro_input_value[ 4 ];
          $( "#altimeter_display" ).html( press_str );
          index = 0;
          return false;
        } else if ( val > 1049.8 ) {
          system.sendNotification(
            "Altimeter setting too high",
            2000,
            // eslint-disable-next-line no-undef
            ( color = "red" )
          );
          val = 1049.8;
          baro_input_value = [ "1", "0", "4", "9", "8" ];
          press_str =
            "" +
            baro_input_value[ 0 ] +
            baro_input_value[ 1 ] +
            baro_input_value[ 2 ] +
            baro_input_value[ 3 ] +
            "." +
            baro_input_value[ 4 ];
          $( "#altimeter_display" ).html( press_str );
          index = 0;
          return false;
        }
      }
    }
    $( "#altimeter_display" ).html( press_str );
    if ( push ) {
      updateKollsmanSetting( val );
    }
    return true;
  }

  function updateKollsmanSetting( kollsman ) {
    altTape.kollsman = kollsman;
    setCookie( "altimeter_setting", altTape.kollsman, altTape.kollsman_memory_seconds );
    setCookie( "altimeter_setting_unit", altTape.unit_text, altTape.kollsman_memory_seconds );
    system.sendNotification(
      `Updated altimeter to ${altTape.kollsman}${altTape.unit_text}`,
      4000
    );
    if ( altTape.source === SOURCE.BARO ) {
      $( "#alt_annun_text" ).html(
        "Baro Altitude <span>" +
          altTape.kollsman +
          altTape.unit_text +
          ", " +
          altTape.unitPrefix +
          ", " +
          vspeedTape.unitPrefix +
          "</span>"
      );
    }
  }

  function resetBaroInput( fromCurrent = false ) {
    let tmp = altTape.kollsman_standard;
    if ( fromCurrent ) {
      tmp = altTape.kollsman;
    }
    if ( altTape.altimeter_setting_unit === UNITS.INHG ) {
      baro_input_value = [
        Math.floor( ( tmp / 10 ) % 10 ),
        Math.floor( tmp % 10 ),
        Math.floor( ( tmp * 10 ) % 10 ),
        Math.floor( ( tmp * 100 ) % 10 ),
        ""
      ];
    } else {
      baro_input_value = [
        Math.floor( ( tmp / 1000 ) % 10 ),
        Math.floor( ( tmp / 100 ) % 10 ),
        Math.floor( ( tmp / 10 ) % 10 ),
        Math.floor( tmp % 10 ),
        Math.floor( ( tmp * 10 ) % 10 )
      ];
    }

    updateBaroPressure();
    pre_input = true;
    index = 0;
  }

  function showBaroInput() {
    $( "#settings_popup" ).removeClass( "hidden" );
    // eslint-disable-next-line no-undef
    resetBaroInput( ( fromCurrent = true ) );
  }

  function hideBaroInput() {
    $( "#settings_popup" ).addClass( "hidden" );
    // eslint-disable-next-line no-undef
    resetBaroInput( ( fromCurrent = true ) );
  }

  function addValue( val ) {
    if ( pre_input ) {
      baro_input_value = [ "", "", "", "", "" ];
      pre_input = false;
    }
    baro_input_value[ index ] = val;
    index += 1;
    if ( index === ( altTape.altimeter_setting_unit === UNITS.INHG ? 4 : 5 ) ) {
      pre_input = true;
      index = 0;
    }

    // console.log(baro_input_value);
    updateBaroPressure();
  }

  function reportButton( button ) {
    switch ( button ) {
      case "1":
      case "2":
      case "3":
      case "4":
      case "5":
      case "6":
      case "7":
      case "8":
      case "9":
      case "0":
        addValue( button );
        break;
      case "Clr":
        baro_input_value = [ "", "", "", "", "" ];
        index = 0;
        updateBaroPressure();
        break;
      case "Ent":
        // eslint-disable-next-line no-undef
        if ( updateBaroPressure( ( push = true ) ) ) {
          hideBaroInput();
        }
        break;
    }
  }

  $( "#update_baro" ).click( () => {
    showBaroInput();
  } );

  $( "#set_std_baro" ).click( () => {
    updateKollsmanSetting( altTape.kollsman_standard );
  } );
  $( "#force_update" ).click( () => {
    window.location.reload( true );
  } );
  $( "#toggle_rotation" ).click( () => {
    system.force_diff_orientation = !system.force_diff_orientation;
    orientationChange();
  } );
  $( "#simulate_tag" ).click( function() {
    if ( system.simulate === true ) {
      system.simulate = false;
      system.enable_ahrs_ws = true;
      initWS();
      $( "#simulate_tag" ).css( "display", "none" );
    }
  } );

  // Set altitude button up
  $( "#alt_annun" ).click( function() {
    var loc = 0;
    for ( let i = 0; i < altTape.possibleSources.length; i++ ) {
      if ( altTape.possibleSources[ i ] === altTape.source ) {
        loc = i;
        break;
      }
    }
    loc++;
    if ( loc >= altTape.possibleSources.length ) {
      loc = 0;
    }
    altTape.source = altTape.possibleSources[ loc ];
    switch ( altTape.source ) {
      case SOURCE.BARO:
        $( "#alt_annun_text" ).html(
          "Baro Altitude <span>" +
            altTape.kollsman +
            altTape.unit_text +
            ", " +
            altTape.unitPrefix +
            ", " +
            vspeedTape.unitPrefix +
            "</span>"
        );
        break;
      case SOURCE.GPS:
        $( "#alt_annun_text" ).html(
          "GPS Altitude <span>" +
            altTape.unitPrefix +
            ", " +
            vspeedTape.unitPrefix +
            "</span>"
        );
        break;
      case SOURCE.INPUT:
        return;

      // $('#alt_annun_text').html('User Altitude <span>' + altTape.unitPrefix + ', ' + vspeedTape.unitPrefix + '</span>');
      // TODO: Implement user defined altimeter setting
      // break;
    }
    vspeedTape.source = altTape.source;
  } );

  // TODO: Restore this functionality to a proper menu
  // system.checkWS = true;
  // system.smooth = true;
  // $( "#sat_count" ).click( function() {
  //   var r = confirm( ( system.smooth ? "Disable" : "Enable" ) + " Smoothing?" );
  //   if ( r === false ) {
  //     r = confirm( ( system.checkWS ? "Disable" : "Enable" ) + " Check WS?" );
  //     if ( r === true ) { system.checkWS = !system.checkWS; }
  //   } else {
  //     system.smooth = !system.smooth;
  //     if ( system.smooth ) {
  //       html.css( "--ease_time", "0.2s" );
  //       html.css( "--hdg_ease_time", "0.2s" );
  //       html.css( "--aux_ease_time", "0.2s" );
  //     } else {
  //       html.css( "--ease_time", "0s" );
  //       html.css( "--hdg_ease_time", "0s" );
  //       html.css( "--aux_ease_time", "0s" );
  //     }
  //   }
  // } );
}

// Checks if all the fields are valid

function checkValid() {
  var now = Date.now();
  for ( var i = 0; i < lastCheckInTime.length; i++ ) {
    if (
      now - lastCheckInTime[ i ] > system.ahrs.updateTimeout &&
      invalidList[ i ] === false
    ) {
      // Set invalid
      switch ( i ) {
        case AHRS_TYPE.SPEED:
          speedTape.update( 0, true );
          satCount.update( "-" );
          break;
        case AHRS_TYPE.ALT:
          altTape.update( 0, true );
          break;
        case AHRS_TYPE.VSPEED:
          vspeedTape.update( 0, true );
          break;
        case AHRS_TYPE.HDG:
          headingTape.update( 0, true );
          break;
        case AHRS_TYPE.AHRS:
        case AHRS_TYPE.GMETER:
          ahrsTape.update( 0, 0, true );
          gMeter.update( 1, true );
          slipSkid.update( 0, true );
          turnCoordinator.update( 0, true );
          break;
      }
      setInvalid( i, true );
    } else if (
      now - lastCheckInTime[ i ] < system.ahrs.updateTimeout &&
      invalidList[ i ] === true
    ) {
      // Set valid
      setInvalid( i, false );
    }
  }
}

// Sets a field with the invalid flag
function setInvalid( type, value ) {
  var name;
  switch ( type ) {
    case AHRS_TYPE.SPEED:
      name = [ "speed_tape" ];
      break;
    case AHRS_TYPE.ALT:
    case AHRS_TYPE.VSPEED:
      name = [ "alt_tape" ];
      break;
    case AHRS_TYPE.HDG:
      name = [ "heading_tape" ];
      break;
    case AHRS_TYPE.AHRS:
      name = [
        "ahrs_container",
        /* 'pitch_readout', */ "roll_readout",
        "slip_skid_holder"
      ];
      break;
    case AHRS_TYPE.ALL:
      name = [
        "ahrs_container",
        /* 'pitch_readout', */ "roll_readout",
        "heading_tape",
        "alt_tape",
        "speed_tape",
        "slip_skid_holder"
      ];
      break;
  }
  if ( name === undefined ) { return; }
  for ( let i = 0; i < name.length; i++ ) {
    if ( value ) {
      $( "#" + name[ i ] + " .invalid_holder:first" ).addClass( "invalid" );
    } else {
      $( "#" + name[ i ] + " .invalid_holder:first" ).removeClass( "invalid" );
    }
    // console.log( "add remove" );
  }
  if ( type !== AHRS_TYPE.ALL ) {
    invalidList[ type ] = value;
  } else {
    for ( let i = 0; i < invalidList.length; i++ ) {
      invalidList[ i ] = value;
    }
  }
}

function refreshIfInvalidTimeout() {
  for ( let i = 0; i < invalidList.length; i++ ) {
    if ( invalidList[ i ] === false ) { return; }
  }
  try {
    ahrsWS.close();
    fmuWS.close();
  } catch ( error ) {}
}
