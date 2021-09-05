# No Man's Connect

This is a location manager that syncs your current game's coordinates, uploads them to a server, and indexes a list of everyone's coordinates using the app. It also provides a map that plots your coordinates relative to the center of the galaxy.

![screenshot](https://github.com/jaszhix/NoMansConnect/raw/master/screenshot.png)

## Features

* Works without an NMS installation.
* Works offline.
* PC players can teleport to locations, including manually registered ones.
* Syncs coordinates while the game is running after each save
* Drill down locations by:
  * Galaxy
  * Screenshots
  * Names
  * Descriptions
  * Distance to center
  * Least modded
  * Bases
* Upload coordinates and have them tagged with your Steam ID
* Add descriptions to locations for other's to view
* Map all locations on a galaxy map
* Optionally view all locations on a 3D map
* Ability to switch game modes
* Write name and descriptions
* Favorite locations
* User profiles with stats and discovery timelines
* Send and receive friend requests, and track their progress on the map
* Detect mods and list them with locations
* Use the Insert key to trigger in-game overlay in borderless mode
* Upload screenshots, and optionally have them taken automatically upon save
* Unlockable cheat menu
* Backup and restore your base and move it to new locations
* Download other people's bases and import them into your game
* Automatic save file backups
* Global stats tracking
* Support for Windows 8.1, 10, and most Linux distributions

## Attribution

NMC uses Matthew Humphrey's [nmssavetool](https://github.com/matthew-humphrey/nmssavetool) for signing the save data, and the cheat menu functionality was ported to JS from it as well.

[monkeyman192](https://github.com/monkeyman192) provided the formula for transferring base data to different locations.

[bdew](https://github.com/bdew) provided code for decompressing the save file format in NMS Frontiers.

Thanks to both of them, the supporters that have helped out with server maintenance, and bug reporters! A list of contributors can be found in the app's About dialog.

## Support

See the [wiki](https://github.com/jaszhix/NoMansConnect/wiki) for frequently asked questions.

## Patreon

If you like using NMC and want to be credited in the About dialog, or get exclusive access to early beta builds, please consider [becoming a Patron](https://www.patreon.com/jaszhix) of the project. The main goal of using Patreon is to help cover server costs. NMC currently uses a VPS plan on Linode with backups, which costs $50 USD per month, and is the cheapest plan that can handle the app's traffic during peak hours. Thanks for your consideration!
