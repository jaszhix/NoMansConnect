import {cpus} from 'os';
import React from 'react';
import {render} from 'react-dom';
import state from './state';
import App from './app';
import konami from 'konami';
import './app.global.scss';

import jsonWorker from './json.worker';
import fsWorker from './fs.worker';
import ajaxWorker from './ajax.worker';
import mapWorker from './map.worker';
import map3DWorker from './map3d.worker';
import formatWorker from './format.worker';

window.jsonWorker = new jsonWorker();
window.settingsWorker = new jsonWorker();

let coreCount = Math.max(Math.ceil(cpus().length / 2), 2);
let count = coreCount;

while (count > 0) {
  window['fsWorker' + count] = new fsWorker();
  window['ajaxWorker' + count] = new ajaxWorker();
  window['mapWorker' + count] = new mapWorker();
  window['formatWorker' + count] = new formatWorker();
  count--;
}
window.coreCount = coreCount;
window.map3DWorker = new map3DWorker();

render(
  <App />,
  document.getElementById('app')
);

if (module.hot) {
  module.hot.accept('./app', () => {
    import('./app').then((NextApp) => {
      render(
        <NextApp.default />,
        document.getElementById('app')
      );
    });
  });
}

document.body.addEventListener('mousedown', function(e) {
  window.__mouseDown = e.buttons;
});

document.body.addEventListener('mouseup', function() {
  window.__mouseDown = 0;
});

new konami(() => state.set({displaySaveEditor: true}));
