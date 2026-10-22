interface Props {
  message: string;
  onRetry?: () => void;
}

export default function ErrorState({ message, onRetry }: Props) {
  return (
    <div role="alert" className="card border-red-200 bg-red-50 px-6 py-8 text-center">
      <p className="font-semibold text-red-800">তথ্য লোড করা যায়নি</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-red-700">{message}</p>
      {onRetry && (
        <button type="button" className="btn btn-outline mt-4" onClick={onRetry}>
          আবার চেষ্টা করুন
        </button>
      )}
    </div>
  );
}
