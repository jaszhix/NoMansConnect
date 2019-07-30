import state from './state';
import React from 'react';
import {
  ScatterChart,
  Scatter, XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceArea,
  // types
  TickFormatterFunction,
  ScaleType,
  PolarRadiusAxisDomain
} from 'recharts';
import {delay, isEqual, last} from 'lodash';
import v from 'vquery';
import {BasicDropdown} from './dropdowns';
import Map3D from './map3d';
import {uuidV4, cleanUp} from './utils';
import {each, map} from './lang';

const toolTipHeaderStyle: CSSProperties = {
  padding: '3px 5px',
  fontWeight: 600,
  borderBottom: '1px solid rgb(149, 34, 14)'
};
const toolTipChildStyle: CSSProperties = {
  fontWeight: 500
}
const toolTipExploredStyle: CSSProperties = {
  padding: '0px 5px'
};
const toolTipContainerStyle: CSSProperties = {
  display: 'inline-table',
  textAlign: 'left',
  fontSize: '16px',
  borderTop: '2px solid rgb(149, 34, 14)',
  letterSpacing: '3px',
};
const nonSelectable = ['Center', 'Selected'];

let workerCount = 1;

const travelCurrentLocation = () => {
  window.travelToCurrent = true;
};

interface TooltipChildProps {
  active: boolean;
  isSelected: boolean;
  payload: any[];
}

class TooltipChild extends React.Component<TooltipChildProps> {
  constructor(props) {
    super(props);
  }
  componentWillReceiveProps() {
    cleanUp(this, true);
  }
  render() {
    if (this.props.active || this.props.isSelected) {
      return (
        <div className="ui segments" style={toolTipContainerStyle}>
          {this.props.payload[0].payload.user ?
          <div
          className="ui segment"
          style={toolTipHeaderStyle}>
            {`${this.props.payload[0].payload.user}`}
          </div> : null}
          {this.props.payload[0].payload.planetData ? map(this.props.payload[0].payload.planetData, (sector, i) => {
            if (!sector) return null;
            return (
              <div
              key={i}
              className="ui segment"
              style={toolTipHeaderStyle}>
                {sector.username}
                {map(sector.entries, (id, z) => {
                  return (
                    <div
                    style={toolTipChildStyle}
                    key={z}>
                      {id}
                    </div>
                  );
                })}
              </div>
            );
          }) : map(this.props.payload, (item, i) => {
            return (
              <div
              key={i}
              className="ui segment"
              style={toolTipExploredStyle}>
                {/*
                // @ts-ignore */}
                {`${item.name}: ${item.name === 'Z' ? (0, 4096) - item.value : item.value}`}
              </div>
            );
          })}
        </div>
      );
    }
    return null;
  }
};

interface MapCoordinate {
  x: number;
  y: number;
  z: number;
};

interface ThreeDimScatterChartProps {
  remoteLocations: APIResult;
  storedLocations: any[];
  selectedLocation: any;
  currentLocation: string;
  username: string;
  show: boolean;
  mapLines: boolean;
  init: boolean;
  size: number;
  selectedGalaxy: number;
  width: number;
  height: number;
  remoteLocationsColumns: number;
  onInit: () => void;
};

interface ThreeDimScatterChartState {
  currentLocation: string;
  locations: any[];
  remoteLocations: any[];
  selectedLocation: any;
  favLocations: any[];
  baseLocations: any[];
  ps4Locations: any[];
  center: MapCoordinate[];
  size: number;
  zRange: number[];
  ticks: number[];
  range: number[];
  xDomain: [PolarRadiusAxisDomain, PolarRadiusAxisDomain];
  yDomain: [PolarRadiusAxisDomain, PolarRadiusAxisDomain];
  zoom: number;
  zoomHistory: any[];
  startCoordinates: number[] | null;
  endCoordinates: number[] | null;
  scale: ScaleType;
  mapLines: boolean;
}

class ThreeDimScatterChart extends React.Component<ThreeDimScatterChartProps, ThreeDimScatterChartState> {
  legendStyle: CSSProperties;
  tooltipCursor: RechartsTooltipProps;
  chartMargin: RechartsMargin;
  xTickFormatter: TickFormatterFunction;
  yTickFormatter: TickFormatterFunction;
  allowZoom: boolean;
  dragCount: number;
  connections: any[];
  willUnmount: boolean;
  dragging: boolean;
  dragCancelled: boolean;
  lastMove: number;

