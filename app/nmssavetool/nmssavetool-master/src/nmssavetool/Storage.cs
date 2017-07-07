using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.IO;
using System.Security.Cryptography;
using SpookilySharp;
using Xxtea;

namespace nomanssave
{
    /// <summary>
    /// This class is based on an original work from No Man's Sky mod maker 'nomansuniverse' later
    /// modified by user 'Mjjstral'. I have made minimal modifications to it to allow it to fully
    /// support the new save game file format in No Man's Sky version 1.1 and later.
    /// 
    /// NMS saves consist of two file types: 
    ///   1) A "storage" file that contains the actual save game data. These files are named 
    ///      storage?.hg.
    ///   2) A "metadata" file that contains details about the storage file, including its
    ///      format and a hash of the file contents.
    ///      
    /// In NMS v1.0, the storage files were both encrypted and compressed. MAC values
    /// within the metadata file were used to authenticate the contents of the storage file
    /// both before and after decryption/decompression. In addition, the metadata file itself
    /// was encrypted, using a key that is embedded in the folder name containing the game saves.
    /// 
    /// In NMS v1.1, the encryption and compression of storage files was removed, and other 
    /// than a terminating NULL ('\0') character, the files are in a form that can be directly
    /// edited. All MAC values within the metadata file are based on the plaintext values (i.e.
    /// the encryption/decryption and compression/decompression steps are just skipped). In 
    /// addition a single 32-bit value in the metadata file is different for NMS v1.1 files.
    /// 
    /// This class supports decoding and encoding files in both the old and new formats. When
    /// decoding a save game, it decrypts the metadata header and looks at the version field
    /// to determine if the storage is in the old, encrypted and compressed, format, and if 
    /// so it will do the additional steps necessary to decrypt and decompress the data. 
    /// For encoding of a JSON file back to the NMS save game format, it takes a parameter
    /// specifying whether or not to encrypt the file (i.e. save in the old format). 
    /// </summary>

    class StorageMetadata
    {
        
        public ulong[] Key;
        public string SHA256;
        public uint DecompressedSize;
        public uint CompressedSize;
        public uint? ProfileHash;
        public uint ArchiveNumber;
        public uint StorageVersion;

        public byte[] StorageRaw;
        public byte[] MetadataRaw;

        public StorageMetadata()
        {
            Key = new ulong[2];
        }
    }

    class Storage
    {
        private const int STORAGE_VERSION_V1 = 0x7d0;
        private const int STORAGE_VERSION_V1_1 = 0x7d1;

        public static string Read(string metadataFilename, string storageFilename, uint archiveNumber, ulong? profileKey)
        {
            using (BinaryReader metadataReader = new BinaryReader(File.Open(metadataFilename, FileMode.Open)))
            using (BinaryReader storageReader = new BinaryReader(File.Open(storageFilename, FileMode.Open)))
            {
                return Read(metadataReader.BaseStream, storageReader.BaseStream, archiveNumber, profileKey);
            }
        }

        public static string Read(Stream metadataStream, Stream storageStream, uint archiveNumber, ulong? profileKey)
        {
            var metadata = ParseMetadataFile(metadataStream, archiveNumber);
            ParseStorageFile(metadata, storageStream, profileKey);
            return Encoding.UTF8.GetString(metadata.StorageRaw).TrimEnd('\0'); // Assumed to be UTF-8, might be ASCII though
        }

        public static void Write(string jsonFilename, string metadataFilename, string storageFilename, uint archiveNumber, ulong? profileKey, bool encrypt)
        {
            using (BinaryReader storageReader = new BinaryReader(File.Open(jsonFilename, FileMode.Open)))
            {
                Write(metadataFilename, storageFilename, storageReader.BaseStream, archiveNumber, profileKey, encrypt);
            }
        }

        public static void Write(string metadataFilename, string storageFilename, Stream storageStream, uint archiveNumber, ulong? profileKey, bool encrypt)
        {
            var metadata = CreateStorageFile(storageStream, archiveNumber, profileKey, encrypt);
            CreateMetadataFile(metadata);

            File.WriteAllBytes(metadataFilename, metadata.MetadataRaw);
            File.WriteAllBytes(storageFilename, metadata.StorageRaw);
        }

