import state from './state';
import React from 'react';

import * as utils from './utils';
window.utils = utils

const transparentIconInputStyle = {
  width: '250px',
  WebkitUserSelect: 'initial',
  WebkitAppRegion: 'no-drag',
  fontSize: '15px'
};
const searchIconStyle = {
  cursor: 'default',
  padding: '0px'
};
const letterSpacingStyle = {
  letterSpacing: '2px'
};

class Search extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      search: ''
    }
  }
  setValue = (e) => {
    let search = e.target.value;
    this.setState({search}, () => {
      if (search.length === 0 && state.searchInProgress) {
        state.set({search}, () => this.props.onClick());
      }
    });
  }
  handleEnter = (e) => {
    if (e.keyCode === 13) {
      state.set({search: this.state.search}, () => this.props.onKeyDown(e));
    }
  }
  handleSearchIconClick = () => {
    state.set({search: this.state.search}, () => this.props.onClick());
  }
  render() {
    return (
      <div className="item">
        <div
        className={`ui transparent icon input${this.props.navLoad ? ' disabled' : ''}`}
        style={transparentIconInputStyle}>
          <input
          type="text"
          style={letterSpacingStyle}
          placeholder="Search..."
          value={this.state.search || this.props.search}
          onChange={this.setValue}
          onKeyDown={this.handleEnter} />
          <i
          className={state.searchInProgress ? 'remove link icon' : 'search link icon'}
          style={searchIconStyle}
          onClick={this.handleSearchIconClick} />
        </div>
      </div>
    );
  }
}

export default Search;