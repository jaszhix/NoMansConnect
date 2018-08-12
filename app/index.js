import React from 'react';
import { render } from 'react-dom';
import { AppContainer } from 'react-hot-loader';
import App from './app';
import konami from 'konami';
import './app.global.css';

render(
  <AppContainer>
    <App />
  </AppContainer>,
  document.getElementById('app')
);

if (module.hot) {
  module.hot.accept('./app', () => {
    const NextApp = require('./app').default;
    render(
      <AppContainer>
        <NextApp />
      </AppContainer>,
      document.getElementById('app')
    );
  });
}

document.body.addEventListener('mousedown', function(e) {
  window.__mouseDown = e.buttons;
});
document.body.addEventListener('mouseup', function() {
  window.__mouseDown = 0;
});
new konami(() => state.set({displaySaveEditor: true}));