        // Math functions
        private static uint RotateLeft(uint value, int bits)
        {
            return (value << bits) | (value >> (32 - bits));
        }

        private static uint F1(uint val1, uint val2, uint val3, uint val4, uint val5)
        {
            uint temp = val1 + val2;
            temp ^= (temp << 0x10) ^ val3;
            temp += (temp >> 0x0b) + val4;
            temp ^= (temp << 0x10) ^ val5;
            temp += (temp >> 0x0b);
            temp ^= (temp * 8);
            temp += (temp >> 0x05);
            temp ^= (temp << 0x04);
            temp += (temp >> 0x11);
            temp ^= (temp << 0x19);
            return temp;
        }

        private static uint F2(uint val1, uint val2 = 0)
        {
            uint temp = RotateLeft(val1 * 0xcc9e2d51, 0x0f) * 0x1b873593;
            temp ^= val2;
            temp = RotateLeft(temp, 0x0d) + 0xfaddaf14;
            temp *= 5;
            return temp;
        }

        private static byte[] GenerateKey(StorageMetadata metadata, ulong? profileKey, bool storeProfileKey = false)
        {
            uint[] keydata_ints = { 0, 0, 0, 0 };

            uint k1_h = (uint)metadata.Key[0] & 0xffff;
            uint k1_d = (uint)(metadata.Key[0] >> 5) & 0x7fff800;
            uint k2_h = (uint)(metadata.Key[0] >> 32) & 0xffff;
            uint k2_d = (uint)((metadata.Key[0] >> 32) >> 5) & 0x7fff800;
            uint k3_h = (uint)metadata.Key[1] & 0xffff;
            uint k3_d = (uint)(metadata.Key[1] >> 5) & 0x7fff800;
            uint k4_h = (uint)(metadata.Key[1] >> 32) & 0xffff;
            uint k4_d = (uint)((metadata.Key[1] >> 32) >> 5) & 0x7fff800;

            // More murmurhash-like code
            uint temp = 0;

            // Byte 1
            temp = F1(0x85EBCA6B, k1_h, k1_d, k2_h, k2_d);
            temp = F2(((temp >> 6) + temp), metadata.ArchiveNumber);
            keydata_ints[0] = temp;

            // Byte 2
            temp = F1(0xCC9E2D51, k3_h, k3_d, k4_h, k4_d);
            temp += (temp >> 6);
            keydata_ints[1] = temp;

            // Byte 3
            temp = F1(0x1b873593, k1_h, k1_d, k2_h, k2_d);
            temp += (temp >> 6);
            keydata_ints[2] = temp;

            // Byte 4
            temp = F1(0x85EBCA6B, k3_h, k3_d, k4_h, k4_d);
            temp += (temp >> 6);
            keydata_ints[3] = temp;

            if (metadata.ProfileHash.HasValue || (profileKey.HasValue && storeProfileKey))
            {
                if (profileKey.HasValue)
                {
                    // Decrypt using Steam/GOG ID key
                    uint profile_key_h = (uint)(profileKey.Value & 0xffff);
                    uint profile_key_d = (uint)((profileKey.Value >> 5) & 0x7fff800);
                    uint profile_key_h2 = (uint)((profileKey.Value >> 0x20) & 0xffff);
                    uint profile_key_d2 = (uint)(((profileKey.Value >> 0x20) >> 5) & 0x7fff800);

                    temp = F1(0x1b873593, profile_key_h, profile_key_d, profile_key_h2, profile_key_d2);
                    temp += (temp >> 6);

                    uint hashCheck = temp & 0xffff;

                    if (storeProfileKey)
                        metadata.ProfileHash = hashCheck;
                    
                    keydata_ints[1] = F2(keydata_ints[1], temp);

                    if (hashCheck != metadata.ProfileHash)
                    {
                        throw new InvalidDataException("Invalid data: profile hash did not check out");
                    }
                }
                else
                {
                    throw new ArgumentException("Must provide profile key to decrypt this data");
                }
            }

            return keydata_ints.SelectMany(BitConverter.GetBytes).ToArray();
        }



