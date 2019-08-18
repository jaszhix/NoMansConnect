import * as CSS from 'csstype';
import * as Raven from 'raven-js';
import * as recharts from 'recharts';
import Json from '../../app/json';

declare global {
  type NumberOrString = number | string;

  interface State extends Object {
    get?: Function;
    set?: Function;
    exclude?: Function;
    trigger?: Function;
    connect?: Function;
    disconnect?: Function;
    destroy?: Function;
    [x: string]: any;
  }

  interface _Listener {
    keys: string[];
    id: number;
    callback: Function
  }

  //type State = _State;
  type Listener = _Listener;
  type DisconnectKey = string[] | number;

  type MatrixSide = [number, number, number];
  type Transform = [number, number, number, number];

  type Map3DCoordinates = MatrixSide | boolean | any /* TODO */;

  interface Window {
    state?: GlobalState;
    modulePath?: string;
    travelTo?: Map3DCoordinates;
    coreCount?: number;
    __mouseDown?: number;
    travelToCurrent?: boolean;
    jsonWorker: Worker;
    map3DWorker: Worker;
    settingsWorker: Worker;
    Raven: Raven.RavenStatic;
  }

  module NodeJS  {
    interface Global {
      Json: Json,
    }
  }

  interface NodeModule {
    hot?: any;
  }

  // @ts-ignore
  interface CSSProperties extends CSS.Properties {
    WebkitAppRegion?: string;
    position?: CSS.PositionProperty | '';
    zIndex?: CSS.ZIndexProperty | string;
  }

  interface RechartsTooltipProps extends recharts.TooltipProps {
    strokeDasharray?: string;
  }

  interface RechartsMargin {
    top?: number;
    right?: number;
    bottom?: number;
    left?: number;
  }

  interface NotificationInfo {
    message: string;
    type: string;
  }

  interface APIResult {
    results: any[];
    count: number;
    next: string | null;
    prev: string | null
  }

  interface LocationQueryParams {
    page?: number;
    page_size?: number;
    sort?: string;
    q?: string;
  }

  interface VisibleRange {
    start: number;
    length: number;
  }

  interface _GlobalState extends State {
    knownProducts?: string[];
    galaxies?: string[];
    defaultLegendKeys?: string[];
    completedMigration?: boolean;
    version?: string;
    notification?: NotificationInfo;
    newsId?: string;
    apiBase?: string;
    staticBase?: string;
    winVersion?: string;
    apiVersion?: number;
    machineId?: null;
    protected?: boolean;
    ready?: boolean;
    init?: true;
    homedir?: string;
    configDir?: string;
    width?: number;
    height?: number;
    tableData?: [];
    title?: string;
    installDirectory?: string | null;
    saveDirectory?: string | null;
    saveFileName?: string;
    saveVersion?: number | null;
    mode?: string;
    storedBases?: any[];
    storedLocations?: NMSLocation[];
    remoteLocations?: any[];
    remoteLength?: 0;
    remoteNext?: null;
    remoteChanged?: any[];
    currentLocation?: null;
    selectedLocation?: NMSLocation;
    multiSelectedLocation?: boolean;
    username?: string;
    profile?: null;
    displaySettings?: null;
    displayLog?: null;
    displayProfile?: null;
    displayFriendRequest?: null;
    displayBaseRestoration?: null;
    displaySaveEditor?: boolean;
    favorites?: any[];
    mods?: string[];
    selectedImage?: null;
    autoCapture?: boolean;
    autoCaptureSpaceStations?: boolean;
    backupSaveFile?: true;
    selectedGalaxy?: number;
    galaxyOptions?: any[];
    pollRate?: number;
    ps4User?: boolean;
    // UI
    updateAvailable?: boolean;
    view?: string;
    sort?: string;
    search?: string;
    searchInProgress?: boolean;
    searchCache?: APIResult;
    pagination?: boolean;
    page?: number;
    pageSize?: number;
    paginationEnabled?: true;
    loading?: string;
    maximized?: boolean;
    mapLines?: boolean;
    map3d?: boolean;
    mapDrawDistance?: boolean;
    wallpaper?: any;
    filterOthers?: boolean;
    useGAFormat?: boolean;
    usernameOverride?: boolean;
    registerLocation?: boolean;
    setEmail?: boolean;
    recoveryToken?: boolean;
    remoteLocationsColumns?: number;
    sortStoredByTime?: boolean;
    sortStoredByKey?: string;
    filterStoredByBase?: boolean;
    filterStoredByScreenshot?: boolean;
    showHidden?: boolean;
    showOnlyNames?: boolean;
    showOnlyDesc?: boolean;
    showOnlyScreenshots?: boolean;
    showOnlyGalaxy?: boolean;
    showOnlyBases?: boolean;
    showOnlyPC?: boolean;
    showOnlyCompatible?: boolean;
    showOnlyFriends?: boolean;
    sortByDistance?: boolean;
    sortByModded?: boolean;
    show?: object;
    compactRemote?: boolean;
    maintenanceTS?: number;
    offline?: boolean;
    error?: string;
    closing?: boolean;
    navLoad?: boolean;
    settingsKeys?: string[];
    _init?: Function;
    handleJsonWorker?: Function;
    handleSettingsWorker?: Function;
    handleMaintenance?: Function;
    handleState?: Function;
    displayErrorDialog?: Function;
    disconnectWindow?: Function;
    get?: Function;
    set?: Function;
    exclude?: Function;
    trigger?: Function;
    connect?: Function;
    disconnect?: Function;
    destroy?: Function;
  }

  type GlobalState = _GlobalState | State;

  interface GalacticAddress {
    VoxelX: number;
    VoxelY: number;
    VoxelZ: number;
    SolarSystemIndex: number;
    PlanetIndex: number;
    RealityIndex?: number;
    GalacticAddress?: GalacticAddress;
    dataId?: string;
  }

  interface NMSPosition {
    name?: string;
    image?: string;
    playerPosition: Transform,
    playerTransform: Transform,
    shipPosition: Transform,
    shipTransform: Transform
  }

  interface NMSLocation extends GalacticAddress {
    GalacticAddress?: GalacticAddress;
    RealityIndex?: number;
    translatedX?: number;
    translatedY?: number;
    translatedZ?: number;
    translatedId?: string;
    planetData?: any;
    username: string;
    positions: NMSPosition[];
    galaxy: number;
    distanceToCenter: number;
    base: boolean;
    baseData: any;
    upvote: boolean;
    image: string;
    mods: string[];
    manuallyEntered: boolean;
    created?: NumberOrString;
    modified?: NumberOrString;
    apiVersion: number;
  }

  interface DiscoveryRecord {
    DD: {
      DT: string;
      UA: NumberOrString;
      VP: [NumberOrString, NumberOrString]
    },
    DM: any;
    FL?: {
      C: number;
      tiH: number;
    },
    NMCID?: string; // mutated at runtime, not saved
    OWS: {
      D6b: string;
      LID: string;
      UID: string;
      USN: string;
      TS?: number;
    },
    RID?: string;
  }

  interface DiscoveryStore {
    Record: DiscoveryRecord[];
  }

  interface DiscoveryData {
    ReserveManaged: number;
    ReserveStore: number;
    Store: DiscoveryStore;
  }

  interface DiscoveryManagerData {
    'DiscoveryData-v1': any;
  }

  interface Waypoint {
    Address: GalacticAddress;
    EventId: string;
    Type: {
      GalaxyWaypointType: string;
    }
  }

  interface GameKnowledgeData {
    Waypoints: Waypoint[];
  }

  interface BaseObject {
    At: MatrixSide;
    GalacticAddress: NumberOrString;
    ObjectID: string;
    Position: MatrixSide;
    RegionSeed: NumberOrString;
    Timestamp: number;
    Up: MatrixSide;
    UserData: any;
  }

  // WIP
  interface PlayerStateData {
    ActiveSpaceBattleUA: number;
    AnomalyPositionOverride: Transform;
    AtlasStationAdressData: GalacticAddress[];
    BaseBuildingObjects: BaseObject[];
    BoltAmmo: number;
    CurrentFreighter: any;
    Energy: number;
    FirstAtlasStationDiscovered: boolean;
    FirstShipPosition: Transform;
    FirstSpawnPosition: Transform;
    FreighterInventory: any;
    FreighterInventory_TechOnly: any;
    FreighterLayout: any;
    FreighterMatrixAt: MatrixSide;
    FreighterMatrixPos: MatrixSide;
    FreighterMatrixUp: MatrixSide;
    FreighterUniverseAddress: GalacticAddress;
    GalacticMapRequests: boolean[];
    GameStartAddress1: GalacticAddress;
    GameStartAddress2: GalacticAddress;
    Hazard: number[];
    HazardTimeAlive: number;
    Health: number;
    InteractionProgressTable: string[];
    Inventory: any;
    IsNew: boolean;
    KnownPortalRunes: number;
    KnownProducts: string[];
    KnownTech: string[];
    LaserAmmo: number;
    LastPortal: any[];
    MaintenanceInteractions: any[];
    MarkerStack: any[];
    MiniStationUA: NumberOrString;
    MultiShipEnabled: boolean;
    NPCWorkers: any[];
    NewAtlasStationAdressData: GalacticAddress[];
    OnOtherSideOfPortal: boolean;
    PersistentPlayerBases: any[];
    PersonalMaintenanceInteractions: any[];
    PlanetPositions: MatrixSide[];
    PlanetSeeds: [boolean, NumberOrString][];
    PlayerFreighterName: string;
    PlayerWeaponName: string;
    PortalMarkerPosition_Local: Transform;
    PortalMarkerPosition_Offset: Transform;
    SavedInteractionDialogTable: any[];
    SavedInteractionIndicies: any[];
    ScatterAmmo: number;
    Shield: number;
    ShipHealth: number;
    ShipOwnership: any[];
    ShipShield: number;
    StartGameShipPosition: Transform;
    Stats: any[];
    StoredInteractions: any[];
    TelemetryStats: any[];
    TeleportEndpoints: any[];
    TerrainEditData: any;
    TimeAlive: number;
    TimeLastMiniStation: number;
    TimeLastSpaceBattle: number;
    TotalPlayTime: number;
    TradingSupplyData: any[];
    TradingSupplyDataIndex: number;
    Units: number;
    UniverseAddress: GalacticAddress;
    UsedEntitlements: any[];
    UsesThirdPersonCharacterCam: boolean;
    VisitedAtlasStationsData: GalacticAddress[];
    VisitedPortal: any;
    VisitedSystems: NumberOrString[];
    WarpsLastMiniStation: number;
    WarpsLastSpaceBattle: number;
    WeaponInventory: any;
  }

  interface SpawnStateData {
    FreighterPositionInSystem: Transform;
    FreighterTransformAt: Transform;
    FreighterTransformUp: Transform;
    LastKnownPlayerState: string;
    PlayerPositionInSystem: Transform;
    PlayerTransformAt: Transform;
    ShipPositionInSystem: Transform;
    ShipTransformAt: Transform;
  }

  interface SaveData {
    DiscoveryManagerData: DiscoveryManagerData;
    GameKnowledgeData: GameKnowledgeData;
    Platform: string;
    PlayerStateData: PlayerStateData;
    SpawnStateData: SpawnStateData;
    Version: number;
  }

  interface SaveDataMeta {
    fileName: string;
    int: number;
    mtime: Date;
    needsConversion: boolean;
    path: string;
    slot: number;
    result: SaveData;
  }
}
