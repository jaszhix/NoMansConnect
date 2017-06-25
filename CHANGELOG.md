# 0.13.0

  * Added an offline mode.
  * Added Linux support.
  * Images are now cached in AppData/Roaming/NoMansConnect, and only download once.
  * Added a compact view for the remote location list.
  * Added more accurate clustering of dense hub areas on the 3D map using SolarSystemIndex.
  * Added a Travel to Current Location 3D map menu option.
  * Fixed the slugishness of the remote location list.
  * Fixed a regression causing fields to not be pre-filled when editing existing location names and descriptions.

# 0.12.1

  * PC players can now teleport to manually registered locations!
    * You will spawn in space inside your ship at these locations. They are marked in blue.
    * Thanks to monkeyman192 for helping me figure it out.

# 0.12.0

  * Added support for PS4 players.
    * This works by manually registering coordinates in hex format.
    * While voxel coordinates are created from a conversion, these locations cannot be teleported to.
    * Older versions of NMC cannot distinguish PS4 locations from PC locations, and teleporting to them will crash your game. It is recommended to *upgrade immediately*.
    * Improved the accuracy of the hex address conversion for PC locations.
  * The settings are now stored in a JSON file named settings.json in AppData/Roaming/NoMansConnect. This makes it easier to change faulty settings, and to report bugs. The app will migrate the old settings format to the new format.
  * The 3D map now only renders systems and lists the planets inside them on the HUD.
  * Added helpful information to the options menu.

# 0.11.0

  * Fixed the map scaling becoming unbalanced.
  * Fixed the auto screenshot feature capturing all monitors. It now only captures the primary monitor.
  * Performance improvements.
  * Minor style fixes.

# 0.10.0

  * Added a 3D map option. Enable from the map options menu in the top left corner of the map.
    * Includes three locations to travel to: Galactic Hub, Pilgrim Star, and Pathfinder Hub. You can also travel to any location by clicking a star, or selecting a location in the UI.
    * Two draw distance options are available. Default is medium. A rotating core is rendered in the center of the galaxy on high draw distance mode.
  * Changed the behavior of the protected username dialog so it doesn't boot users out of the app.

# 0.9.0

  * Improved CPU and RAM usage.
  * Fixed storing of other people's bases (for importation into your own game) not working.
  * Fixed cached remote location metadata not updating when they're edited.
  * Fixed the search functionality breaking on large remote location lists.
  * Reorganized the layout to optimize the best use of available space.
  * Added an option to toggle between 1-2 columns for remote locations.
  * Added an option to show locations' galactic addresses in the stored location list.
  * Added several new sorting options for locations. You can now drill down locations by:
    * Galaxy
    * Screenshots
    * Names
    * Descriptions
    * Distance to center
    * Least modded
    * Bases
  * Improved location loading.
  * Added an option to change how often the app checks for new locations.
  * Fixed the location name and description fields not showing their current values when updating them.

# 0.8.0

  * Added a new base backup and restore feature!
    * This allows you to save your current base to the app's storage, and restore it and all of its building objects at another location, or in another game mode save.
    * In base locations, a new menu item is added allowing you to store other people's bases.
    * Only building objects from the vanilla game will be saved. This prevents the game from crashing for other players.
    * This feature was made possible thanks to monkeyman192, who wrote the algorithm that makes base object position matrices compatible in new locations.
  * Added username overriding.
  * Added a Copy Address to Clipboard option.
  * Added ability to sort stored locations chronologically.
  * Added galaxies 135-257 ct. NMS Wiki.
  * Fixed the scaling of enlarged screenshots.
  * Fixed a bug causing the window to become invisible if DWM is disabled.
  * Fixed a time stamp bug with locations.
  * Fixed a bug that can cause the install directory to not be set by the user's preference.
  * Fixed a bug causing the "Remove From Storage" option on selected locations appearing when the location is not stored.
  * Fixed a bug that can cause the stored locations list to clear when switching modes from the menu and then teleporting.
  * Fixed search queries getting reset prematurely.

# 0.7.1

  * Added markdown support to descriptions.
  * Fixed a regression with manual screenshot uploads not working.
  * Fixed the app window not being able to be repositioned correctly, and added window position state saving.
  * Fixed a bug causing the remote location cache to reset when resetting a search query.
  * Added galaxies 120-134 ct. NMS Wiki.

