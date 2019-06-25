// ============================================== //
// script.js :: Stratux AHRS
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

// Run systemInit when the DOM is ready for modifications.
$(document).ready(systemInit);

// System Initialization function
function systemInit() {
  html = $('html');
  // Print init message
  console.log("JS INIT");
  // Prevent touch moves to ensure the user can't scroll off the screen
  $('body').bind('touchmove', function(e) {
    e.preventDefault();
  });
  // Init Overlay
  let bypass_warning = getCookie('bypass_warning');
  if (system.overlay_active === true && bypass_warning !== "true") {
    $('#overlay').css('display', 'unset');
    $('#overlay').click(function() {
      console.warn("User acknowledged warning. View './README.md' for more information.");
      $('#overlay').css('opacity', '0');
      setTimeout(function() {
        system.overlay_active = false;
        $('#overlay').remove();
      }, 500);
    });
  }
  // Initialize the orientation system
  orientationInit();
  // Bind button interactions to their functions
  initButtons();
  // Set up simulation if simulate is enabled
  if (system.simulate) {
    // Init the simulation pace variable
    var interval_val = 0;
    // Don't init ahrs_ws if we are simulating
    system.enable_ahrs_ws = false;
    $('#simulate_tag').css('display', 'unset');
    // Repeating function every 1/4 second
    setInterval(function() {
      // Exit simulation if it has been canceled
      if (!system.simulate)
        return;
      // Increment interval
      interval_val++;
      // Send artificial updates for simulation
      headingTape.update(+interval_val);
      ahrsTape.update(Math.sin(interval_val / 10) * 7, Math.cos(interval_val / 15 + 0.7) * 12);
      speedTape.update(Math.sin(interval_val / 20 + 0.5) * 9 + 70);
      altTape.update(Math.cos(interval_val / 18 + 0.3) * 75 + 1423);
      vspeedTape.update(Math.sin(interval_val / 18 + 0.3) * 50 + 4);
      slipSkid.update(Math.sin(interval_val / 27)*20);
      turnCoordinator.update(Math.sin(interval_val / 17)*3.5);
      satCount.update(7);
      gMeter.update(Math.cos(interval_val / 30) + 1);
      // Toggle message flag to show updates
      $('#message_flag').toggleClass('bright');
    }, 250);
  }

  // Check for valid date every 1/4 second
  setInterval(checkValid, 250);
  // Refresh the websock connections after set time (checkActiveTime) if the
  // data is not valid for too long
  setInterval(refreshIfInvalidTimeout, system.checkActiveTime);

  if (system.simulate === false) {
    initWS();
  }
}

var ahrsWS;
var avgCount = 0;
var headingAvg = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
var system_status = {};
var presist = {
  overheat: false
};
system.ahrs.inactiveCounter = 0;

system.sendNotification = function(msg, opentime, color='#587E4B'){
  let l;
  let side = 'top';
  if(system.orinetation === "landscape"){
    l = $(`<div class="notification">${msg}</div>`);
  }else{
    l = $(`<div class="notification portrait">${msg}</div>`);
    side = 'right';
  }
  l.css('background-color', color);
  $('body').append(l);
  setTimeout(() => {
    l.css(side, '0px');
  }, 1)
  setTimeout(() => {
    l.css(side, '-40px');
  }, opentime)
  setTimeout(() => {
    l.remove();
  }, opentime+2000)
};

var sockets = [];
function initWS() {
  //Init AHRS
  if (system.enable_ahrs_ws === true) {
    ahrsWSInit();
    setInterval(ahrsWS.checkActive, 500);
  }

  //Init FMU - BETA
  if (system.enable_fmu === true) {
    fmuInit();
    setInterval(fmuWS.checkActive, 1000);
  }
}

function avg(arr) {
  var sum = 0;
  for (var i = 0; i < arr.length; i++) {
    sum += arr[i];
  }
  return sum / arr.length;
}

function removeAllClients(){
  for(s in sockets)
    sockets[s].close();
  sockets = [];
}

