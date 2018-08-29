const locationItemStyle = {
  padding: '0px 2px',
  margin: '0px 3px',
  background: 'rgba(23, 26, 22, 0.8)',
  fontSize: '16px'
};

const sortStoredByKeyMap = {
  created: 'Time',
  name: 'Name',
  description: 'Description',
  distanceToCenter: 'Distance To Center',
  galaxy: 'Galaxy',
  teleports: 'Popularity'
};

const defaultPosition = {
  playerPosition: [
    233.02163696289063,
    6774.24560546875,
    115.99118041992188,
    1
  ],
  playerTransform: [
    0.35815203189849854,
    0.82056683301925659,
    0.44541805982589722,
    1
  ],
  shipPosition: [
    234.85250854492188,
    6777.2685546875,
    121.86365509033203,
    1
  ],
  shipTransform: [
    -0.48167002201080322,
    -0.84464621543884277,
    -0.23359590768814087,
    1
  ],
};

const saveKeyMapping = {
  Version: 'F2P',
  GameKnowledgeData: 'VuQ',
  Waypoints: 'yRy',
  Address: '2Ak',
  GalaxyWaypointType: 'S8b',
  EventId: 'SSo',
  SpawnStateData: 'rnc',
  LastKnownPlayerState: 'jk4',
  PlayerStateData: '6f=',
  Platform: '8>q',
  UniverseAddress: 'yhJ',
  RealityIndex: 'Iis',
  GalacticAddress: 'oZw',
  VoxelX: 'dZj',
  VoxelY: 'IyE',
  VoxelZ: 'uXE',
  SolarSystemIndex: 'vby',
  PlanetIndex: 'jsv',
  PlayerPositionInSystem: 'mEH',
  PlayerTransformAt: 'l2U',
  ShipPositionInSystem: 'tnP',
  ShipTransformAt: 'l4H',
  FreighterPositionInSystem: 'NGn',
  FreighterTransformAt: 'uAt',
  FreighterTransformUp: '5Sg',
  PersistentPlayerBases: 'F?0',
  BaseVersion: 'h4X',
  Position: 'wMC',
  Forward: 'oHw',
  UserData: 'CVX',
  LastUpdateTimestamp: 'wx7',
  Objects: '@ZJ',
  Timestamp: 'b1:',
  ObjectID: 'r<7',
  Up: 'wJ0',
  At: 'aNu',
  Inventory: ';l5',
  Slots: ':No',
  Type: 'Vn8',
  InventoryType: 'elv',
  Id: 'b2n',
  Amount: '1o9',
  MaxAmount: 'F9q',
  DamageFactor: 'eVk',
  Index: '3ZH',
  X: '>Qh',
  Y: 'XJ>',
  Class: 'B@N',
  InventoryClass: '1o6',
  SubstanceMaxStorageMultiplier: '0H2',
  ProductMaxStorageMultiplier: 'cTY',
  BaseStatValues: 'bB',
  SpecialSlots: 'MMm',
  Width: '=Tb',
  Height: 'N9>',
  IsCool: 'iF:',
  KnownTech: '4kj',
  KnownProducts: 'eZ<',
  DiscoveryManagerData: 'fDu',
  'DiscoveryData-v1': 'ETO',
  ReserveStore: 'fgt',
  ReserveManaged: 'xxK',
  Store: 'OsQ',
  Record: '?fB',
  DD: '8P3',
  UA: '5L6',
  DT: '<Dn',
  VP: 'bEr',
  DM: 'q9a',
  OWS: 'ksu',
  LID: 'f5Q',
  UID: 'K7E',
  USN: 'V?:',
  TS: '3I1',
  RID: 'B2h',
  FL: '=wD',
  C: 'bLr'
};

module.exports = {locationItemStyle, sortStoredByKeyMap, defaultPosition, saveKeyMapping};