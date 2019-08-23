import React, {Fragment} from 'react';
import {map, each, filter, findIndex} from '@jaszhix/utils';
import {uniqBy} from 'lodash';

import state from './state';
import {ajaxWorker} from './utils';

const resultHeight = 22;

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
  selectedResult: number;
}

class SearchField extends React.Component<SearchFieldProps, SearchFieldState> {
  connectId: number;
  resultsRef: any;
  height: number;

  constructor(props) {
    super(props);

    this.state = {
      results: [],
      selectedResult: -1,
    };
  }
  componentDidMount() {
    this.connectId = state.connect({
      clearTagResults: () => this.setState({results: []})
    });
  }
  componentWillUnmount() {
    if (this.resultsRef) this.resultsRef.removeEventListener('resize', this.handleResize);
    state.disconnect(this.connectId);
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
  handleKeyDown = (e) => {
    let {results, selectedResult} = this.state;

    switch (e.keyCode) {
      case 13: // Enter
        if (selectedResult > -1) {
          this.handleResultClick(results[selectedResult]);
        } else {
          this.setState({results: []}, () => this.props.onEnter(e));
        }
        break;
      case 38: // Up
        selectedResult -= 1;

        if (selectedResult < 0) selectedResult = results.length - 1;

        this.setState({selectedResult}, () => {
          if (!this.resultsRef) return;

          this.resultsRef.scrollTo(0, selectedResult * resultHeight);
        });
        break;
      case 40: // Down
        selectedResult += 1;

        if (selectedResult > results.length - 1) selectedResult = 0;

        this.setState({selectedResult}, () => {
          if (!this.resultsRef) return;

          let visibleCount = Math.floor(this.height / resultHeight);

          if (selectedResult % visibleCount === 0) {
            this.resultsRef.scrollTo(0, selectedResult * resultHeight);
          }
        });
        break;
    }
  }
  handleResize = () => {
    this.height = this.resultsRef.clientHeight;
  }
  getResultsRef = (ref) => {
    if (!ref) return;

    this.resultsRef = ref;
    this.height = ref.clientHeight;
    ref.addEventListener('resize', this.handleResize);
  }
  render() {
    const {value, placeholder, className, resultsClassName, resultClassName} = this.props;
    const {results, selectedResult} = this.state;

    return (
      <Fragment>
        <input
        className={className}
        type="text"
        value={value}
        onChange={this.handleChange}
        onKeyDown={this.handleKeyDown}
        maxLength={30}
        placeholder={placeholder} />
        {results.length ?
        <div
        ref={this.getResultsRef}
        className={resultsClassName}
        onMouseLeave={() => this.setState({selectedResult: -1})}>
          {map(results, (result, i) => {
          return (
            <div
            key={result}
            className={`${resultClassName}${selectedResult === i ? ' SearchField__selected' : ''}`}
            onMouseEnter={() => this.setState({selectedResult: i})}
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

interface SearchState {}

class Search extends React.Component<SearchProps, SearchState> {
  connectId: number;

  constructor(props) {
    super(props);
  }
  componentDidMount() {
    this.connectId = state.connect({
      handleSearch: () => this.handleSearch(),
      handleClearSearch: () => this.handleClearSearch(),
    })
  }
  componentWillUnmount() {
    state.disconnect(this.connectId);
  }
  setValue = (search) => {
    if (search.length === 0) {
      state.trigger('clearTagResults');
      this.handleClearSearch();
    }

    state.set({search});
  }
  handleSearch = () => {
    const {offline, remoteLocations, search} = state;

    if (offline) {
      let results = filter(remoteLocations.results, (location) => {
        return (location.dataId === search
          || location.translatedId === search
          || location.username === search
          || location.name.indexOf(search) > -1
          || location.description.indexOf(search) > -1)
      });

      state.set({
        searchInProgress: true,
        searchCache: {
          results,
          count: results.length,
          next: null,
          prev: null
        }
      });
    } else {
      state.trigger('fetchRemoteLocations');
    }
  }
  handleClearSearch = () => {
    const {offline, searchCache, remoteLocations} = state;

    if (!offline) {
      let diff = [];
      each(searchCache.results, (location) => {
        let refRemoteLocation = findIndex(remoteLocations.results, _location => _location.dataId === location.dataId);
        if (refRemoteLocation === -1) {
          diff.push(location);
        }
      });
      remoteLocations.results = remoteLocations.results.concat(uniqBy(diff, (location) => {
        return location.dataId;
      }));
    }

    state.set({
      search: '',
      searchCache: {
        results: [],
        count: 0,
        next: null,
        prev: null
      },
      searchInProgress: false,
      sort: '-created'
    });

    window.jsonWorker.postMessage({
      method: 'set',
      key: 'remoteLocations',
      value: remoteLocations,
    });
  }
  handleSearchIconClick = () => {
    let {search} = this.props;

    if (state.searchInProgress) search = '';

    state.set({search}, () => {
      if (state.searchInProgress) {
        this.handleClearSearch();
      } else {
        this.handleSearch();
      }
    });
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
          value={this.props.search}
          resultsPrefix="tag:"
          onChange={this.setValue}
          onEnter={this.handleSearch} />
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
