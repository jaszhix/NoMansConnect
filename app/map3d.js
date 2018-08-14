import React from 'react'
import * as THREE from 'three';
import {delay, isEqual} from 'lodash';
import state from './state';
import path from 'path'
import TWEEN from 'tween.js'
import v from 'vquery';
import RNG from './RNG';
import {cleanUp} from './utils';
import {each, find, findIndex, map, filter} from './lang';

function distanceVector (v1, v2) {
  var dx = v1.x - v2.x
  var dy = v1.y - v2.y
  var dz = v1.z - v2.z

  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

function findOffset (element) {
  var pos = {}
  pos.left = pos.top = 0
  if (element.offsetParent) {
    do {
      pos.left += element.offsetLeft
      pos.top += element.offsetTop
    } while (element = element.offsetParent)
  }
  return pos
}

function toScreenXY (position, camera, div) {
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

function toScreenPosition(obj, camera, controls, div){
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
class Map3D extends React.Component {
  constructor(props) {
    let threact = require('threact');
    WebGLRenderer = threact.WebGLRenderer;
    Mesh = threact.Mesh;
    SpotLight = threact.SpotLight;
    super(props);
    this.state = {
      locations: null
    };

    this.mounted = false;
    this.loader = new THREE.TextureLoader();
    let {modulePath} = window;
    if (process.env.NODE_ENV === 'development') {
      modulePath = '.';
    }
    this.starRed = this.loader.load(path.resolve(`${modulePath}/app/textures/star_red.jpg`));
    this.starOrange = this.loader.load(path.resolve(`${modulePath}/app/textures/star_orange.jpg`));
    this.starBlue = this.loader.load(path.resolve(`${modulePath}/app/textures/star_blue.jpg`));
    this.starGreen = this.loader.load(path.resolve(`${modulePath}/app/textures/star_green.jpg`));
    this.starPurple = this.loader.load(path.resolve(`${modulePath}/app/textures/star_purple.jpg`));

    this.sphere = new THREE.SphereGeometry(5, 9, 9);
    this.sphereVs = document.getElementById('surface-vertexShader').textContent;
    this.sphereFs = document.getElementById('surface-fragmentShader').textContent;

    let getMaterialProperties = (texture) => {
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
        flatShading: THREE.SmoothShading,
        side: THREE.FrontSide,
        transparent: true
      };
    };

    this.blueMaterial = new THREE.ShaderMaterial(getMaterialProperties(this.starBlue));
    this.blueMaterial.wrapS = this.blueMaterial.wrapT = THREE.RepeatWrapping;
    this.blueMaterial.minFilter = THREE.LinearFilter;
    this.orangeMaterial = new THREE.ShaderMaterial(getMaterialProperties(this.starOrange));
    this.greenMaterial = new THREE.ShaderMaterial(getMaterialProperties(this.starGreen));
    this.redMaterial = new THREE.ShaderMaterial(getMaterialProperties(this.starRed));
    this.purpleMaterial = new THREE.ShaderMaterial(getMaterialProperties(this.starPurple));
/*    this.skybox = [ // Threact bug TBD
      path.resolve('app/textures/s1.png'),
      path.resolve('app/textures/s2.png'),
      path.resolve('app/textures/s3.png'),
      path.resolve('app/textures/s4.png'),
      path.resolve('app/textures/s5.png'),
      path.resolve('app/textures/s6.png')
    ];*/
    this.connections = [
      state.connect(['remoteLocations', 'searchCache'], (partial) => this.updateLocations(partial)),
      state.connect({
        selectedLocation: () => this.selected = true,
        selectedGalaxy: () => this.galaxyChanged = true
      })
    ];
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
    console.log(this);
    if (!this.mounted) {
      delay(() => this.mounted = true, 3000);
    }
  }
  handleAnimation = (c, time) => {
    if (this.willUnmount) return;
    TWEEN.update(time)

    if (this.props.selectedLocation && this.selected) {
      this.selected = false;
      this.travelTo = {data: this.props.selectedLocation};
    }

    if (this.galaxyChanged) {
      this.galaxyChanged = false;
      each(this.scene.children, (child) => {
        if (child.type === 'Mesh' && child.name !== 'Center') {
          child.visible = child.userData.data.galaxy === state.selectedGalaxy;
          if (!child.visible && child.el) {
            child.el.remove();
            child.el = null;
          }
        }
      })
    }

    if (window.travelTo) {
      let coords = window.travelTo;
      let vector3 = new THREE.Vector3(...coords);
      if (!isEqual(vector3, this.lastTraveled)) {
        this.handleTravel(vector3);
      }
    }

    if (window.travelToCurrent) {
      window.travelToCurrent = null;
      let currentLocation = find(this.props.storedLocations, location => location.id === this.props.currentLocation);
      if (currentLocation) {
        if (state.selectedGalaxy !== currentLocation.galaxy) {
          state.set({selectedGalaxy: currentLocation.galaxy});
        }
        let refMesh = findIndex(this.scene.children, (child) => {
          return child.type === 'Mesh' && child.name !== 'Center' && child.userData.data.translatedId === currentLocation.translatedId;
        });
        if (refMesh > -1) {
          this.handleTravel(this.scene.children[refMesh].position);
        }
      }
    }

    if (this.travelTo) {
      let refMesh = findIndex(this.scene.children, (child) => {
        return child.type === 'Mesh' && child.name !== 'Center' && child.userData.data.translatedId === this.travelTo.data.translatedId;
      });
      this.travelTo = false;
      if (refMesh > -1 && !isEqual(this.scene.children[refMesh].position, this.lastTraveled)) {
        this.handleTravel(this.scene.children[refMesh].position);
      }
    }
  }
  handleTravel = (vector3) => {
    this.lastTraveled = vector3;
    const _this = this;

    let onComplete = function () {
      _this.controls.distance = 75;
      _this.controls.needsUpdate = true;

    }
    new TWEEN.Tween({x: _this.target.x, y: _this.target.y, z: _this.target.z})
      .to({ x: vector3.x, y: vector3.y, z: vector3.z }, 2200)
      .easing(TWEEN.Easing.Quadratic.In)
      .onUpdate(function () {
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

      state.set({selectedLocation: intersects[0].object.userData.data}, () => {
        if (intersects[0].object.userData.data
          && intersects[0].object.userData.data.translatedId !== this.props.selectedLocation.translatedId) {
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
      if (!intersects[0].object.el) {
        console.log(this.controls)
        let screen = toScreenPosition(intersects[0].object, this.camera, this.controls, this.renderer.domElement);
        let distanceBetweenMouseAndHoveredObject = distanceVector(new THREE.Vector3(screen.x, screen.y, 0.5), mouseCoords);
        if (distanceBetweenMouseAndHoveredObject <= 1319 && intersects[0].object.type === 'Mesh') {
          intersects[0].object.el = this.getHUDElement(intersects[0].object, {x: screen.x, y: screen.y});
          intersects[0].object.hovered = true;
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
    each(instance.userData.data.planetData, (array, key) => {
      planets += `<div style="border-bottom: 1px solid rgb(149, 34, 14);">${key}</div>`
      each(array, (planetLabel) => {
        planets += `<div class="planetLabel" style="cursor: pointer;">${planetLabel}</div>`;
      });
    });
    let el = v(
    `<div class="hud-element" id="${instance.uuid}" style="position: fixed; bottom: ${screen.y}px; left: ${screen.x}px; background-color: rgba(0, 0, 0, 0.5); color: #FFFFFF; text-shadow: 2px 2px #000000; -webkit-user-select: none; cursor: default;">
      ${planets}
    </div>`
    );
    el.css({
      padding: '4px 8px',
      borderTop: '2px solid rgb(149, 34, 14)',
      letterSpacing: '3px',
      fontSize: '16px',
    });
    each(el.find('.planetLabel').ns, (label) => {
      label.addEventListener('click', () => {
        if (!this.props) {
          return;
        }
        let refLocation = find(this.props.remoteLocations.results, (location) => {
          return location.name === label.innerText || location.data.id === label.innerText;
        });
        if (refLocation) {
          state.set({selectedLocation: refLocation.data});
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
  handleMeshMount = (c, location) => {

    c.instance.userData = location;

    let dupePositions = filter(c.scene.children, (child) => {
      return child.position.equals(c.instance.position);
    });

    let currentCentered = null;

    each(dupePositions, (child) => {
      let pos = ['x', 'y', 'z']

      if (!child.userData.data) {
        return;
      }

      each(pos, (key, i) => {
        let div = key === 'y' ? 1 : 2;
        let rng = new RNG((child.position[key] * child.userData.data.SolarSystemIndex) / div);
        let value = Math.ceil((rng.uniform() * child.userData.data.SolarSystemIndex) / div);
        let arg = rng.uniform() > 0.5;
        if (arg) {
          pos[key] = child.position[key] + value;
        } else {
          pos[key] = child.position[key] - value;
        }
      });

      child.position.copy(new THREE.Vector3(pos.x, pos.y, pos.z));

      if (child.userData.data.id === this.props.currentLocation && !this.mounted) {
        currentCentered = true;
        this.handleTravel(c.instance.position);
      }
    });

    if (location.data.id === this.props.currentLocation && !currentCentered && !this.mounted) {
      this.handleTravel(c.instance.position);
    }
  }
  handleMeshAnimation = (c, time) => {
    if (this.willUnmount || !c.instance.visible || c.instance.name === 'Center') {
      return;
    }
    let distance = distanceVector(c.camera.position, c.instance.position)
    if (distance > 2000) {
      if (c.material) {
        c.instance.material = this.blueMaterial;
      }
    } else {
      if (!c.material) {
        let refSelected = findIndex(this.props.storedLocations, (location) => {
          return c.instance.userData.data.id === location.id;
        });
        let refCurrent = findIndex(this.props.storedLocations, (location) => {
          return c.instance.userData.data.id === this.props.currentLocation;
        });
        if (refCurrent > -1) {
          c.material = this.orangeMaterial;
        } else if (c.instance.userData.data.upvote) {
          c.material = this.redMaterial;
        } else if (refSelected > -1) {
          c.material = this.greenMaterial;
        } else if (c.instance.userData.data.playerPosition
          || (c.instance.userData.data.positions
            && c.instance.userData.data.positions[0].playerPosition)
            && !c.instance.userData.data.manuallyEntered) {
          c.material = this.blueMaterial;
        } else {
          c.material = this.purpleMaterial;
        }
      }
      c.instance.material = c.material;
      c.instance.material.uniforms.time = { type: 'f', value: time }
    }
    if (distance < 76
      && this.props.selectedLocation
      && c.instance.userData.data.translatedId === this.props.selectedLocation.translatedId) {
      let screen = toScreenPosition(c.instance, c.camera, c.controls, this.renderer.domElement)
      let rect = this.renderer.domElement.getBoundingClientRect();
      if (screen.x < rect.left || screen.y + 250 < rect.left || screen.x < rect.top || screen.x - 50 > rect.bottom) {
        if (c.instance.el) {
          c.instance.el.remove();
          c.instance.el = null;
        }
        return;
      }

      if (!c.instance.el && c.instance.type === 'Mesh') {
          c.instance.el = this.getHUDElement(c.instance, screen);
          c.instance.el.insertAfter('#app');
      } else if (!c.instance.hovered) {
        c.instance.el.css({left: `${screen.x}px`, bottom: `${screen.y}px`})
      }
    } else {
      if (c.instance.el && !c.instance.hovered) {
        c.instance.el.remove();
        c.instance.el = null;
      }
    }
  }
  render() {
    if (this.state.locations) {
      return (
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
        camera={new THREE.PerspectiveCamera(85, this.props.size / this.props.size, 10, 100000)}
        scene={new THREE.Scene()}
        onMouseMove={this.handleMouseMove}
        onMouseDown={this.handleMouseDown}
        onMount={this.handleMount}
        onAnimate={this.handleAnimation}>
          <Mesh
          name="Center"
          geometry={new THREE.SphereGeometry( 20, 9, 9 )}
          material={this.redMaterial}
          position={[0, 2, 0]}
          onMount={(c) => {
            c.instance.parent.intensity / Math.pow( 0.02, 2.0 );
          }}
          onAnimate={(c) => {
            c.instance.rotation.x += 0.0002;
            c.instance.rotation.y += 0.0002;
          }}  />
          {map(this.state.locations, (location) => {
            let position = [location.data.VoxelX * 4, location.data.VoxelY * 174, location.data.VoxelZ * 4]
            return (
              <Mesh
              key={location.data.id}
              geometry={this.sphere}
              material={this.blueMaterial}
              position={position}
              onMount={(c) => this.handleMeshMount(c, location)}
              onAnimate={this.handleMeshAnimation} />
            )
          })}
          <SpotLight color={0xffffff} position={[0, 0, 0]} angle={Math.PI / 7} penumbra={0.8} />
        </WebGLRenderer>
      )
    } else {
      return null
    }
  }
}

export default Map3D;
