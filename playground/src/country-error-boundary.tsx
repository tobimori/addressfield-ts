import { Component } from "react";
import type { ReactNode } from "react";

export class CountryErrorBoundary extends Component<{ children: ReactNode }> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override render() {
    if (this.state.failed) {
      return (
        <p role="alert" className="text-sm text-destructive">
          Could not load this country. Choose another country or reload the page.
        </p>
      );
    }

    return this.props.children;
  }
}
