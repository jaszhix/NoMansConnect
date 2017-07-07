using System;
using System.Collections.Generic;
using System.Text;
using System.IO;
using System.Linq;
using System.IO.Compression;
using nomanssave;
using Newtonsoft.Json;
using CommandLine;


namespace nmssavetool
{
    public enum TechGrp
    {
        exosuit,
        multitool,
        ship,
        freighter
    }

    public class CommonOptions
    {
        [Option('g', "game-mode", Required = true, HelpText = "Use saves for which game mode (normal|survival|creative|permadeath)")]
        public GameModes GameMode { get; set; }

        [Option('s', "save-dir", Required = false, HelpText = "Path to game save folder (optional - determined automatically if not provided)")]
        public string SaveDir { get; set; }

        [Option('v', "verbose", HelpText = "Displays additional information during execution.")]
        public bool Verbose { get; set; }
    }

    public class BackupOptions : CommonOptions
    {
        [Option('b', "backup-dir", HelpText = "If provided, will back up game saves to the specified directory.")]
        public string BackupDir { get; set; }
    }

    [Verb("decrypt", HelpText = "Decrypt the latest game save slot and write it to a formatted JSON file.")]
    public class DecryptOptions : CommonOptions
    {
        [Option('o', "output", Required = true, HelpText = "Specifies the file to which the decrypted, formatted game save will be written.")]
        public string OutputPath { get; set; }
    }

    [Verb("encrypt", HelpText = "Encrypt a JSON file and write it to the latest game save slot.")]
    public class EncryptOptions : BackupOptions
    {
        [Option('i', "input", Required = true, HelpText = "Specifies the JSON input file which will be encrypted and written to the latest game save slot.")]
        public string InputPath { get; set; }

        [Option("v1-format", HelpText = "When encrypting, use the old NMS V1 format")]
        public bool UseOldFormat { get; set; }
    }

    [Verb("modify", HelpText = "Refresh, repair, or refill exosuit, multitool, ship, or freighter inventory.")]
    public class ModifyOptions : BackupOptions
    {
        [Option('a', "all", HelpText = "Maximize exosuit, multi-tool, ship, and freighter inventory, health, fuel, and energy levels. Repair all damage.")]
        public bool Everything { get; set; }

        [Option('e', "energy", HelpText = "Maximize exosuit, multi-tool, and ship energy and fuel (hyperdrive and launcher) levels.")]
        public bool Energy { get; set; }

        [Option('i', "inventory", HelpText = "Maximize exosuit, multi-tool, ship, and freighter inventory.")]
        public bool Inventory { get; set; }

        [Option('r', "repair", HelpText = "Repair damage to exosuit, multi-tool, and ship.")]
        public bool Repair { get; set; }

        [Option('t', "apply-to", Separator = '+', Max = 4, Default = new TechGrp[] { TechGrp.exosuit, TechGrp.multitool, TechGrp.ship, TechGrp.freighter }, 
            HelpText = "What to apply changes to.")]
        public IEnumerable<TechGrp> TechGroups { get; set; }

        [Option("v1-format", HelpText = "When encrypting, use the old NMS V1 format")]
        public bool UseOldFormat { get; set; }

        [Option("randomize-ship-seed", HelpText = "Generate a new seed value for the Ship.")]
        public bool RandomizeShipSeed { get; set; }

        [Option("set-ship-seed", HelpText = "Set the seed value for the Ship.")]
        public string SetShipSeed { get; set; }

        [Option("randomize-multitool-seed", SetName = "multitool-seed", HelpText = "Generate a new seed value for the Multitool.")]
        public bool RandomizeMultitoolSeed { get; set; }

        [Option("set-multitool-seed", SetName = "multitool-seed", HelpText = "Set the seed value for the Multitool.")]
        public string SetMultitoolSeed { get; set; }

        [Option("randomize-freighter-seed", SetName = "freighter-seed", HelpText = "Generate a new seed value for the Freighter.")]
        public bool RandomizeFreighterSeed { get; set; }