        // Loading code
        private static StorageMetadata ParseMetadataFile(Stream input, uint archiveNumber)
        {
            archiveNumber += 2;

            List<uint> data = new List<uint>();
            using (BinaryReader reader = new BinaryReader(input))
            {
                while (reader.BaseStream.Position < reader.BaseStream.Length)
                {
                    data.Add(reader.ReadUInt32());
                }
            }

            if(data.Count * 4 != 0x68)
            {
                throw new InvalidDataException("Invalid metadata file. Expected a file of size 0x68");
            }

            // Murmurhash-like
            uint k1 = archiveNumber ^ 0x1422cb8c;
            uint h1 = RotateLeft(k1, 13) * 5 + 0xe6546b64;

            var input_key = Encoding.ASCII.GetBytes("NAESEVADNAYRTNRG");
            for (int i = 0; i < 4; i++)
            {
                input_key[i] = (byte)(h1 >> (i * 8));
            }

            List<uint> key = new List<uint>();
            for (int i = 0; i < input_key.Length; i += 4)
            {
                key.Add(BitConverter.ToUInt32(input_key, i));
            }

            uint hash = 0xf1bbcdc8;
            for (int itr1 = 0; itr1 < 8; itr1++)
            {
                int key_idx = (int)((hash >> 2) & 3);

                uint cur = data[0];
                int idx = data.Count - 1;
                uint tmp = 0;
                for (int itr2 = 0x19; itr2 > 0; itr2--, idx--)
                {
                    tmp = ((cur >> 3) ^ (data[idx - 1] << 4)) + ((cur * 4) ^ (data[idx - 1] >> 5));
                    tmp ^= (data[idx - 1] ^ key[(itr2 & 3) ^ key_idx]) + (cur ^ hash);

                    data[idx] -= tmp;
                    cur = data[idx];
                }

                idx = data.Count - 1;
                tmp = (((cur >> 3) ^ (data[idx] << 4)) + ((cur * 4) ^ (data[idx] >> 5))) & 0xffffffff;
                tmp ^= (((data[idx] ^ key[key_idx]) + (cur ^ hash)) & 0xffffffff);
                data[0] -= tmp;
                hash += 0x61c88647;
            }

            // Check fixed header values to make sure decryption worked
            if (data[0] != 0xeeeeeebe)
            {
                throw new InvalidDataException("Invalid metadata header");
            }

            StorageMetadata metadata = new StorageMetadata();

            metadata.StorageVersion = data[1];

            if (metadata.StorageVersion != STORAGE_VERSION_V1 && metadata.StorageVersion != STORAGE_VERSION_V1_1)
            {
                throw new InvalidDataException("Invalid or unsupported format in metadata header");
            }

            // Get SHA-256 hash from data
            var sha256 = BitConverter.ToString(data.Skip(6).Take(8).SelectMany(BitConverter.GetBytes).ToArray()).Replace("-", "");

            // Get encryption key for data
            var dataKey = data.Skip(2).Take(4).ToArray();

            metadata.Key = new ulong[] { ((ulong)dataKey[1] << 32) | dataKey[0], ((ulong)dataKey[3] << 32) | dataKey[2] };
            metadata.SHA256 = sha256;
            metadata.DecompressedSize = data[14];
            metadata.CompressedSize = data[15];
            metadata.ArchiveNumber = archiveNumber;

            if (data[16] != 0)
                metadata.ProfileHash = data[16];

            return metadata;
        }

