Array.prototype.forEach = function (cb, _this) {
  _this = _this ? _this : this;
  let len = this.length;
  for (let i = 0; i < len; i++) {
    cb.apply(_this, [this[i], i, this]);
  }
};
import React from 'react';
import { render } from 'react-dom';
import { AppContainer } from 'react-hot-loader';
import App from './app';
import './app.global.css';

render(
  <AppContainer>
    <App />
  </AppContainer>,
  document.getElementById('app')
);

if (module.hot) {
  module.hot.accept('./app', () => {
    const NextApp = require('./app');
    render(
      <AppContainer>
        <NextApp />
      </AppContainer>,
      document.getElementById('app')
    );
  });
}