        [Option("set-freighter-seed", SetName = "freighter-seed", HelpText = "Set the seed value for the Freighter.")]
        public string SetFreighterSeed { get; set; }
    }

    class Program
    {
        readonly string[] REFILLABLE_TECH = {
            // Inventory 
            "^PROTECT", "^ENERGY", "^TOX1", "^TOX2", "^TOX3", "^RAD1", "^RAD2", "^RAD3",
            "^COLD1", "^COLD2", "^COLD3", "^HOT1", "^HOT2", "^HOT3", "^UNW1", "^UNW2", "^UNW3",

            // ShipInventory
            "^SHIPGUN1", "^SHIPSHIELD", "^SHIPJUMP1", "^HYPERDRIVE", "^LAUNCHER", "^SHIPLAS1",

            // WeaponInventory
            "^LASER", "^GRENADE"
        };

        private HashSet<string> _refillableTech;
        private Random _random;

        static void Main(string[] args)
        {            
            Program program = null;
            try
            {
                program = new Program();
                bool success = program.Run(args);
                if (success)
                {
                    Console.WriteLine("Success");
                }
                Environment.Exit(success ? 0 : 1);
            }
            catch (Exception x)
            {
                Console.Error.WriteLine(x.Message);
                Environment.Exit(-1);
            }
        }

        Program()
        {
            _refillableTech = new HashSet<string>(REFILLABLE_TECH);
            _random = new Random();
            LogWriter = Console.Out;
        }

        public TextWriter LogWriter { get; set; }

        public bool Verbose { get; set; }


        public bool Run(IEnumerable<string> args)
        {
            var result = CommandLine.Parser.Default.ParseArguments<DecryptOptions, EncryptOptions, ModifyOptions>(args);
            
            bool success = result.MapResult(
                (DecryptOptions opt) => RunDecrypt(opt),
                (EncryptOptions opt) => RunEncrypt(opt),
                (ModifyOptions opt) => RunModify(opt),
                _ => false);

            return success;
        }

        private void DoCommon(CommonOptions opt)
        {
            if (!Verbose)
            {
                Verbose = opt.Verbose;
            }

            LogVerbose("CLR version: {0}", Environment.Version);
            LogVerbose("APPDATA folder: {0}", Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData));
        }

        private bool RunDecrypt(DecryptOptions opt)
        {
            DoCommon(opt);

            GameSaveDir gsd;
            try
            {
                gsd = new GameSaveDir(opt.SaveDir);
            }
            catch (Exception x)
            {
                LogError("Error locating game save file:\n{0}", x.Message);
                return false;
            }

            object json;
            try
            {
                json = ReadLatestSaveFile(gsd, opt.GameMode);
            }
            catch (Exception x)
            {
                LogError("Error loading or parsing save file: {0}", x.Message);
                return false;
            }

            LogVerbose("Parsing and formatting save game JSON");
            string formattedJson;
            try
            {
                formattedJson = JsonConvert.SerializeObject(json, Formatting.Indented);
            }
            catch (Exception x)
            {
                LogError("Error formatting JSON (invalid save?): {0}", x.Message);
                return false;
            }

            LogVerbose("Writing formatted JSON to:\n   {0}", opt.OutputPath);
            try
            {
                File.WriteAllText(opt.OutputPath, formattedJson);
            }
            catch (Exception x)
            {
                LogError("Error writing decrypted JSON: {0}", x.Message);
                return false;
            }

            return true;
        }