        private static void ParseStorageFile(StorageMetadata metadata, Stream storageStream, ulong? profileKey = null)
        {
            byte[] data = null;
            using(BinaryReader reader = new BinaryReader(storageStream))
            {
                data = reader.ReadBytes((int)reader.BaseStream.Length);
            }

            var rawSha256 = new SHA256Managed().ComputeHash(data);
            var sha256 = BitConverter.ToString(rawSha256).Replace("-", "");
            if (sha256 != metadata.SHA256)
            {
                throw new InvalidDataException("Invalid storage file. Corrupt or wrong file?");
            }

            if (metadata.StorageVersion == STORAGE_VERSION_V1)
            {
                var key = GenerateKey(metadata, profileKey);
                var decryptedData = XXTEA.Decrypt(data, key);
                var output = Decompress(metadata, decryptedData);

                // Verify data
                SpookyHash sh = new SpookyHash(0x155af93ac304200, 0x8ac7230489e7ffff);
                sh.Update(new SHA256Managed().ComputeHash(output));
                sh.Update(output);

                ulong hash1, hash2;
                sh.Final(out hash1, out hash2);

                ulong orig_hash1 = metadata.Key[0];
                ulong orig_hash2 = metadata.Key[1];

                if (orig_hash1 != hash1 || orig_hash2 != hash2)
                {
                    throw new InvalidDataException("Invalid decrypted data. Wrong key?");
                }

                metadata.StorageRaw = output;
            }
            else
            {
                SpookyHash sh = new SpookyHash(0x155af93ac304200, 0x8ac7230489e7ffff);
                sh.Update(rawSha256);
                sh.Update(data);

                ulong hash1, hash2;
                sh.Final(out hash1, out hash2);

                ulong orig_hash1 = metadata.Key[0];
                ulong orig_hash2 = metadata.Key[1];

                if (orig_hash1 != hash1 || orig_hash2 != hash2)
                {
                    throw new InvalidDataException("Invalid decrypted data. Wrong key?");
                }

                metadata.StorageRaw = data;
            }
        }

        private static byte[] Decompress(StorageMetadata metadata, byte[] data)
        {
            List<byte> output = new List<byte>();

            int i = 0;
            int window = 0;
            while (i < metadata.CompressedSize)
            {
                var c = data[i++];

                for (int x = 1; x >= 0; x--)
                {
                    int size = ((c >> (0x04 * x)) & 0xf);

                    if (output.Count >= metadata.DecompressedSize)
                        break;

                    if (size == 0x0f)
                    {
                        do
                        {
                            size += data[i++];
                        } while (data[i - 1] == 0x0ff);
                    }

                    if (x == 1)
                    {

                        byte[] temp_data = new byte[size];
                        Array.Copy(data, i, temp_data, 0, size);
                        output.AddRange(temp_data);
                        i += size;

                        if (output.Count >= metadata.DecompressedSize)
                            break;

                        window = output.Count - BitConverter.ToUInt16(data, i);
                        i += 2;
                    }
                    else
                    {
                        size += 4;

                        byte[] temp_data = new byte[size];
                        int copySize = size > (output.Count - window) ? (output.Count - window) : size;

                        for (int idx = 0; idx < copySize; idx++)
                        {
                            temp_data[idx] = output[window + idx];
                        }

                        int remaining = size - copySize;
                        int offset = copySize;
                        while (remaining > 0)
                        {
                            copySize = remaining > offset ? offset : remaining;
                            Array.Copy(temp_data, 0, temp_data, offset, copySize);
                            remaining -= copySize;
                            offset += copySize;
                        }

                        output.AddRange(temp_data);
                    }
                }
            }

            return output.ToArray();
        }



