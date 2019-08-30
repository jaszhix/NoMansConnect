import React, {Fragment} from 'react'
import * as THREE from 'three';
import {isEqual} from 'lodash';
import state from './state';
import path from 'path'
import TWEEN from 'tween.js'
import v from 'vquery';
import RNG from './RNG';
import {cleanUp, convertRange} from './utils';
import {each, find, findIndex, map, filter} from '@jaszhix/utils';

interface Position {
  top?: number;
  left?: number;
  x?: number;
  y?: number;
}

function distanceVector (v1: THREE.Vector3, v2: THREE.Vector3): number {
  var dx = v1.x - v2.x
  var dy = v1.y - v2.y
  var dz = v1.z - v2.z

  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

function findOffset (element: HTMLElement): Position {
  const pos: Position = {};
  pos.left = pos.top = 0
  if (element.offsetParent) {
    do {
      pos.left += element.offsetLeft
      pos.top += element.offsetTop
    // @ts-ignore
    } while (element = element.offsetParent)
  }
  return pos
}

function toScreenXY (position: THREE.Vector3, camera, div) {
  let posX = position.clone()
  let projScreenMatX = new THREE.Matrix4()
  projScreenMatX.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
  posX.applyMatrix4(projScreenMatX)
  let posY = position.clone()
  let projScreenMatY = new THREE.Matrix4()
  projScreenMatY.multiplyMatrices(camera.projectionMatrix, camera.matrixWorld)
  posY.applyMatrix4(projScreenMatY)

  let offset = findOffset(div)

  return { x: (posX.x + 1) * div.width / 2 + offset.left,
    y: (-posY.y + 1) * div.height / 2 + offset.top }
}

function toScreenPosition(obj: THREE.Object3D, camera, controls, div){
  obj.updateMatrixWorld();
  let vector = obj.position.clone();

  vector.setFromMatrixPosition(obj.matrixWorld);
  vector.project(camera);

  var m = obj.matrixWorld.elements;
  var w = m[3] * vector.x + m[7] * vector.y + m[11] * vector.z + m[15]; // required for perspective divide
  vector.applyMatrix4(camera.projectionMatrix);
  if (w!==0){ // do perspective divide and NDC -> screen conversion
      var invW = 1.0/w;
      vector.x = (vector.x*invW + 1) / 2 * window.innerWidth;
      vector.y = (1-vector.y*invW) / 2 * window.innerHeight - vector.y; // screen space Y goes from top to bottom
      vector.z *= invW;
  }

  let x = toScreenXY(obj.position, camera, div);
  let result = {x: x.x, y: vector.y};
  if (result.x > window.innerWidth - 200) {
    result.x = window.innerWidth - (controls.distance / 5);
  } else if (result.x < 0) {
    result.x = 200;
  } else if (result.y > window.innerHeight - 200) {
    result.y = window.innerHeight - (controls.distance / 5);
  } else if (result.y < 0) {
    result.y = 200;
  }
  return result;
}
let WebGLRenderer = null;
let Mesh = null;
let SpotLight = null;

interface Map3DProps {
  remoteLocations: APIResult;
  storedLocations: any[];
  selectedLocation: any;
  currentLocation: string;
  remoteLocationsColumns: number;
  selectedGalaxy: number;
  size: number;
  mapDrawDistance: boolean;
  mapLODFar: boolean;
  mapSkyBox: boolean;
  searchCache: APIResult;
}

interface Map3DState {
  locations: any[];
  ready: boolean;
}

class Map3D extends React.Component<Map3DProps, Map3DState> {
  mounted: boolean;
  needsUpdate: boolean;
  loader: THREE.TextureLoader;
  starRed: any;
  starWhite: any;
  starOrange: any;
  starBlue: any;
  starDarkBlue: any;
  starGreen: any;
  starLightGreen: any;
  starPurple: any;
  sphere: THREE.SphereGeometry;
  sphereVs: string;
  sphereFs: string;
  skyBox: string[];
  blueMaterial: THREE.ShaderMaterial;
  darkBlueMaterial: THREE.ShaderMaterial;
  whiteMaterial: THREE.ShaderMaterial;
  orangeMaterial: THREE.ShaderMaterial;
  greenMaterial: THREE.ShaderMaterial;
  lightGreenMaterial: THREE.ShaderMaterial;
  redMaterial: THREE.ShaderMaterial;
  purpleMaterial: THREE.ShaderMaterial;
  connections: any[];
  selected: boolean;
  galaxyChanged: boolean;
  willUnmount: any;
  lights: number;
  hovered: string;
  renderer: any;
  scene: any;
  camera: any;
  controls: any;
  target: any;
  anisotropy: any;
  raycaster: THREE.Raycaster;
  mouse: THREE.Vector3;
  lastTraveled: THREE.Vector3;
  skipTravel: boolean;
  travelTo: Map3DCoordinates;

  constructor(props) {
    super(props);

    this.state = {
      locations: null,
      ready: false,
    };

    import(/* webpackChunkName: "threact" */ 'threact').then((threact) => {
      WebGLRenderer = threact.WebGLRenderer;
      Mesh = threact.Mesh;
      SpotLight = threact.SpotLight;

      this.mounted = false;

      this.loader = new THREE.TextureLoader();
      let {modulePath} = window;

      if (process.env.NODE_ENV === 'development') {
        modulePath = '.';
      }

      this.starRed = this.loader.load(path.resolve(`${modulePath}/app/textures/star_red.jpg`));
      this.starWhite = this.loader.load(path.resolve(`${modulePath}/app/textures/star_white.jpg`));
      this.starOrange = this.loader.load(path.resolve(`${modulePath}/app/textures/star_orange.jpg`));
      this.starBlue = this.loader.load(path.resolve(`${modulePath}/app/textures/star_blue.jpg`));
      this.starDarkBlue = this.loader.load(path.resolve(`${modulePath}/app/textures/star_darkBlue.jpg`));
      this.starGreen = this.loader.load(path.resolve(`${modulePath}/app/textures/star_green.jpg`));
      this.starLightGreen = this.loader.load(path.resolve(`${modulePath}/app/textures/star_lightGreen.jpg`));
      this.starPurple = this.loader.load(path.resolve(`${modulePath}/app/textures/star_purple.jpg`));

      this.sphere = new THREE.SphereGeometry(5, 9, 9);

      this.sphereVs = document.getElementById('surface-vertexShader').textContent;
      this.sphereFs = document.getElementById('surface-fragmentShader').textContent;

      let getMaterialProperties = (texture): THREE.ShaderMaterialParameters => {
        return {
          uniforms: {
            texture1: {type: 't', value: texture},
            sunVectorDelta: { type: 'f', value: 0},
            sunFragmentDelta: {type: 'f', value: -0.7},
            textureColor:   { type: "t", value: texture },
              textureSpectral: { type: "t", value: texture },
              time: { type: 'f', value: 0 },
              spectralLookup: { type: "f", value: texture },
          },
          vertexShader: this.sphereVs,
          fragmentShader: this.sphereFs,
          flatShading: true, // TBD: THREE.SmoothShading,
          side: THREE.FrontSide,
          transparent: true
        };
      };

      this.blueMaterial = new THREE.ShaderMaterial(getMaterialProperties(this.starBlue));
      this.darkBlueMaterial = new THREE.ShaderMaterial(getMaterialProperties(this.starDarkBlue));
      this.whiteMaterial = new THREE.ShaderMaterial(getMaterialProperties(this.starWhite));
      this.orangeMaterial = new THREE.ShaderMaterial(getMaterialProperties(this.starOrange));
      this.greenMaterial = new THREE.ShaderMaterial(getMaterialProperties(this.starGreen));
      this.lightGreenMaterial = new THREE.ShaderMaterial(getMaterialProperties(this.starLightGreen));
      this.redMaterial = new THREE.ShaderMaterial(getMaterialProperties(this.starRed));
      this.purpleMaterial = new THREE.ShaderMaterial(getMaterialProperties(this.starPurple));

      this.skyBox = [
        path.resolve('app/textures/s1.png'),
        path.resolve('app/textures/s2.png'),
        path.resolve('app/textures/s3.png'),
        path.resolve('app/textures/s4.png'),
        path.resolve('app/textures/s5.png'),
        path.resolve('app/textures/s6.png')
      ];

      this.camera = new THREE.PerspectiveCamera(85, 1, 10, 100000);
      this.scene = new THREE.Scene();

      this.connections = [
        state.connect(['remoteLocations', 'searchCache'], (partial) => this.updateLocations(partial)),
        state.connect({
          selectedLocation: ({selectedLocation}) => {
            this.setNeedsUpdate();

            if (!selectedLocation) return;

            this.selected = true;
          },
          selectedGalaxy: () => this.galaxyChanged = true,
          currentLocation: () => {
            this.setNeedsUpdate();

            if (state.selectedLocation) return;

            window.travelToCurrent = true
          },
          mapLODFar: () => this.setNeedsUpdate()
        })
      ];

      this.setState({ready: true});
    });
  }

  setNeedsUpdate() {
    this.needsUpdate = true;

    setTimeout(() => this.needsUpdate = false, 1000);
  }

  componentDidMount() {
    window.map3DWorker.onmessage = (e) => {
      if (this.willUnmount) return;
      this.setState({locations: e.data.locations});
    };
    this.updateLocations(this.props, true);

    this.lights = 0;
    this.hovered = '';
  }
  componentWillUnmount() {
    this.willUnmount = true;

    each(this.connections, (connection) => {
      state.disconnect(connection);
    });

    this.clearHUDElements();

    cleanUp(this);
  }
  updateLocations = (partial, init = false) => {
    if (!init && partial.searchCache && partial.searchCache.results.length === 0) {
      return;
    }
    window.map3DWorker.postMessage({
      props: {
        searchCache: state.searchCache,
        storedLocations: state.storedLocations,
        remoteLocations: state.remoteLocations
      }
    });
  }
  handleMount = (c) => {
    console.log('Renderer: ', c)
    c.camera.position.z = 50;
    this.renderer = c.instance;
    this.scene = c.scene;
    this.camera = c.camera;
    this.controls = c.controls;
    this.controls.distanceBounds = [1, 100000];
    this.controls.damping = 0.5;
    this.target = c.target;
    this.anisotropy = c.anisotropy;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector3();

    if (!this.mounted) {
      setTimeout(() => this.mounted = true, 3000);
    }
  }
  handleAnimation = (c, time) => {
    if (this.willUnmount) return;

    TWEEN.update(time);

    if (this.props.selectedLocation && this.selected) {
      this.selected = false;
      this.travelTo = this.props.selectedLocation;
    }

    if (this.galaxyChanged) {
      this.galaxyChanged = false;
      each(this.scene.children, (child) => {
        if (child.type === 'Mesh' && child.name !== 'Center') {
          child.visible = child.userData.galaxy === state.selectedGalaxy;
          if (!child.visible && child.el) {
            child.el.remove();
            child.el = null;
          }
        }
      })
    }

    if (window.travelTo) {
      let coords = window.travelTo;
      // @ts-ignore
      let vector3 = new THREE.Vector3(...coords);
      if (!isEqual(vector3, this.lastTraveled)) {
        this.handleTravel(vector3);
      }
    }

    if (window.travelToCurrent) {
      window.travelToCurrent = null;
      let currentLocation = find(this.props.storedLocations, location => location.dataId === this.props.currentLocation);
      if (currentLocation) {
        if (state.selectedGalaxy !== currentLocation.galaxy) {
          state.set({selectedGalaxy: currentLocation.galaxy});
        }
        let refMesh = findIndex(this.scene.children, (child) => {
          return child.type === 'Mesh' && child.name !== 'Center' && child.userData.translatedId === currentLocation.translatedId;
        });
        if (refMesh > -1) {
          this.handleTravel(this.scene.children[refMesh].position);
        }
      }
    }

    if (this.travelTo) {
      let refMesh = findIndex(this.scene.children, (child) => {
        return child.type === 'Mesh' && child.name !== 'Center' && child.userData.translatedId === this.travelTo.translatedId;
      });
      this.travelTo = false;
      if (refMesh > -1 && !isEqual(this.scene.children[refMesh].position, this.lastTraveled)) {
        this.handleTravel(this.scene.children[refMesh].position);
      }
    }

    document.getElementById('arrow').style.transform = `rotate(${this.controls.theta - 0.79}rad)`;
  }
  handleTravel = (vector3: THREE.Vector3) => {
    if (isEqual(this.lastTraveled, vector3)) {
      this.skipTravel = true;
    }

    this.lastTraveled = vector3;
    const _this = this;

    if (this.skipTravel) {
      setTimeout(() => this.skipTravel = false, 1000);
      return;
    }

    let onComplete = function () {
      if (!_this.controls) return;
      _this.controls.distance = 75;
      _this.controls.needsUpdate = true;
    }
    new TWEEN.Tween({x: _this.target.x, y: _this.target.y, z: _this.target.z})
      .to({ x: vector3.x, y: vector3.y, z: vector3.z }, 2200)
      .easing(TWEEN.Easing.Quadratic.In)
      .onUpdate(function () {
        if (!_this.controls) return;

        let tween = new THREE.Vector3(this.x, this.y, this.z);
        _this.controls.needsUpdate = false;
        _this.camera.position.copy(tween);

        _this.target.copy(tween);
        _this.controls.target[0] = tween.x;
        _this.controls.target[1] = tween.y;
        _this.controls.target[2] = tween.z;
        _this.camera.lookAt(vector3);
        _this.controls.position[0] = _this.camera.position.x;
        _this.controls.position[1] = _this.camera.position.y;
        _this.controls.position[2] = _this.camera.position.z;
        _this.controls.up[0] = _this.camera.up.x;
        _this.controls.up[1] = _this.camera.up.y;
        _this.controls.up[2] = _this.camera.up.z;
        _this.controls.update();
        _this.camera.updateProjectionMatrix();
        _this.camera.updateMatrixWorld();
      })
      .onComplete(onComplete)
      .start();
      if (window.travelTo) {
        window.travelTo = null;
      }
  }
  handleMouseDown = (e) => {
    e.preventDefault()

    let rect = this.renderer.domElement.getBoundingClientRect();
    let x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    let y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    let mouseCoords = new THREE.Vector3(x, y, 0.5);

    this.raycaster.setFromCamera(mouseCoords, this.camera);

    var intersects = this.raycaster.intersectObjects(this.scene.children, true);
    console.log(intersects, this.scene.children);
    if (intersects.length > 0 && intersects[0].object.name !== 'Center' && intersects[0].object.userData) {
      if (!intersects[0].object.visible) {
        return;
      }

      state.set({selectedLocation: intersects[0].object.userData}, () => {
        if (intersects[0].object.userData
          && intersects[0].object.userData.translatedId !== this.props.selectedLocation.translatedId) {
          this.handleTravel(intersects[0].object.position);
        }
      });
    }
  }
  handleMouseMove = (e) => {
    e.preventDefault()
    let rect = this.renderer.domElement.getBoundingClientRect();
    let x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    let y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    let mouseCoords = new THREE.Vector3(x, y, 0.5);

    this.raycaster.setFromCamera(mouseCoords, this.camera);

    var intersects = this.raycaster.intersectObjects(this.scene.children, true);

    let removeHovered = () => {
      let refInstance = findIndex(this.scene.children, child => child.uuid === this.hovered);
      if (refInstance > -1 && this.scene.children[refInstance]) {
        let el = v(`#${this.hovered}`);
        if (el) {
          this.hovered = null;
          this.scene.children[refInstance].hovered = false;
        }
      }
    };

    if (intersects.length > 0 && intersects[0].object.userData && intersects[0].object.name !== 'Center') {
      if (!intersects[0].object.visible) {
        return;
      }
      // @ts-ignore
      if (!intersects[0].object.el) {
        console.log(this.controls)
        let screen = toScreenPosition(intersects[0].object, this.camera, this.controls, this.renderer.domElement);
        let distanceBetweenMouseAndHoveredObject = distanceVector(new THREE.Vector3(screen.x, screen.y, 0.5), mouseCoords);
        if (distanceBetweenMouseAndHoveredObject <= 1319 && intersects[0].object.type === 'Mesh') {
          // @ts-ignore
          intersects[0].object.el = this.getHUDElement(intersects[0].object, {x: screen.x, y: screen.y});
          // @ts-ignore
          intersects[0].object.hovered = true;
          // @ts-ignore
          intersects[0].object.el.insertAfter('#app');
          removeHovered();
          this.hovered = intersects[0].object.uuid;
        }
      }
    } else if (this.hovered) {
      removeHovered();
    }
  }
  getHUDElement = (instance, screen) => {
    let planets = '';
    each(instance.userData.planetData, (array, key) => {
      planets += `<div class="Map3D__hudUser">${key}</div>`
      each(array, (planetLabel) => {
        planets += `<div class="planetLabel cursorPointer">${planetLabel}</div>`;
      });
    });
    let el = v(
    `<div class="Map3D__hudElement" id="${instance.uuid}" style="position: fixed; bottom: ${screen.y}px; left: ${screen.x}px;">
      ${planets}
    </div>`
    );
    each(el.find('.planetLabel').ns, (label) => {
      label.addEventListener('click', () => {
        if (this.willUnmount
          || !state.remoteLocations
          || !state.remoteLocations.results) {
          return;
        }

        let refLocation = find(state.remoteLocations.results, (location) => {
          return location.name === label.innerText || location.dataId === label.innerText;
        });
        if (refLocation) {
          this.skipTravel = true;
          state.set({selectedLocation: refLocation});
        }
      });
      label.addEventListener('mouseenter', () => {
        label.style.fontWeight = '600';
      });
      label.addEventListener('mouseleave', () => {
        label.style.fontWeight = 'inherit';
      });
    })
    return el;
  }
  clearHUDElements = () => {
    let labels = v('.Map3D__hudElement');

    if (labels.length) labels.remove();
  }
  handleMeshMount = (c, location) => {
    c.instance.userData = location;

    let dupePositions = filter(c.scene.children, (child) => {
      return child.position.equals(c.instance.position);
    });

    let currentCentered = null;

    each(dupePositions, (child) => {
      let pos: [string|number, string|number, string|number] = ['x', 'y', 'z']

      if (!child.userData) {
        return;
      }

      each(pos, (key, i) => {
        let div = key === 'y' ? 1 : 2;
        let rng = new RNG((child.position[key] * child.userData.SolarSystemIndex) / div);
        let value = Math.ceil((rng.uniform() * child.userData.SolarSystemIndex) / div);
        let arg = rng.uniform() > 0.5;
        if (arg) {
          pos[key] = child.position[key] + value;
        } else {
          pos[key] = child.position[key] - value;
        }
      });
      // @ts-ignore
      child.position.copy(new THREE.Vector3(pos.x, pos.y, pos.z));

      if (child.userData.dataId === this.props.currentLocation && !this.mounted) {
        currentCentered = true;
        this.handleTravel(c.instance.position);
      }
    });

    if (location.dataId === this.props.currentLocation && !currentCentered && !this.mounted) {
      this.handleTravel(c.instance.position);
    }
  }
  handleMeshAnimation = (c, time) => {
    if (this.willUnmount || !c.instance.visible || c.instance.name === 'Center') {
      return;
    }

    const {mapLODFar, storedLocations, currentLocation, selectedLocation} = this.props;
    const {instance, camera, controls} = c;
    const distance = distanceVector(camera.position, instance.position);
    const {userData} = instance;
    const isSelected = selectedLocation && userData.translatedId === selectedLocation.translatedId;
    const isCurrent = userData.dataId === currentLocation;

    // Make the stars larger the further away from the camera they are.
    // This makes it so they are always visible from any distance.
    instance.scale.x = instance.scale.y = instance.scale.z = convertRange(distance, [0, 19000], [1, 10]);

    switch (true) {
      case (!mapLODFar && distance > 2000):
        c.instance.material = this.blueMaterial;
        break;
      default:
        if (!c.material || this.needsUpdate || c.distance !== distance) {
          if (isSelected) {
            c.material = this.orangeMaterial;
          } else if (isCurrent) {
            c.material = this.whiteMaterial;
          } else if (userData.upvote) {
            c.material = this.purpleMaterial;
          } else if (state.profile
            && findIndex(state.profile.friends, (friend) => friend.username === userData.username) > -1) {
            c.material = this.lightGreenMaterial;
          } else if (findIndex(storedLocations, (location) => location.dataId === userData.dataId) > -1) {
            c.material = this.greenMaterial;
          } else if (userData.manuallyEntered) {
            c.material = this.darkBlueMaterial;
          } else {
            c.material = this.blueMaterial;
          }

          c.instance.material = c.material;
        }
    }

    c.instance.material.uniforms.time = {type: 'f', value: time};
    c.distance = distance;

    if (distance < 100 && isSelected) {
      let screen = toScreenPosition(instance, camera, controls, this.renderer.domElement)
      let rect = this.renderer.domElement.getBoundingClientRect();

      if (screen.x < rect.left || screen.y + 250 < rect.left || screen.x < rect.top || screen.x - 50 > rect.bottom) {
        if (instance.el) {
          instance.el.remove();
          instance.el = null;
        }
        return;
      }

      if (!instance.el && instance.type === 'Mesh') {
          instance.el = this.getHUDElement(c.instance, screen);
          instance.el.insertAfter('#app');
      } else if (!c.instance.hovered) {
        instance.el.css({left: `${screen.x}px`, bottom: `${screen.y}px`})
      }
    } else {
      if (instance.el && !instance.hovered) {
        instance.el.remove();
        instance.el = null;
      }
    }
  }
  render() {
    const {locations, ready} = this.state;

    if (!locations || !locations.length || !ready) return null;

    return (
      <Fragment>
        <WebGLRenderer
        style={{position: 'relative', left: '18px'}}
        deferred={this.props.mapDrawDistance}
        alpha={false}
        antialias={true}
        stats={process.env.NODE_ENV === 'development' ? 0 : null}
        bgColor={0x00a1ff}
        setPixelRatio={window.devicePixelRatio}
        width={this.props.size}
        height={this.props.size}
        setSize={[this.props.size, this.props.size]}
        logarithmicDepthBuffer={false}
        camera={this.camera}
        scene={this.scene}
        skybox={this.props.mapSkyBox ? this.skyBox : null}
        onMouseMove={this.handleMouseMove}
        onMouseDown={this.handleMouseDown}
        onMount={this.handleMount}
        onAnimate={this.handleAnimation}>
          <Mesh
          name="Center"
          geometry={new THREE.SphereGeometry(20, 9, 9)}
          material={this.redMaterial}
          position={[0, 2, 0]}
          onMount={(c) => {
            c.instance.parent.intensity / Math.pow(0.02, 2.0);
          }}
          onAnimate={(c) => {
            c.instance.rotation.x += 0.0002;
            c.instance.rotation.y += 0.0002;
          }}  />
          {map(this.state.locations, (location) => {
            let position = [location.VoxelX * 4, location.VoxelY * 174, location.VoxelZ * 4];

            return (
              <Mesh
              key={location.dataId}
              geometry={this.sphere}
              material={this.blueMaterial}
              position={position}
              onMount={(c) => this.handleMeshMount(c, location)}
              onAnimate={this.handleMeshAnimation} />
            )
          })}
          <SpotLight color={0xffffff} position={[0, 0, 0]} angle={Math.PI / 7} penumbra={0.8} />
        </WebGLRenderer>
        <i id="arrow" className="Map3D__arrow location arrow icon" />
      </Fragment>
    )
  }
}

export default Map3D;