        private bool RunEncrypt(EncryptOptions opt)
        {
            DoCommon(opt);

            GameSaveDir gsd;
            try
            {
                gsd = new GameSaveDir(opt.SaveDir);
            }
            catch (Exception x)
            {
                LogError("Error locating game save file:\n{0}", x.Message);
                return false;
            }

            LogVerbose("Reading JSON save game data from: {0}", opt.InputPath);
            string unformattedJson;
            try
            {
                unformattedJson = File.ReadAllText(opt.InputPath);
            }
            catch (IOException x)
            {
                LogError("Error reading JSON save game file: {0}", x.Message);
                return false;
            }

            LogVerbose("Validating (parsing) JSON save game data");
            object json;
            try
            {
                json = JsonConvert.DeserializeObject(unformattedJson);
            }
            catch (Exception x)
            {
                LogError("Error parsing save game file: {0}", x.Message);
                return false;
            }

            BackupSave(gsd, opt);

            try
            {
                WriteLatestSaveFile(gsd, opt.GameMode, json, opt.UseOldFormat);
            }
            catch (Exception x)
            {
                LogError("Error storing save file: {0}", x.Message);
                return false;
            }

            return true;
        }

        private static ulong ParseUlongOption(string str)
        {
            if (str.StartsWith("0x") || str.StartsWith("0X"))
            {
                return Convert.ToUInt64(str, 16);
            }
            else
            {
                return Convert.ToUInt64(str);
            }
        }


        private bool RunModify(ModifyOptions opt)
        {
            try
            {
                DoCommon(opt);

                GameSaveDir gsd;
                try
                {
                    gsd = new GameSaveDir(opt.SaveDir);
                }
                catch (Exception x)
                {
                    LogError("Error locating game save file:\n{0}", x.Message);
                    return false;
                }

                dynamic json;
                try
                {
                    json = ReadLatestSaveFile(gsd, opt.GameMode);
                }
                catch (Exception x)
                {
                    Console.WriteLine("Error loading or parsing save file: {0}", x.Message);
                    return false;
                }

                // Now iterate through JSON, maxing out technology, Substance, and Product values in Inventory, ShipInventory, and FreighterInventory

                ModifyExosuitSlots(opt, json);
                ModifyMultitoolSlots(opt, json);
                ModifyShipSlots(opt, json);
                ModifyFreighterSlots(opt, json);
                ModifyShipSeed(opt, json);
                ModifyMultitoolSeed(opt, json);
                ModifyFreighterSeed(opt, json);

                BackupSave(gsd, opt);

                try
                {
                    WriteLatestSaveFile(gsd, opt.GameMode, json, opt.UseOldFormat);
                }
                catch (Exception x)
                {
                    throw new Exception(string.Format("Error storing save file: {0}", x.Message), x);
                }
            }
            catch (Exception x)
            {
                LogError(x.Message);
                return false;
            }

            return true;
        }

        private dynamic SuitInventoryNode(dynamic json)
        {
            return json.PlayerStateData.Inventory;
        }

        private void ModifyExosuitSlots(ModifyOptions opt, dynamic json)
        {
            if (opt.TechGroups.Contains(TechGrp.exosuit))
            {
                LogVerbose("Updating Exosuit");
                if (opt.Energy || opt.Everything)
                {
                    json.PlayerStateData.Health = 8;
                    json.PlayerStateData.Energy = 100;
                    json.PlayerStateData.Shield = 100;
                }

                foreach (var slot in SuitInventoryNode(json).Slots)
                {
                    if (opt.Repair || opt.Everything)
                    {
                        slot.DamageFactor = 0.0f;
                    }

                    if ((opt.Energy || opt.Everything) && slot.Type.InventoryType == "Technology" && _refillableTech.Contains(slot.Id.Value))
                    {
                        slot.Amount = slot.MaxAmount;
                    }

                    if ((opt.Inventory || opt.Everything) && (slot.Type.InventoryType == "Product" || slot.Type.InventoryType == "Substance"))
                    {
                        slot.Amount = slot.MaxAmount;
                    }
                }
            }
        }

        private dynamic WeaponInventoryNode(dynamic json)
        {
            return json.PlayerStateData.WeaponInventory;
        }

