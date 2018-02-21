# stratux_ahrs
AHRS Display for the Raspberry pi powered Stratux software.

Extension to the [Stratux](https://github.com/cyoung/stratux) project that allows an iPhone to be used to display AHRS information.

### Installation:
"stratux_ahrs" is simply a webpage that needs to be copied to the Raspberry pi's /var/www folder.
- Download this repo
- Use SFTP [GUI example here](https://barnesian.com/how-to-transfer-files-to-the-raspberry-pi-using-sftp/) to transfer the resulting folder to the /var/www/ folder on the pi.
- Visit [192.168.10.1/stratux_ahrs](192.168.10.1/stratux_ahrs) when connected to Stratux to connect.
- [Save an icon to the home screen](http://www.knowyourmobile.com/apple/iphone-4/15554/user-guide-how-save-websites-desktop-icons-your-iphone-4s)

# Disclamer
This display uses data directly from stratux. As a result, I'll quote [cyoung](https://github.com/cyoung/stratux/wiki/All-About-AHRS) (the creater of stratux):

"This AHRS will not save your life.

I was partially motivated to develop this software due to losing my vacuum pump-driven attitude indicator system (including standby pump within an hour each time!) no less than three times over the course of 2700 hours of flying. The last time, at night over the Egyptian Saharan desert, I at least had a clear sky above (there was oftentimes not a single light in the desert below). My autopilot was also driven by the attitude indicator, so I had to both keep upright and hand-fly through the pitch black for hours.

Fortunately, this last time I also had a MidCon LifeSaver electrical backup. Even surrounded by inky blackness above and below, with no horizon visible outside, between the stars above and the MidCon certified backup, I was able to continue without any loss of situational awareness. However, the thought crossed my mind many times as I flew on through the dark for hours that the MidCon was my last and only backup. If I had to do an instrument approach, I would be partial panel. I would really have loved to have had at least one potential additional and fully independent backup system, if only to provide me some comfort and an independent check for my partial panel flying.

It goes without saying that a self-built attitude indicator system that can potentially be thrown willy nilly up on the glareshield, in a severely uncontrolled environment, and running software that has never been certified by any independent agent should not be relied upon in any but the most dire of circumstances. Even then, you would be very wise to fly partial panel on certified instruments and use any such system as this only as a cross-reference.

If this software ever serves just to provide some comfort to a pilot in an event such as I experienced, it will have served its purpose. Its purpose is not to save your life."

I would like to further add that this display is not perfect, and is under development. Use of this display in life threatening situations is seriously cautioned.
