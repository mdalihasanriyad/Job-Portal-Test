import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface Props {
  initialValue?: string;
  autoFocus?: boolean;
}

export default function SearchBar({ initialValue = '', autoFocus = false }: Props) {
  const [value, setValue] = useState(initialValue);
  const navigate = useNavigate();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = value.trim().slice(0, 100);
    navigate(query ? `/search?q=${encodeURIComponent(query)}` : '/search');
  }

  return (
    <form onSubmit={handleSubmit} role="search" className="flex w-full gap-2">
      <label htmlFor="site-search" className="sr-only">
        চাকরি খুঁজুন
      </label>
      <input
        id="site-search"
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        maxLength={100}
        autoFocus={autoFocus}
        placeholder="পদের নাম বা প্রতিষ্ঠানের নাম লিখুন"
        className="input"
      />
      <button type="submit" className="btn btn-primary shrink-0">
        খুঁজুন
      </button>
    </form>
  );
}
