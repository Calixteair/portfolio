import { Component, type ReactNode } from 'react';

interface Props {
  onError: (error: unknown) => void;
  children: ReactNode;
}

/** The renderer or a shader failed: hand over to the loader's classic version. */
export default class RenderErrorBoundary extends Component<Props, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override componentDidCatch(error: unknown) {
    this.props.onError(error);
  }

  override render() {
    return this.state.failed ? null : this.props.children;
  }
}
