import React, {Fragment} from 'react';

import state from './state';
import {map} from '@jaszhix/utils';
import {ajaxWorker} from './utils';

interface SearchFieldProps {
  className: string;
  resultsClassName: string;
  resultClassName: string;
  value: string;
  placeholder: string;
  resultsPrefix: string;
  onChange: (value: string) => void
  onEnter: (e?) => void
}

interface SearchFieldState {
  results: string[];
}

class SearchField extends React.Component<SearchFieldProps, SearchFieldState> {
  constructor(props) {
    super(props);

    this.state = {
      results: []
    };
  }
  handleChange = (e) => {
    const {onChange, resultsPrefix} = this.props;
    let name = e.target.value;

    onChange(name);

    if (resultsPrefix) {
      if (name.indexOf(resultsPrefix) === -1) return;

      name = name.split(resultsPrefix)[1];
    }

    if (!name && !resultsPrefix) {
      this.setState({results: []})
      return;
    }

    ajaxWorker.get('/nmstag/', {params: {name}}).then((res) => {
      this.setState({results: res.data});
    });
  }
  handleResultClick = (value) => {
    const {resultsPrefix, onChange, onEnter} = this.props;

    onChange(`${resultsPrefix}${value}`);

    this.setState({results: []}, onEnter);
  }
  handleEnter = (e) => {
    if (e.keyCode === 13) this.setState({results: []}, () => this.props.onEnter(e));
  }
  render() {
    const {value, placeholder, className, resultsClassName, resultClassName} = this.props;
    const {results} = this.state;

    return (
      <Fragment>
        <input
        className={className}
        type="text"
        value={value}
        onChange={this.handleChange}
        onKeyDown={this.handleEnter}
        maxLength={30}
        placeholder={placeholder} />
        {results.length ?
        <div className={resultsClassName}>
          {map(results, (result) => {
          return (
            <div
            key={result}
            className={resultClassName}
            onClick={() => this.handleResultClick(result)}>
              {result}
            </div>
          )
        })}
        </div> : null}
      </Fragment>

    )
  }
}

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
  setValue = (search) => {
    this.setState({search}, () => {
      if (search.length === 0 && state.searchInProgress) {
        state.set({search}, () => this.props.onClick(null));
      }
    });
  }
  handleEnter = (e) => {
    state.set({search: this.state.search}, () => this.props.onKeyDown(e));
  }
  handleSearchIconClick = () => {
    if (state.searchInProgress) this.setState({search: ''});
    state.set({search: this.state.search}, () => this.props.onClick(null));
  }
  render() {
    return (
      <div className="item">
        <div
        className="ui transparent icon input iconTransparent">
          <SearchField
          className="Search__input"
          resultsClassName="Search__resultsContainer"
          resultClassName="Search__item"
          placeholder="Search..."
          value={this.state.search || this.props.search}
          resultsPrefix="tag:"
          onChange={this.setValue}
          onEnter={this.handleEnter} />
          <i
          className={`cursorDefaultIcon ${state.searchInProgress ? 'remove link icon' : 'search link icon'}`}
          onClick={this.handleSearchIconClick} />
        </div>
      </div>
    );
  }
}

export {
  SearchField,
  Search
};
