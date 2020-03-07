import React from 'react';
import ReactMarkdown from 'react-markdown';
import openExternal from 'open-external';
import {cleanUp} from './utils';

interface ItemProps {
  dataTip?: any;
  dataPlace?: string;
  onValueClick?: React.MouseEventHandler;
  label?: string;
  className?: string;
  value?: NumberOrString | React.ReactElement;
  icon?: string;
  disabled?: boolean;
  border?: boolean;
}

class Item extends React.Component<ItemProps> {
  descriptionRef: HTMLElement;

  static defaultProps = {
    border: true,
  }

  constructor(props) {
    super(props);
  }
  handleDescClick = (e) => {
    e.preventDefault();
    openExternal(e.target.href);
  }
  componentDidMount() {
    if (this.props.label === 'Description') {
      setTimeout(() => {
        if (this.descriptionRef) {
          this.descriptionRef.addEventListener('click', this.handleDescClick);
        }
      }, 0);
    }
  }
  componentWillUnmount() {
    if (this.descriptionRef) {
      this.descriptionRef.removeEventListener('click', this.handleDescClick);
    }
    cleanUp(this);
  }
  getRef = (ref) => {
    this.descriptionRef = ref;
  }
  render(){
    let {label, value, icon, className, onValueClick, dataTip, disabled, border, children} = this.props;

    className = `Item__wrapperStyle${className ? ` ${className}` : ''}${onValueClick ? ' cursorPointer' : ''}`;

    if (disabled) className += ' Item__disabled';
    if (!border) className += ' Item__noBorder';

    if (label === 'Description') {
      return (
        <div
        ref={this.getRef}
        className={className}>
          <ReactMarkdown className="md-p" source={value as string} />
        </div>
      );
    }

    return (
      <div
      className={className}
      onClick={onValueClick}
      data-place="top"
      data-tip={dataTip}>
        <span className="Item__labelStyle">{`${label}`}</span>
          {label === 'Portal Address' ?
        <span className="Item__valueStyle Item__portal">
          {children}
        </span>
        :
        <span
        className="Item__valueStyle">
          {value ? value : icon ? <i className={`${icon} icon Item__icon`} /> : null}
        </span>}
      </div>
    );
  }
};

export default Item;