  constructor(props) {
    super(props);
    this.state = {
      currentLocation: '',
      locations: [],
      remoteLocations: [],
      selectedLocation: null,
      favLocations: [],
      baseLocations: [],
      ps4Locations: [],
      center: [{
        x: 2048,
        y: 2048,
        z: 127
      }],
      size: 480,
      zRange: [14, 32],
      ticks: [0, 256, 512, 768, 1024, 1280, 1536, 1792, 2048, 2304, 2560, 2816, 3072, 3328, 3584, 3840, 4096],
      range: [0, 4096],
      xDomain: [0, 4096],
      yDomain: [0, 4096],
      zoom: 0,
      zoomHistory: [],
      startCoordinates: null,
      endCoordinates: null,
      scale: 'linear',
      mapLines: props.mapLines
    };
    if (process.env.NODE_ENV === 'development') {
      let originalSetState = this.setState;
      this.setState = function(obj, cb) {
        originalSetState.call(this, ...arguments);
      };
    }
    each(props.show, (legendItem, key) => {
      if (state.defaultLegendKeys.indexOf(key) > -1) {
        return;
      }
      this.state[legendItem.listKey] = [];
    });
    this.legendStyle = {
      fontSize: '16px',
      right: '0px'
    };
    this.tooltipCursor = {strokeDasharray: '3 3'};
    this.chartMargin = {
      top: 20,
      right: 20,
      bottom: 20
    };
    this.xTickFormatter = (e) => {
      if (!this.state.zoom) return '';
      return (e - 2047);
    };
    this.yTickFormatter = (e) => {
      if (!this.state.zoom) return '';
      return -(e - 2047);
    };
    this.allowZoom = true;
    this.dragCount = 0;
  }
  componentDidMount() {
    this.connections = [
      state.connect([
        'width',
        'height',
        'remoteLocationsColumns',
        'maximize'
      ], () => {
        if (this.willUnmount) return;
        this.handlePostMessageSize();
      }),
      state.connect([
        'selectedGalaxy',
        'storedLocations',
        'remoteLocations'
      ], () => {
        if (this.willUnmount) return;
        this.handlePostMessage()
      }),
      state.connect([
        'showOnlyNames',
        'showOnlyDesc',
        'showOnlyScreenshots',
        'showOnlyGalaxy',
        'showOnlyBases',
        'showOnlyPC',
        'showOnlyCompatible',
        'showOnlyFriends',
      ], () => {
        if (this.willUnmount) return;
        setTimeout(() => {
          this.handlePostMessage();
          this.handlePostMessageSize();
        }, 0);
      }),
      state.connect({
        selectedLocation: () => this.handlePostMessageSelect(),
        mapLines: () => {
          if (this.willUnmount) return;
          if (state.mapLines !== this.props.mapLines) {
            this.setState({mapLines: state.mapLines});
          }
        }
      })
    ];
    this.handlePostMessage();
    this.handlePostMessageSize();
  }
  componentWillUnmount() {
    this.willUnmount = true;
    each(this.connections, (connection) => {
      state.disconnect(connection);
    });
    cleanUp(this, true);
  }
  shouldComponentUpdate(nP, nS) {
    return isEqual(this.props, nP) || !isEqual(this.state, nS)
  }
  handlePostMessage = () => {
    if (this.dragging || this.willUnmount) return;
    if (!state.navLoad) {
      state.set({navLoad: true});
    }
    this.postMessage({
      selectOnly: false,
      p: {
        remoteLocations: this.props.remoteLocations,
        selectedLocation: state.selectedLocation,
        selectedGalaxy: state.selectedGalaxy,
        currentLocation: state.currentLocation,
        username: this.props.username,
        show: this.props.show,
        defaultLegendKeys: state.defaultLegendKeys
      },
      opts: {
        locations: true
      }
    });
  }
  handlePostMessageSize = () => {
    if (this.dragging || this.willUnmount) return;
    this.postMessage({
      selectOnly: false,
      p: {
        width: state.width,
        height: state.height,
        remoteLocationsColumns: state.remoteLocationsColumns,
        show: this.props.show,
        defaultLegendKeys: state.defaultLegendKeys
      },
      opts: {
        size: true
      }
    });
  }
  handlePostMessageSelect = () => {
    if (this.dragging || this.willUnmount) return;
    this.postMessage({
      p: {
        selectedLocation: state.selectedLocation,
        selectedGalaxy: state.selectedGalaxy,
        remoteLocations: this.props.remoteLocations,
        show: this.props.show,
        defaultLegendKeys: state.defaultLegendKeys
      },
      opts: {
        selectedLocation: true
      },
      s: this.state
    });
  }
  workerHandler = (e) => {
    if (this.willUnmount) return;
    let setState = (data) => {
      this.setState(data, () => {
        let stateUpdate = {navLoad: false};
        if (this.props.init) {
          let legendItemText = v('.recharts-legend-item-text');
          let legendItem = v('.recharts-legend-item');
          if (!legendItemText.n || !legendItem.n) {
            setTimeout(() => setState(data), 0);
            return;
          }
          legendItemText.css({position: 'relative', top: '3px'});
          each(this.props.show, (obj, key) => {
            legendItem.each(function(el){
              let _el = v(el);
              if (_el.text()[0] === key) {
                _el.addClass(key);
              }
            });
          });
          this.handleUpdateLegend();
          this.props.onInit();
        }
        stateUpdate.navLoad = false;
        if (e.data.fromSelected && e.data.fromSelected.globalState) {
          Object.assign(stateUpdate, e.data.fromSelected.globalState);
        }
        state.set(stateUpdate);
      });
    };
    if (e.data.fromSelected) {
      setState({selectedLocation: e.data.fromSelected.selectedLocation});
    } else {
      setState(e.data);
    }
  };
  postMessage = (obj, r = 0) => {
    if (workerCount > window.coreCount) {
      workerCount = 1;
    }
    let worker = `mapWorker${workerCount}`;
    if (window[worker].onmessage) {
      workerCount++;
      if (r > 0) {
        setTimeout(() => {
          if (!this.postMessage) return;
          this.postMessage(obj, 0);
        }, 50);
        return;
      }
      this.postMessage(obj, 1);
      return;
    }
    window[worker].onmessage = (e) => {
      window[worker].onmessage = null;
      if (this.willUnmount) return;
      this.workerHandler(e);
    };
    window[worker].postMessage(obj);
    workerCount++;
  }
  handleSelect = (symbol) => {
    let stateUpdate = {};
    let sector;
    let hexSector;
    let results = [];

    each(this.props.remoteLocations, (location, i) => {
      if (!location || !location.translatedId) {
        return;
      }
      sector = `${location.translatedX}:${location.translatedY}:${location.translatedZ}`;
      let hexArr = location.translatedId.split(':');
      hexArr.pop();
      hexSector = hexArr.join(':');
      if (sector === symbol.id) {
        results.push(location);
      }
    });
    let remoteLen = results.length;
    let multiSelectedLocation = remoteLen > 1;
    stateUpdate = {
      selectedLocation: results[0],
      multiSelectedLocation
    };
    if (multiSelectedLocation) {
      Object.assign(stateUpdate, {
        searchCache: {
          results: results,
          count: remoteLen,
        },
        searchInProgress: true,
        search: `Sector ${hexSector}`
      });
    } else if (state.searchInProgress) {
      state.trigger('handleClearSearch');
    }
    state.set(stateUpdate);
  }
  handleUpdateLegend = () => {
    each(this.props.show, (obj, name) => {
      v(`.${name}`).css({
        opacity: obj.value ? '1' : '0.5'
      });
    });
  }
  handleLegendClick = (e) => {
    this.props.show[e.payload.name].value = !this.props.show[e.payload.name].value;
    state.set({show: this.props.show, navLoad: true});
    if (e.payload.name === 'Center') {
      this.handlePostMessageSize();
    } else if (e.payload.name.indexOf('Selected') > -1) {
      this.handlePostMessageSelect();
    } else {
      this.handlePostMessage();
    }
    this.handleUpdateLegend();
  }
  handleMouseDown = (e) => {
    let {zoomHistory, zoom} = this.state;
    if (window.__mouseDown === 2) {
      this.dragCancelled = false;
      zoomHistory.pop();
      let [xDomain, yDomain] = zoomHistory.length > 0 ? last(zoomHistory) : [[0, 4096], [0, 4096]];
      this.setState({
        startCoordinates: null,
        endCoordinates: null,
        xDomain,
        yDomain,
        zoom: zoom <= 0 ? 0 : zoom - 1
      });
      return;
    }
    if (!e) return;

    let {xValue, yValue} = e;
    this.setState({startCoordinates: [xValue, yValue]});
  }
  handleMouseUp = () => {
    if (!this.allowZoom || window.__mouseDown === 2 || this.dragCount < 2) {
      this.dragCount = 0;
      this.setState({
        startCoordinates: null,
        endCoordinates: null
      });
      return;
    }

    let {zoom, xDomain, yDomain, range, ticks, startCoordinates, endCoordinates, zoomHistory} = this.state;
    if (!startCoordinates || !endCoordinates) return;

    ++zoom;
    range = [0, 4096 * zoom]

    xDomain = [startCoordinates[0], endCoordinates[0]]
    yDomain = [endCoordinates[1], startCoordinates[1]];
    startCoordinates = null;
    endCoordinates = null;
    zoomHistory.push([xDomain, yDomain])

    this.setState({xDomain, yDomain, zoom, zoomHistory, ticks, startCoordinates, endCoordinates, range}, () => {
      this.dragging = false;
      this.dragCount = 0;
    });
  }
  handleMouseMove = (e) => {
    if (!e || !this.state.startCoordinates || !window.__mouseDown) return;

    ++this.dragCount;

    let now = Date.now();
    if ((now - this.lastMove) < 60) return;
    this.lastMove = now;

    this.dragging = true;
    let {xValue, yValue} = e;
    this.setState({endCoordinates: [xValue, yValue]});
  }
  handleDotMouseEnter = () => {
    this.allowZoom = false;
  }
  handleDotMouseLeave = () => {
    this.allowZoom = true;
  }
  render = () => {
    const {
      size,
      scale,
      ticks,
      xDomain,
      yDomain,
      range,
      zRange,
      startCoordinates,
      endCoordinates,
      zoom,
      mapLines
    } = this.state
    const {show} = this.props;
    let isZoom = zoom > 0;
    let legends = [];
    each(show, (obj, label) => {
      legends.push(
        <Scatter
        key={label}
        name={label}
        data={this.state[obj.listKey]}
        fill={obj.color}
        shape="circle"
        line={label === 'Explored' ? mapLines : null}
        isAnimationActive={false}
        animationDuration={100}
        animationEasing="linear"
        onClick={nonSelectable.indexOf(label) === -1 ? this.handleSelect : null}
        onMouseEnter={this.handleDotMouseEnter}
        onMouseLeave={this.handleDotMouseLeave} />
      );
    });

    return (
      <ScatterChart
      width={size}
      height={size}
      margin={this.chartMargin}
      onMouseDown={this.handleMouseDown}
      onMouseMove={this.handleMouseMove}
      onMouseUp={this.handleMouseUp}>
        {/*
        // @ts-ignore */}
        <XAxis
        scale={scale}
        allowDataOverflow={isZoom}
        tickLine={isZoom}
        tickFormatter={this.xTickFormatter}
        ticks={ticks}
        domain={xDomain}
        type="number"
        dataKey="x"
        range={range}
        name="X"
        label="X" />
        {/*
        // @ts-ignore */}
        <YAxis
        scale={scale}
        allowDataOverflow={isZoom}
        tickLine={isZoom}
        tickFormatter={this.yTickFormatter}
        ticks={ticks}
        domain={yDomain}
        type="number"
        dataKey="y"
        range={range}
        name="Z"
        label="Z" />
        {/*
        // @ts-ignore */}
        <ZAxis allowDataOverflow={isZoom} dataKey="z" range={zRange} name="Y" />
        <CartesianGrid strokeDasharray={`${zoom} ${zoom}`} />
        {/*
        // @ts-ignore */}
        <Tooltip cursor={this.tooltipCursor} content={<TooltipChild />} selectedLocation={this.props.selectedLocation} />
        <Legend align="right" wrapperStyle={this.legendStyle} iconSize={12} onClick={this.handleLegendClick} />
        {map(legends, (l) => l)}
        {startCoordinates && endCoordinates ?
        <ReferenceArea
        y1={startCoordinates[1]}
        y2={endCoordinates[1]}
        x1={startCoordinates[0]}
        x2={endCoordinates[0]}
        stroke="#FFFFFF"
        strokeOpacity={0.3}
        strokeWidth={1}
        fill="#FFFFFF"
        fillOpacity={0.2} /> : null}
      </ScatterChart>
    );
  }
};

