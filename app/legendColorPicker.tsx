import state from './state';
import React from 'react';
import onClickOutside from 'react-onclickoutside';
import {Panel as ColorPickerPanel} from 'rc-color-picker';
import v from 'vquery';
import {find} from '@jaszhix/utils';

import {BasicDropdown} from './dropdowns';
import Button from './buttons';
import {generateHexColor} from './utils';
import {showDefault, shapeOptions} from './constants';

interface LegendColorPickerProps {
  name: string;
  show: any;
  height: number;
}

interface LegendColorPickerState {
  top: number;
}

class LegendColorPicker extends React.Component<LegendColorPickerProps, LegendColorPickerState> {
  ref: any;
  connectId: number;

  constructor(props) {
    super(props);

    this.state = {
      top: 0,
    };
  }

  componentDidMount() {
    this.connectId = state.connect({
      width: () => {
        if (!this.ref) return;

        this.handleRef(this.ref)
      }
    })
  }

  componentWillUnmount() {
    state.disconnect()
  }

  handleRef = (ref) => {
    if (!ref) return;

    this.ref = ref;

    const {name} = this.props;
    let legendEl = v(`.${name}`).n;

    if (!legendEl) return;

    let {left, top} = legendEl.getBoundingClientRect();

    ref.style.top = `${top - ref.clientHeight - legendEl.clientHeight}px`;
    ref.style.left = `${left - (ref.clientWidth / 2)}px`;

    this.setState({top});
  }

  onChange = (e) => {
    const {name, show} = this.props;

    show[name].color = e.color;

    state.set({show}, true);
  }

  handleClickOutside = () => state.set({displayColorPicker: false})

  handleReset = () => {
    const {name, show} = this.props;

    if (showDefault[name]) {
      show[name].color = showDefault[name].color;
    } else {
      show[name].color = generateHexColor();
    }

    show[name].shape = 'circle';

    state.set({show}, true);
  }

  handleShapeSelect = (shape) => {
    const {name, show} = this.props;

    show[name].shape = shape;

    state.set({show}, true);
  }

  render() {
    const {name, show} = this.props;

    return (
      <div
      ref={this.handleRef}
      className="LegendColorPicker__container">
        <ColorPickerPanel enableAlpha={false} color={show[name].color} onChange={this.onChange} mode="RGB" />
        <BasicDropdown
        className="LegendColorPicker__shapeSelect"
        maxHeight={110}
        showValue={true}
        value={`Shape: ${find(shapeOptions, (option) => option.id === show[name].shape).label}`}
        options={shapeOptions}
        onOptionClick={this.handleShapeSelect}
        isGalaxies={false} />
        <Button className="LegendColorPicker__resetButton" onClick={this.handleReset}>Reset</Button>
      </div>
    );
  }
}
// @ts-ignore
LegendColorPicker = onClickOutside(LegendColorPicker)

export default LegendColorPicker;