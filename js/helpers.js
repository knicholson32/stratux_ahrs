/* eslint-disable no-unused-vars */
// ============================================== //
// helpers.js :: Stratux AHRS
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

function constrainDegree( deg ) {
  if ( deg <= 0 ) {
    while ( deg <= 0 ) {
      deg += 360;
    }
  } else {
    while ( deg > 360 ) {
      deg -= 360;
    }
  }
  return deg;
}

function getDegreeDistance( deg1, deg2, use360 = true ) {
  var out = Math.abs(
    Math.min( constrainDegree( deg1 - deg2 ), constrainDegree( deg2 - deg1 ) )
  );
  if ( use360 === false && out === 360 ) {
    return 0;
  }
  return out;
}

function pad( num, size ) {
  var s = num + "";
  while ( s.length < size ) { s = "0" + s; }
  return s;
}

Math.toDegrees = function( rad ) {
  return rad * 57.2958;
};

function setCookie( name, value, seconds ) {
  var expires = "";
  if ( seconds ) {
    var date = new Date();
    date.setTime( date.getTime() + seconds * 1000 );
    expires = "; expires=" + date.toUTCString();
  }
  document.cookie = name + "=" + ( value || "" ) + expires + "; path=/";
}

function getCookie( name ) {
  var nameEQ = name + "=";
  var ca = document.cookie.split( ";" );
  for ( var i = 0; i < ca.length; i++ ) {
    var c = ca[ i ];
    while ( c.charAt( 0 ) === " " ) { c = c.substring( 1, c.length ); }
    if ( c.indexOf( nameEQ ) === 0 ) { return c.substring( nameEQ.length, c.length ); }
  }
  return null;
}

var getUrlParameter = function getUrlParameter( sParam ) {
  var sPageURL = window.location.search.substring( 1 );
  var sURLVariables = sPageURL.split( "&" );
  var sParameterName;
  var i;

  for ( i = 0; i < sURLVariables.length; i++ ) {
    sParameterName = sURLVariables[ i ].split( "=" );

    if ( sParameterName[ 0 ] === sParam ) {
      return sParameterName[ 1 ] === undefined ?
        true :
        decodeURIComponent( sParameterName[ 1 ] );
    }
  }
};