interface GalacticMapProps {
  remoteLocations: APIResult;
  storedLocations: any[];
  selectedLocation: any;
  currentLocation: string;
  username: string;
  searchCache: APIResult;
  galaxyOptions: any[];
  map3d: boolean;
  mapDrawDistance: boolean;
  mapLines: boolean;
  show: boolean;
  selectedGalaxy: number;
  width: number;
  height: number;
  remoteLocationsColumns: number;
  onSearch: () => void;
  onRestart: () => void;
};

interface GalacticMapState {
  init: boolean;
};

class GalacticMap extends React.Component<GalacticMapProps, GalacticMapState> {
  mapWrapper: CSSProperties;
  leftDropdownWrapper: CSSProperties;
  connections: any[];

  constructor(props) {
    super(props);
    this.state = {
      init: true
    };
    this.mapWrapper = {
      position: 'relative',
      left: '-18px'
    };
    this.leftDropdownWrapper = {
      position: 'absolute',
      right: this.props.map3d ? '38px' : '54px',
      top: '16px'
    };

  }
  componentDidMount() {
    state.set({navLoad: true});
    this.connections = [
      state.connect([
        'storedLocations',
        'remoteLocations',
        'selectedLocation',
        'showOnlyNames',
        'showOnlyDesc',
        'showOnlyScreenshots',
        'showOnlyGalaxy',
        'showOnlyBases',
        'showOnlyPC',
        'showOnlyCompatible',
        'showOnlyFriends',
      ], () => this.buildGalaxyOptions(false)),
      state.connect(['selectedGalaxy', 'selectedLocation'], () => {
        if (this.props.map3d) {
          this.travelToCenter();
        }
      })
    ];
  }
  componentWillUnmount() {
    each(this.connections, (connection) => {
      state.disconnect(connection);
    });
  }
  buildGalaxyOptions = (init, r = 0) => {
    if (workerCount > window.coreCount) {
      workerCount = 1;
    }
    let worker = `mapWorker${workerCount}`;
    if (window[worker].onmessage) {
      workerCount++;
      if (r > 0) {
        setTimeout(() => this.buildGalaxyOptions(init, 0), 50);
        return;
      }
      this.buildGalaxyOptions(init, 1);
      return;
    }
    window[worker].onmessage = (e) => {
      window[worker].onmessage = null;
      state.set(e.data.buildGalaxyOptions, () => {
        if (e.data.init) {
          travelCurrentLocation();
        }
      });
    }
    window[worker].postMessage({
      buildGalaxyOptions: {
        init,
        storedLocations: state.storedLocations,
        remoteLocations: state.remoteLocations,
        selectedLocation: state.selectedLocation,
        selectedGalaxy: state.selectedGalaxy,
        currentLocation: state.currentLocation,
        ps4User: state.ps4User,
        galaxies: state.galaxies
      }
    });
    workerCount++;
  }
  handleInit = () => {
    this.setState({init: false}, () => this.buildGalaxyOptions(true));
  }
  travelToCenter = () => {
    window.travelTo = [0, 2, 0];
  }
  travelToGalacticHub = () => {
    this.props.onSearch();
    window.travelTo = [-3474, 865, 5516];
  }
  travelToAGT = () => {
    this.props.onSearch();
    window.travelTo = [2934, 71, -5277];
  }
  travelToPilgrimStar = () => {
    this.props.onSearch();
    window.travelTo = [-1770, 492, -6420];
  }
  render() {
    let p = this.props;
    if (p.selectedGalaxy < 0) {
      return null;
    }
    let compact = p.width <= 1212 || p.height <= 850;
    let leftOptions = [
      {
        id: 'map3d',
        label: `3D Map (BETA): ${p.map3d ? 'On' : 'Off'}`,
        onClick: () => state.set({map3d: !p.map3d})
      }
    ];
    if (p.map3d) {
      leftOptions.push({
        id: 'mapDrawDistance',
        label: `Draw Distance: ${p.mapDrawDistance ? 'High' : 'Medium'}`,
        onClick: () => state.set({mapDrawDistance: !p.mapDrawDistance}, p.onRestart)
      });
      leftOptions.push({
        id: 'travelTo',
        label: `Go to Center`,
        onClick: this.travelToCenter
      });
      leftOptions.push({
        id: 'travelToCurrent',
        label: `Travel to Current Location`,
        onClick: travelCurrentLocation
      });
      leftOptions.push({
        id: 'travelTo',
        label: `Travel to Galactic Hub`,
        onClick: () => {
          state.set({
            selectedGalaxy: 0,
            search: '0469:0081:0D6D:0211'
          }, this.travelToGalacticHub);
        }
      });
      leftOptions.push({
        id: 'travelTo',
        label: `Travel to Pilgrim Star`,
        onClick: () => {
          state.set({
            selectedGalaxy: 0,
            search: '064A:0082:01B9:009A'
          }, this.travelToPilgrimStar);
        }
      });
      leftOptions.push({
        id: 'travelTo',
        label: `Travel to Alliance of Galactic Travellers HQ`,
        onClick: () => {
          state.set({
            selectedGalaxy: 0,
            search: '0B11:0081:02EB:01F2'
          }, this.travelToAGT);
        }
      });
    } else {
      leftOptions.push({
        id: 'mapLines',
        label: `Show Path: ${p.mapLines ? 'On' : 'Off'}`,
        onClick: () => state.set({mapLines: !p.mapLines})
      });
    }

    let remoteLocationsWidth;
    if (p.remoteLocationsColumns === 1) {
      remoteLocationsWidth = 441;
    } else if (p.remoteLocationsColumns === 2) {
      remoteLocationsWidth = 902;
    } else {
      remoteLocationsWidth = 1300;
    }

    let size = p.width - (remoteLocationsWidth + 438);
    let maxSize = p.height - 105;
    size = size > maxSize ? maxSize : size < 260 ? 260 : size;

    return (
      <div
      className="ui segment"
      style={{
        background: 'rgba(23, 26, 22, 0.9)',
        display: 'inline-table',
        borderTop: '2px solid #95220E',
        textAlign: 'center',
        position: 'absolute',
        top: '-11px',
        left: '15px',
        WebkitTransition: 'left 0.1s, background 0.1s, opacity 0.2s',
        zIndex: p.map3d ? 0 : 90,
        WebkitUserSelect: 'none',
        minWidth: '360px',
        minHeight: '360px',
        opacity: this.state.init && !p.map3d ? 0 : 1
      }}>
        <h3 style={{textAlign: compact ? 'left' : 'inherit'}}>Galactic Map</h3>
        {p.galaxyOptions.length > 0 ?
        <div style={this.leftDropdownWrapper}>
          <BasicDropdown
          height={p.height}
          options={p.galaxyOptions}
          selectedGalaxy={p.selectedGalaxy} />
        </div> : null}
        <div style={{
          position: 'absolute',
          left: compact ? 'initial' : p.map3d ? '16px' : '48px',
          right: compact ? '143px' : 'initial',
          top: '16px'
        }}>
          <BasicDropdown
          height={p.height}
          icon="ellipsis horizontal"
          showValue={null}
          persist={true}
          options={leftOptions} />
        </div>
        <div style={this.mapWrapper}>
          {p.map3d ?
          <Map3D
          size={size}
          selectedGalaxy={p.selectedGalaxy}
          storedLocations={p.storedLocations}
          remoteLocationsColumns={p.remoteLocationsColumns}
          remoteLocations={p.remoteLocations}
          selectedLocation={p.selectedLocation}
          searchCache={p.searchCache}
          currentLocation={p.currentLocation}
          mapDrawDistance={p.mapDrawDistance} />
          :
          <ThreeDimScatterChart
          size={size}
          mapLines={p.mapLines}
          show={p.show}
          selectedGalaxy={p.selectedGalaxy}
          storedLocations={p.storedLocations}
          width={p.width}
          height={p.height}
          remoteLocationsColumns={p.remoteLocationsColumns}
          remoteLocations={p.remoteLocations}
          selectedLocation={p.selectedLocation}
          currentLocation={p.currentLocation}
          username={p.username}
          init={this.state.init}
          onInit={this.handleInit} />}
        </div>
      </div>
    );
  }
};

export default GalacticMap;