function ahrsWSInit() {
  console.log("Attempting to connect to " + system.websocket_url);
  try {
    try{
      ahrsWS.onmessage = function () {};
      ahrsWS.checkActive = function () {};
      ahrsWS.onerror = function () {};
    }catch (error) {}
    removeAllClients();
    // ahrsWS.close();
  } catch (error) {
    console.error(error);
  }
  ahrsWS = new WebSocket(system.websocket_url);
  sockets.push(ahrsWS);
  ahrsWS.closed = true;
  ahrsWS.lastMessage = new Date().getTime();

  ahrsWS.onopen = function(e) {
    console.log("Connection established!");
    ahrsWS.closed = false;
  };

  ahrsWS.onclose = function(e) {
    ahrsWS.closed = true;
    var name = e.target.url.substr(e.target.url.lastIndexOf('/') + 1);
    if (e.wasClean) {
      console.log("Websocket \"" + name + "\" closed cleanly.");
    } else {
      console.warn("Websocket \"" + name + "\" did not closed cleanly.");
    }
    console.log("Reconnecting after 0.5 seconds:");
    system.ahrs.inactiveCounter++;
    if(system.allowReload && system.ahrs.inactiveCounter > system.ahrs.reloadAfterTimeoutCount){
      console.log('Reboot!');
      doRefresh();
    }else{
      setTimeout(function() {
        ahrsWSInit();
      }, 500);
    }
  };

  ahrsWS.kill = function() {
    system.checkWS = false;
    ahrsWS.closed = true;
    ahrsWS.close();
  }

  ahrsWS.checkActive = function() {
    if (system.checkWS === false || ahrsWS.closed === true)
      return;
    // Get the current time
    var d = new Date().getTime();
    // If it has been too long since a message, restart the connection
    if (d - system.ahrs.updateTimeout > ahrsWS.lastMessage) {
      ahrsWS.close();
      if(system.allowReload && system.ahrs.inactiveCounter > system.ahrs.reloadAfterTimeoutCount){
        console.log('Reboot!');
        doRefresh();
      }else{
        console.log("Reconnecting after 0.5 seconds:");
        setTimeout(function() {
          ahrsWS = undefined;
          ahrsWSInit();
        }, 500);
      }
    }
  };

  ahrsWS.onmessage = function(message) {
    ahrsWS.lastMessage = new Date().getTime();
    $('#message_flag').toggleClass('bright');
    if (message.isTrusted) {
      system.ahrs.inactiveCounter = 0;
      var data = JSON.parse(message.data);
      //console.log(data);
      var gpsValid = false;
      // GPS Detection:
      switch (data.GPSFixQuality) {
        case 2: // WAAS
        case 1: // 2D / 3D
          if (data.GPSSatellitesSeen < 7 || data.GPSLatitude == 0.0 || data.GPSLongitude == 0.0 || data.GPSNACp < 7 || data.GPSHorizontalAccuracy > 100 || data.GPSVerticalAccuracy > 500 /*|| data.GPSPositionSampleRate === 0*/ ) {
            // Data is invalid for some reason
            break;
          }
          gpsValid = true;
          satCount.update(data.GPSSatellites);
          speedTape.update(data.GPSGroundSpeed * conv.kts2mps); // Given in kts
          headingAvg[avgCount] = data.AHRSGyroHeading;
          headingTape.update(data.AHRSGyroHeading); // AHRSGyroHeading  GPSTrueCourse
          avgCount++;
          if (avgCount > headingAvg.length - 1) {
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

      switch (altTape.source) {
        case SOURCE.GPS:
          if (gpsValid) {
            //vspeedTape.update(data.GPSVerticalSpeed * conv.fps2mps);    // Given in f/s -> 100ft/min  BaroVerticalSpeed GPSVerticalSpeed
            altTape.update(data.GPSAltitudeMSL * conv.ft2m); // BaroPressureAltitude BaroPressureAltitude GPSAltitudeMSL
          }
          break;
        case SOURCE.BARO:
          if (data.BaroVerticalSpeed !== 99999 && data.BaroPressureAltitude !== 99999) {
            //vspeedTape.update(data.BaroVerticalSpeed * conv.fps2mps);   // Given in f/s -> 100ft/min  BaroVerticalSpeed GPSVerticalSpeed
            altTape.update(data.BaroPressureAltitude * conv.ft2m); // BaroPressureAltitude BaroPressureAltitude GPSAltitudeMSL
          }
          break;
      }

      if (data.AHRSTurnRate != 3276.7){
        console.log(data.AHRSTurnRate);
      }

      if (data.BaroVerticalSpeed !== 99999 && data.BaroPressureAltitude !== 99999) {
        vspeedTape.update(data.BaroVerticalSpeed * conv.fps2mps);
      }

      // data.AHRSSlipSkid

      if (data.AHRSStatus !== 1) {
        ahrsTape.update(data.AHRSPitch, data.AHRSRoll);
        slipSkid.update(data.AHRSSlipSkid)
        gMeter.update(data.AHRSGLoad);
      }

      if (data.AHRSTurnRate != 3276.7){
        turnCoordinator.update(dataAHRSTurnRate);
      }else{
        turnCoordinator.update(0);
      }

      if (presist.overheat === false && system_status.CPUTemp > system.cpu_temp_warn) {
        presist.overheat = true;
        $('#overheat_flag').css('display', 'block');
      } else if (presist.overheat === true && system_status.CPUTemp < system.cpu_temp_warn) {
        presist.overheat = false;
        $('#overheat_flag').css('display', 'none');
      }


      //console.log(data);

    } else {
      console.log("Invalid data");
    }

  };

  ahrsWS.onerror = function(message) {
    var name = message.target.url.substr(message.target.url.lastIndexOf('/') + 1);
    console.error("Websocket \"" + name + "\" had an error.");
    ahrsWS.close();
  };
}

// Get status at interval
var getRequest = true;
setInterval(function() {
  if (getRequest === true) {
    getRequest = false;
    $.getJSON(system.status_url, function(data) {
      system_status = data;
    }).always(function() {
      getRequest = true;
    });
  }
}, 1000);

var fmuWS;

function fmuInit() {
  console.log("Attempting to connect to " + system.fmu_url);
  try {
    fmuWS.close();
  } catch (error) {}
  fmuWS = new WebSocket(system.fmu_url);
  fmuWS.lastMessage = new Date().getTime();
  fmuWS.closed = true;
  fmuWS.onopen = function(e) {
    console.log("Connection established!");
    console.log(e);
    fmuWS.closed = false;
  };

  fmuWS.onclose = function(e) {
    fmuWS.closed = true;
    var name = e.target.url.substr(e.target.url.lastIndexOf('/') + 1);
    if (e.wasClean) {
      console.log("Websocket \"" + name + "\" closed cleanly.");
    } else {
      console.warn("Websocket \"" + name + "\" did not closed cleanly.");
    }
    console.log("Reconnecting after 0.5 seconds:");
    setTimeout(function() {
      fmuInit();
    }, 500);
  };

  fmuWS.checkActive = function() {
    if (system.checkWS === false || fmuWS.closed === true)
      return;
    // If it has been too long since a message, restart the connection
    if (new Date().getTime() - system.fmu.updateTimeout > fmuWS.lastMessage) {
      fmuWS.close();
    }
  };

  fmuWS.onmessage = function(message) {
    fmuWS.lastMessage = new Date().getTime();
    $('#message_flag').toggleClass('bright');
    if (message.isTrusted) {
      var data = JSON.parse(message.data);
      headingTape.updateFMU(data.hdg);
      speedTape.updateFMU(data.spd);
      altTape.updateFMU(data.alt);
    }
  };

  fmuWS.onerror = function(message) {
    var name = message.target.url.substr(message.target.url.lastIndexOf('/') + 1);
    console.error("Websocket \"" + name + "\" had an error.");
    fmuWS.close();
  };

}

// NOTICE: ALL INPUTS TO UPDATE FUNCTIONS ARE TO BE IN SI UNITS

function initButtons() {
  let buttons = $('.number_button');
  for(let i = 0; i < buttons.length; i++){
    let button = $(buttons[i]);
    $(buttons[i]).click((event) => {
      reportButton($(event.currentTarget).html());
    });
  }

  $('#settings_icon').mouseup(() => {
    // Make the menu visible
    $('#settings_menu').removeClass('hidden');
    $('#settings_overlay').removeClass('hidden');

    // Now that it is visible, set its scroll back to 0 so that
    // the default icons are visible first
    $('#settings_menu')[0].scrollLeft=0;
    $('#settings_menu')[0].scrollTop=0;
  });

  $(document).keyup(function(e) {
    if (e.keyCode === 27){
      $('#settings_menu').addClass('hidden');
      $('#settings_overlay').addClass('hidden');
      hideBaroInput();
    }
  });

  $('#settings_overlay').click(() => {
    $('#settings_menu').addClass('hidden');
    $('#settings_overlay').addClass('hidden');
    hideBaroInput();
  });

  // Set Pitch On-Click
  $('#align_ahrs').click(function() {
    var r = confirm("Center AHRS?");
    if (r == true) {
      post('cageAHRS');
    }
  });

  $('#calibrate_gyro').click(function() {
    var r = confirm("Calibrate GYRO?");
    if (r == true) {
      post('calibrateAHRS');
    }
  });

  var baro_input_value = ['2','9','9','2'];
  var pre_input = true;
  var index = 0;
  function updateBaroPressure(push = false){
    if(push && (baro_input_value[0] === '' || baro_input_value[1] == '' || baro_input_value[2] == '' || baro_input_value[3] == '')){
      system.sendNotification(`Please enter a valid altimeter setting`, 2000, color='red');
      return false;
    }
    let press_str = '' + baro_input_value[0] + baro_input_value[1] + '.' + baro_input_value[2] + baro_input_value[3];
    let val = parseFloat(press_str);
    if(push || index == 4){
      if(val < 26){
        system.sendNotification(`Altimeter setting too low`, 2000, color='red');
        val = 26;
        baro_input_value = ['2','6','0','0'];
        press_str = '' + baro_input_value[0] + baro_input_value[1] + '.' + baro_input_value[2] + baro_input_value[3];
        $('#altimeter_display').html(press_str);
        return false;
      }else if(val > 32){
        system.sendNotification(`Altimeter setting too high`, 2000, color='red');
        val = 32;
        baro_input_value = ['3','2','0','0'];
        press_str = '' + baro_input_value[0] + baro_input_value[1] + '.' + baro_input_value[2] + baro_input_value[3];
        $('#altimeter_display').html(press_str);
        return false;
      }
    }
    $('#altimeter_display').html(press_str);
    if(push){
      updateKollsmanSetting(val);
    }
    return true;
  }

  function updateKollsmanSetting(kollsman){
    altTape.kollsman = kollsman;
    system.sendNotification(`Updated altimeter to ${altTape.kollsman}inHg`, 4000);
    if(altTape.source == SOURCE.BARO) {
        $('#alt_annun_text').html('Baro Altitude <span>' + altTape.kollsman + 'inHg, ' + altTape.unitPrefix + ', ' + vspeedTape.unitPrefix + '</span>');
    }
  }

  function resetBaroInput(fromCurrent=false){
    if(fromCurrent){
      let tmp = altTape.kollsman;
      baro_input_value = [Math.floor(tmp/10 % 10), Math.floor(tmp % 10), Math.floor(tmp*10 % 10), Math.floor(tmp*100 % 10)];
    }else{
      baro_input_value = ['2','9','9','2'];
    }
    
    updateBaroPressure();
    pre_input = true;
    index = 0;
  }

  function showBaroInput(){
    $('#settings_popup').removeClass('hidden');
    resetBaroInput(fromCurrent=true)
  }

  function hideBaroInput(){
    $('#settings_popup').addClass('hidden');
    resetBaroInput(fromCurrent=true)
  }

  function addValue(val){
    if(pre_input){
      baro_input_value = ['','','',''];
      pre_input = false;
    }
    baro_input_value[index] = val;
    index += 1;
    if(index === 4){
      pre_input = true;
      index = 0;
    }
    // console.log(baro_input_value);
    updateBaroPressure();
  }

  function reportButton(button) {
    switch(button){
      case '1':
      case '2':
      case '3':
      case '4':
      case '5':
      case '6':
      case '7':
      case '8':
      case '9':
      case '0':
        addValue(button);
        break;
      case 'Clr':
          pre_redix = false;
          baro_input_value = ['','','',''];
          index = 0;
          updateBaroPressure();
          break;
      case 'Ent':
          if(updateBaroPressure(push=true)){
            hideBaroInput();
          }
          break;
    }
  }

  $('#update_baro').click(() => {
    showBaroInput();
  });

  $('#set_std_baro').click(() => {
    updateKollsmanSetting(29.92);
  });
  $('#force_update').click(() => {
    window.location.reload(true)
  });
  $('#simulate_tag').click(function() {
    if (system.simulate === true) {
      system.simulate = false;
      system.enable_ahrs_ws = true;
      initWS();
      $('#simulate_tag').css('display', 'none');
    }
  });

  // Set altitude button up
  $('#alt_annun').click(function() {
    var loc = 0;
    for (var i = 0; i < altTape.possibleSources.length; i++) {
      if (altTape.possibleSources[i] === altTape.source) {
        loc = i;
        break;
      }
    }
    loc++;
    if (loc >= altTape.possibleSources.length) {
      loc = 0;
    }
    altTape.source = altTape.possibleSources[loc];
    switch (altTape.source) {
      case SOURCE.BARO:
        $('#alt_annun_text').html('Baro Altitude <span>' + altTape.kollsman + 'inHg, ' + altTape.unitPrefix + ', ' + vspeedTape.unitPrefix + '</span>');
        break;
      case SOURCE.GPS:
        $('#alt_annun_text').html('GPS Altitude <span>' + altTape.unitPrefix + ', ' + vspeedTape.unitPrefix + '</span>');
        break;
      case SOURCE.INPUT:
        return;
        /*$('#alt_annun_text').html('User Altitude <span>' + altTape.unitPrefix + ', ' + vspeedTape.unitPrefix + '</span>');*/
        // TODO: Implement user defined altimeter setting
        //break;
    }
    vspeedTape.source = altTape.source;
  });

  system.checkWS = true;
  system.smooth = true;
  $('#sat_count').click(function() {
    var r = confirm((system.smooth ? "Disable" : "Enable") + " Smoothing?");
    if (r == false) {
      r = confirm((system.checkWS ? "Disable" : "Enable") + " Check WS?");
      if (r == true)
        system.checkWS = !system.checkWS;
    } else {
      system.smooth = !system.smooth;
      if (system.smooth) {
        html.css('--ease_time', '0.2s');
        html.css('--hdg_ease_time', '0.2s');
        html.css('--aux_ease_time', '0.2s');
      } else {
        html.css('--ease_time', '0s');
        html.css('--hdg_ease_time', '0s');
        html.css('--aux_ease_time', '0s');
      }
    }

  });
}

var currentHeading = 0;
var updateHeading = 0;

function generateTapes() {

  $("div.volitile").remove();

  // Define height and width characteristics
  speedTape.width = $('#speed_tape').outerWidth();
  speedTape.height = $('#speed_tape').outerHeight();
  altTape.width = $('#alt_tape').outerWidth();
  altTape.height = $('#alt_tape').outerHeight();
  vspeedTape.width = $('#alt_vspeed').outerWidth();
  vspeedTape.height = $('#alt_vspeed').outerHeight();
  ahrsTape.width = $('#pitch_indicator').outerWidth();
  ahrsTape.height = $('#pitch_indicator').outerHeight();
  headingTape.height = $('#heading_tape').outerHeight();
  headingTape.width = $('#heading_tape').outerWidth();
  gMeter.height = $('#speed_tape').outerHeight();
  gMeter.width = $('#speed_tape').outerWidth();

  // ------------------------------------------------------------------------ //
  // Init conversions                                                         //
  // ------------------------------------------------------------------------ //

  // Speed tape
  switch (speedTape.units) {
    case UNITS.KTS:
      speedTape.unitPrefix = 'KTS';
      speedTape.conv = conv.mps2kts;
      break;
    case UNITS.MPH:
      speedTape.unitPrefix = 'MPH';
      speedTape.conv = conv.mps2mph;
      break;
    case UNITS.MPS:
      speedTape.unitPrefix = 'M/S';
      speedTape.conv = 1;
      break;
    case UNITS.FPS:
      speedTape.unitPrefix = 'Ft/S';
      speedTape.conv = conv.mps2fps;
      break;
    case UNITS.FPM:
      speedTape.unitPrefix = 'Ft/M';
      speedTape.conv = conv.mps2fpm;
      break;
    case UNITS.KPH:
      speedTape.unitPrefix = 'KPH';
      speedTape.conv = conv.mps2kph;
      break;
    case UNITS.MPM:
      speedTape.unitPrefix = 'M/Min';
      speedTape.conv = conv.mps2mpm;
      break;
    default:
      console.error("Cannot use speed unit: " + speedTape.units);
  }
  speedTape.lowerSpeed = Math.round(speedTape.conv * speedTape.lowerSpeed * conv.mph2mps);
  speedTape.upperSpeed = Math.round(speedTape.conv * speedTape.upperSpeed * conv.mph2mps);
  for (var i = 0; i < speedTape.speeds.length; i++) {
    speedTape.speeds[i].start = Math.round(speedTape.speeds[i].start * conv.mph2mps * speedTape.conv);
    speedTape.speeds[i].end = Math.round(speedTape.speeds[i].end * conv.mph2mps * speedTape.conv);
  }
  $('#speed_annun_text').html('GPS GS ' + speedTape.unitPrefix);

  // Alt tape
  switch (altTape.units) {
    case UNITS.FEET:
      altTape.unitPrefix = 'Feet';
      altTape.conv = conv.m2ft;
      break;
    case UNITS.METERS:
      altTape.unitPrefix = 'Meters';
      altTape.conv = 1;
      break;
    case UNITS.MILES:
      altTape.unitPrefix = 'Mils';
      altTape.conv = conv.m2mi;
      break;
    case UNITS.NAUTICLE_MILES:
      altTape.unitPrefix = 'N Miles';
      altTape.conv = conv.m2nmi;
      break;
    default:
      console.error("Cannot use altitude unit: " + altTape.units);
  }


  // VSpeed tape
  switch (vspeedTape.units) {
    case UNITS.KTS:
      vspeedTape.unitPrefix = 'KTS';
      vspeedTape.conv = conv.mps2kts;
      break;
    case UNITS.MPH:
      vspeedTape.unitPrefix = 'MPH';
      vspeedTape.conv = conv.mps2mph;
      break;
    case UNITS.MPS:
      vspeedTape.unitPrefix = 'M/S';
      vspeedTape.conv = 1;
      break;
    case UNITS.FPS:
      vspeedTape.unitPrefix = 'FPS';
      vspeedTape.conv = conv.mps2fps;
      break;
    case UNITS.FPM:
      vspeedTape.unitPrefix = 'FPM';
      vspeedTape.conv = conv.mps2fpm;
      break;
    case UNITS.KPH:
      vspeedTape.unitPrefix = 'KPH';
      vspeedTape.conv = conv.mps2kph;
      break;
    case UNITS.MPM:
      vspeedTape.unitPrefix = 'M/Min';
      vspeedTape.conv = conv.mps2mpm;
      break;
    default:
      console.error("Cannot use vspeed unit: " + vspeedTape.units);
  }

  $('#alt_annun_text span').html(altTape.kollsman + 'inHg, ' + altTape.unitPrefix + ', ' + vspeedTape.unitPrefix);

  // ------------------------------------------------------------------------ //
  // Generate speed tape                                                      //
  // ------------------------------------------------------------------------ //

  // Speed tape paramaters dependant on css size.
  var space = 10;
  var tick = 5;
  var number_height = 100;
  // Calculate pixels per number for the speed tape
  speedTape.pixels_per_number = number_height / space;
  speedTape.fmu_speed = NaN;
  speedTape.updateFMU = function(speed) {
    speedTape.fmu_speed = speed;
  };
  // Add all speeds as text
  for (i = speedTape.upperSpeed; i >= speedTape.lowerSpeed; i -= space) {
    var val = $('#speed_tape_text').append('<div class="speed_tape_index volitile">' + i + '</div>');
  }
  // Calculate speed tape total height
  speedTape.total_height = number_height * (speedTape.upperSpeed - speedTape.lowerSpeed) / space;
  // Calculate tick offset based on text size
  speedTape.offset = parseInt($('#speed_tape_text').css('margin-top').replace('px', '')) + parseInt($('#speed_tape_text').css('line-height').replace('px', '')) / 2 + 4;

  // Loop through each speed and add color bars
  for (i = 0; i < speedTape.speeds.length; i++) {
    // Grab the current color bar from config
    var bar = speedTape.speeds[i];
    // Generate the color bar
    var color_bar = $('<div/>', {
      class: 'speed_tape_color_bar volitile',
    });
    // Change some settings based on where the color bar is located
    if (bar.start === speedTape.lowerSpeed) {
      color_bar.css('height', (bar.end - bar.start) * speedTape.pixels_per_number + speedTape.offset);
      color_bar.css('top', (speedTape.upperSpeed - bar.end) * speedTape.pixels_per_number + speedTape.offset);
    } else if (bar.end === speedTape.upperSpeed) {
      color_bar.css('height', (bar.end - bar.start) * speedTape.pixels_per_number + speedTape.offset);
      color_bar.css('top', (speedTape.upperSpeed - bar.end) * speedTape.pixels_per_number);
    } else {
      color_bar.css('height', (bar.end - bar.start) * speedTape.pixels_per_number);
      color_bar.css('top', (speedTape.upperSpeed - bar.end) * speedTape.pixels_per_number + speedTape.offset);
    }
    // Set the color bar colors and parameters
    switch (bar.color) {
      case COLORS.GREEN:
        color_bar.css('background-color', '#0F0');
        break;
      case COLORS.YELLOW:
        color_bar.css('background-color', '#FF0');
        break;
      case COLORS.RED:
        color_bar.css('background-color', '#F00');
        break;
      case COLORS.WHITE:
        color_bar.css('background-color', '#FFF');
        color_bar.css('width', '10px');
        color_bar.css('z-index', '-1');
        break;
    }
    // Append the color bar to the tick holder
    $('#speed_tape_tick_holder').append(color_bar);
  }
  // Generte the ticks for the speed tape
  var tick_offset = 4;
  for (i = speedTape.upperSpeed; i >= speedTape.lowerSpeed; i -= tick) {
    // Generate a tick
    var tick_div = $('<div/>', {
      class: 'h_tick volitile',
    });
    // Set the tick's location
    tick_div.css('top', i * speedTape.pixels_per_number + speedTape.offset - tick_offset);
    // If the current tick has a number, make it wider
    if (i % space === 0) {
      tick_div.css('width', '150%');
    }
    // Append the tick to the tick holder
    $('#speed_tape_tick_holder').append(tick_div);
    // Update the total height
    speedTape.total_height = Math.max(speedTape.total_height, i * speedTape.pixels_per_number + speedTape.offset - tick_offset);
  }
  $('#speed_tape_scroll').append('<div id="speed_fmu" class="fmu_h volitile"></div>');

  // Define the speed tape update method
  speedTape.update = function(s, override) {
    // Unit conversion
    s *= speedTape.conv;
    // Position the scroll div
    $('#speed_tape_scroll').css('top', s * speedTape.pixels_per_number - speedTape.total_height + system.ahrs.height / 2 - 2);
    // Round speed for text display
    s = Math.round(s);
    // Pad and display speed in the speed box
    if (s < 10) {
      $('#speed_counter_text').html('00' + s);
    } else if (s < 100) {
      $('#speed_counter_text').html('0' + s);
    } else {
      $('#speed_counter_text').html(s);
    }
    if (!isNaN(speedTape.fmu_speed) && speedTape.fmu_speed != null) {
      $('#speed_fmu').css('display', 'block');
      $('#speed_fmu').css('bottom', (-(speedTape.upperSpeed - speedTape.fmu_speed) * speedTape.pixels_per_number - 30) + 'px');
    } else {
      $('#speed_fmu').css('display', 'none');
    }

    checkIn(AHRS_TYPE.SPEED, override);
  };

  // ------------------------------------------------------------------------ //
  // Generate altitude tape                                                   //
  // ------------------------------------------------------------------------ //

  // Define some constants
  tick_offset = 4;
  altTape.pixels_per_number = 2.2;
  altTape.total_height = 0;
  // Calculate tick offset based on text size
  altTape.offset = speedTape.offset;
  // Add FMU Line
  altTape.fmu_alt = NaN;
  altTape.updateFMU = function(alt) {
    altTape.fmu_alt = alt;
  };
  $('#alt_tape_scroll').append('<div id="alt_fmu" class="fmu_h volitile"></div>');
  // Loop through altitudes (0 - 20,000 ft)
  for (i = 2000; i >= 0; i -= 10) {
    // Generate a tick
    var tick_div = $('<div/>', {
      class: 'h_tick alt_tick volitile',
    });
    // Set the tick location
    tick_div.css('top', i * altTape.pixels_per_number + altTape.offset - tick_offset);
    // If the tick is an increment of 50, make it wider
    if (i % 50 === 0) {
      tick_div.css('width', '175%');
    }
    // Add the tick to the tick holder
    $('#alt_tape_tick_holder').append(tick_div);
    // Update the total height
    altTape.total_height = Math.max(altTape.total_height, i * altTape.pixels_per_number + altTape.offset - tick_offset);
  }
  // Add the text for each altitude
  $('#alt_tape_text').append('<div class="alt_tape_index volitile"></div>');
  for (i = 1950; i > 0; i -= 50) {
    $('#alt_tape_text').append('<div class="alt_tape_index volitile">' + i + '0</div>');
  }
  $('#alt_tape_text').append('<div class="alt_tape_index volitile">0</div>');

  // Define the altitude tape update method
  altTape.update = function(alt, override) {
    // Alt in meters at this time. Need to apply Kollsman setting:
    alt = -44307.6 * (1 - 0.523779 * Math.pow(altTape.kollsman,0.190284)) + alt;
    // Unit conversion
    alt *= altTape.conv;
    // Position the scroll div
    $('#alt_tape_scroll').css('top', alt / 10 * altTape.pixels_per_number - altTape.total_height + system.ahrs.height / 2 - 2);
    // Round the altitude for text display
    alt = Math.round(alt);
    // Pad and display the altitude in the altitude box
    if(alt <= -1000){
      $('#alt_counter_text').html(Math.abs(alt));
    } else if(alt <= -100){
      $('#alt_counter_text').html('-' + Math.abs(alt));
    } else if(alt <= -10){
      $('#alt_counter_text').html('-0' + Math.abs(alt));
    } else if(alt < 0){
      $('#alt_counter_text').html('-00' + Math.abs(alt));
    } else if (alt < 10) {
      $('#alt_counter_text').html('000' + alt);
    } else if (alt < 100) {
      $('#alt_counter_text').html('00' + alt);
    } else if (alt < 1000) {
      $('#alt_counter_text').html('0' + alt);
    } else if (alt < 10000){
      $('#alt_counter_text').html(alt);
    } else {
      $('#alt_counter_text').html(Math.floor(alt/100) + 'X');
    }
    if (!isNaN(altTape.fmu_alt) && altTape.fmu_alt != null) {
      $('#alt_fmu').css('bottom', (-(10000 - altTape.fmu_alt) * altTape.pixels_per_number / 10 - 30) + 'px');
      $('#alt_fmu').css('display', 'block');
    } else {
      $('#alt_fmu').css('display', 'none');
    }

    checkIn(AHRS_TYPE.ALT, override);
  };

  // Define possible sources
  altTape.possibleSources = [SOURCE.BARO, SOURCE.GPS];
  // Designate the default source
  altTape.source = SOURCE.BARO;
  vspeedTape.source = altTape.source;

  // ------------------------------------------------------------------------ //
  // Generate vertical speed tape                                             //
  // ------------------------------------------------------------------------ //

  // Define some constants
  vspeedTape.total_offset = 7;
  vspeedTape.offset = $('#alt_vspeed').outerHeight() / 2 + vspeedTape.total_offset;
  vspeedTape.pixels_per_number = 22;
  tick_offset = 4;
  // VSpeed tick generation
  for (var i = 15; i >= -15; i -= 1) {
    // Generate a tick
    var tick_div = $('<div/>', {
      class: 'h_tick vspeed_tick volitile',
    });
    // Set the tick location
    tick_div.css('top', i * vspeedTape.pixels_per_number + vspeedTape.offset - tick_offset);
    // If the tick is a 5th tick, make it larger
    if (i % 5 === 0) {
      tick_div.css('width', '20px');
      tick_div.css('height', '4px');
    }
    // Append the tick to the tick holder
    $('#vspeed_tape_tick_holder').append(tick_div);
    // Update the total height
    altTape.total_height = Math.max(altTape.total_height, i * vspeedTape.pixels_per_number + vspeedTape.offset - tick_offset);
  }

  // Set the text position based on the size
  var text_pos = $('#alt_vspeed').outerHeight() / 2 - vspeedTape.pixels_per_number * 16 + 8 + vspeedTape.total_offset;
  // Loop through each number and add it
  for (var i = 15; i >= 0; i -= 5) {
    var val = $('<div/>', {
      class: 'vspeed_tape_index volitile',
      html: i
    });
    val.css('top', text_pos);
    $('#vspeed_tape_text').append(val);
    text_pos += vspeedTape.pixels_per_number * 5;
  }
  for (var i = 5; i <= 15; i += 5) {
    var val = $('<div/>', {
      class: 'vspeed_tape_index volitile',
      html: i,
    });
    val.css('top', text_pos);
    $('#vspeed_tape_text').append(val);
    text_pos += vspeedTape.pixels_per_number * 5;
  }

  // Define the altitude tape update method
  vspeedTape.update = function(vspeed, override) {
    // Unit conversion
    vspeed *= vspeedTape.conv;
    vspeed /= 10000;
    // Position the vspeed pointer
    $('#vspeed_pointer').css('top', vspeedTape.height / 2 - vspeed * vspeedTape.pixels_per_number - $('#vspeed_pointer').outerHeight() / 2 - 14 + vspeedTape.total_offset);
    // Set the vspeed tail position and height
    if (vspeed > 0) {
      $('#vspeed_trail').css('top', vspeedTape.height / 2 - vspeed * vspeedTape.pixels_per_number - 3 + vspeedTape.total_offset);
      $('#vspeed_trail').css('height', vspeed * vspeedTape.pixels_per_number);
    } else {
      $('#vspeed_trail').css('height', -vspeed * vspeedTape.pixels_per_number);
      $('#vspeed_trail').css('top', vspeedTape.height / 2 - 3 + vspeedTape.total_offset);
    }
    checkIn(AHRS_TYPE.VSPEED, override);
  }

  // ------------------------------------------------------------------------ //
  // Generate AHRS                                                            //
  // ------------------------------------------------------------------------ //

  // Define some constants
  ahrsTape.pixels_per_tick = ahrsTape.height / (ahrsTape.degrees_in_view / 2.5);
  ahrsTape.total_height = 0;
  ahrsTape.ticks = [];
  var pos_index = 0;
  // Loop through initial chevrons
  for (var c = 0; c < ahrsTape.chevrons; c++) {
    // Generate chevron from svg
    var chevron = $('<img/>', {
      class: 'ahrs_chevron volitile',
      src: 'images/chevron.svg'
    });
    // Set chevron position
    chevron.css('top', -c * ahrsTape.chevron_space - 150);
    // Add the chevron to the tick array
    ahrsTape.ticks.push({
      angle: i,
      val: chevron,
      type: 'chevron'
    });
    // Append the chevron to the scroll div
    $('#pitch_tape_scroll').append(chevron);
  }
  // Loop through the ticks based on the limits
  for (var i = ahrsTape.limits[0]; i >= ahrsTape.limits[1]; i -= 2.5) {
    // Generate a tick
    var tick_div = $('<div/>', {
      class: 'h_tick ahrs_tick volitile'
    });
    // Position the tick
    tick_div.css('top', pos_index * ahrsTape.pixels_per_tick);
    // Skip the tick at the 0 degree location
    if (i !== 0) {
      // If the degree is a factor of 5, make it med size
      if (i % 5 === 0) {
        tick_div.css('width', '80px');
        tick_div.css('height', '4px');
      }
      // If the degree is a factor of 10, make it large
      if (i % 10 === 0) {
        tick_div.css('width', '120px');
        tick_div.css('height', '4px');
        // Add text
        for (var j = 0; j < 2; j++) {
          // Generate text
          var text = $('<div/>', {
            class: 'ahrs_text volitile noselect'
          });
          // Set the html as the degree in question
          text.html((i < 0 ? -i : i));
          // Position the text
          text.css('top', pos_index * ahrsTape.pixels_per_tick - 8);
          // Adjust the position
          if (j === 0)
            text.css('left', '0px');
          else
            text.css('right', '0px');
          // Add the text to the tick array
          ahrsTape.ticks.push({
            angle: i,
            val: text,
            type: 'text'
          });
          // Append the text to the scroll div
          $('#pitch_tape_scroll').append(text);
        }
      }
      // Add the tick to the tick array
      ahrsTape.ticks.push({
        angle: i,
        val: tick_div,
        type: 'tick'
      });
      // Append the tick to the scroll div
      $('#pitch_tape_scroll').append(tick_div);
    }
    // Update the total height
    ahrsTape.total_height = Math.max(ahrsTape.total_height, pos_index * ahrsTape.pixels_per_tick);
    // Adjust the position of the scroll div
    $('#pitch_tape_scroll').css('top', -ahrsTape.total_height / 2 + ahrsTape.height / 2 - 2);
    // Increment the total position
    pos_index++;
  }
  // Loop through ending chevrons
  for (var c = 0; c < ahrsTape.chevrons; c++) {
    // Generate chevron from svg
    var chevron = $('<img/>', {
      class: 'ahrs_chevron volitile',
      src: 'images/chevron_flip.svg'
    });
    // Set chevron position
    chevron.css('top', ahrsTape.total_height + c * ahrsTape.chevron_space + 50);
    // Add the chevron to the tick array
    ahrsTape.ticks.push({
      angle: i,
      val: chevron,
      type: 'chevron'
    });
    // Append the chevron to the scroll div
    $('#pitch_tape_scroll').append(chevron);
  }

  // Define the AHRS update method
  ahrsTape.update = function(pitch, roll, override) {
    // Set the pitch amount to the global CSS variable
    html.css('--pitch_amount', pitch * (ahrsTape.pixels_per_tick * 4) / 10 - 3);
    // Loop through each stored tick
    for (var i = 0; i < ahrsTape.ticks.length; i++) {
      var val = ahrsTape.ticks[i];
      var dist = Math.abs(pitch - val.angle);
      // If the current tick is a third from the center, set it to full white
      if (dist <= ahrsTape.degrees_in_view / 3) {
        if (val.type === 'text') {
          val.val.css('color', 'white');
        } else if (val.type === 'tick') {
          val.val.css('background-color', 'white');
        }
      } else if (dist <= ahrsTape.degrees_in_view / 2) {
        // Otherwise if it is within a half, set it to some transparancy value
        // Generate a transparancy level
        var level = Math.abs((dist - ahrsTape.degrees_in_view / 2) / (ahrsTape.degrees_in_view / 2 - ahrsTape.degrees_in_view / 3));
        // Set the color to that value
        var color = 'rgba(255,255,255,' + level + ')';
        if (val.type === 'text') {
          val.val.css('color', color);
        } else if (val.type === 'tick') {
          val.val.css('background-color', color);
        }
      } else {
        // Otherwise make it fully transparent
        if (val.type === 'text') {
          val.val.css('color', 'transparent');
        } else if (val.type === 'tick') {
          val.val.css('background-color', 'transparent');
        }
      }
    }
    // Set the flight angle degree CSS value
    html.css('--flight_angle', -roll + 'deg');
    // Set the pitch text
    // if (Math.abs(pitch) < 0.5) {
    //   $('#pitch_readout span').html(pad(Math.round(Math.abs(pitch)), 2) + '°-');
    // } else {
    //   $('#pitch_readout span').html(pad(Math.round(Math.abs(pitch)), 2) + '°' + (pitch < 0 ? 'D' : 'U'));
    // }
    // // Set the roll text
    // if (Math.abs(roll) < 0.5) {
    //   $('#roll_readout span').html(pad(Math.round(Math.abs(roll)), 2) + '°-');
    // } else {
    //   $('#roll_readout span').html(pad(Math.round(Math.abs(roll)), 2) + '°' + (roll < 0 ? 'L' : 'R'));
    // }
    checkIn(AHRS_TYPE.AHRS, override);
  };

  // ------------------------------------------------------------------------ //
  // Generate SLIP SKID                                                       //
  // ------------------------------------------------------------------------ //

  slipSkid.update = function(yaw, override) {
    html.css('--slip_skid', (yaw * slipSkid.multiplier) + 'px')
  }

  // ------------------------------------------------------------------------ //
  // Generate Turn Coordinator                                                //
  // ------------------------------------------------------------------------ //

  var turnCoordinatorArrow = $('#tcarrow');
  var turnCoordinatorBar= $('#tcbar');
  if(turnCoordinator.display === false){
    turnCoordinator.update = function(rate, override){}
  }else{
    $('#turn_coordinator_holder').addClass('show');
    // $('#settings_icon').removeClass('shifted');
    $('#slip_skid_holder').removeClass('shifted');
    turnCoordinator.update = function(rate, override) {
      if(rate > 3.25){
        rate = 3.25;
      }else if(rate < -3.25){
        rate = -3.25;
      }
      if(Math.abs(rate) < 0.2){
        html.css('--turn_rate', `0px`);
        turnCoordinatorArrow.addClass('hide');
      }else{
        if(rate < 0){
          turnCoordinatorBar.addClass('right');
          turnCoordinatorArrow.addClass('right');
          turnCoordinatorBar.removeClass('left');
          turnCoordinatorArrow.removeClass('left');
        }else{
          turnCoordinatorBar.addClass('left');
          turnCoordinatorArrow.addClass('left');
          turnCoordinatorBar.removeClass('right');
          turnCoordinatorArrow.removeClass('right');
        }
        let px = (Math.abs(rate) * 100 / 3);
        turnCoordinatorArrow.removeClass('hide');
        html.css('--turn_rate', `${px}px`);
      }
    }
  }


  // ------------------------------------------------------------------------ //
  // Generate Heading Tape                                                    //
  // ------------------------------------------------------------------------ //

  // Define some constants
  headingTape.safetyOffset = 30;

  if (html.css('--hdg_ease_time').trim() === '0s') {
    headingTape.removeAnimation = true;
  } else {
    headingTape.removeAnimation = false;
  }

  // Add FMU Line
  headingTape.fmu_hdg = NaN;
  headingTape.forceRedraw = false;
  headingTape.updateFMU = function(hdg) {
    if (hdg == null || isNaN(hdg)) {
      headingTape.fmu_hdg = null;
    } else {
      headingTape.fmu_hdg = constrainDegree(hdg);
    }
    headingTape.forceRedraw = true;
  }

  headingTape.span = headingTape.width / headingTape.ticks_per_number / 2;

  // Define the heading tape update method
  headingTape.update = function(heading, override) {
    heading = constrainDegree(Math.round(heading));
    headingTape.heading = heading;
    // Update the heading text to display the new heading
    $('#heading_text span').html(pad(heading, 3) + '°');
    // Check that the tape does not need to be recalculated for the new heading
    if (headingTape.forceRedraw === true || getDegreeDistance(updateHeading, heading) >= headingTape.safetyOffset / 2) {
      // Current tape needs to be redrawn
      headingTape.redrawHeadingTape(currentHeading, heading);
      // Update this heading as the last heading used for a redraw
      updateHeading = heading;
    }
    // Calculate direction
    var direction = !(constrainDegree(updateHeading - heading) < 180);
    // Calculate movement offset
    var value = -(getDegreeDistance(headingTape.left_heading, heading) * headingTape.pixels_per_tick - headingTape.pixels_per_tick * headingTape.padding);
    // Queue the animation and position change for a slightly later time. Allows
    // the CSS to catch up
    setTimeout(function() {
      if (!headingTape.removeAnimation)
        $('#heading_tape_scroll').css('transition', 'all var(--hdg_ease_time) ease 0s');
      //$('#heading_tape_scroll').addClass('annimate');
      $('#heading_tape_scroll').css('left', value);
    }, 10);
    // Update the current heading
    currentHeading = heading;
    if (!isNaN(headingTape.fmu_hdg) && headingTape.fmu_hdg != null && getDegreeDistance(headingTape.heading, headingTape.fmu_hdg, false) > headingTape.span / 2 + 1) {
      $('#hdg_fmu_arrow').css('display', 'block');
      if (constrainDegree(headingTape.heading - headingTape.fmu_hdg) < 180 === false) {
        $('#hdg_fmu_arrow').css('left', 'unset');
        $('#hdg_fmu_arrow').css('right', '5px');
        $('#hdg_fmu_arrow').css('transform', 'rotate(180deg)');
      } else {
        $('#hdg_fmu_arrow').css('left', '5px');
        $('#hdg_fmu_arrow').css('right', 'unset');
        $('#hdg_fmu_arrow').css('transform', 'rotate(0deg)');
      }
    } else {
      $('#hdg_fmu_arrow').css('display', 'none');
    }
    checkIn(AHRS_TYPE.HDG, override);
  }

  // Define the heading tape redraw method
  headingTape.redrawHeadingTape = function(currentHeading, heading) {
    // Disable annimation
    headingTape.forceRedraw = false;
    //$('#heading_tape_scroll').removeClass('annimate');
    if (!headingTape.removeAnimation)
      $('#heading_tape_scroll').css('transition', 'all 0s ease 0s');
    // Clear current system
    $('#heading_tape_scroll').html('');
    // Calculate pixels per tick using dimenstions and range
    headingTape.pixels_per_tick = (system.ahrs.width - 2 * $('#speed_tape').outerWidth()) / headingTape.range;
    // Calculate direction
    var direction = !(constrainDegree(updateHeading - heading) < 180);
    // Calculate side padding to reduce redraws
    headingTape.padding = headingTape.safetyOffset / 2;
    // Set the left and right headings
    if (direction) {
      headingTape.left_heading = constrainDegree(currentHeading - headingTape.range / 2 - headingTape.padding);
      headingTape.right_heading = constrainDegree(heading + headingTape.range / 2 + headingTape.padding);
    } else {
      headingTape.right_heading = constrainDegree(currentHeading + headingTape.range / 2 + headingTape.padding);
      headingTape.left_heading = constrainDegree(heading - headingTape.range / 2 - headingTape.padding);
    }
    // Initialize some variables before the loop
    var pointer = headingTape.left_heading;
    var index = 0;
    var tapeWidth = 0;
    // Loop through the headings
    while (pointer != headingTape.right_heading) {
      // Generate a tick
      var tick_div = $('<div/>', {
        class: 'v_tick volitile',
      });
      // Set the tick's location
      tick_div.css('left', index * headingTape.pixels_per_tick);
      // If the current degree falls on a number, add a number
      if (pointer % headingTape.ticks_per_number === 0) {
        // Increase the tick height for the number
        tick_div.css('height', '30px');
        // Generate a number
        var text = $('<div/>', {
          class: 'heading_text volitile',
        });
        // Set the number text to the current degree
        text.html(pointer);
        // Text offset - based on text size
        var text_offset = 5;
        // Set the offset based on the number of characters in the number
        if (pointer >= 100) {
          text_offset *= 3;
        } else if (pointer >= 10) {
          text_offset *= 2;
        }
        // Set the text position
        text.css('left', index * headingTape.pixels_per_tick - text_offset);
        // Append the text to the scroll div
        $('#heading_tape_scroll').append(text);
      } else if (pointer % (headingTape.ticks_per_number / 2) === 0) {
        // Make the half ticks slightly larger than a regular tick
        tick_div.css('height', '20px');
      }
      // If the current heading is a cardinal heading, add extra text
      if (pointer % 90 === 0) {
        // Generate cardinal coord text
        var text = $('<div/>', {
          class: 'heading_text card_text volitile'
        });
        // Associate headings with leters
        if (pointer === 360) {
          text.html('N');
        } else if (pointer === 90) {
          text.html('E');
        } else if (pointer === 180) {
          text.html('S');
        } else if (pointer === 270) {
          text.html('W');
        }
        // Set position
        text.css('left', index * headingTape.pixels_per_tick - 13);
        // Append the text to the scroll div
        $('#heading_tape_scroll').append(text);
      }
      // Append the tick to the scroll div
      $('#heading_tape_scroll').append(tick_div);
      // Update the pointer
      pointer = constrainDegree(pointer + 1);
      // Increment the index
      index++;
      // Update the total tape width
      tapeWidth += headingTape.pixels_per_tick;
    }
    // Add FMU Marker
    if (!isNaN(headingTape.fmu_hdg) && headingTape.fmu_hdg != null) {
      var range = getDegreeDistance(headingTape.left_heading, headingTape.right_heading);
      if (getDegreeDistance(headingTape.left_heading, headingTape.fmu_hdg) < range && constrainDegree(headingTape.left_heading - headingTape.fmu_hdg) < 180 === false) {
        $('#heading_tape_scroll').append('<div id="hdg_fmu" class="fmu_v"   style="left:' + (getDegreeDistance(headingTape.left_heading, headingTape.fmu_hdg) * headingTape.pixels_per_tick) + 'px;"></div>');
      }
    } else {
      $('#hdg_fmu_arrow').css('display', 'none');
    }
    // Set the scroll div to the tape width. Used for 0px alignment
    $('#heading_tape_scroll').css('width', tapeWidth);
    // Set the padding offset in pixels
    headingTape.padding_offset = headingTape.padding * headingTape.pixels_per_tick;
    // Restore the tape to the last location before the redraw
    var value = -(getDegreeDistance(headingTape.left_heading, currentHeading) * headingTape.pixels_per_tick - headingTape.pixels_per_tick * headingTape.padding);
    // Update the location
    $('#heading_tape_scroll').css('left', value);
    $('#heading_tape_scroll').css('bottom', '0px');
  };
  // Redraw the heading tape initially
  headingTape.redrawHeadingTape(0, 0);

  // ------------------------------------------------------------------------ //
  // Generate G METERS                                                        //
  // ------------------------------------------------------------------------ //

  if (gMeter.display) {
    // Add text to G Meter
    var pos = [
      [19, 4, '1'],
      [7, 30, '2'],
      [31, 30, '0']
    ];
    for (var i = 0; i < pos.length; i++) {
      var text = $('<div/>', {
        class: 'g_text volitile noselect'
      });
      // Position text
      text.css('top', pos[i][0]);
      text.css('left', pos[i][1]);
      text.html(pos[i][2]);
      // Append the chevron to the scroll div
      $('#g_meter').append(text);
    }

    // Define the G Meter update method
    gMeter.update = function(gees, override) {
      var rot = 132 * (gees - 1);
      $('#g_pointer').css('transform', 'rotate(' + rot + 'deg)');
      checkIn(AHRS_TYPE.GMETER, override);
    };
  } else {
    $('#g_meter').css('display', 'none');
    gMeter.update = function(gees) {};
  }

  // ------------------------------------------------------------------------ //
  // Generate Sat Count                                                       //
  // ------------------------------------------------------------------------ //

  if (satCount.display) {
    // Define the Sat Count update method
    satCount.update = function(count) {
      $('#sat_count_text').html(count);
    };
  } else {
    $('#sat_count').css('display', 'none');
    satCount.update = function(count) {};
  }

  // Initialize the tapes
  ahrsTape.update(0, 0, true);
  headingTape.update(0, true);
  speedTape.update(0, true);
  altTape.update(0, true);
  vspeedTape.update(0, true);

  // Add invalid flags.
  setInvalid(AHRS_TYPE.ALL, true);

}


// Check in method used in all update methods
var lastCheckInTime = [];

function checkIn(type, override) {
  if (override === true)
    return;
  while (lastCheckInTime[type] === undefined) {
    lastCheckInTime.push([]);
  }
  lastCheckInTime[type] = Date.now();
}

// Checks if all the fields are valid
var invalidList = [false, false, false, false, false, false];

function checkValid() {
  var now = Date.now();
  for (var i = 0; i < lastCheckInTime.length; i++) {
    if (now - lastCheckInTime[i] > system.ahrs.updateTimeout && invalidList[i] === false) {
      // Set invalid
      switch (i) {
        case AHRS_TYPE.SPEED:
          speedTape.update(0, true);
          satCount.update('-');
          break;
        case AHRS_TYPE.ALT:
          altTape.update(0, true);
          break;
        case AHRS_TYPE.VSPEED:
          vspeedTape.update(0, true);
          break;
        case AHRS_TYPE.HDG:
          headingTape.update(0, true);
          break;
        case AHRS_TYPE.AHRS:
        case AHRS_TYPE.GMETER:
          ahrsTape.update(0, 0, true);
          gMeter.update(1, true);
          slipSkid.update(0, true);
          turnCoordinator.update(0, true);
          break;
      }
      setInvalid(i, true);
    } else if (now - lastCheckInTime[i] < system.ahrs.updateTimeout && invalidList[i] === true) {
      // Set valid
      setInvalid(i, false);
    }
  }
}

// Sets a field with the invalid flag
function setInvalid(type, value) {
  var name;
  switch (type) {
    case AHRS_TYPE.SPEED:
      name = ['speed_tape'];
      break;
    case AHRS_TYPE.ALT:
    case AHRS_TYPE.VSPEED:
      name = ['alt_tape'];
      break;
    case AHRS_TYPE.HDG:
      name = ['heading_tape'];
      break;
    case AHRS_TYPE.AHRS:
      name = ['ahrs_container', /*'pitch_readout',*/ 'roll_readout', 'slip_skid_holder'];
      break;
    case AHRS_TYPE.ALL:
      name = ['ahrs_container', /*'pitch_readout',*/ 'roll_readout', 'heading_tape', 'alt_tape', 'speed_tape', 'slip_skid_holder'];
      break;
  }
  if (name === undefined)
    return;
  for (var i = 0; i < name.length; i++) {
    if (value) {
      var val = $('#' + name[i] + ' .invalid_holder:first').addClass('invalid')
    } else {
      var val = $('#' + name[i] + ' .invalid_holder:first').removeClass('invalid')
    }
  }
  if (type !== AHRS_TYPE.ALL) {
    invalidList[type] = value;
  } else {
    for (var i = 0; i < invalidList.length; i++) {
      invalidList[i] = value;
    }
  }
}


function refreshIfInvalidTimeout() {
  for (var i = 0; i < invalidList.length; i++) {
    if (invalidList[i] === false)
      return;
  }
  try {
    ahrsWS.close();
    fmuWS.close();
  } catch (error) {};
}


// Helpers
function constrainDegree(deg) {
  if (deg <= 0) {
    while (deg <= 0) {
      deg += 360;
    }
  } else {
    while (deg > 360) {
      deg -= 360;
    }
  }
  return deg;
}

function pad(num, size) {
  var s = num + "";
  while (s.length < size) s = "0" + s;
  return s;
}

function getDegreeDistance(deg1, deg2, use360 = true) {
  var out = Math.abs(Math.min(constrainDegree(deg1 - deg2), constrainDegree(deg2 - deg1)));
  if (use360 === false && out == 360) {
    return 0;
  }
  return out;
}

function requestFullScreen(element) {
  // Supports most browsers and their versions.
  var requestMethod = element.requestFullScreen || element.webkitRequestFullScreen || element.mozRequestFullScreen || element.msRequestFullScreen;

  if (requestMethod) { // Native full screen.
    requestMethod.call(element);
  } else if (typeof window.ActiveXObject !== "undefined") { // Older IE.
    var wscript = new ActiveXObject("WScript.Shell");
    if (wscript !== null) {
      wscript.SendKeys("{F11}");
    }
  }
}

var post = function(url) {
  var http = new XMLHttpRequest();
  var text_url = '';
  switch(url){
    case "cageAHRS":
      text_url = "Cage AHRS";
      break;
    case "calibrateAHRS":
      text_url = "Cage AHRS";
      break;
    default:
      text_url = 'Unknown';
      break;
  }
  var url = system.push_url + '/' + url;
  var params = "";
  http.open("POST", url, true);

  //Send the proper header information along with the request
  http.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
  //http.setRequestHeader("Content-length", params.length);
  //http.setRequestHeader("Connection", "close");

  http.onreadystatechange = function() { //Call a function when the state changes.
    if (http.readyState == 4 && http.status == 200) {
      console.log("Done: " + http.responseText);
      system.sendNotification(`Sent the '${text_url}' command to Stratux`, 4000);
    }else if(http.readyState == 4 && http.status == 0){
      system.sendNotification(`Failed to send the '${text_url}' command to Stratux`, 6000, color='red');
    }else{
      console.log(http);
    }
  }
  http.send(params);
}

window.addEventListener("deviceorientation", handleOrientation, true);

function handleOrientation(event) {
  var absolute = event.absolute;
  var alpha = event.alpha;
  var beta = event.beta;
  var gamma = event.gamma;

  // console.log('Absolute: ' + absolute)
  // console.log('Alpha: ' + alpha)
  // console.log('Beta: ' + beta)
  // console.log('Gamma: ' + gamma)

  // Do stuff with the new orientation data
}


Math.toDegrees = function(rad) {
  return rad * 57.2958;
}

function setCookie(name,value,seconds) {
  var expires = "";
  if (seconds) {
      var date = new Date();
      date.setTime(date.getTime() + (seconds*1000));
      expires = "; expires=" + date.toUTCString();
  }
  document.cookie = name + "=" + (value || "")  + expires + "; path=/";
}
function getCookie(name) {
  var nameEQ = name + "=";
  var ca = document.cookie.split(';');
  for(var i=0;i < ca.length;i++) {
      var c = ca[i];
      while (c.charAt(0)==' ') c = c.substring(1,c.length);
      if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length,c.length);
  }
  return null;
}
function eraseCookie(name) {   
  document.cookie = name+'=; Max-Age=-99999999;';  
}

function doRefresh(){
  setCookie('bypass_warning', 'true', 5);
  location.reload();
}

const times = [];
let fps;

function refreshLoop() {
  window.requestAnimationFrame(() => {
    const now = performance.now();
    while (times.length > 0 && times[0] <= now - 1000) {
      times.shift();
    }
    times.push(now);
    fps = times.length;
    refreshLoop();
  });
}

// refreshLoop();