# 0.7.0

  * Added multi-threading: Moved some of the renderer work to worker threads for a performance boost.
  * Fixed a bug preventing Windows 7 users from using the app.
  * Fixed the name and description fields not resetting when a location is updated.
  * Fixed teleporting to stored locations not working for users with save data in non-default locations.
  * Widened the stored locations column.
  * Added ability to select locations directly from the shared location list.
  * Added galaxies 80-119 ct. NMS Wiki.

# 0.6.1

  * Fixed a bug related to filtering stored locations.
  * Fixed a regression with the extra columns not rendering correctly.
  * Fixed a bug causing duplicate locations to be uploaded for some players.
  * The app now checks your NMS settings for whether or not fullscreen is enabled, and if so it will disable auto capturing on init.

# 0.6.0

  * Added local caching for shared locations
  * Added username protection. This will associate your username with your computer to prevent impersonation. Please read the information before enabling this option.
  * Added a cheat menu unlockable by exploring
  * Current location indicator on the map now shows up for base locations
  * Moved the location buttons to their own dropdown menu to conserve space
  * Added base and space station indicator icons to locations
  * Fixed a bug that could prevent bases from being recognized
  * Fixed the screenshot capture setting not being stored correctly
  * Fixed the "Explored by" row not appearing when a location name is set
  * Fixed the scroll box not resetting when selecting a new selected location
  * Fixed non-pak files being listed with mods
  * Style overhaul

# 0.5.2

  * Fixed save data not being found for GOG users
  * Fixed a bug preventing users from getting past the NMS install path selection prompt on a fresh install

# 0.5.1

  * Fixed a critical bug preventing the app from correctly identifying the newest save slot
  * Fixed logging, the log file can be found at AppData/Roaming/NoMansConnect/NMC.log
  * Added names for galaxies 66-72 courtesy of NMS Wiki and parsec on Nexus Mods

# 0.5.0

  * The app will now ask for your NMS install and save file directories on init if they can't be found
  * Implemented native parsing of NMS save files
  * Fixed the galaxy list not updating as locations change
  * Fixed the current location being inaccurate, and set the current location's galaxy as the initial galaxy seen on the map
  * Optimizations

# 0.4.2

  * Fixed location order becoming inaccurate when switching sort options

# 0.4.1

  * Fixed the screenshot in the selected location changing when switching sort options
  * Optimized how images are loaded
  * Increased the image quality of automatic screenshots

# 0.4.0

  * Added an enlarged map layout
  * Added an option to show coordinate paths
  * Added ability to toggle types of coordinates by clicking their icon on the legend
  * Added missing galaxy names 63-65
  * Added error logging
  * Fixed a bug causing the selected location name and screenshot states to not update
  * Fixed stored location screenshot, name, and description fields not syncing with its related remote location on update
  * Fixed a regression causing the remote location list to not update
  * Fixed the selected location box clipping on lower resolutions
  * Experimental fix in place for users not getting past the loading screen
  * Reformatted the Voxel ID to include the RealityIndex and migrated old data

# 0.3.1

  * Fixed a bug preventing locations from uploading

# 0.3.0

  * Added ability to disable automatic screenshots in the main menu, and upload screenshots
  * Each galaxy now has its own map
  * Improved NMS install detection for the mod listing feature
  * Made it easier to reset search queries
  * Remote locations are now synced if they are missing from the locally stored locations cache
  * Screenshots are now only taken automatically if the game is running
  * Style fixes

# 0.2.0

  * Switched to more efficient method of watching save file changes
  * Added naming of locations
  * Added transparency overlay. Trigger with the Insert key.
  * Added screenshots
  * Added favorites
  * Added naming
  * Style changes
  * Fixed the stored locations list not scrolling
  * Fixed teleports stat getting stuck at 1
  * Installed mods are now listed with uploaded locations
  * Expanded the remote locations list to multiple columns for higher resolutions.

# 0.1.0

  * Updated fonts on text boxes
  * Added search
  * Added tracking of teleport stats
  * Added sorting by recent and popular (number of teleports)

# 0.0.3

  * Fixed incorrect coordinates being stored. Old data will be migrated to the correct formatting
  * Fixed teleporting to shared locations not working
  * Added tracking of galaxies

# 0.0.2

  * Fixed scroll pagination
  * Added an upgrade notifier

# 0.0.1

  * Initial version.