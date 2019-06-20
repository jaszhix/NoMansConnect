import state from './state';
import React from 'react';

const transparentIconInputStyle: CSSProperties = {
  width: '250px',
  WebkitUserSelect: 'initial',
  WebkitAppRegion: 'no-drag',
  fontSize: '15px'
};
const searchIconStyle: CSSProperties = {
  cursor: 'default',
  padding: '0px'
};
const letterSpacingStyle: CSSProperties = {
  letterSpacing: '2px'
};

interface SearchProps {
  search: string;
  onClick: React.MouseEventHandler;
  onKeyDown: React.KeyboardEventHandler;
}

interface SearchState {
  search: string;
}

class Search extends React.Component<SearchProps, SearchState> {
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
        state.set({search}, () => this.props.onClick(null));
      }
    });
  }
  handleEnter = (e) => {
    if (e.keyCode === 13) {
      state.set({search: this.state.search}, () => this.props.onKeyDown(e));
    }
  }
  handleSearchIconClick = () => {
    state.set({search: this.state.search}, () => this.props.onClick(null));
  }
  render() {
    return (
      <div className="item">
        <div
        className="ui transparent icon input"
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