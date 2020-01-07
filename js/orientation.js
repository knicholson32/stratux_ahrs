/* eslint-disable no-unused-vars */
/* global system, generateTapes, orientationInit */
// ============================================== //
// orientation.js :: Stratux AHRS
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

// Initialize orientation system
function orientationInit() {
  system.prevent_orientation_change_process = false;

  // Bind orientationChange to the window resize event
  $( window ).resize( orientationChange );
  // Set some system variables
  system.ios = {};

  system.ios.correction = false;
  // Run orientationChange to initialize the orientation
  orientationChange();
  // Run orientationChange 1/10th of a second after display orientation changes
  $( window ).on( "orientationchange", function( _event ) {
    setTimeout( orientationChange, 100 );
  } );

  // Set the fullscreen flag
  system.fullscreen = window.navigator.standalone;

  // Get the user agent and determine the type of device
  var ua = navigator.userAgent;
  if ( ua.indexOf( "iPad" ) !== -1 ) {
    system.device = "iPad";
  } else if ( ua.indexOf( "iPhone" ) !== -1 || ua.indexOf( "iPod" ) !== -1 ) {
    system.device = "iPhone";
  } else if ( ua.indexOf( "Android" ) !== -1 ) {
    system.device = "Android";
  }

  system.is_ios = system.device === "iPad" || system.device === "iPhone";

  // Check if the system started in portrait mode and is a web-app
  if (
    system.fullscreen &&
    system.orinetation === "portrait" &&
    system.device === "iPhone"
  ) {
    system.ios.correction = true;
    system.ios.original_height = $( window ).height();
  }

  // Prompt the user to use fullscreen if they can
  if ( system.fullscreen === false ) {
    alert( "For best results, save to homescreen and run as web-app." );
  }
}

// Check if the orientation change was valid and yielded a proper looking display
function confirmOrientationChange() {
  // Get the current scale
  var currentScale = $( window ).height() / $( window ).width();
  // Check the scale vs. the target scale
  if ( Math.abs( system.scale - currentScale ) > 0.1 ) {
    console.error( "Redraw" );
    console.log( "-> CurrentScale: " + currentScale );
    console.log( "-> SystemScale: " + system.scale );
    orientationChange();
  } else {
    // Zoom the container based on the orientation
    if ( system.orientation === "portrait" ) {
      $( "#ahrs_container" ).css( "zoom", system.scale * 100 + "%" );
    }
  }
}

