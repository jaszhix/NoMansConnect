# nmssavetool
## A command line tool to decrypt, encrypt, and modify No Man's Sky game save files

Author: [Matthew Humphrey](https://github.com/matthew-humphrey)

This is a simple tool to allow decoding, encoding, and convenient editing operations
on saves for the No Man's Sky game.

Download the [precompiled binary](https://github.com/matthew-humphrey/nmssavetool/releases/latest)

---
## Usage

Run "nmssavetool help" for help.

```
> nmssavetool help

nmssavetool

  addinv       Adds an inventory item.

  backup       Back up the latest game save for the specified game slot.

  backupall    Back up all game saves.

  decrypt      Decrypt the latest game save slot and write it to a formatted JSON file.

  delinv       Deletes an inventory item.

  encrypt      Encrypt a previously decrypted save-game JSON file and replace the latest game save.

  info         Display information about a game save including player stats and inventory contents.

  maxslots     Maximize the number of inventory slots.

  moveinv      Moves an inventory item from one slot to another. Anything in the destination slot is 
               destroyed.

  recharge     Recharge shield, energy and fuel levels in the exosuit, multitool, ship, freighter or vehicle 
               inventories.

  refill       Maximize amounts of product and substance items in the exosuit, multitool, ship, vehicle, or 
               freighter inventories.

  refurbish    Recharge, repair, and refill items in the exosuit, multitool, ship, and vehicle inventories.

  relocate     Set the player position within the NMS universe using various coordinate systems.

  repair       Repair damaged technology in the exosuit, multitool, ship, vehicle, or freighter inventories.

  restore      Restore the latest game save from the specified back-up file.

  seed         Change the RNG seed value that is used to determine the appearance of the ship, multitool, or 
               freighter.

  setinv       Adds an inventory item to a specific position.

  swapinv      Swaps the contents of two inventory slots.

  units        Change the amount of units (in-game money).

  help         Display more information on a specific command.

  version      Display version information.
```

---
### addinv

Adds any inventory item (product, substance, or technology) to an available inventory slot
in the specified inventory group. Items are added starting at the bottom right, and then
moving left and up as necessary until an available slot is found.

```
>nmssavetool.exe help addinv

nmssavetool

  -i, --item               Required. Specifies the inventory item to add. You may specify a portion of the name
                           and the program will try and match with one of the valid items. Surround the name in
                           quotes, and prefix the name with a '^' to match against item IDs instead of item
                           descriptions. Choose which inventory to add the item to with the add-item-to option.

  -c, --inventory-group    Required. (Default: exosuit_general) Specifies the inventory group to which the item
                           will be added: exosuit_general, exosuit_cargo, ship_general, freighter_general, or
                           vehicle

  -b, --backup-dir         If provided, will write the selected game-save to a decrypted JSON file in the
                           specified directory.

  --full-backup            If provided (along with -b/--backup-dir), will archive the full game-save directory
                           in addition to the decrypted JSON game-save file.

  -g, --game-slot          Required. Use saves for which game slot (1-5)

  --save-dir               Path to game save folder (optional - determined automatically if not provided)

  -v, --verbose            Displays additional information during execution.

  --help                   Display this help screen.

  --version                Display version information.
```
#### Examples:
```
  > nmssavetool.exe addinv -g 1 -c ship_general -i "^HYPERFUEL"
```
  Adds a warp cell to any available slot in the Ship general inventory, for game save slot 1.

```
  > nmssavetool.exe addinv -g 2 -c exosuit_cargo -i dagger
```
  Adds a Vy'keen Dagger to any available slot in the Exosuit cargo inventory, for game save slot 2.

---
### backup

Backs up the current game save for the specified game mode to a file in the provided directory.
The directory must already exist. Normally, the program writes out the game save as a decrypted,
formatted JSON file, that can be edited, or provided as input to the encrypt or restore commands.

```
>nmssavetool.exe help backup

nmssavetool

  -b, --backup-dir    Required. If provided, will write the selected game-save to a decrypted JSON file in the
                      specified directory.

  -g, --game-slot     Required. Use saves for which game slot (1-5)

  --save-dir          Path to game save folder (optional - determined automatically if not provided)

  -v, --verbose       Displays additional information during execution.

  --help              Display this help screen.

  --version           Display version information.
```
#### Examples:
```
  > nmssavetool backup -g 1 -b C:\nms_backups
```
  Backs up the latest slot 1 game save to `C:\nms_backups`. The back-up consists of the decrypted, JSON, 
  save file.

```
  > nmssavetool backup -g 3 -b C:\nms_backups --full-backup
```

  Backs up the latest slot 3 game save to `C:\nms_backups`. The back-up consists of the decrypted, JSON, 
  save file plus a zip file containing the full game-save folder.

---
### backupall

Backups up all game save slots to a zip file with the specified name or in the specified directory. 
If an existing directory name is supplied for the -b/--backup-to option, the zip file will be given
a descriptive name containing the most recent game save date and time. Otherwise, the supplied value
is assumed to be the filename for the created archive.

```
  > nmssavetool.exe help backupall

nmssavetool

  -b, --backup-to    Required. Specifies the directory or file to which the backup will be written. The backup 
                     will be saved as a zip archive.

  --save-dir         Path to game save folder (optional - determined automatically if not provided)

  -v, --verbose      Displays additional information during execution.

  --help             Display this help screen.

  --version          Display version information.
```
#### Examples:
```
  > nmssavetool backupall -b C:\nms_backups\all_saves.zip
```
  Backs up all game saves to `C:\nms_backups\all_saves.zip`.

---
### decrypt

Decrypts the latest game save for the specified game mode. One decrypted, the game save information
is written out as a formatted JSON file. This file can be edited to make various changes not supported
by this program, and then provided as input to the encrypt command.

```
>nmssavetool.exe help decrypt

nmssavetool

  -f, --output-file    Required. Specifies the file to which the decrypted, formatted game save will be
                       written.

  -g, --game-slot      Required. Use saves for which game slot (1-5)

  --save-dir           Path to game save folder (optional - determined automatically if not provided)

  -v, --verbose        Displays additional information during execution.

  --help               Display this help screen.

  --version            Display version information.
```
#### Examples:
```
  > nmssavetool decrypt -g 1 -f C:\my_save_game.json
```
  Decrypts latest slot 1 game save and writes it to the file, `C:\my_save_game.json`

---
### delinv

Deletes an item (product, substance, or technology) from an inventory.
```
>nmssavetool.exe help delinv

nmssavetool

  -s, --position           Required. Specifies the position, as row,col, of the inventory item which will be
                           deleted. Valid row and column value start at 1.

  -c, --inventory-group    Required. (Default: exosuit_general) Specifies the inventory group from which the
                           inventory item will be deleted: exosuit_general, exosuit_cargo, ship_general,
                           freighter_general, or vehicle

  -b, --backup-dir         If provided, will write the selected game-save to a decrypted JSON file in the
                           specified directory.

  --full-backup            If provided (along with -b/--backup-dir), will archive the full game-save directory
                           in addition to the decrypted JSON game-save file.

  -g, --game-slot          Required. Use saves for which game slot (1-5)

  --save-dir               Path to game save folder (optional - determined automatically if not provided)

  -v, --verbose            Displays additional information during execution.

  --help                   Display this help screen.

  --version                Display version information.
```
*Use with caution!*
#### Examples:
```
  > nmssavetool delinv -g 1 -s 3,4 -c ship_general -b D:\nms_backups
```
  Deletes the inventory item at row 3, column 4 in the ship general inventory. Before updating the game
  save file, the existing game save is backed up to a file in D:\nms_backups. The slot 1 game save is used.

---
### encrypt

Takes a game-save in JSON format, encrypts and writes it to the latest game-save slot for the
specified game mode.

```
>nmssavetool help encrypt

nmssavetool

  -f, --input-file    Required. Specifies the JSON input file which will be encrypted and written to the latest
                      game save slot.

  -b, --backup-dir    If provided, will write the selected game-save to a decrypted JSON file in the specified
                      directory.

  --full-backup       If provided (along with -b/--backup-dir), will archive the full game-save directory in
                      addition to the decrypted JSON game-save file.

  -g, --game-slot     Required. Use saves for which game slot (1-5)

  --save-dir          Path to game save folder (optional - determined automatically if not provided)

  -v, --verbose       Displays additional information during execution.

  --help              Display this help screen.

  --version           Display version information.
```
#### Examples:
```
  > nmssavetool encrypt -g 1 C:\my_save_game.json
```
  Encrypts the file, `C:\my_save_game.json` and writes it to game slot 1.

```
  > nmssavetool encrypt -g 2 C:\my_save_game.json -b D:\nms_backups
```
  Encrypts the file, `C:\my_save_game.json` and writes it to game slot 2.
  Before overwriting the existing game save it is backed up to the directory D:\nms_backups.

---
### info

Outputs information about the latest game save for the specified game slot. Information includes various player 
stats, the player position, and (optionally) inventory contents. When outputting inventory contents, by default
the contents of all non-empty inventory slots are displayed. To see the empty slots as well, or to restrict 
further restrict what inventory types are displayed, use the -t/--types option.

```
>nmssavetool help info

nmssavetool

  --no-basic                (Default: false) Omits display of basic game-save information such as player stats
                            and position.

  -i, --show-inventory      (Default: false) Display inventory contents.

  -c, --inventory-groups    (Default: all) The inventory groups whose contents will be displayed.

  -t, --types               (Default: all_but_empty) Which inventory types to include
                            (all,all_but_empty,product,substance,tech,non_tech,empty).

  -g, --game-slot           Required. Use saves for which game slot (1-5)

  --save-dir                Path to game save folder (optional - determined automatically if not provided)

  -v, --verbose             Displays additional information during execution.

  --help                    Display this help screen.

  --version                 Display version information.
```
#### Examples:
```
  > nmssavetool info -g 1
```
  Displays player stats and position for the slot 1 game save.

```
  > nmssavetool info -g 2 -i -c ship_general -t tech
```
  Displays a list of technology items in the ship_general inventory of the slot 1 game save. 
  The basic player stats are also displayed.

```
  > nmssavetool info -g 3 -i -c ship -t tech --no-basic
```
  Displays a list of technology in all ship inventories of the slot 3 game save. The 
  display of basic player stats is omitted.

```
  > nmssavetool.exe info -g 1 -i -c exosuit_cargo -t all
```
Shows the contents of the Exosuit Cargo inventory, including empty slots, of the slot 1 game save.

---
### maxslots

Maximizes the number of valid slots for the current ship, vehicle, multitool, or exosuit.

Note that the maximum number of slots was determined by the author with some experimentation in game,
but it is possible that Hello Games may change this in the future. 

```
>nmssavetool help maxslots

nmssavetool

  -c, --inventory-groups    (Default: all) The inventory groups whose slots will be maximized

  -b, --backup-dir          If provided, will write the selected game-save to a decrypted JSON file in the
                            specified directory.

  --full-backup             If provided (along with -b/--backup-dir), will archive the full game-save directory
                            in addition to the decrypted JSON game-save file.

  -g, --game-slot           Required. Use saves for which game slot (1-5)

  --save-dir                Path to game save folder (optional - determined automatically if not provided)

  -v, --verbose             Displays additional information during execution.

  --help                    Display this help screen.

  --version                 Display version information.
```
#### Examples:
```
  > nmssavetool -c ship_general -g 1
```
  Maximizes the number of slots for the ship_general inventory (instant 48-slot ship) for game slot 1.

---
### moveinv

Moves an inventory item from one position to another. If the destination slot was previously invalid, the 
source slot will be made invalid so that the total number of valid slots does not change. Otherwise, the 
source slot will be left valid, but empty. To swap the contents of inventory slots, see the swapinv command.

```
>nmssavetool help moveinv

nmssavetool

  -p, --position           Required. Specifies the from- and to-position as, "from_row,from_col:to_row,to_col",
                           of the item which will be moved. Valid row and column values start at '1'

  -c, --inventory-group    Required. (Default: exosuit_general) Specifies the inventory group within which the
                           item will be moved: exosuit_general, exosuit_cargo, ship_general, freighter_general,
                           or vehicle

  -b, --backup-dir         If provided, will write the selected game-save to a decrypted JSON file in the
                           specified directory.

  --full-backup            If provided (along with -b/--backup-dir), will archive the full game-save directory
                           in addition to the decrypted JSON game-save file.

  -g, --game-slot          Required. Use saves for which game slot (1-5)

  --save-dir               Path to game save folder (optional - determined automatically if not provided)

  -v, --verbose            Displays additional information during execution.

  --help                   Display this help screen.

  --version                Display version information.
```

#### Examples:
```
  > nmssavetool.exe moveinv -g 1 -c exosuit_cargo -p 6,4:6,5
```
Moves the contents of the Exosuit Cargo inventory slot at row 6, column 4 to row 6, column 5. Anything in
the destination is overwritten (use "info -i -c exosuit_cargo -t all" to check contents before moving, or
use the swapinv command).

---
### recharge

Recharges technology items. Certain technology items in the game have an
associated energy capacity that discharges with use. Some examples are the
exosuit life support system, the radiation deflector, etc. In the ship,
hyperdrive, launch thruster, pulse engine, and other items also have this
behavior. Some multitool and vehicle technology items also behave this way.
This command will "recharge" these items back to their full capacity.

```
  > nmssavetool help recharge 

nmssavetool

  -c, --inventory-groups    (Default: exosuit ship multitool freighter vehicle) Which inventories to recharge.

  -b, --backup-dir          If provided, will write the selected game-save to a decrypted JSON file in the
                            specified directory.

  --full-backup             If provided (along with -b/--backup-dir), will archive the full game-save directory
                            in addition to the decrypted JSON game-save file.

  -g, --game-slot           Required. Use saves for which game slot (1-5)

  --save-dir                Path to game save folder (optional - determined automatically if not provided)

  -v, --verbose             Displays additional information during execution.

  --help                    Display this help screen.

  --version                 Display version information.
```

#### Examples:
```
  > nmssavetool recharge -g 1 -c ship+exosuit
```
Recharges technologies in default inventories for game save slot 1.

---
### refill

Maximizes the amount of each product or substance item in an inventory slot.
This command has no effect on technology items.

```
  > nmssavetool help refill 

nmssavetool

  -c, --inventory-groups    (Default: exosuit ship freighter vehicle container) Which inventories to refill.

  -b, --backup-dir          If provided, will write the selected game-save to a decrypted JSON file in the
                            specified directory.

  --full-backup             If provided (along with -b/--backup-dir), will archive the full game-save directory
                            in addition to the decrypted JSON game-save file.

  -g, --game-slot           Required. Use saves for which game slot (1-5)

  --save-dir                Path to game save folder (optional - determined automatically if not provided)

  -v, --verbose             Displays additional information during execution.

  --help                    Display this help screen.

  --version                 Display version information.
```

#### Examples:
```
  > nmssavetool refill -g 1 -c container
```
Maximizes inventory quantities in all base containers for the game save slot 1.

---
### refurbish

Refurbish is equivalent to running the recharge, refill, and repair commands independently.
```
  > nmssavetool help refurbish 

nmssavetool

  -c, --inventory-groups    (Default: exosuit ship multitool freighter vehicle container) Which inventories to
                            refurbish.

  -b, --backup-dir          If provided, will write the selected game-save to a decrypted JSON file in the
                            specified directory.

  --full-backup             If provided (along with -b/--backup-dir), will archive the full game-save directory
                            in addition to the decrypted JSON game-save file.

  -g, --game-slot           Required. Use saves for which game slot (1-5)

  --save-dir                Path to game save folder (optional - determined automatically if not provided)

  -v, --verbose             Displays additional information during execution.

  --help                    Display this help screen.

  --version                 Display version information.
```

#### Examples:
```
  > nmssavetool refurbish -g 1 -c ship
```
Refurbishes all ship inventories for the game save slot 1.

---
### relocate

Relocate the player, within the current galaxy, to a position specified using one of several
coordinate representations. Currently three formats are supported:

1. Signal scanner coordinates. These are the coordinates displayed by any signal scanner in game. They 
   appear as 4, 4-digit hexidecimal numbers separated by colons (example, 0C93:0080:02B1:0202).
2. Portal coordinates. The game has 16 portal glyphs, each of which represents a hexidecimal digit.
   Several online sites and tools allow you to convert a sequence of glyphs into a 12-digit hexidecimal
   number. This command supports coordinates in this representation.
3. Voxel coordinates. Within the game-save file, coordinates are specified as X, Y, Z, and Solary System 
   Index values. You may directly provide these values to this command. This is useful when trying to
   replicate a position from another game save.

When moving the player, it is generally safer to reset the player's planet index and LastKnownPlayerState
so that the player is positioned near a valid planet and in his ship. The program will do that by
default, but if desired that behavior can be disabled with the --no-reset-planet and --no-reset-to-ship
flags.

```
  > nmssavetool help relocate 

nmssavetool

  -c, --galactic-coordinates    Set the player position using the galactic coordinates displayed by signal
                                scanners.

  -p, --portal-coordinates      Set the player position using portal coordinates.

  --voxel-coordinates           Set the player position using the voxel coordinates used within the save-game
                                file. Format is (x,y,z,ssi).

  --galaxy                      Set the galaxy index (0 = Euclid Galaxy, 1 = Hilbert Dimension, 2 = Calypso
                                Galaxy, etc.)

  --planet                      Set the planet index

  --no-reset-planet             Normally when relocating the player, the player's planet value is set to zero,
                                so that the player's position is compatible with all star systems. Set this
                                flag to disable that behavior.

  --no-reset-to-ship            Normally when relocating the player, the player's last known state value is set
                                to 'InShip' so the player spawns inside his ship. Set this flag to disable that
                                behavior.

  -b, --backup-dir              If provided, will write the selected game-save to a decrypted JSON file in the
                                specified directory.

  --full-backup                 If provided (along with -b/--backup-dir), will archive the full game-save
                                directory in addition to the decrypted JSON game-save file.

  -g, --game-slot               Required. Use saves for which game slot (1-5)

  --save-dir                    Path to game save folder (optional - determined automatically if not provided)

  -v, --verbose                 Displays additional information during execution.

  --help                        Display this help screen.

  --version                     Display version information.
```

#### Examples:
```
  > nmssavetool recolocate -g 1 -c 0C93:0080:02B1:0202
```
Relocate the player, within the current galaxy, to the position at the signal-scanner coordinates,
0C93:0080:02B1:0202. The player will be placed within his ship and reset on or near the first planet 
(planet 0).

```
  > nmssavetool recolocate -g 1 -p 020201AB2494 --no-reset-planet --no-reset-to-ship
```
Relocate the player, within the current galaxy, to the position at portal cooredinates, 020201AB2494.
The player planet and last known player state will be left unmodified (use with caution).

---
### repair

Repairs damaged technology items.

```
  > nmssavetool help repair 

nmssavetool

  -c, --inventory-groups    (Default: exosuit multitool ship) What inventories to repair.

  -b, --backup-dir          If provided, will write the selected game-save to a decrypted JSON file in the
                            specified directory.

  --full-backup             If provided (along with -b/--backup-dir), will archive the full game-save directory
                            in addition to the decrypted JSON game-save file.

  -g, --game-slot           Required. Use saves for which game slot (1-5)

  --save-dir                Path to game save folder (optional - determined automatically if not provided)

  -v, --verbose             Displays additional information during execution.

  --help                    Display this help screen.

  --version                 Display version information.
```

#### Examples:
```
  > nmssavetool repair -g 1 -c ship
```
Repair all damaged technology items in the ship, for example to repair damage created by a warp through a black hole.

```
  > nmssavetool repair -g 1 -c exosuit
```
Repair all damaged technology items in the exosuit, for example to repair damage created after passing through
the galatic core.

---
### restore

Restore a previously decrypted / backed-up game save.

```
  > nmssavetool help restore 

nmssavetool

  -f, --restore-from    Required. Specifies the full path to a back-up file to restore from. The back-up file
                        should be a decrypted JSON file created by this program.

  -g, --game-slot       Required. Use saves for which game slot (1-5)

  --save-dir            Path to game save folder (optional - determined automatically if not provided)

  -v, --verbose         Displays additional information during execution.

  --help                Display this help screen.

  --version             Display version information.
```

#### Examples:
```
nmssavetool restore -g 1 -f C:\nms_backups\nmssavetool-backup-normal-20170903-202134.json
```

Restore slot 1 game save backup created on 2017-09-03, at 8:31:34 PM.

---
### seed

Change the random number seed used by NMS to determine the appearance of your ship, multitool, or freighter.
You may set the seed explicitly, or have the program generate another random value.

```
  > nmssavetool help seed 

nmssavetool

  -c, --apply-to               Specifies which object whose RNG seed will be changed: ship, multitool, or
                               freighter

  -r, --randomize-ship-seed    Generate a random seed.

  -s, --set-ship-seed          Set the seed value.

  -b, --backup-dir             If provided, will write the selected game-save to a decrypted JSON file in the
                               specified directory.

  --full-backup                If provided (along with -b/--backup-dir), will archive the full game-save
                               directory in addition to the decrypted JSON game-save file.

  -g, --game-slot              Required. Use saves for which game slot (1-5)

  --save-dir                   Path to game save folder (optional - determined automatically if not provided)

  -v, --verbose                Displays additional information during execution.

  --help                       Display this help screen.

  --version                    Display version information.
```

#### Examples:
```
  > nmssavetool seed -g 1 -c ship -r
```

Generate a new seed for the ship, changing its appearance.

```
  > nmssavetool seed -g 1 -c freighter -s 0x12AC41FE98157A9C
```

Set the RNG seed for the freighter to 0x12AC41FE98157A9C. 

---
### swapinv

Swap the contents of two inventory slots.

```
  > nmssavetool help swapinv 

nmssavetool

  -p, --position           Required. Specifies the positions as, "row1,col1:row2,col2", of the items which will
                           be swapped. Valid row and column values start at '1'

  -c, --inventory-group    Required. (Default: exosuit_general) Specifies the inventory group within which the
                           items will be swapped: exosuit_general, exosuit_cargo, ship_general,
                           freighter_general, or vehicle

  -b, --backup-dir         If provided, will write the selected game-save to a decrypted JSON file in the
                           specified directory.

  --full-backup            If provided (along with -b/--backup-dir), will archive the full game-save directory
                           in addition to the decrypted JSON game-save file.

  -g, --game-slot          Required. Use saves for which game slot (1-5)

  --save-dir               Path to game save folder (optional - determined automatically if not provided)

  -v, --verbose            Displays additional information during execution.

  --help                   Display this help screen.

  --version                Display version information.
```

#### Examples:
```
  > nmssavetool swapinv -g 1 -c exosuit_general -p 1:2,3:4
```
Swap the contents of exosuit general inventory items at row 1, column 2, and row 3, column 4.

---
### units

Change the player's amount of units (in-game currency).

```
  > nmssavetool help units 

nmssavetool

  -s, --set-units     Set the player Units.

  -a, --add-units     Add the specified amount to player Units (negative units will subtract from total).

  -b, --backup-dir    If provided, will write the selected game-save to a decrypted JSON file in the specified
                      directory.

  --full-backup       If provided (along with -b/--backup-dir), will archive the full game-save directory in
                      addition to the decrypted JSON game-save file.

  -g, --game-slot     Required. Use saves for which game slot (1-5)

  --save-dir          Path to game save folder (optional - determined automatically if not provided)

  -v, --verbose       Displays additional information during execution.

  --help              Display this help screen.

  --version           Display version information.
```
#### Examples:
```
  > nmssavetool units -g 1 -a 1000000
```
Add one million units to the player's total.

```
  > nmssavetool units -g 1 -s 2000000000
```
Set player units to 2 billion.

---
## Changelog

### 2017-10-16 2.0.1.6 (beta-4)
* Fixed bug in inventory selection for refill, recharge, and refurbish commands. Program also 
  now detects if there were any changes to the selected inventories or not, and if not skips
  update of game save.
* Fixed incorrect IsRechargeable attribute for HyperDrive in InventoryItemTypes.csv. This was
  preventing the program from recharging the hyperdrive.
* Fixed typo in "Vortex Cube" in inventory item CSV file, InventoryItemTypes.csv (H/T Github user jgreely)

### 2017-10-15 2.0.1.5 (beta-3)
* Fixed bug preventing correct location of save directory for GoG

### 2017-10-15 2.0.1.4 (beta-2)
* Fixed bug in seed command that would cause invalid display of seed
* Added display of seeds to Info command
* Added display of current value when no change is made, to "units", "seed", and "relocate" commands.

### 2017-10-13 2.0.1.3 (beta-1)
* Updated game save file naming to match NMS 1.38 release
* Updated game save archive select logic to always pick the latest save file and to create
  one on save if less than two exist.
* Added display of game mode to Info command

### 2017-10-08 2.0.1.2 (alpha-2)

* Split out backup of all saves into a separate command, "backupall".
* Full backup now only backs up the game save archive and metadata files - no cache directory.
* Add verbose logging to GameSaveManager

### 2017-09-25 2.0.1.1 (alpha-1)

* Fix missing implementation of "seed" command.

### 2017-09-25 2.0.1.0 (alpha)

* Initial changes to support NMS 1.38 new save slot scheme.

### 2017-09-17 2.0.0.0

* Every feature anyone has ever requested, except for a GUI :)
* Several new inventory commands giving the ability to manipulate inventory contents. 
  Add, move, swap, or delete inventory items
* New command maxslots. Maximizes the number of inventory slots. Instant 48-slot ship!
* New command: info. This can be used to dump information about the most recent game save, including
  the player's position and inventory contents.
* New command: backup. This command allows the user to back-up the current game save without modifying it.
* New command: restore. This command is functionally equivalent to 'restore', but was provided to
* Backup now also writes a decrypted, formatted JSON file. This makes it easy to 
  restore a backup by simply using the encrypt command with one of these JSON files as input.
* Backup now includes the game mode in the output file name.
* Backup now by default only makes a copy of the unencrypted JSON file rather than the full
  archive of the save dir. A full archive is still available with the --full-backup option.
  make the process of restoring a backed-up game-save more explicit/obvious to the end user.
* Significant internal refactoring to separate the command-line interface from the save-game abstraction. 
  This will allow that code to be used in other contexts (like a GUI).
* Support for the old NMS version 1.0 save-game format has been removed.
* The command-line options have changed. Please check the help for details.

### 2017-08-20 1.5.0.0

* New modify command options, set_galactic-coordinates, set-portal-coordinates, and set-voxel-coordinates allow 
  movement of the player position within the current galaxy
* New modify command option, set-galaxy, allows the player to change the current galaxy.

### 2017-08-19 1.4.4.0

* Added the ability to set or add to the player Units total.

### 2017-08-13 1.4.3.0

* Added support for new NMS 1.3 Exosuit and Ship inventory groups
* Added support for containers

### 2017-03-12 1.4.2.0

* Added option (-s / --save-dir) to explicitly specify the folder containing the game save files.
* Added dump of some troubleshooting info (CLR version and APPDATA folder) to verbose mode display
* Modified game save location logic to work even if save directories do not contain the profile key
  number. This key is not needed for current versions of the game, so perhaps newer installs are
  no longer naming the directory this way.

### 2017-03-12 1.4.1.0

* Fixed bug where GoG game save directory detection would only work if a Normal mode game had been saved.

### 2017-03-12 1.4.0.0

* Added support for GoG game save directory
* Added support for Permadeath game mode

### 2017-03-11 1.3.0.0

* Updated to work with new NMS save file format (version 4101) in the NMS Pathfinder update (version 1.2)

### 2017-01-01 1.2.0.1

* Added backup feature

### 2016-12-31 1.1.0.0

* Added damage repair to Refill Command
* Switched to a new command-line parsing library
* Moved to a verb-style command line interface, and provide more fine-grained control over modifications.
* Minor refactoring to reduce duplicated code

### 2016-12-30 1.0.0.0

* Initial release

---

## Credits & Attribution

Many thanks to the authors of the following software libraries used by nmssavetool:

* CsvHelper - http://joshclose.github.io/CsvHelper/
* Json.NET (NewtonSoft) - https://www.newtonsoft.com/json
* CommandLineParser - https://github.com/gsscoder/commandline

I would also like to thank No Man's Sky mod maker 'nomansuniverse' and 'Mjjstral', who discovered how to 
decrypt the V1 format NMS save files.

