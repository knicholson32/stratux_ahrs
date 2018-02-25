function orientationInit(){

  $( window ).resize(orientationChange);

  system.ios = {};
  system.ios.correction = false;

  orientationChange();
  $( window ).on( "orientationchange", function( event ) {
    setTimeout(orientationChange,100);
  });

  system.fullscreen = window.navigator.standalone;
  var ua = navigator.userAgent;
  if(ua.indexOf('iPad')!==-1){
    system.device = 'iPad';
  }else if(ua.indexOf('iPhone')!==-1 || ua.indexOf('iPod')!==-1){
    system.device = 'iPhone';
  }else if(ua.indexOf('Android')!==-1){
    system.device = 'Android';
  }


  // Check if the system started in portrait mode and is a webapp
  if(system.fullscreen && system.orinetation === "portrait" && system.device === 'iPhone'){
    system.ios.correction = true;
    system.ios.orgnial_height = $(window).height();
  }

  // Prompt the user to use fullscreen if they can
  if(system.fullscreen === false){
    alert("For best results, save to homescreen and run as webapp.");
  }


}



function confirmOrientationChange(){
  var currentScale = $(window).height()/$(window).width();
  if(Math.abs(system.scale - currentScale) > 0.1){
    console.error("Redraw");
    console.log("-> CurrentScale: " + currentScale);
    console.log("-> SystemScale: " + system.scale);
    orientationChange();
  }else{
    if(system.orientation == 'portrait'){
      $('#ahrs_container').css('zoom',(system.scale*100)+'%');
    }
  }

}


function orientationChange(){

  system.screen_width = $(window).width();
  system.screen_height = $(window).height();


  if(system.screen_width > system.screen_height){
    system.orinetation = "landscape";
    $('#ahrs_container').css('height', system.screen_height);
    $('#ahrs_container').css('width','100%');
    $('#ahrs_container').css('zoom','100%');
    $('#ahrs_container').css('left','unset');
    system.scale = system.screen_height/system.screen_width;
  }else{
    system.orinetation = "portrait";
    if(system.ios.correction === true){
      system.screen_height = system.ios.orgnial_height;
      $('#ahrs_container').css('left','31px');
    }
    system.scale = system.screen_height/system.screen_width;
    $('#ahrs_container').css('width',system.screen_height / system.scale);
    $('#ahrs_container').css('height',system.screen_width / system.scale);
    $('#ahrs_container').css('zoom',(system.scale*100+1)+'%');
  }

  // Record total sizes
  ahrs.width = $( '#ahrs_container' ).outerWidth();
  ahrs.height = $( '#ahrs_container' ).outerHeight();

  // Configure specific div sizes based on the current window size
  $('#heading_tape').css('width', ahrs.width - $( '#speed_tape' ).outerWidth() - $( '#alt_tape ').outerWidth() - 1);
  $('#heading_tape').css('left', $( '#speed_tape' ).outerWidth());
  $('#readouts').css('width', ahrs.width - $( '#speed_tape' ).outerWidth() - $( '#alt_tape ').outerWidth() - 1);
  $('#readouts').css('left', $( '#speed_tape' ).outerWidth());
  $('#heading_tape').css('top', $( '#speed_tape' ).outerHeight() - $( '#heading_tape' ).outerHeight());
  $('#speed_counter').css('margin-right',$( '#speed_tape_tick_holder' ).outerWidth() - 2);
  $('#g_meter').css('bottom', $( '#heading_tape' ).outerHeight() + 10);
  $('#g_meter').css('right' ,$( '#alt_tape ').outerWidth() + 10);
  $('#overheat_flag').css('display', 'none');


  generateTapes();

  setTimeout(confirmOrientationChange, 500);

}