// Process an orientation change
function orientationChange() {
  if ( system.prevent_orientation_change_process === true ) { return; }

  // Reset the system screen width and height based on the current values
  system.screen_width = $( window ).width();
  system.screen_height = $( window ).height();

  let option = system.screen_width > system.screen_height;
  let ar = 1;
  if ( system.force_diff_orientation ) { option = !option; }

  // Detect if in landscape or portrait based on the screen height and width
  if ( option ) {
    // Set to landscape
    system.orinetation = "landscape";
    ar = system.screen_width / system.screen_height;

    // Reset ahrs_container css values to defaults
    $( "#ahrs_container" ).css( "height", system.screen_height );
    $( "#ahrs_container" ).css( "width", "100%" );
    $( "#ahrs_container" ).css( "zoom", "100%" );
    $( "#ahrs_container" ).css( "left", "unset" );
    $( "#ahrs_container" ).css( "top", "unset" );
    $( "#settings_menu" ).css( "height", "" );
    $( "#settings_menu" ).css( "width", "" );
    if ( system.force_diff_orientation ) {
      $( "#ahrs_container" ).css( "transform", "rotate(-90deg)" );
      $( "#settings_menu" ).css( "zoom", "unset" );
      console.log( "orientation mode 3" );
    } else {
      $( "#ahrs_container" ).css( "transform", "unset" );
      $( "#settings_menu" ).css( "zoom", "unset" );
      console.log( "orientation mode 4" );
    }

    if ( system.overlay_active === true ) {
      $( "#overlay" ).css( "height", system.screen_height );
      $( "#overlay" ).css( "width", "100%" );
      $( "#overlay" ).css( "zoom", "100%" );
      $( "#overlay" ).css( "left", "unset" );
      $( "#overlay" ).css( "top", "unset" );
      $( "#overlay" ).css( "transform", "unset" );
    }
    $( "#settings_menu" ).removeClass( "settings_menu_rotated" );
    $( ".settings_button" ).removeClass( "settings_button_rotated" );
    $( "#settings_popup" ).removeClass( "settings_popup_rotated" );
    $( ".settings_last" ).removeClass( "settings_last_rotated" );
    $( ".settings_spacer" ).removeClass( "settings_spacer_rotated" );

    // Set the system scale value ratio
    system.scale = system.screen_height / system.screen_width;
  } else {
    // Set to portrait
    system.orinetation = "portrait";
    ar = system.screen_height / system.screen_width;

    // Detect if the user is using an ios device and correct for status bar
    // intrusion
    if ( system.ios.correction === true ) {
      system.screen_height = system.ios.original_height;
      $( "#ahrs_container" ).css( "left", "31px" );
    }

    // Set the system scale value ratio
    system.scale = system.screen_height / system.screen_width;

    // Update the width to fit the portrait mode
    const width = system.screen_height / system.scale;
    const height = system.screen_width / system.scale;
    $( "#ahrs_container" ).css( "width", width );
    $( "#ahrs_container" ).css( "height", height );

    // Set the scale to fit the portrait mode
    $( "#ahrs_container" ).css( "zoom", system.scale * 100 + "%" );
    $( "#ahrs_container" ).css( "top", "unset" );
    $( "#settings_menu" ).css( "height", "" );
    $( "#settings_menu" ).css( "width", "" );

    if ( system.force_diff_orientation ) {
      $( "#ahrs_container" ).css( "transform", "rotate(90deg)" );
      $( "#settings_menu" ).css( "zoom", system.scale * 100 + "%" );
      $( "#ahrs_container" ).css( "width", system.scale * 100 + "%" );
      const scroll_prevent_width = $( "#scroll_prevent" ).width();
      const container_width =
        ( scroll_prevent_width * system.scale ) / system.scale;
      $( "#ahrs_container" ).css( "top", ( container_width - height ) / 2 + "px" );
      $( "#settings_menu" ).css( "height", scroll_prevent_width - 20 + "px" );
      console.log( "orientation mode 1" );
    } else {
      $( "#ahrs_container" ).css( "transform", "unset" );
      $( "#settings_menu" ).css( "zoom", "unset" );
      console.log( "orientation mode 2" );
    }

    if ( system.overlay_active === true ) {
      $( "#overlay" ).css( "width", width + 20 );
      $( "#overlay" ).css( "height", height );

      // Set the scale to fit the portrait mode
      $( "#overlay" ).css( "zoom", system.scale * 100 + 1 + "%" );
      $( "#overlay" ).css( "transform", "rotate(90deg)" );
      $( "#overlay" ).css( "left", -( width / 2 - height / 2 ) );
      $( "#overlay" ).css( "top", width / 2 - height / 2 - 10 );
    }
    $( "#settings_menu" ).addClass( "settings_menu_rotated" );
    $( ".settings_button" ).addClass( "settings_button_rotated" );
    $( "#settings_popup" ).addClass( "settings_popup_rotated" );
    $( ".settings_last" ).addClass( "settings_last_rotated" );
    $( ".settings_spacer" ).addClass( "settings_spacer_rotated" );
  }

  system.prevent_orientation_change_process = true;
  $( "meta[name=viewport]" ).attr(
    "content",
    "viewport-fit=cover, user-scalable=no, maximum-scale=0.1"
  );
  $( "meta[name=viewport]" ).attr(
    "content",
    "viewport-fit=cover, user-scalable=no"
  );
  system.prevent_orientation_change_process = false;

  // Calculate scale factors for the ahrs virtual horizon bar
  const top = -20.08655 + 39.72259 * ar + 21.09178 * ar * ar;
  const zoom =
    0.133225025 * ar * ar * ar * ar -
    1.226095815 * ar * ar * ar +
    4.400482563 * ar * ar -
    7.607275965 * ar +
    5.879861878;
  $( "#vhor_bar" ).css( "top", `${top}px` );
  $( "#vhor_bar" ).css( "zoom", zoom );

  // Record total sizes
  system.ahrs.width = $( "#ahrs_container" ).outerWidth();
  system.ahrs.height = $( "#ahrs_container" ).outerHeight();

  // Configure specific div sizes based on the current window size
  $( "#heading_tape" ).css(
    "width",
    system.ahrs.width -
      $( "#speed_tape" ).outerWidth() -
      $( "#alt_tape " ).outerWidth() -
      1
  );
  $( "#heading_tape" ).css( "left", $( "#speed_tape" ).outerWidth() );
  $( "#readouts" ).css(
    "width",
    system.ahrs.width -
      $( "#speed_tape" ).outerWidth() -
      $( "#alt_tape " ).outerWidth() -
      1
  );
  $( "#readouts" ).css( "left", $( "#speed_tape" ).outerWidth() );

  // $('#heading_tape').css('top', $('#speed_tape').outerHeight() - $('#heading_tape').outerHeight());
  $( "#speed_counter" ).css(
    "margin-right",
    $( "#speed_tape_tick_holder" ).outerWidth() - 2
  );
  $( "#g_meter" ).css( "bottom", $( "#heading_tape" ).outerHeight() + 10 );
  $( "#g_meter" ).css( "right", $( "#alt_tape " ).outerWidth() + 10 );
  $( "#overheat_flag" ).css( "display", "none" );

  // $('#slip_skid_holder').css()

  // Generate the tapes
  generateTapes();

  // Check the orientation change after 1/2 second
  // setTimeout(confirmOrientationChange, 500);
}