        // Creation code
        public static void CreateMetadataFile(StorageMetadata metadata)
        {
            var sha256 = new SHA256Managed().ComputeHash(metadata.StorageRaw);

            // Murmurhash-like
            uint k1 = metadata.ArchiveNumber ^ 0x1422cb8c;
            uint h1 = RotateLeft(k1, 13) * 5 + 0xe6546b64;

            var input_key = Encoding.ASCII.GetBytes("NAESEVADNAYRTNRG");
            for (int i = 0; i < 4; i++)
            {
                input_key[i] = (byte)(h1 >> (i * 8));
            }

            List<uint> key = new List<uint>();
            for (int i = 0; i < input_key.Length; i += 4)
            {
                key.Add(BitConverter.ToUInt32(input_key, i));
            }

            var metadataBuffer = new byte[0x68];
            using (BinaryWriter writer = new BinaryWriter(new MemoryStream(metadataBuffer)))
            {
                writer.Write(0xeeeeeebe);
                writer.Write(metadata.StorageVersion);

                writer.Write(metadata.Key[0]);
                writer.Write(metadata.Key[1]);

                writer.Write(sha256);
                writer.Write(metadata.DecompressedSize);
                writer.Write(metadata.CompressedSize);

                if (metadata.ProfileHash.HasValue)
                    writer.Write(metadata.ProfileHash.Value);
            }
            
            List<uint> data = new List<uint>();
            using (BinaryReader reader = new BinaryReader(new MemoryStream(metadataBuffer)))
            {
                while (reader.BaseStream.Position < reader.BaseStream.Length)
                {
                    data.Add(reader.ReadUInt32());
                }
            }

            uint hash = 0;
            uint cur = 0;
            for (int itr1 = 0; itr1 < 8; itr1++)
            {
                hash += 0x9E3779B9;

                int key_idx = (int)((hash >> 2) & 3);

                int idx = 0;
                uint tmp = 0;
                for (int itr2 = 0; itr2 < 0x19; itr2++, idx++)
                {
                    tmp = ((data[idx + 1] >> 3) ^ (cur << 4)) + ((data[idx + 1] * 4) ^ (cur >> 5));
                    tmp ^= (cur ^ key[(itr2 & 3) ^ key_idx]) + (data[idx + 1] ^ hash);
                    data[idx] += tmp;
                    cur = data[idx];
                }

                tmp = ((data[0] >> 3) ^ (cur << 4)) + ((data[0] * 4) ^ (cur >> 5));
                tmp ^= (cur ^ key[key_idx ^ 1]) + (data[0] ^ hash);
                data[data.Count - 1] += tmp;
                cur = data[data.Count - 1];
            }

            metadata.MetadataRaw = data.SelectMany(BitConverter.GetBytes).ToArray();
        }

        public static StorageMetadata CreateStorageFile(Stream dataStream, uint archiveNumber, ulong? profileKey, bool encrypt)
        {
            StorageMetadata metadata = new StorageMetadata();
            metadata.ArchiveNumber = archiveNumber + 2;

            byte[] data = null;
            using (BinaryReader reader = new BinaryReader(dataStream))
            {
                data = reader.ReadBytes((int)reader.BaseStream.Length);
            }

            Array.Resize(ref data, data.Length + 1); // 1 byte null padding

            // Generate Spooky hash of data for later
            SpookyHash sh = new SpookyHash(0x155af93ac304200, 0x8ac7230489e7ffff);
            sh.Update(new SHA256Managed().ComputeHash(data));
            sh.Update(data);
            sh.Final(out metadata.Key[0], out metadata.Key[1]);

            if (encrypt)
            {
                var compressedData = Compress(data);
                var key = GenerateKey(metadata, profileKey, true);

                metadata.StorageRaw = XXTEA.Encrypt(compressedData, key);
                metadata.CompressedSize = (uint)compressedData.Length;
                metadata.DecompressedSize = (uint)data.Length;
                metadata.StorageVersion = STORAGE_VERSION_V1;
            }
            else
            {
                metadata.StorageRaw = data;
                metadata.CompressedSize = 0;
                metadata.DecompressedSize = 0;
                metadata.StorageVersion = STORAGE_VERSION_V1_1;
            }

            return metadata;
        }

        public static byte[] Compress(byte[] input)
        {
            List<byte> output = new List<byte>();
            List<byte> data = new List<byte>(input);

            int size = data.Count;

            int x = 0;
            if (size >= 0x0f)
                x = 0x0f;
            else
                x = size;

            output.Add((byte)(x << 4));

            for (int i = 0; i < (size - x) / 0xff; i++)
            {
                output.Add(0xff);
            }

            int remaining = size - x - (0xff * ((size - x) / 0xff));

            if (remaining > 0)
                output.Add((byte)remaining);

            output.AddRange(data);
            //output.AddRange(new byte[] { 0, 0 }); // Padding for window just in case

            return output.ToArray();
        }
    }
}
