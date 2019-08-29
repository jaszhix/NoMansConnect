import React from 'react';
import state from './state';

interface ErrorBoundaryProps {
  onError?: (e: Error) => void
}
interface ErrorBoundaryState {
  error: Error,
  eventId: any;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  willUnmount: boolean;

  constructor(props) {
    super(props);

    this.state = {
      error: null,
      eventId: null
    };
  }

  componentDidCatch(error, errorInfo) {
    const {onError} = this.props;

    this.setState({error});

    import(/* webpackChunkName: "sentry" */ '@sentry/browser').then((Sentry) => {
      Sentry.withScope((scope) => {
        scope.setExtras(errorInfo);

        if (this.willUnmount) {
          Sentry.captureException(error);
          return;
        }

        this.setState({eventId: Sentry.captureException(error)}, () => {
          if (typeof onError === 'function') this.callbackOnError();
        });
      });
    }).catch(() => this.callbackOnError());
  }

  componentWillUnmount() {
    this.willUnmount = true;
  }

  callbackOnError = () => {
    const {eventId} = this.state;
    const {onError} = this.props;

    state.set({
      notification: {
        message: `An error occurred during rendering. Click to add more details about this incident.${eventId ? '\nEvent ID: ' + eventId : ''}`,
        type: 'error',
        onClick: () => this.handleClick()
      }
    }, onError, true);
  }

  handleClick = () => {
    import(/* webpackChunkName: "sentry" */ '@sentry/browser').then((Sentry) => {
      Sentry.showReportDialog({eventId: this.state.eventId});
    });
  }

  render() {
    if (this.state.error) return null;

    return this.props.children;
  }
}

export default ErrorBoundary;