        private void ModifyMultitoolSlots(ModifyOptions opt, dynamic json)
        {
            if (opt.TechGroups.Contains(TechGrp.multitool))
            {
                LogVerbose("Updating Multitool");
                foreach (var slot in WeaponInventoryNode(json).Slots)
                {
                    if (opt.Repair || opt.Everything)
                    {
                        slot.DamageFactor = 0.0f;
                    }

                    if ((opt.Energy || opt.Everything) && _refillableTech.Contains(slot.Id.Value))
                    {
                        slot.Amount = slot.MaxAmount;
                    }
                }
            }
        }

        private dynamic PrimaryShipInventoryNode(dynamic json)
        {
            return PrimaryShipNode(json).Inventory;
        }

        private void ModifyShipSlots(ModifyOptions opt, dynamic json)
        {
            if (opt.TechGroups.Contains(TechGrp.ship))
            {
                LogVerbose("Updating Ship");
                if (opt.Energy || opt.Everything)
                {
                    json.PlayerStateData.ShipHealth = 8;
                    json.PlayerStateData.ShipShield = 200;
                }

                foreach (var slot in PrimaryShipInventoryNode(json).Slots)
                {
                    if (opt.Repair || opt.Everything)
                    {
                        slot.DamageFactor = 0.0f;
                    }

                    if ((opt.Energy || opt.Everything) && slot.Type.InventoryType == "Technology" && _refillableTech.Contains(slot.Id.Value))
                    {
                        slot.Amount = slot.MaxAmount;
                    }

                    if ((opt.Inventory || opt.Everything) && (slot.Type.InventoryType == "Product" || slot.Type.InventoryType == "Substance"))
                    {
                        slot.Amount = slot.MaxAmount;
                    }
                }
            }
        }

        private dynamic FreighterInventoryNode(dynamic json)
        {
            return json.PlayerStateData.FreighterInventory;
        }

        private void ModifyFreighterSlots(ModifyOptions opt, dynamic json)
        {
            if (opt.TechGroups.Contains(TechGrp.freighter))
            {
                LogVerbose("Updating Freighter");
                foreach (var slot in FreighterInventoryNode(json).Slots)
                {
                    if ((opt.Inventory || opt.Everything) &&
                        // Leave this next line in as protection against future version of NMS allowing other things in Freighter
                        (slot.Type.InventoryType == "Product" || slot.Type.InventoryType == "Substance")
                       )
                    {
                        slot.Amount = slot.MaxAmount;
                    }
                }
            }
        }

        private void BackupSave(GameSaveDir gsd, BackupOptions opt)
        {
            if (null != opt.BackupDir)
            {
                try
                {
                    string backupPath;
                    bool backupCreated;
                    gsd.Backup(opt.BackupDir, out backupPath, out backupCreated);

                    if (backupCreated)
                    {
                        LogVerbose("Backed up save game files to: {0}", backupPath);
                    }
                    else
                    {
                        LogVerbose("Backup file already exists: {0}", backupPath);
                    }
                }
                catch (Exception x)
                {
                    throw new Exception(string.Format("Error backing up save game files: {0}", x.Message), x);
                }
            }
        }

        private void ModifyShipSeed(ModifyOptions opt, dynamic json)
        {
            ulong? seed = null;

            if (opt.SetShipSeed != null)
            {
                try
                {
                    seed = ParseUlongOption(opt.SetShipSeed);
                }
                catch(Exception x)
                {
                    throw new ArgumentException(string.Format("Invalid value for option {0}: {1}", "--set-ship-seed", opt.SetShipSeed), x);
                }
            }
            else if (opt.RandomizeShipSeed)
            {
                byte[] randBytes = new byte[8];
                _random.NextBytes(randBytes);
                seed = BitConverter.ToUInt64(randBytes, 0);
            }

            if (seed != null)
            {
                string seedStr = string.Format("0x{0:X16}", seed);
                LogVerbose("Setting ship seed to: {0}", seedStr);
                PrimaryShipNode(json).Resource.Seed[1] = seedStr;
            }
        }

