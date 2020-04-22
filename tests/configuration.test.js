const config = require( "../js/configuration" );
console.log( "Config:", config );

test( "confirm system configuration usable for production", () => {
  const system = config.system;
  expect( system.overlay_active ).toBe( true );
  expect( system.enable_ahrs_ws ).toBe( true );
  expect( system.enable_fmu ).toBe( false );
  expect( system.allow_reload ).toBe( true );
  expect( system.simulate ).toBe( false );
  expect( system.websocket_url ).toBe( "ws://raspberrypi.local/situation" );
  expect( system.status_url ).toBe( "http://raspberrypi.local/getStatus" );
  expect( system.push_url ).toBe( "http://raspberrypi.local" );
} );
