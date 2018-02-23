function orientationInit(){
  orientationChange();
  $( window ).on( "orientationchange", function( event ) {
    setTimeout(orientationChange,100);
  });
}



function orientationChange(){

  system.screen_width = window.innerWidth;
  system.screen_height = $(window).height() - 0;


  if(system.screen_width > system.screen_height){
    system.orinetation = "landscape";
    $('#ahrs_container').css('height', system.screen_height);
    $('#ahrs_container').css('width','100%');
    $('#ahrs_container').css('zoom','100%');
    system.scale = system.screen_height/system.screen_width;
  }else{
    system.orinetation = "portrait";
    system.scale = system.screen_height/system.screen_width;
    $('#ahrs_container').css('width',system.screen_height / system.scale);
    $('#ahrs_container').css('height',system.screen_width / system.scale);
    $('#ahrs_container').css('zoom',(system.scale*100)+'%');
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

}