        private void ModifyMultitoolSeed(ModifyOptions opt, dynamic json)
        {
            ulong? seed = null;

            if (opt.SetMultitoolSeed != null)
            {
                try
                {
                    seed = ParseUlongOption(opt.SetShipSeed);
                }
                catch (Exception x)
                {
                    throw new ArgumentException(string.Format("Invalid value for option {0}: {1}", "--nodify-multitool-seed", opt.SetMultitoolSeed), x);
                }
            }
            else if (opt.RandomizeMultitoolSeed)
            {
                byte[] randBytes = new byte[8];
                _random.NextBytes(randBytes);
                seed = BitConverter.ToUInt64(randBytes, 0);
            }

            if (seed != null)
            {
                string seedStr = string.Format("0x{0:X16}", seed);
                LogVerbose("Setting multitool seed to: {0}", seedStr);
                json.PlayerStateData.CurrentWeapon.GenerationSeed[1] = seedStr;
            }
        }

        private void ModifyFreighterSeed(ModifyOptions opt, dynamic json)
        {
            ulong? seed = null;

            if (opt.SetFreighterSeed != null)
            {
                try
                {
                    seed = ParseUlongOption(opt.SetFreighterSeed);
                }
                catch (Exception x)
                {
                    throw new ArgumentException(string.Format("Invalid value for option {0}: {1}", "--modify-freighter-seed", opt.SetFreighterSeed), x);
                }
            }
            else if (opt.RandomizeFreighterSeed)
            {
                byte[] randBytes = new byte[8];
                _random.NextBytes(randBytes);
                seed = BitConverter.ToUInt64(randBytes, 0);
            }

            if (seed != null)
            {
                string seedStr = string.Format("0x{0:X16}", seed);
                LogVerbose("Setting freightert seed to: {0}", seedStr);
                json.PlayerStateData.CurrentFreighter.Seed[1] = seedStr;
            }
        }

        private dynamic PrimaryShipNode(dynamic json)
        {
            int primaryShipIndex = json.PlayerStateData.PrimaryShip;
            return json.PlayerStateData.ShipOwnership[primaryShipIndex];
        }


        private void Log(string format, params object[] arg)
        {
            LogWriter.WriteLine(format, arg);
        }

        private void LogVerbose(string format, params object[] arg)
        {
            if (Verbose)
            {
                LogWriter.WriteLine(format, arg);
            }
        }

        private void LogError(string format, params object[] arg)
        {
            Console.Error.WriteLine(format, arg);
        }

        // TODO: Move all save file handling into a separate class
        private object ReadLatestSaveFile(GameSaveDir gsd, GameModes gameMode)
        {
            string metadataPath;
            string storagePath;
            uint archiveNumber;
            ulong? profileKey;

            gsd.FindLatestGameSaveFiles(gameMode, out metadataPath, out storagePath, out archiveNumber, out profileKey);

            LogVerbose("Reading latest {0}-mode save game file from:\n   {1}", gameMode, storagePath);

            string jsonStr = Storage.Read(metadataPath, storagePath, archiveNumber, profileKey);

            return JsonConvert.DeserializeObject(jsonStr);
        }

        private void WriteLatestSaveFile(GameSaveDir gsd, GameModes gameMode, object json, bool useOldFormat)
        {
            string formattedJson = JsonConvert.SerializeObject(json, Formatting.None);

            string metadataPath;
            string storagePath;
            uint archiveNumber;
            ulong? profileKey;

            gsd.FindLatestGameSaveFiles(gameMode, out metadataPath, out storagePath, out archiveNumber, out profileKey);

            LogVerbose("Writing latest {0}-mode save game file to:\n   {1}", gameMode, storagePath);
            using (MemoryStream ms = new MemoryStream(Encoding.UTF8.GetBytes(formattedJson)))
            {
                Storage.Write(metadataPath, storagePath, ms, archiveNumber, profileKey, useOldFormat);
                var now = DateTime.Now;
                File.SetLastWriteTime(metadataPath, now);
                File.SetLastWriteTime(storagePath, now);
            }
        }

    }
}
