import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  failed: boolean;
}

/** Last line of defence: shows a friendly Bengali message instead of a blank page. */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('UI error:', error.message, info.componentStack);
  }

  render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" className="container-page py-20 text-center">
        <h1 className="text-2xl font-bold text-slate-900">কিছু একটা সমস্যা হয়েছে</h1>
        <p className="mt-2 text-slate-600">পেজটি দেখাতে গিয়ে ত্রুটি হয়েছে। পেজটি রিফ্রেশ করে আবার চেষ্টা করুন।</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
            পেজ রিফ্রেশ করুন
          </button>
          <a href="/" className="btn btn-outline">হোমে ফিরে যান</a>
        </div>
      </div>
    );
  }
}
