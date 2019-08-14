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

  type Map3DCoordinates = [number, number, number] | boolean | any /* TODO */;

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
    dataId?: string;
  }

  interface NMSPosition {
    playerPosition: [number, number, number, number],
    playerTransform: [number, number, number, number],
    shipPosition: [number, number, number, number],
    shipTransform: [number, number, number, number]
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
    created: number;
    apiVersion: number;
  }
}